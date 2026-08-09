-- RC-2.9.0: Paid event registration and event-payment evidence.
-- Extends the existing events + event_attendances architecture. Payments are
-- tracked separately from contributions so event fees never become donations.

alter table public.events
  add column if not exists registration_required boolean not null default false,
  add column if not exists registration_type text not null default 'free',
  add column if not exists registration_fee numeric(12,2) not null default 0,
  add column if not exists registration_currency text not null default 'TZS',
  add column if not exists registration_deadline timestamptz,
  add column if not exists registration_capacity integer,
  add column if not exists payment_required_for_confirmation boolean not null default false;

alter table public.events
  drop constraint if exists events_registration_type_check,
  add constraint events_registration_type_check
    check (registration_type in ('free', 'paid')),
  drop constraint if exists events_registration_fee_check,
  add constraint events_registration_fee_check
    check (registration_fee >= 0),
  drop constraint if exists events_registration_capacity_check,
  add constraint events_registration_capacity_check
    check (registration_capacity is null or registration_capacity > 0),
  drop constraint if exists events_paid_registration_amount_check,
  add constraint events_paid_registration_amount_check
    check (
      (registration_type = 'free' and registration_fee = 0)
      or (registration_type = 'paid' and registration_fee > 0)
    );

alter table public.event_attendances
  add column if not exists registration_status text not null default 'registered',
  add column if not exists payment_status text not null default 'not_required',
  add column if not exists amount_due numeric(12,2) not null default 0,
  add column if not exists currency text not null default 'TZS',
  add column if not exists registered_at timestamptz not null default now(),
  add column if not exists confirmed_at timestamptz,
  add column if not exists cancelled_at timestamptz;

alter table public.event_attendances
  drop constraint if exists event_attendances_registration_status_check,
  add constraint event_attendances_registration_status_check
    check (registration_status in ('registered', 'payment_pending', 'payment_submitted', 'confirmed', 'cancelled', 'refunded')),
  drop constraint if exists event_attendances_payment_status_check,
  add constraint event_attendances_payment_status_check
    check (payment_status in ('not_required', 'pending', 'submitted', 'paid', 'failed', 'refunded')),
  drop constraint if exists event_attendances_amount_due_check,
  add constraint event_attendances_amount_due_check
    check (amount_due >= 0);

create table if not exists public.event_registration_payments (
  id uuid primary key default gen_random_uuid(),
  church_id uuid not null references public.churches(id) on delete cascade,
  event_id uuid not null references public.events(id) on delete cascade,
  attendance_id uuid not null references public.event_attendances(id) on delete cascade,
  member_id uuid not null references public.members(id) on delete cascade,
  amount numeric(12,2) not null check (amount > 0),
  currency text not null default 'TZS',
  payment_method text not null,
  transaction_reference text,
  proof_url text,
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected', 'refunded')),
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  review_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint event_registration_payments_evidence_check
    check (nullif(trim(coalesce(transaction_reference, '')), '') is not null or nullif(trim(coalesce(proof_url, '')), '') is not null)
);

create index if not exists idx_events_church_registration
  on public.events (church_id, registration_required, registration_type);

create index if not exists idx_event_attendances_registration
  on public.event_attendances (event_id, registration_status, payment_status);

create index if not exists idx_event_registration_payments_event
  on public.event_registration_payments (event_id, status, created_at desc);

create unique index if not exists event_registration_payments_transaction_unique
  on public.event_registration_payments (lower(trim(transaction_reference)))
  where transaction_reference is not null;

drop trigger if exists update_event_registration_payments_updated_at on public.event_registration_payments;
create trigger update_event_registration_payments_updated_at
before update on public.event_registration_payments
for each row execute function public.update_updated_at_column();

alter table public.event_registration_payments enable row level security;

drop policy if exists "Members can view own event registration payments" on public.event_registration_payments;
create policy "Members can view own event registration payments"
on public.event_registration_payments
for select
to authenticated
using (
  exists (
    select 1
    from public.members m
    where m.id = event_registration_payments.member_id
      and m.church_id = event_registration_payments.church_id
      and (
        m.user_id = auth.uid()
        or lower(coalesce(m.email, '')) = lower(coalesce(auth.jwt() ->> 'email', ''))
      )
  )
);

drop policy if exists "Church managers manage event registration payments" on public.event_registration_payments;
create policy "Church managers manage event registration payments"
on public.event_registration_payments
for all
to authenticated
using (
  public.can_manage_church_roles(auth.uid(), church_id)
  or public.can_manage_church_workspace(auth.uid(), church_id)
  or public.is_platform_super_admin(auth.uid())
  or public.is_super_admin(auth.uid())
)
with check (
  public.can_manage_church_roles(auth.uid(), church_id)
  or public.can_manage_church_workspace(auth.uid(), church_id)
  or public.is_platform_super_admin(auth.uid())
  or public.is_super_admin(auth.uid())
);

create or replace function public.register_for_event(_event_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event public.events%rowtype;
  v_member public.members%rowtype;
  v_existing public.event_attendances%rowtype;
  v_registered_count integer;
  v_registration_status text;
  v_payment_status text;
  v_confirmed_at timestamptz;
begin
  if auth.uid() is null then
    return jsonb_build_object('success', false, 'error', 'Authentication required.');
  end if;

  if _event_id is null then
    return jsonb_build_object('success', false, 'error', 'Event is required.');
  end if;

  select * into v_event
  from public.events
  where id = _event_id
    and archived_at is null
  for update;

  if v_event.id is null then
    return jsonb_build_object('success', false, 'error', 'Event was not found.');
  end if;

  if not public.can_view_event(auth.uid(), v_event.id) then
    return jsonb_build_object('success', false, 'error', 'You are not authorized to register for this event.');
  end if;

  if coalesce(v_event.status, 'upcoming') = 'cancelled' then
    return jsonb_build_object('success', false, 'error', 'This event is cancelled.');
  end if;

  if v_event.registration_deadline is not null and now() > v_event.registration_deadline then
    return jsonb_build_object('success', false, 'error', 'Registration deadline has passed.');
  end if;

  select * into v_member
  from public.members m
  where m.church_id = v_event.church_id
    and coalesce(m.status, 'active') = 'active'
    and (
      m.user_id = auth.uid()
      or lower(coalesce(m.email, '')) = lower(coalesce(auth.jwt() ->> 'email', ''))
    )
  order by case when m.user_id = auth.uid() then 0 else 1 end
  limit 1;

  if v_member.id is null then
    return jsonb_build_object('success', false, 'error', 'Member profile is required before registering.');
  end if;

  select * into v_existing
  from public.event_attendances
  where event_id = v_event.id
    and member_id = v_member.id
  for update;

  if v_existing.id is null and v_event.registration_capacity is not null then
    select count(*) into v_registered_count
    from public.event_attendances ea
    where ea.event_id = v_event.id
      and ea.registration_status in ('registered', 'payment_pending', 'payment_submitted', 'confirmed');

    if v_registered_count >= v_event.registration_capacity then
      return jsonb_build_object('success', false, 'error', 'Registration is full.');
    end if;
  end if;

  if coalesce(v_event.registration_type, 'free') = 'paid' then
    v_registration_status := 'payment_pending';
    v_payment_status := 'pending';
    v_confirmed_at := null;
  else
    v_registration_status := 'confirmed';
    v_payment_status := 'not_required';
    v_confirmed_at := now();
  end if;

  insert into public.event_attendances (
    church_id,
    event_id,
    member_id,
    response,
    responded_at,
    registration_status,
    payment_status,
    amount_due,
    currency,
    registered_at,
    confirmed_at,
    cancelled_at
  )
  values (
    v_event.church_id,
    v_event.id,
    v_member.id,
    'yes',
    now(),
    v_registration_status,
    v_payment_status,
    case when coalesce(v_event.registration_type, 'free') = 'paid' then v_event.registration_fee else 0 end,
    coalesce(nullif(trim(v_event.registration_currency), ''), 'TZS'),
    now(),
    v_confirmed_at,
    null
  )
  on conflict (event_id, member_id) do update
    set response = 'yes',
        responded_at = now(),
        registration_status = case
          when event_attendances.registration_status = 'cancelled' then excluded.registration_status
          else event_attendances.registration_status
        end,
        payment_status = case
          when event_attendances.payment_status = 'not_required' then excluded.payment_status
          else event_attendances.payment_status
        end,
        amount_due = excluded.amount_due,
        currency = excluded.currency,
        cancelled_at = null
  returning * into v_existing;

  return jsonb_build_object(
    'success', true,
    'attendance_id', v_existing.id,
    'event_id', v_event.id,
    'member_id', v_member.id,
    'registration_status', v_existing.registration_status,
    'payment_status', v_existing.payment_status,
    'amount_due', v_existing.amount_due,
    'currency', v_existing.currency
  );
end;
$$;

create or replace function public.submit_event_registration_payment(
  _attendance_id uuid,
  _payment_method text,
  _transaction_reference text default null,
  _proof_url text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_attendance public.event_attendances%rowtype;
  v_event public.events%rowtype;
  v_payment_id uuid;
  v_transaction_reference text := nullif(trim(coalesce(_transaction_reference, '')), '');
  v_proof_url text := nullif(trim(coalesce(_proof_url, '')), '');
begin
  if auth.uid() is null then
    return jsonb_build_object('success', false, 'error', 'Authentication required.');
  end if;

  if _attendance_id is null or nullif(trim(coalesce(_payment_method, '')), '') is null then
    return jsonb_build_object('success', false, 'error', 'Payment details are required.');
  end if;

  if v_transaction_reference is null and v_proof_url is null then
    return jsonb_build_object('success', false, 'error', 'Provide a transaction reference or payment proof.');
  end if;

  if v_transaction_reference is not null and v_transaction_reference !~ '^[A-Za-z0-9._-]{4,120}$' then
    return jsonb_build_object('success', false, 'error', 'Enter a valid transaction reference.');
  end if;

  select * into v_attendance
  from public.event_attendances
  where id = _attendance_id
  for update;

  if v_attendance.id is null then
    return jsonb_build_object('success', false, 'error', 'Registration was not found.');
  end if;

  if not exists (
    select 1
    from public.members m
    where m.id = v_attendance.member_id
      and m.church_id = v_attendance.church_id
      and (
        m.user_id = auth.uid()
        or lower(coalesce(m.email, '')) = lower(coalesce(auth.jwt() ->> 'email', ''))
      )
  ) then
    return jsonb_build_object('success', false, 'error', 'You can only submit payment for your own registration.');
  end if;

  select * into v_event
  from public.events
  where id = v_attendance.event_id;

  if coalesce(v_event.registration_type, 'free') <> 'paid' or v_attendance.amount_due <= 0 then
    return jsonb_build_object('success', false, 'error', 'This registration does not require payment.');
  end if;

  if v_attendance.payment_status = 'paid' then
    return jsonb_build_object('success', false, 'error', 'This registration is already paid.');
  end if;

  if v_transaction_reference is not null and exists (
    select 1
    from public.event_registration_payments p
    where lower(trim(p.transaction_reference)) = lower(v_transaction_reference)
  ) then
    return jsonb_build_object('success', false, 'error', 'This transaction reference has already been submitted.');
  end if;

  insert into public.event_registration_payments (
    church_id,
    event_id,
    attendance_id,
    member_id,
    amount,
    currency,
    payment_method,
    transaction_reference,
    proof_url,
    status
  )
  values (
    v_attendance.church_id,
    v_attendance.event_id,
    v_attendance.id,
    v_attendance.member_id,
    v_attendance.amount_due,
    v_attendance.currency,
    trim(_payment_method),
    v_transaction_reference,
    v_proof_url,
    'pending'
  )
  returning id into v_payment_id;

  update public.event_attendances
  set registration_status = 'payment_submitted',
      payment_status = 'submitted'
  where id = v_attendance.id;

  return jsonb_build_object('success', true, 'payment_id', v_payment_id, 'status', 'pending');
end;
$$;

create or replace function public.review_event_registration_payment(
  _payment_id uuid,
  _approve boolean,
  _reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_payment public.event_registration_payments%rowtype;
begin
  if auth.uid() is null then
    return jsonb_build_object('success', false, 'error', 'Authentication required.');
  end if;

  select * into v_payment
  from public.event_registration_payments
  where id = _payment_id
  for update;

  if v_payment.id is null then
    return jsonb_build_object('success', false, 'error', 'Payment was not found.');
  end if;

  if not (
    public.can_manage_church_roles(auth.uid(), v_payment.church_id)
    or public.can_manage_church_workspace(auth.uid(), v_payment.church_id)
    or public.is_platform_super_admin(auth.uid())
    or public.is_super_admin(auth.uid())
  ) then
    return jsonb_build_object('success', false, 'error', 'You are not authorized to review this payment.');
  end if;

  if v_payment.status <> 'pending' then
    return jsonb_build_object('success', false, 'error', 'This payment has already been reviewed.');
  end if;

  update public.event_registration_payments
  set status = case when _approve then 'approved' else 'rejected' end,
      reviewed_by = auth.uid(),
      reviewed_at = now(),
      review_reason = nullif(trim(coalesce(_reason, '')), '')
  where id = v_payment.id;

  update public.event_attendances
  set registration_status = case when _approve then 'confirmed' else 'payment_pending' end,
      payment_status = case when _approve then 'paid' else 'failed' end,
      confirmed_at = case when _approve then now() else confirmed_at end
  where id = v_payment.attendance_id;

  return jsonb_build_object(
    'success', true,
    'payment_id', v_payment.id,
    'status', case when _approve then 'approved' else 'rejected' end
  );
end;
$$;

grant execute on function public.register_for_event(uuid) to authenticated;
grant execute on function public.submit_event_registration_payment(uuid, text, text, text) to authenticated;
grant execute on function public.review_event_registration_payment(uuid, boolean, text) to authenticated;
grant select, insert, update, delete on public.event_registration_payments to authenticated;

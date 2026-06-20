-- Payment and permission audit hardening.
-- This migration tightens new payment submissions without deleting or rewriting existing records.

do $$
begin
  if not exists (
    select 1 from pg_indexes
    where schemaname = 'public'
      and indexname = 'subscription_payments_payment_reference_unique_idx'
  ) then
    if not exists (
      select lower(btrim(payment_reference)) as normalized_reference
      from public.subscription_payments
      where nullif(btrim(payment_reference), '') is not null
      group by lower(btrim(payment_reference))
      having count(*) > 1
    ) then
      create unique index subscription_payments_payment_reference_unique_idx
        on public.subscription_payments (lower(btrim(payment_reference)))
        where nullif(btrim(payment_reference), '') is not null;
    else
      raise warning 'Skipped subscription payment reference unique index because duplicate references already exist.';
    end if;
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1 from pg_indexes
    where schemaname = 'public'
      and indexname = 'member_record_subscriptions_transaction_unique_idx'
  ) then
    if not exists (
      select lower(btrim(transaction_id)) as normalized_transaction_id
      from public.member_record_subscriptions
      where nullif(btrim(transaction_id), '') is not null
      group by lower(btrim(transaction_id))
      having count(*) > 1
    ) then
      create unique index member_record_subscriptions_transaction_unique_idx
        on public.member_record_subscriptions (lower(btrim(transaction_id)))
        where nullif(btrim(transaction_id), '') is not null;
    else
      raise warning 'Skipped record preservation transaction unique index because duplicate transaction IDs already exist.';
    end if;
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1 from pg_indexes
    where schemaname = 'public'
      and indexname = 'contributions_church_payment_reference_unique_idx'
  ) then
    if not exists (
      select church_id, lower(btrim(payment_reference)) as normalized_reference
      from public.contributions
      where nullif(btrim(payment_reference), '') is not null
      group by church_id, lower(btrim(payment_reference))
      having count(*) > 1
    ) then
      create unique index contributions_church_payment_reference_unique_idx
        on public.contributions (church_id, lower(btrim(payment_reference)))
        where nullif(btrim(payment_reference), '') is not null;
    else
      raise warning 'Skipped contribution payment reference unique index because duplicate references already exist.';
    end if;
  end if;
end;
$$;

alter table public.member_record_subscriptions
  drop constraint if exists member_record_subscriptions_transaction_id_format_check;

alter table public.member_record_subscriptions
  add constraint member_record_subscriptions_transaction_id_format_check
  check (
    transaction_id is null
    or btrim(transaction_id) ~ '^[A-Za-z0-9._-]{4,80}$'
  )
  not valid;

alter table public.subscription_payments
  drop constraint if exists subscription_payments_reference_format_check;

alter table public.subscription_payments
  add constraint subscription_payments_reference_format_check
  check (btrim(payment_reference) ~ '^[A-Za-z0-9._-]{4,80}$')
  not valid;

drop policy if exists "Members can submit own record preservation subscriptions" on public.member_record_subscriptions;
drop policy if exists "Members cannot directly insert record preservation subscriptions" on public.member_record_subscriptions;
create policy "Members cannot directly insert record preservation subscriptions"
on public.member_record_subscriptions
for insert
to authenticated
with check (false);

create or replace function public.submit_member_record_subscription(
  p_church_id uuid,
  p_member_id uuid,
  p_plan_interval text,
  p_transaction_id text,
  p_proof_url text default null
)
returns public.member_record_subscriptions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_amount numeric;
  v_transaction_id text := nullif(btrim(coalesce(p_transaction_id, '')), '');
  v_subscription public.member_record_subscriptions%rowtype;
begin
  if auth.uid() is null then
    raise exception 'Authentication required.';
  end if;

  if not exists (
    select 1
    from public.members m
    where m.id = p_member_id
      and m.church_id = p_church_id
      and m.user_id = auth.uid()
  ) then
    raise exception 'You can only submit preservation payments for your own member profile.';
  end if;

  v_amount := case p_plan_interval
    when 'monthly' then 3000
    when 'yearly' then 30000
    else null
  end;

  if v_amount is null then
    raise exception 'Choose a valid preservation plan.';
  end if;

  if v_transaction_id is null or v_transaction_id !~ '^[A-Za-z0-9._-]{4,80}$' then
    raise exception 'Enter a valid transaction ID.';
  end if;

  if p_proof_url is not null
    and p_proof_url not like p_church_id::text || '/' || p_member_id::text || '/%' then
    raise exception 'Invalid payment proof path.';
  end if;

  if exists (
    select 1
    from public.member_record_subscriptions s
    where lower(btrim(s.transaction_id)) = lower(v_transaction_id)
  ) then
    raise exception 'This transaction ID has already been submitted.';
  end if;

  insert into public.member_record_subscriptions (
    church_id,
    member_id,
    amount,
    plan_interval,
    status,
    transaction_id,
    proof_url
  )
  values (
    p_church_id,
    p_member_id,
    v_amount,
    p_plan_interval,
    'pending',
    v_transaction_id,
    p_proof_url
  )
  returning * into v_subscription;

  return v_subscription;
end;
$$;

revoke all on function public.submit_member_record_subscription(uuid, uuid, text, text, text) from public;
grant execute on function public.submit_member_record_subscription(uuid, uuid, text, text, text) to authenticated;

create or replace function public.submit_subscription_payment(
  _church_id uuid,
  _plan text,
  _payment_reference text,
  _payer_phone text default null,
  _receipt_url text default null
)
returns public.subscription_payments
language plpgsql
security definer
set search_path = public
as $$
declare
  _amount numeric;
  _payment public.subscription_payments%rowtype;
  _reference text := nullif(btrim(coalesce(_payment_reference, '')), '');
begin
  if not public.can_manage_church_workspace(auth.uid(), _church_id) then
    raise exception 'Only workspace managers can submit a subscription payment.';
  end if;

  _amount := case _plan
    when 'basic' then 50000
    when 'intermediate' then 80000
    when 'pro' then 120000
    when 'enterprise' then 150000
    else null
  end;

  if _amount is null then
    raise exception 'Select a paid subscription plan.';
  end if;

  if _reference is null then
    raise exception 'Enter the mobile-money transaction reference.';
  end if;

  if _reference !~ '^[A-Za-z0-9._-]{4,80}$' then
    raise exception 'Enter a valid transaction reference.';
  end if;

  if _receipt_url is not null
    and _receipt_url not like _church_id::text || '/%' then
    raise exception 'Invalid receipt upload path.';
  end if;

  if exists (
    select 1 from public.subscription_payments p
    where p.church_id = _church_id and p.status = 'pending'
  ) then
    raise exception 'This workspace already has a payment awaiting verification.';
  end if;

  if exists (
    select 1
    from public.subscription_payments p
    where lower(btrim(p.payment_reference)) = lower(_reference)
  ) then
    raise exception 'This transaction reference has already been submitted.';
  end if;

  insert into public.subscription_payments (
    church_id,
    requested_by,
    plan,
    amount,
    payment_reference,
    payer_phone,
    receipt_url
  )
  values (
    _church_id,
    auth.uid(),
    _plan,
    _amount,
    _reference,
    nullif(btrim(coalesce(_payer_phone, '')), ''),
    _receipt_url
  )
  returning * into _payment;

  return _payment;
end;
$$;

revoke all on function public.submit_subscription_payment(uuid, text, text, text, text) from public;
grant execute on function public.submit_subscription_payment(uuid, text, text, text, text) to authenticated;

create or replace function public.submit_public_contribution(
  p_church_slug_or_id text,
  p_contribution_type text,
  p_amount numeric,
  p_donor_name text,
  p_phone text,
  p_note text default null,
  p_transaction_id text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_church_id uuid;
  v_category_id uuid;
  v_type text := nullif(btrim(coalesce(p_contribution_type, '')), '');
  v_donor_name text := nullif(btrim(coalesce(p_donor_name, '')), '');
  v_phone text := regexp_replace(coalesce(p_phone, ''), '\s+', '', 'g');
  v_note text := nullif(btrim(coalesce(p_note, '')), '');
  v_transaction_id text := nullif(btrim(coalesce(p_transaction_id, '')), '');
  v_contribution_id uuid;
begin
  select church.id
  into v_church_id
  from public.get_public_giving_church(p_church_slug_or_id) as church
  limit 1;

  if v_church_id is null then
    return jsonb_build_object('success', false, 'error', 'Church not found.');
  end if;

  if v_type is null or v_type not in ('Sadaka', 'Zaka', 'Jengo', 'Shukrani', 'Special Contribution') then
    return jsonb_build_object('success', false, 'error', 'Choose a valid contribution type.');
  end if;

  if p_amount is null or p_amount <= 0 then
    return jsonb_build_object('success', false, 'error', 'Amount must be greater than zero.');
  end if;

  if v_donor_name is null or length(v_donor_name) < 2 then
    return jsonb_build_object('success', false, 'error', 'Member name is required.');
  end if;

  if v_phone !~ '^\+?[0-9]{9,15}$' then
    return jsonb_build_object('success', false, 'error', 'Enter a valid phone number.');
  end if;

  if v_transaction_id is not null and v_transaction_id !~ '^[A-Za-z0-9._-]{4,80}$' then
    return jsonb_build_object('success', false, 'error', 'Enter a valid transaction ID.');
  end if;

  if v_transaction_id is not null and exists (
    select 1
    from public.contributions c
    where c.church_id = v_church_id
      and lower(btrim(c.payment_reference)) = lower(v_transaction_id)
  ) then
    return jsonb_build_object('success', false, 'error', 'This transaction ID has already been submitted for this church.');
  end if;

  select cc.id
  into v_category_id
  from public.contribution_categories cc
  where cc.church_id = v_church_id
    and lower(cc.name) = lower(
      case v_type
        when 'Sadaka' then 'Offering'
        when 'Zaka' then 'Tithe'
        when 'Jengo' then 'Building Fund'
        when 'Shukrani' then 'Donations'
        else 'Donations'
      end
    )
  limit 1;

  insert into public.contributions (
    church_id,
    amount,
    category_id,
    donor_name,
    phone,
    payment_reference,
    notes,
    currency,
    date,
    created_by
  )
  values (
    v_church_id,
    p_amount,
    v_category_id,
    left(v_donor_name, 160),
    left(v_phone, 32),
    left(v_transaction_id, 120),
    left(concat_ws(
      E'\n',
      'Public QR giving submission - pending confirmation',
      'Type: ' || v_type,
      case when v_note is not null then 'Note: ' || v_note else null end
    ), 1000),
    'TZS',
    current_date,
    null
  )
  returning id into v_contribution_id;

  return jsonb_build_object(
    'success', true,
    'contribution_id', v_contribution_id,
    'message', 'Thank you. Your contribution has been submitted for confirmation.'
  );
end;
$$;

revoke all on function public.submit_public_contribution(text, text, numeric, text, text, text, text) from public;
grant execute on function public.submit_public_contribution(text, text, numeric, text, text, text, text) to anon, authenticated;

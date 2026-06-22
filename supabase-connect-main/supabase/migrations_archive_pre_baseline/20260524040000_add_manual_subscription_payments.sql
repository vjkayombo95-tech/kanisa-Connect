-- Manual mobile-money billing approval for subscription upgrades.
alter table public.platform_settings
  add column if not exists billing_payment_method text not null default 'Mobile Money / Lipa Namba',
  add column if not exists billing_lipa_number text not null default 'Configure Lipa Namba in Platform Settings',
  add column if not exists billing_payment_instructions text not null default 'Pay the exact plan amount, then submit the mobile-money transaction reference for verification.';

alter table public.platform_settings enable row level security;
drop policy if exists "Super admins manage platform settings" on public.platform_settings;
create policy "Super admins manage platform settings"
on public.platform_settings
for all
to authenticated
using (public.is_platform_super_admin(auth.uid()))
with check (public.is_platform_super_admin(auth.uid()));

create table if not exists public.subscription_payments (
  id uuid primary key default gen_random_uuid(),
  church_id uuid not null references public.churches(id) on delete cascade,
  requested_by uuid not null references auth.users(id) on delete cascade,
  plan text not null
    check (plan in ('basic', 'intermediate', 'pro', 'enterprise')),
  amount numeric not null check (amount > 0),
  payment_method text not null default 'mobile_money'
    check (payment_method = 'mobile_money'),
  payment_reference text not null,
  payer_phone text,
  receipt_url text,
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected')),
  verified_by uuid references auth.users(id) on delete set null,
  verified_at timestamp with time zone,
  rejection_reason text,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);

create unique index if not exists subscription_payments_one_pending_per_church_idx
  on public.subscription_payments (church_id)
  where status = 'pending';

create index if not exists subscription_payments_review_queue_idx
  on public.subscription_payments (status, created_at desc);

drop trigger if exists set_subscription_payments_updated_at_before_write on public.subscription_payments;
create trigger set_subscription_payments_updated_at_before_write
before update on public.subscription_payments
for each row execute function public.set_billing_updated_at();

alter table public.subscription_payments enable row level security;

drop policy if exists "Workspace managers can view subscription payments" on public.subscription_payments;
create policy "Workspace managers can view subscription payments"
on public.subscription_payments
for select
to authenticated
using (public.can_manage_church_workspace(auth.uid(), church_id));

drop policy if exists "Workspace managers can submit subscription payments" on public.subscription_payments;
create policy "Workspace managers can submit subscription payments"
on public.subscription_payments
for insert
to authenticated
with check (
  requested_by = auth.uid()
  and status = 'pending'
  and verified_by is null
  and verified_at is null
  and public.can_manage_church_workspace(auth.uid(), church_id)
  and amount = case plan
    when 'basic' then 50000
    when 'intermediate' then 80000
    when 'pro' then 120000
    when 'enterprise' then 150000
  end
);

drop policy if exists "Super admins can manage subscription payments" on public.subscription_payments;
create policy "Super admins can manage subscription payments"
on public.subscription_payments
for all
to authenticated
using (public.is_platform_super_admin(auth.uid()))
with check (public.is_platform_super_admin(auth.uid()));

-- Subscription activation is performed through approval, not by workspace clients.
drop policy if exists "Workspace managers can manage subscriptions" on public.subscriptions;
drop policy if exists "Church admins manage subscriptions" on public.subscriptions;
drop policy if exists "Church creators can insert subscription" on public.subscriptions;
drop policy if exists "Super admins can manage subscriptions" on public.subscriptions;
create policy "Super admins can manage subscriptions"
on public.subscriptions
for all
to authenticated
using (public.is_platform_super_admin(auth.uid()))
with check (public.is_platform_super_admin(auth.uid()));

insert into storage.buckets (id, name, public)
values ('billing-receipts', 'billing-receipts', false)
on conflict (id) do nothing;

drop policy if exists "Workspace managers can upload billing receipts" on storage.objects;
create policy "Workspace managers can upload billing receipts"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'billing-receipts'
  and exists (
    select 1
    from public.churches c
    where c.id::text = (storage.foldername(name))[1]
      and public.can_manage_church_workspace(auth.uid(), c.id)
  )
);

drop policy if exists "Workspace managers can read billing receipts" on storage.objects;
create policy "Workspace managers can read billing receipts"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'billing-receipts'
  and exists (
    select 1
    from public.churches c
    where c.id::text = (storage.foldername(name))[1]
      and public.can_manage_church_workspace(auth.uid(), c.id)
  )
);

drop policy if exists "Super admins can read billing receipts" on storage.objects;
create policy "Super admins can read billing receipts"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'billing-receipts'
  and public.is_platform_super_admin(auth.uid())
);

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

  if nullif(trim(coalesce(_payment_reference, '')), '') is null then
    raise exception 'Enter the mobile-money transaction reference.';
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
    trim(_payment_reference),
    nullif(trim(coalesce(_payer_phone, '')), ''),
    _receipt_url
  )
  returning * into _payment;

  return _payment;
end;
$$;

revoke all on function public.submit_subscription_payment(uuid, text, text, text, text) from public;
grant execute on function public.submit_subscription_payment(uuid, text, text, text, text) to authenticated;

create or replace function public.review_subscription_payment(
  _payment_id uuid,
  _approved boolean,
  _rejection_reason text default null
)
returns public.subscription_payments
language plpgsql
security definer
set search_path = public
as $$
declare
  _payment public.subscription_payments%rowtype;
  _action text;
begin
  if not public.is_platform_super_admin(auth.uid()) then
    raise exception 'Only super admins can review subscription payments.';
  end if;

  select p.* into _payment
  from public.subscription_payments p
  where p.id = _payment_id
  for update;

  if _payment.id is null then
    raise exception 'Payment request not found.';
  end if;

  if _payment.status <> 'pending' then
    raise exception 'This payment request has already been reviewed.';
  end if;

  if _approved then
    update public.subscriptions
    set status = 'expired',
        expires_at = now()
    where church_id = _payment.church_id
      and status in ('active', 'trial');

    insert into public.subscriptions (church_id, plan, status, started_at, expires_at)
    values (_payment.church_id, _payment.plan, 'active', now(), now() + interval '1 month');

    update public.subscription_payments
    set status = 'approved',
        verified_by = auth.uid(),
        verified_at = now(),
        rejection_reason = null
    where id = _payment.id
    returning * into _payment;

    _action := 'SUBSCRIPTION_PAYMENT_APPROVED';
  else
    update public.subscription_payments
    set status = 'rejected',
        verified_by = auth.uid(),
        verified_at = now(),
        rejection_reason = nullif(trim(coalesce(_rejection_reason, '')), '')
    where id = _payment.id
    returning * into _payment;

    _action := 'SUBSCRIPTION_PAYMENT_REJECTED';
  end if;

  insert into public.audit_logs (user_id, action, entity, entity_id, details)
  values (
    auth.uid(),
    _action,
    'subscription_payment',
    _payment.id,
    format(
      '%s payment request for church %s, plan %s, amount %s.',
      case when _approved then 'Approved' else 'Rejected' end,
      _payment.church_id,
      _payment.plan,
      _payment.amount
    )
  );

  return _payment;
end;
$$;

revoke all on function public.review_subscription_payment(uuid, boolean, text) from public;
grant execute on function public.review_subscription_payment(uuid, boolean, text) to authenticated;

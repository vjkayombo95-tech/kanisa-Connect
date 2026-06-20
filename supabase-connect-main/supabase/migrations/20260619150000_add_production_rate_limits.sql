-- Production request throttles for expensive or abuse-prone actions.
-- Login is handled by Supabase Auth rate-limit and captcha settings; see docs/production-launch-checklist.md.

create table if not exists public.rate_limits (
  id uuid primary key default gen_random_uuid(),
  action text not null,
  actor_id uuid,
  scope_key text not null,
  occurred_at timestamptz not null default now()
);

create index if not exists idx_rate_limits_action_scope_time
  on public.rate_limits(action, scope_key, occurred_at desc);

alter table public.rate_limits enable row level security;

create or replace function public.enforce_rate_limit(
  _action text,
  _scope_key text,
  _max_attempts integer,
  _window interval
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  _actor_id uuid := auth.uid();
  _recent_count integer;
begin
  if nullif(trim(coalesce(_action, '')), '') is null then
    raise exception 'Rate limit action is required.';
  end if;

  if nullif(trim(coalesce(_scope_key, '')), '') is null then
    raise exception 'Rate limit scope is required.';
  end if;

  delete from public.rate_limits
  where occurred_at < now() - interval '2 days';

  select count(*)
  into _recent_count
  from public.rate_limits
  where action = _action
    and scope_key = _scope_key
    and occurred_at >= now() - _window;

  if _recent_count >= _max_attempts then
    raise exception 'Too many requests. Please wait and try again.';
  end if;

  insert into public.rate_limits(action, actor_id, scope_key)
  values (_action, _actor_id, _scope_key);
end;
$$;

revoke all on function public.enforce_rate_limit(text, text, integer, interval) from public;

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

  perform public.enforce_rate_limit('payment_submission', _church_id::text, 3, interval '15 minutes');

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

create or replace function public.save_church_announcement(
  _announcement_id uuid default null,
  _church_id uuid default null,
  _title text default null,
  _content text default null,
  _is_published boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  _target_church_id uuid;
  _announcement_id_result uuid;
  _published_at timestamptz;
begin
  if auth.uid() is null then
    return jsonb_build_object('success', false, 'error', 'Authentication required');
  end if;

  if coalesce(trim(_title), '') = '' then
    return jsonb_build_object('success', false, 'error', 'Title is required');
  end if;

  if coalesce(trim(_content), '') = '' then
    return jsonb_build_object('success', false, 'error', 'Content is required');
  end if;

  _published_at := case when _is_published then now() else null end;

  if _announcement_id is null then
    if _church_id is null then
      return jsonb_build_object('success', false, 'error', 'Church is required');
    end if;

    if not (public.is_church_admin(auth.uid(), _church_id) or public.is_platform_super_admin(auth.uid())) then
      return jsonb_build_object('success', false, 'error', 'You do not have permission to create announcements for this church');
    end if;

    perform public.enforce_rate_limit('announcement_post', _church_id::text, 10, interval '10 minutes');

    insert into public.announcements (
      church_id,
      title,
      content,
      is_published,
      published_at,
      created_by
    )
    values (
      _church_id,
      trim(_title),
      trim(_content),
      _is_published,
      _published_at,
      auth.uid()
    )
    returning id into _announcement_id_result;

    return jsonb_build_object('success', true, 'id', _announcement_id_result);
  end if;

  select church_id
  into _target_church_id
  from public.announcements
  where id = _announcement_id;

  if _target_church_id is null then
    return jsonb_build_object('success', false, 'error', 'Announcement not found');
  end if;

  if not (public.is_church_admin(auth.uid(), _target_church_id) or public.is_platform_super_admin(auth.uid())) then
    return jsonb_build_object('success', false, 'error', 'You do not have permission to update this announcement');
  end if;

  update public.announcements
  set title = trim(_title),
      content = trim(_content),
      is_published = _is_published,
      published_at = _published_at,
      archived_at = null,
      updated_at = now()
  where id = _announcement_id;

  return jsonb_build_object('success', true, 'id', _announcement_id);
end;
$$;

grant execute on function public.save_church_announcement(uuid, uuid, text, text, boolean) to authenticated;

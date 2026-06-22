alter table public.member_record_subscriptions enable row level security;

drop policy if exists "Admins can manage record preservation subscriptions" on public.member_record_subscriptions;
drop policy if exists "Platform super admins can manage record preservation subscriptions" on public.member_record_subscriptions;
create policy "Platform super admins can manage record preservation subscriptions"
on public.member_record_subscriptions
for all
to authenticated
using (
  public.is_super_admin(auth.uid())
)
with check (
  public.is_super_admin(auth.uid())
);

drop policy if exists "Admins read record preservation proofs" on storage.objects;
drop policy if exists "Platform super admins read record preservation proofs" on storage.objects;
create policy "Platform super admins read record preservation proofs"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'record-preservation-proofs'
  and public.is_super_admin(auth.uid())
);

create or replace function public.review_member_record_subscription(
  p_subscription_id uuid,
  p_approved boolean,
  p_rejection_reason text default null
)
returns public.member_record_subscriptions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_request public.member_record_subscriptions%rowtype;
  v_active public.member_record_subscriptions%rowtype;
  v_new_start timestamptz;
  v_new_end timestamptz;
  v_extension interval;
begin
  -- Approval only changes preservation access windows. Member historical records stay in their original tables.
  select *
  into v_request
  from public.member_record_subscriptions
  where id = p_subscription_id
  for update;

  if v_request.id is null then
    raise exception 'Subscription request not found.';
  end if;

  if not (
    auth.role() = 'service_role'
    or public.is_super_admin(auth.uid())
  ) then
    raise exception 'Only platform super admins can review record preservation payments.';
  end if;

  if v_request.status <> 'pending' then
    raise exception 'This preservation request has already been reviewed.';
  end if;

  if not p_approved then
    update public.member_record_subscriptions
    set status = 'rejected',
        reviewed_at = now(),
        reviewed_by = auth.uid()
    where id = v_request.id
    returning * into v_request;

    return v_request;
  end if;

  v_extension := case
    when v_request.plan_interval = 'yearly' then interval '1 year'
    else interval '1 month'
  end;

  select *
  into v_active
  from public.member_record_subscriptions
  where church_id = v_request.church_id
    and member_id = v_request.member_id
    and status = 'active'
    and end_date > now()
    and id <> v_request.id
  order by end_date desc
  limit 1
  for update;

  if v_active.id is not null then
    v_new_start := coalesce(v_active.start_date, now());
    v_new_end := v_active.end_date + v_extension;

    update public.member_record_subscriptions
    set status = 'expired'
    where id = v_active.id;
  else
    v_new_start := now();
    v_new_end := now() + v_extension;
  end if;

  update public.member_record_subscriptions
  set status = 'active',
      start_date = v_new_start,
      end_date = v_new_end,
      reviewed_at = now(),
      reviewed_by = auth.uid()
  where id = v_request.id
  returning * into v_request;

  return v_request;
end;
$$;

revoke all on function public.review_member_record_subscription(uuid, boolean, text) from public;
grant execute on function public.review_member_record_subscription(uuid, boolean, text) to authenticated, service_role;

create or replace function public.expire_member_record_subscriptions()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_expired_count integer := 0;
begin
  -- Expiry only locks historical archive visibility. Never delete member records because preservation is inactive.
  if not (
    auth.role() = 'service_role'
    or public.is_super_admin(auth.uid())
  ) then
    raise exception 'Only platform super admins can expire record preservation subscriptions.';
  end if;

  update public.member_record_subscriptions
  set status = 'expired'
  where status = 'active'
    and end_date is not null
    and end_date < now();

  get diagnostics v_expired_count = row_count;
  return v_expired_count;
end;
$$;

revoke all on function public.expire_member_record_subscriptions() from public;
grant execute on function public.expire_member_record_subscriptions() to authenticated, service_role;

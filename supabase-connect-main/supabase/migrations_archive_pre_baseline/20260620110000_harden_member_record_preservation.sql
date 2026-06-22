alter table public.member_record_subscriptions
  add column if not exists plan_interval text not null default 'monthly'
    check (plan_interval in ('monthly', 'yearly'));

alter table public.member_record_subscriptions
  drop constraint if exists member_record_subscriptions_amount_check;

alter table public.member_record_subscriptions
  add constraint member_record_subscriptions_amount_check
    check (
      (plan_interval = 'monthly' and amount = 3000)
      or (plan_interval = 'yearly' and amount = 30000)
    );

create index if not exists idx_member_record_subscriptions_plan_interval
  on public.member_record_subscriptions(plan_interval);

drop policy if exists "Members can submit own record preservation subscriptions" on public.member_record_subscriptions;
create policy "Members can submit own record preservation subscriptions"
on public.member_record_subscriptions
for insert
to authenticated
with check (
  status = 'pending'
  and (
    (plan_interval = 'monthly' and amount = 3000)
    or (plan_interval = 'yearly' and amount = 30000)
  )
  and exists (
    select 1
    from public.members m
    where m.id = member_record_subscriptions.member_id
      and m.church_id = member_record_subscriptions.church_id
      and m.user_id = auth.uid()
  )
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
  select *
  into v_request
  from public.member_record_subscriptions
  where id = p_subscription_id
  for update;

  if v_request.id is null then
    raise exception 'Subscription request not found.';
  end if;

  if not (
    public.is_super_admin(auth.uid())
    or exists (
      select 1
      from public.user_roles ur
      where ur.user_id = auth.uid()
        and ur.church_id = v_request.church_id
        and ur.role::text in ('church_admin', 'pastor', 'secretary', 'treasurer', 'admin')
    )
  ) then
    raise exception 'You do not have permission to review this subscription.';
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
grant execute on function public.review_member_record_subscription(uuid, boolean, text) to authenticated;

create or replace function public.expire_member_record_subscriptions()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_expired_count integer := 0;
begin
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
grant execute on function public.expire_member_record_subscriptions() to authenticated;

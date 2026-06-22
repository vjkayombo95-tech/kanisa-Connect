create table if not exists public.member_record_subscriptions (
  id uuid primary key default gen_random_uuid(),
  church_id uuid not null references public.churches(id) on delete cascade,
  member_id uuid not null references public.members(id) on delete cascade,
  amount numeric not null default 3000,
  status text not null default 'pending' check (status in ('pending', 'active', 'expired', 'rejected')),
  start_date timestamptz,
  end_date timestamptz,
  transaction_id text,
  proof_url text,
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_member_record_subscriptions_member_id
  on public.member_record_subscriptions(member_id);

create index if not exists idx_member_record_subscriptions_church_id
  on public.member_record_subscriptions(church_id);

create index if not exists idx_member_record_subscriptions_status
  on public.member_record_subscriptions(status);

create index if not exists idx_member_record_subscriptions_end_date
  on public.member_record_subscriptions(end_date desc);

alter table public.member_record_subscriptions enable row level security;

drop policy if exists "Members can view own record preservation subscriptions" on public.member_record_subscriptions;
create policy "Members can view own record preservation subscriptions"
on public.member_record_subscriptions
for select
to authenticated
using (
  exists (
    select 1
    from public.members m
    where m.id = member_record_subscriptions.member_id
      and m.user_id = auth.uid()
  )
);

drop policy if exists "Members can submit own record preservation subscriptions" on public.member_record_subscriptions;
create policy "Members can submit own record preservation subscriptions"
on public.member_record_subscriptions
for insert
to authenticated
with check (
  amount = 3000
  and status = 'pending'
  and exists (
    select 1
    from public.members m
    where m.id = member_record_subscriptions.member_id
      and m.church_id = member_record_subscriptions.church_id
      and m.user_id = auth.uid()
  )
);

drop policy if exists "Admins can manage record preservation subscriptions" on public.member_record_subscriptions;
create policy "Admins can manage record preservation subscriptions"
on public.member_record_subscriptions
for all
to authenticated
using (
  public.is_super_admin(auth.uid())
  or exists (
    select 1
    from public.user_roles ur
    where ur.user_id = auth.uid()
      and ur.church_id = member_record_subscriptions.church_id
      and ur.role::text in ('church_admin', 'pastor', 'secretary', 'treasurer', 'admin')
  )
)
with check (
  public.is_super_admin(auth.uid())
  or exists (
    select 1
    from public.user_roles ur
    where ur.user_id = auth.uid()
      and ur.church_id = member_record_subscriptions.church_id
      and ur.role::text in ('church_admin', 'pastor', 'secretary', 'treasurer', 'admin')
  )
);

insert into storage.buckets (id, name, public)
values ('record-preservation-proofs', 'record-preservation-proofs', false)
on conflict (id) do nothing;

drop policy if exists "Members upload record preservation proofs" on storage.objects;
create policy "Members upload record preservation proofs"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'record-preservation-proofs'
  and exists (
    select 1
    from public.members m
    where m.church_id::text = (storage.foldername(name))[1]
      and m.id::text = (storage.foldername(name))[2]
      and m.user_id = auth.uid()
  )
);

drop policy if exists "Members read own record preservation proofs" on storage.objects;
create policy "Members read own record preservation proofs"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'record-preservation-proofs'
  and exists (
    select 1
    from public.members m
    where m.church_id::text = (storage.foldername(name))[1]
      and m.id::text = (storage.foldername(name))[2]
      and m.user_id = auth.uid()
  )
);

drop policy if exists "Admins read record preservation proofs" on storage.objects;
create policy "Admins read record preservation proofs"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'record-preservation-proofs'
  and (
    public.is_super_admin(auth.uid())
    or exists (
      select 1
      from public.user_roles ur
      where ur.user_id = auth.uid()
        and ur.church_id::text = (storage.foldername(name))[1]
        and ur.role::text in ('church_admin', 'pastor', 'secretary', 'treasurer', 'admin')
    )
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
    v_new_start := v_active.start_date;
    v_new_end := v_active.end_date + interval '1 month';

    update public.member_record_subscriptions
    set status = 'expired'
    where id = v_active.id;
  else
    v_new_start := now();
    v_new_end := now() + interval '1 month';
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

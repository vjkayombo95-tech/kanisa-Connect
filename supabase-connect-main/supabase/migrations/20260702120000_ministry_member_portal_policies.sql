-- RC-28.0: Member ministry discovery and join-request workflow.
-- This adds a lightweight ministry join request table and narrow RLS policies.

create table if not exists public.ministry_join_requests (
  id uuid primary key default gen_random_uuid(),
  church_id uuid not null references public.churches(id) on delete cascade,
  ministry_id uuid not null references public.ministries(id) on delete cascade,
  member_id uuid not null references public.members(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'cancelled')),
  message text,
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists ministry_join_requests_church_status_idx
on public.ministry_join_requests (church_id, status, created_at desc);

create index if not exists ministry_join_requests_member_idx
on public.ministry_join_requests (member_id, ministry_id, status);

create unique index if not exists ministry_join_requests_one_pending_idx
on public.ministry_join_requests (member_id, ministry_id)
where status = 'pending';

drop trigger if exists update_ministry_join_requests_updated_at on public.ministry_join_requests;
create trigger update_ministry_join_requests_updated_at
before update on public.ministry_join_requests
for each row
execute function public.update_updated_at_column();

alter table public.ministry_join_requests enable row level security;

drop policy if exists "Church members can view ministries" on public.ministries;
create policy "Church members can view ministries"
on public.ministries
for select
to authenticated
using (
  public.is_church_member(auth.uid(), church_id)
  or public.can_manage_church_workspace(auth.uid(), church_id)
  or public.is_super_admin(auth.uid())
);

drop policy if exists "Church members can view ministry memberships" on public.member_ministries;
create policy "Church members can view ministry memberships"
on public.member_ministries
for select
to authenticated
using (
  exists (
    select 1
    from public.ministries ministry
    where ministry.id = member_ministries.ministry_id
      and (
        public.is_church_member(auth.uid(), ministry.church_id)
        or public.can_manage_church_workspace(auth.uid(), ministry.church_id)
        or public.is_super_admin(auth.uid())
      )
  )
);

drop policy if exists "Church members can leave own ministries" on public.member_ministries;
create policy "Church members can leave own ministries"
on public.member_ministries
for delete
to authenticated
using (
  exists (
    select 1
    from public.members member
    join public.ministries ministry on ministry.id = member_ministries.ministry_id
    where member.id = member_ministries.member_id
      and member.user_id = auth.uid()
      and member.church_id = ministry.church_id
      and public.is_church_member(auth.uid(), ministry.church_id)
  )
);

drop policy if exists "Church members can create own ministry requests" on public.ministry_join_requests;
create policy "Church members can create own ministry requests"
on public.ministry_join_requests
for insert
to authenticated
with check (
  status = 'pending'
  and reviewed_by is null
  and reviewed_at is null
  and exists (
    select 1
    from public.members member
    join public.ministries ministry on ministry.id = ministry_join_requests.ministry_id
    where member.id = ministry_join_requests.member_id
      and member.user_id = auth.uid()
      and member.church_id = ministry.church_id
      and ministry.church_id = ministry_join_requests.church_id
      and public.is_church_member(auth.uid(), ministry.church_id)
  )
);

drop policy if exists "Church members can view own ministry requests" on public.ministry_join_requests;
create policy "Church members can view own ministry requests"
on public.ministry_join_requests
for select
to authenticated
using (
  exists (
    select 1
    from public.members member
    where member.id = ministry_join_requests.member_id
      and member.user_id = auth.uid()
  )
  or public.can_manage_church_workspace(auth.uid(), church_id)
  or public.is_super_admin(auth.uid())
);

drop policy if exists "Workspace managers can review ministry requests" on public.ministry_join_requests;
create policy "Workspace managers can review ministry requests"
on public.ministry_join_requests
for update
to authenticated
using (
  public.can_manage_church_workspace(auth.uid(), church_id)
  or public.is_super_admin(auth.uid())
)
with check (
  public.can_manage_church_workspace(auth.uid(), church_id)
  or public.is_super_admin(auth.uid())
);

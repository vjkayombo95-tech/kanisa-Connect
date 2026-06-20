-- Remove recursive legacy member policies from databases where the workspace
-- content RLS migration was already executed.
alter table public.members enable row level security;

create or replace function public.can_manage_church_workspace(_user_id uuid, _church_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select _user_id is not null
    and _church_id is not null
    and (
      exists (
        select 1
        from public.user_roles ur
        where ur.user_id = _user_id
          and ur.church_id = _church_id
          and lower(coalesce(ur.role, '')) in ('church_admin', 'admin', 'pastor', 'secretary', 'treasurer')
      )
      or exists (
        select 1
        from public.profiles p
        where p.id = _user_id
          and p.church_id = _church_id
          and lower(coalesce(p.role, '')) in ('church_admin', 'admin', 'pastor', 'secretary', 'treasurer')
      )
      or exists (
        select 1
        from public.churches c
        where c.id = _church_id
          and (_user_id = c.owner_id or _user_id = c.created_by)
      )
      or exists (
        select 1
        from public.super_admins sa
        where sa.id = _user_id
      )
    );
$$;

grant execute on function public.can_manage_church_workspace(uuid, uuid) to authenticated;

create or replace function public.can_view_church_workspace(_user_id uuid, _church_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.can_manage_church_workspace(_user_id, _church_id)
    or exists (
      select 1
      from public.user_roles ur
      where ur.user_id = _user_id
        and ur.church_id = _church_id
    )
    or exists (
      select 1
      from public.profiles p
      where p.id = _user_id
        and p.church_id = _church_id
    );
$$;

grant execute on function public.can_view_church_workspace(uuid, uuid) to authenticated;

do $$
declare
  _policy record;
begin
  for _policy in
    select p.policyname
    from pg_policies p
    where p.schemaname = 'public'
      and p.tablename = 'members'
  loop
    execute format('drop policy if exists %I on public.members', _policy.policyname);
  end loop;
end;
$$;

create policy "Workspace managers can manage members"
on public.members
for all
to authenticated
using (public.can_manage_church_workspace(auth.uid(), church_id))
with check (public.can_manage_church_workspace(auth.uid(), church_id));

create policy "Church workspace users can view members"
on public.members
for select
to authenticated
using (
  user_id = auth.uid()
  or public.can_view_church_workspace(auth.uid(), church_id)
);

create policy "Members can update own member record"
on public.members
for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

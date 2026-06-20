-- Restore management access for live workspace content tables.
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

alter table public.communities enable row level security;
drop policy if exists "Workspace managers can manage communities" on public.communities;
create policy "Workspace managers can manage communities"
on public.communities
for all
to authenticated
using (public.can_manage_church_workspace(auth.uid(), church_id))
with check (public.can_manage_church_workspace(auth.uid(), church_id));

alter table public.ministries enable row level security;
drop policy if exists "Workspace managers can manage ministries" on public.ministries;
create policy "Workspace managers can manage ministries"
on public.ministries
for all
to authenticated
using (public.can_manage_church_workspace(auth.uid(), church_id))
with check (public.can_manage_church_workspace(auth.uid(), church_id));

alter table public.members enable row level security;
-- Remove legacy member policies first. Some deployed versions resolve church
-- membership by querying members again, which recurses while evaluating RLS.
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

alter table public.families enable row level security;
drop policy if exists "Workspace managers can manage families" on public.families;
create policy "Workspace managers can manage families"
on public.families
for all
to authenticated
using (public.can_manage_church_workspace(auth.uid(), church_id))
with check (public.can_manage_church_workspace(auth.uid(), church_id));

alter table public.invitations enable row level security;
drop policy if exists "Workspace managers can manage invitations" on public.invitations;
create policy "Workspace managers can manage invitations"
on public.invitations
for all
to authenticated
using (public.can_manage_church_workspace(auth.uid(), church_id))
with check (public.can_manage_church_workspace(auth.uid(), church_id));

alter table public.member_communities enable row level security;
drop policy if exists "Workspace managers can manage member communities" on public.member_communities;
create policy "Workspace managers can manage member communities"
on public.member_communities
for all
to authenticated
using (
  exists (
    select 1
    from public.communities c
    where c.id = community_id
      and public.can_manage_church_workspace(auth.uid(), c.church_id)
  )
)
with check (
  exists (
    select 1
    from public.communities c
    where c.id = community_id
      and public.can_manage_church_workspace(auth.uid(), c.church_id)
  )
);

alter table public.member_ministries enable row level security;
drop policy if exists "Workspace managers can manage member ministries" on public.member_ministries;
create policy "Workspace managers can manage member ministries"
on public.member_ministries
for all
to authenticated
using (
  exists (
    select 1
    from public.ministries m
    where m.id = ministry_id
      and public.can_manage_church_workspace(auth.uid(), m.church_id)
  )
)
with check (
  exists (
    select 1
    from public.ministries m
    where m.id = ministry_id
      and public.can_manage_church_workspace(auth.uid(), m.church_id)
  )
);

-- The live communities table stores its chairperson in mwenyekiti_id.
create or replace function public.update_community_leadership(
  _community_id uuid,
  _role_field text,
  _member_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  _church_id uuid;
begin
  if auth.uid() is null then
    return jsonb_build_object('success', false, 'error', 'Authentication required');
  end if;

  if _role_field not in ('mwenyekiti_id', 'makamu_mwenyekiti_id', 'mweka_hazina_id', 'katibu_id') then
    return jsonb_build_object('success', false, 'error', 'Invalid leadership role');
  end if;

  select c.church_id into _church_id
  from public.communities c
  where c.id = _community_id;

  if _church_id is null then
    return jsonb_build_object('success', false, 'error', 'Community not found');
  end if;

  if not public.can_manage_church_workspace(auth.uid(), _church_id) then
    return jsonb_build_object('success', false, 'error', 'You do not have permission to update this community');
  end if;

  if _member_id is not null and not exists (
    select 1
    from public.members m
    where m.id = _member_id
      and m.church_id = _church_id
  ) then
    return jsonb_build_object('success', false, 'error', 'Selected member does not belong to this church');
  end if;

  execute format('update public.communities set %I = $1 where id = $2', _role_field)
  using _member_id, _community_id;

  return jsonb_build_object('success', true);
end;
$$;

grant execute on function public.update_community_leadership(uuid, text, uuid) to authenticated;

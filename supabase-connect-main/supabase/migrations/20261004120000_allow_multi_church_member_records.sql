-- Slice 1: allow one authenticated user to have one member identity per church.
--
-- This migration intentionally does not change get_current_user_context(),
-- active-church selection, RLS policy decisions, or any frontend behavior.

begin;

lock table public.members, public.user_roles, public.church_memberships
  in share row exclusive mode;

do $$
begin
  if exists (
    select 1
    from public.members m
    where m.user_id is not null
      and m.church_id is not null
    group by m.user_id, m.church_id
    having count(*) > 1
  ) then
    raise exception 'Cannot replace unique_user_member: duplicate linked member rows exist for at least one (user_id, church_id).'
      using errcode = '23505';
  end if;

  if exists (
    select 1
    from public.members m
    join public.church_memberships cm on cm.id = m.membership_id
    where m.membership_id is not null
      and (m.user_id is distinct from cm.user_id
        or m.church_id is distinct from cm.church_id)
  ) then
    raise exception 'Cannot continue: members.membership_id does not match members user/church scope.'
      using errcode = '23514';
  end if;

  if exists (
    select 1
    from public.user_roles ur
    join public.church_memberships cm on cm.id = ur.membership_id
    where ur.membership_id is not null
      and (ur.user_id is distinct from cm.user_id
        or ur.church_id is distinct from cm.church_id)
  ) then
    raise exception 'Cannot continue: user_roles.membership_id does not match user_roles user/church scope.'
      using errcode = '23514';
  end if;

  if exists (
    select 1
    from public.church_memberships cm
    where cm.is_primary
      and cm.status = 'active'
    group by cm.user_id
    having count(*) > 1
  ) then
    raise exception 'Cannot continue: multiple active primary church memberships exist for at least one user.'
      using errcode = '23514';
  end if;
end;
$$;

drop index if exists public.unique_user_member;

create unique index if not exists members_user_church_unique_idx
  on public.members (user_id, church_id)
  where user_id is not null and church_id is not null;

comment on index public.members_user_church_unique_idx is
  'Allows one authenticated user to have one member identity per church while preserving unlinked member records.';

with relationship_sources as (
  select
    m.user_id,
    m.church_id,
    min(m.created_at)::timestamptz as joined_at,
    bool_or(lower(coalesce(m.status, 'active')) in ('active', 'approved')) as active_from_member,
    false as active_from_role
  from public.members m
  where m.user_id is not null
    and m.church_id is not null
  group by m.user_id, m.church_id

  union all

  select
    ur.user_id,
    ur.church_id,
    min(ur.created_at) as joined_at,
    false as active_from_member,
    true as active_from_role
  from public.user_roles ur
  where ur.user_id is not null
    and ur.church_id is not null
  group by ur.user_id, ur.church_id
),
canonical_sources as (
  select
    user_id,
    church_id,
    coalesce(min(joined_at), now()) as joined_at,
    bool_or(active_from_member or active_from_role) as should_be_active
  from relationship_sources
  group by user_id, church_id
)
insert into public.church_memberships (
  user_id,
  church_id,
  status,
  joined_at,
  is_primary,
  membership_source
)
select
  cs.user_id,
  cs.church_id,
  case when cs.should_be_active then 'active' else 'pending' end::public.church_membership_status,
  cs.joined_at,
  false,
  'slice1_member_uniqueness_backfill_v1'
from canonical_sources cs
on conflict (user_id, church_id) do nothing;

update public.members m
set membership_id = cm.id
from public.church_memberships cm
where m.membership_id is null
  and m.user_id is not null
  and m.church_id is not null
  and cm.user_id = m.user_id
  and cm.church_id = m.church_id;

update public.user_roles ur
set membership_id = cm.id
from public.church_memberships cm
where ur.membership_id is null
  and ur.user_id is not null
  and ur.church_id is not null
  and cm.user_id = ur.user_id
  and cm.church_id = ur.church_id;

do $$
begin
  if exists (
    select 1
    from public.members m
    join public.church_memberships cm on cm.id = m.membership_id
    where m.membership_id is not null
      and (m.user_id is distinct from cm.user_id
        or m.church_id is distinct from cm.church_id)
  ) then
    raise exception 'Post-backfill member membership scope mismatch detected.'
      using errcode = '23514';
  end if;

  if exists (
    select 1
    from public.user_roles ur
    join public.church_memberships cm on cm.id = ur.membership_id
    where ur.membership_id is not null
      and (ur.user_id is distinct from cm.user_id
        or ur.church_id is distinct from cm.church_id)
  ) then
    raise exception 'Post-backfill role membership scope mismatch detected.'
      using errcode = '23514';
  end if;
end;
$$;

create or replace function public.enforce_member_membership_scope()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if new.membership_id is null then
    return new;
  end if;

  if new.user_id is null or new.church_id is null then
    raise exception 'members.membership_id requires user_id and church_id.'
      using errcode = '23514';
  end if;

  if not exists (
    select 1
    from public.church_memberships cm
    where cm.id = new.membership_id
      and cm.user_id = new.user_id
      and cm.church_id = new.church_id
  ) then
    raise exception 'members.membership_id must reference the same user_id and church_id.'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

create or replace function public.enforce_user_role_membership_scope()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if new.membership_id is null then
    return new;
  end if;

  if new.user_id is null or new.church_id is null then
    raise exception 'user_roles.membership_id requires user_id and church_id.'
      using errcode = '23514';
  end if;

  if not exists (
    select 1
    from public.church_memberships cm
    where cm.id = new.membership_id
      and cm.user_id = new.user_id
      and cm.church_id = new.church_id
  ) then
    raise exception 'user_roles.membership_id must reference the same user_id and church_id.'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

drop trigger if exists enforce_member_membership_scope on public.members;
create trigger enforce_member_membership_scope
before insert or update of user_id, church_id, membership_id
on public.members
for each row execute function public.enforce_member_membership_scope();

drop trigger if exists enforce_user_role_membership_scope on public.user_roles;
create trigger enforce_user_role_membership_scope
before insert or update of user_id, church_id, membership_id
on public.user_roles
for each row execute function public.enforce_user_role_membership_scope();

revoke all on function public.enforce_member_membership_scope() from public, anon, authenticated;
revoke all on function public.enforce_user_role_membership_scope() from public, anon, authenticated;

commit;

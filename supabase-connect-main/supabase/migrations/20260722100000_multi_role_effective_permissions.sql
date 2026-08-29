-- Multi-role church authorization.
-- One login may hold many role assignments in one church. Effective access is
-- the union of grants from those roles, still bounded by tenant, platform,
-- subscription, church-feature, and row-ownership controls.

-- Preserve the final administrative recovery assignment even when two role
-- removals race. Locking the church row serializes the count-and-delete decision.
create or replace function public.protect_last_church_admin()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
declare
  v_removing_admin boolean := false;
begin
  if lower(old.role::text) <> 'church_admin' then
    return case when tg_op = 'DELETE' then old else new end;
  end if;

  if tg_op = 'DELETE' then
    v_removing_admin := true;
  elsif new.church_id is distinct from old.church_id
     or lower(new.role::text) <> 'church_admin' then
    v_removing_admin := true;
  end if;

  if v_removing_admin then
    perform 1 from public.churches c where c.id = old.church_id for update;
    if (select count(*) from public.user_roles ur
        where ur.church_id = old.church_id
          and lower(ur.role::text) = 'church_admin') <= 1 then
      raise exception 'The final Church Admin cannot be removed or demoted'
        using errcode = '23514';
    end if;
  end if;

  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

drop trigger if exists protect_last_church_admin on public.user_roles;
create trigger protect_last_church_admin
before update or delete on public.user_roles
for each row execute function public.protect_last_church_admin();

-- Normalize legacy role keys before enforcing tuple uniqueness. Rows that map
-- to the same canonical tuple are archived first so their original role text,
-- identity, and assignment timestamp remain available for audit.
create table if not exists public.user_role_duplicate_archive (
  id uuid primary key,
  user_id uuid,
  church_id uuid,
  role text,
  normalized_role text,
  created_at timestamptz,
  archived_at timestamptz not null default now(),
  archive_reason text not null default 'duplicate_user_church_role'
);

alter table public.user_role_duplicate_archive enable row level security;
revoke all on public.user_role_duplicate_archive from anon, authenticated;

with ranked as (
  select id, lower(trim(role::text)) as normalized_role, row_number() over (
    partition by user_id, church_id, lower(trim(role::text))
    order by created_at nulls last, id
  ) as duplicate_number
  from public.user_roles
  where user_id is not null and church_id is not null
    and nullif(trim(role::text), '') is not null
), archived as (
  insert into public.user_role_duplicate_archive (
    id, user_id, church_id, role, normalized_role, created_at
  )
  select ur.id, ur.user_id, ur.church_id, ur.role::text, r.normalized_role, ur.created_at
  from public.user_roles ur
  join ranked r on r.id = ur.id
  where r.duplicate_number > 1
  on conflict (id) do nothing
  returning id
)
delete from public.user_roles ur
using ranked r
where r.id = ur.id and r.duplicate_number > 1;

update public.user_roles
set role = lower(trim(role::text))
where role is distinct from lower(trim(role::text));

alter table public.user_roles
  add constraint user_roles_user_church_role_key unique (user_id, church_id, role);

create index if not exists user_roles_user_church_idx
  on public.user_roles(user_id, church_id);

-- The authorization engine deliberately contains no list of role names. A role
-- is useful only through church_role_permissions rows assigned to it.
create or replace function public.has_church_feature_permission(
  _user_id uuid, _church_id uuid, _feature_key text, _action text
)
returns boolean
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $$
declare
  v_actor uuid := auth.uid();
  v_mandatory boolean;
  v_global_locked boolean;
  v_church_locked boolean;
begin
  if v_actor is null or _user_id is null or _church_id is null
     or nullif(trim(_feature_key), '') is null
     or _action not in ('view','create','edit','delete','approve','publish','manage') then
    return false;
  end if;
  if _user_id <> v_actor
     and not public.is_platform_super_admin(v_actor)
     and not public.is_super_admin(v_actor) then
    return false;
  end if;

  select pf.is_mandatory, pf.globally_locked
  into v_mandatory, v_global_locked
  from public.platform_features pf
  where pf.key = _feature_key;
  if not found then return false; end if;

  if not public.is_feature_available_for_church(_church_id, _feature_key) then return false; end if;
  select cf.locked into v_church_locked
  from public.church_features cf
  join public.platform_features pf on pf.id = cf.feature_id
  where cf.church_id = _church_id and pf.key = _feature_key and cf.enabled;
  if not found then return false; end if;
  if not v_mandatory and _action <> 'view' and (v_global_locked or v_church_locked) then return false; end if;

  if public.is_platform_super_admin(_user_id) or public.is_super_admin(_user_id) then return true; end if;

  return exists (
    select 1
    from public.church_role_permissions crp
    join public.platform_features pf on pf.id = crp.feature_id
    where crp.church_id = _church_id
      and pf.key = _feature_key
      and case _action
        when 'view' then crp.can_view when 'create' then crp.can_create
        when 'edit' then crp.can_edit when 'delete' then crp.can_delete
        when 'approve' then crp.can_approve when 'publish' then crp.can_publish
        when 'manage' then crp.can_manage else false end
      and (
        exists (
          select 1 from public.user_roles ur
          where ur.user_id = _user_id and ur.church_id = _church_id
            and lower(ur.role::text) = crp.role
        )
        or (
          crp.role = 'member'
          and exists (
            select 1 from public.members m
            where m.user_id = _user_id and m.church_id = _church_id
              and coalesce(m.status, 'active') = 'active'
          )
        )
      )
      and ((crp.role = 'member' and pf.member_available)
        or (crp.role <> 'member' and pf.staff_available))
  );
end;
$$;

-- Permission administration discovers role keys from data rather than a fixed
-- application list. Existing seeded rows keep all legacy roles visible.
create or replace function public.get_church_feature_permission_matrix(_church_id uuid)
returns table (
  feature_id uuid, feature_key text, feature_name text, description text,
  category text, globally_enabled boolean, globally_locked boolean,
  subscription_available boolean, member_available boolean, staff_available boolean,
  church_enabled boolean, role text, can_view boolean, can_create boolean,
  can_edit boolean, can_delete boolean, can_approve boolean,
  can_publish boolean, can_manage boolean
)
language sql stable security definer set search_path = pg_catalog, public
as $$
  select pf.id, pf.key, pf.name, pf.description, pf.category,
    pf.globally_enabled, pf.globally_locked,
    public.is_feature_available_for_church(_church_id, pf.key),
    pf.member_available, pf.staff_available, coalesce(cf.enabled, false),
    roles.role,
    coalesce(crp.can_view, false), coalesce(crp.can_create, false),
    coalesce(crp.can_edit, false), coalesce(crp.can_delete, false),
    coalesce(crp.can_approve, false), coalesce(crp.can_publish, false),
    coalesce(crp.can_manage, false)
  from public.platform_features pf
  cross join lateral (
    select distinct role_key as role
    from (
      select crp_role.role as role_key
      from public.church_role_permissions crp_role
      where crp_role.church_id = _church_id
      union all
      select lower(ur.role::text)
      from public.user_roles ur
      where ur.church_id = _church_id
    ) church_roles
  ) roles
  left join public.church_features cf
    on cf.church_id = _church_id and cf.feature_id = pf.id
  left join public.church_role_permissions crp
    on crp.church_id = _church_id and crp.feature_id = pf.id and crp.role = roles.role
  where auth.uid() is not null and public.can_manage_church_roles(auth.uid(), _church_id)
  order by pf.category, pf.name, roles.role;
$$;

-- Assignment now inserts one tuple instead of replacing another role.
create or replace function public.assign_church_member_role(
  _church_id uuid, _user_id uuid, _role text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_role text := lower(nullif(trim(coalesce(_role, '')), ''));
  v_role_id uuid;
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  if _church_id is null or _user_id is null or v_role is null then
    raise exception 'Missing role assignment fields' using errcode = '22023';
  end if;
  if not public.can_manage_church_roles(auth.uid(), _church_id) then
    raise exception 'You do not have permission to manage roles for this church' using errcode = '42501';
  end if;
  if not exists (
    select 1 from public.members m where m.church_id = _church_id
      and m.user_id = _user_id and coalesce(m.status, 'active') = 'active'
  ) then
    raise exception 'This member must have an active linked account in this church' using errcode = '42501';
  end if;
  if not exists (
    select 1 from public.church_role_permissions crp
    where crp.church_id = _church_id and crp.role = v_role
  ) then
    raise exception 'Unknown church role: %', v_role using errcode = '22023';
  end if;
  if exists (
    select 1 from public.user_roles ur where ur.user_id = _user_id
      and ur.church_id = _church_id and lower(ur.role::text) = v_role
  ) then
    raise exception 'This role is already assigned to the user' using errcode = '23505';
  end if;

  insert into public.user_roles (user_id, church_id, role)
  values (_user_id, _church_id, v_role)
  returning id into v_role_id;
  return jsonb_build_object('success', true, 'id', v_role_id, 'role', v_role);
end;
$$;

-- Backward-compatible startup context: `role` remains for old clients while
-- `roles` exposes every assignment for permission-aware routing.
create or replace function public.get_current_user_context()
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_user_id uuid := auth.uid();
  v_profile public.profiles%rowtype;
  v_member public.members%rowtype;
  v_church public.churches%rowtype;
  v_church_id uuid;
  v_role_church_id uuid;
  v_role text;
  v_roles text[] := array[]::text[];
  v_is_super_admin boolean := false;
begin
  if v_user_id is null then
    return jsonb_build_object('profile',null,'role',null,'roles','[]'::jsonb,
      'church_id',null,'church',null,'member',null,'is_super_admin',false,
      'permissions',jsonb_build_object('is_super_admin',false,
        'can_view_church_workspace',false,'can_manage_church_workspace',false));
  end if;

  select * into v_profile from public.profiles where id = v_user_id limit 1;
  v_church_id := v_profile.church_id;
  v_is_super_admin := public.is_super_admin(v_user_id)
    or coalesce(v_profile.role = 'super_admin', false);

  if v_is_super_admin then
    v_role := 'super_admin'; v_roles := array['super_admin'];
  else
    select ur.church_id into v_role_church_id
    from public.user_roles ur where ur.user_id = v_user_id
    order by (ur.church_id = v_church_id) desc, ur.created_at nulls last, ur.id limit 1;
    v_church_id := coalesce(v_role_church_id, v_church_id);
    if v_church_id is null then
      select m.church_id into v_church_id from public.members m
      where m.user_id = v_user_id and m.church_id is not null limit 1;
    end if;
    if v_church_id is null then
      select c.id into v_church_id from public.churches c
      where c.created_by = v_user_id limit 1;
    end if;
    if v_church_id is not null then
      select coalesce(array_agg(distinct lower(ur.role::text)), array[]::text[])
      into v_roles from public.user_roles ur
      where ur.user_id = v_user_id and ur.church_id = v_church_id;
      if exists (select 1 from public.members m where m.user_id=v_user_id
        and m.church_id=v_church_id and coalesce(m.status,'active')='active')
        and not ('member' = any(v_roles)) then v_roles := array_append(v_roles, 'member'); end if;
      select lower(ur.role::text) into v_role from public.user_roles ur
      where ur.user_id=v_user_id and ur.church_id=v_church_id
      order by (lower(ur.role::text) = 'member'), ur.created_at nulls last, ur.id limit 1;
      v_role := coalesce(v_role, 'member');
    end if;
  end if;

  if v_church_id is not null then
    select * into v_member from public.members where user_id=v_user_id and church_id=v_church_id limit 1;
    select * into v_church from public.churches where id=v_church_id limit 1;
  end if;
  return jsonb_build_object(
    'profile',case when v_profile.id is null then null else to_jsonb(v_profile) end,
    'role',v_role,'roles',to_jsonb(v_roles),'church_id',v_church_id,
    'church',case when v_church.id is null then null else to_jsonb(v_church) end,
    'member',case when v_member.id is null then null else to_jsonb(v_member) end,
    'is_super_admin',v_is_super_admin,
    'permissions',jsonb_build_object('is_super_admin',v_is_super_admin,
      'can_view_church_workspace',case when v_church_id is null then false else public.can_view_church_workspace(v_user_id,v_church_id) end,
      'can_manage_church_workspace',case when v_church_id is null then false else public.can_manage_church_workspace(v_user_id,v_church_id) end));
end;
$$;

revoke all on function public.assign_church_member_role(uuid,uuid,text) from public, anon, authenticated;
revoke all on function public.get_church_feature_permission_matrix(uuid) from public, anon, authenticated;
revoke all on function public.get_current_user_context() from public, anon, authenticated;
grant execute on function public.assign_church_member_role(uuid,uuid,text) to authenticated;
grant execute on function public.get_church_feature_permission_matrix(uuid) to authenticated;
grant execute on function public.get_current_user_context() to authenticated;

-- Role changes must invalidate cached effective permissions in every session.
do $$ begin
  alter publication supabase_realtime add table public.user_roles;
exception when duplicate_object or undefined_object then null; end $$;

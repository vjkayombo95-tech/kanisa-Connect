-- Tenant feature controls and church-scoped role permissions.
-- Forward-only: preserves existing access by enabling current catalog features
-- and seeding role defaults that mirror the application's existing workspaces.

alter table public.platform_features
  add column if not exists category text not null default 'General',
  add column if not exists member_available boolean not null default false,
  add column if not exists staff_available boolean not null default true,
  add column if not exists available_plans text[] not null
    default array['free', 'basic', 'intermediate', 'pro', 'enterprise']::text[];

alter table public.church_features
  add column if not exists settings jsonb not null default '{}'::jsonb,
  add column if not exists enabled_by uuid references auth.users(id) on delete set null,
  add column if not exists enabled_at timestamptz,
  add column if not exists locked boolean not null default false;

create table if not exists public.church_role_permissions (
  id uuid primary key default gen_random_uuid(),
  church_id uuid not null references public.churches(id) on delete cascade,
  role text not null,
  feature_id uuid not null references public.platform_features(id) on delete cascade,
  can_view boolean not null default false,
  can_create boolean not null default false,
  can_edit boolean not null default false,
  can_delete boolean not null default false,
  can_approve boolean not null default false,
  can_publish boolean not null default false,
  can_manage boolean not null default false,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint church_role_permissions_role_check
    check (role in ('church_admin', 'pastor', 'secretary', 'treasurer', 'member')),
  constraint church_role_permissions_church_role_feature_key
    unique (church_id, role, feature_id)
);

create index if not exists church_features_church_id_idx on public.church_features(church_id);
create index if not exists church_features_feature_id_idx on public.church_features(feature_id);
create index if not exists church_role_permissions_church_id_idx on public.church_role_permissions(church_id);
create index if not exists church_role_permissions_feature_id_idx on public.church_role_permissions(feature_id);
create index if not exists church_role_permissions_role_idx on public.church_role_permissions(role);

update public.platform_features
set
  category = case
    when key in ('members', 'families', 'communities', 'ministries', 'roles') then 'People'
    when key in ('bible_verses', 'catholic_content', 'prayer_requests', 'mass_intentions', 'sacraments') then 'Liturgy & Pastoral Care'
    when key in ('contributions', 'give', 'pledges', 'finance_intelligence') then 'Finance'
    when key in ('events', 'event_requests', 'announcements', 'sermons', 'community_help') then 'Engagement'
    when key in ('channels', 'notifications') then 'Communication'
    when key in ('reports', 'kanisa_ai', 'operations', 'audio_processing') then 'Operations'
    else 'General'
  end,
  member_available = key in (
    'bible_verses', 'catholic_content', 'prayer_requests', 'mass_intentions',
    'events', 'event_requests', 'announcements', 'ministries', 'community_help',
    'channels', 'give', 'contributions', 'pledges', 'kanisa_ai'
  ),
  staff_available = true;

-- Existing churches keep their current feature access. A disabled row remains
-- disabled, and no feature data is removed.
insert into public.church_features (church_id, feature_id, enabled, enabled_at)
select c.id, pf.id, true, now()
from public.churches c
cross join public.platform_features pf
on conflict (church_id, feature_id) do nothing;

-- Existing behavior becomes the recommended baseline. Church admins retain
-- all actions; other roles receive only the workspaces they already had.
insert into public.church_role_permissions (
  church_id, role, feature_id, can_view, can_create, can_edit, can_delete,
  can_approve, can_publish, can_manage
)
select
  c.id,
  role_name,
  pf.id,
  true,
  role_name = 'church_admin'
    or (role_name = 'pastor' and pf.key in ('prayer_requests','mass_intentions','sacraments','events','announcements','community_help'))
    or (role_name = 'secretary' and pf.key in ('members','families','communities','ministries','events','event_requests','announcements','mass_intentions','notifications','channels'))
    or (role_name = 'treasurer' and pf.key in ('contributions','give','pledges','reports','finance_intelligence'))
    or (role_name = 'member' and pf.key in ('prayer_requests','mass_intentions','event_requests','community_help','give','pledges')),
  role_name = 'church_admin'
    or (role_name = 'pastor' and pf.key in ('prayer_requests','mass_intentions','sacraments','events','announcements','community_help'))
    or (role_name = 'secretary' and pf.key in ('members','families','communities','ministries','events','event_requests','announcements','mass_intentions','notifications','channels'))
    or (role_name = 'treasurer' and pf.key in ('contributions','pledges','reports','finance_intelligence')),
  role_name = 'church_admin',
  role_name = 'church_admin' or (role_name = 'pastor' and pf.key in ('prayer_requests','mass_intentions','sacraments','community_help')),
  role_name = 'church_admin' or (role_name in ('pastor','secretary') and pf.key in ('announcements','events','sermons')),
  role_name = 'church_admin'
from public.churches c
cross join unnest(array['church_admin','pastor','secretary','treasurer','member']) role_name
cross join public.platform_features pf
where (role_name <> 'member' or pf.member_available)
  and (role_name = 'member' or pf.staff_available)
on conflict (church_id, role, feature_id) do nothing;

create or replace function public.touch_church_permission_updated_at()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists touch_church_role_permissions on public.church_role_permissions;
create trigger touch_church_role_permissions
before update on public.church_role_permissions
for each row execute function public.touch_church_permission_updated_at();

create or replace function public.is_feature_available_for_church(_church_id uuid, _feature_key text)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.platform_features pf
    where pf.key = _feature_key
      and pf.globally_enabled
      and not pf.globally_locked
      and coalesce((
        select s.plan = any(pf.available_plans)
        from public.subscriptions s
        where s.church_id = _church_id
          and s.status in ('active', 'trial')
          and (s.expires_at is null or s.expires_at > now())
        order by s.started_at desc
        limit 1
      ), 'free' = any(pf.available_plans))
  );
$$;

create or replace function public.has_church_feature_permission(
  _user_id uuid,
  _church_id uuid,
  _feature_key text,
  _action text
)
returns boolean
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_role text;
  v_allowed boolean := false;
begin
  if _user_id is null or _church_id is null
     or _action not in ('view','create','edit','delete','approve','publish','manage') then
    return false;
  end if;

  if auth.uid() is not null and _user_id <> auth.uid()
     and not public.is_platform_super_admin(auth.uid())
     and not public.is_super_admin(auth.uid()) then
    return false;
  end if;

  if not exists (select 1 from public.platform_features where key = _feature_key) then
    return false;
  end if;

  if not public.is_feature_available_for_church(_church_id, _feature_key) then
    return false;
  end if;

  if not exists (
    select 1 from public.church_features cf
    join public.platform_features pf on pf.id = cf.feature_id
    where cf.church_id = _church_id and pf.key = _feature_key and cf.enabled and not cf.locked
  ) then
    return false;
  end if;

  if public.is_platform_super_admin(_user_id) or public.is_super_admin(_user_id) then
    return true;
  end if;

  select lower(ur.role::text) into v_role
  from public.user_roles ur
  where ur.user_id = _user_id and ur.church_id = _church_id
  limit 1;

  if v_role is null then
    select 'member' into v_role
    where exists (
      select 1 from public.members m
      where m.user_id = _user_id and m.church_id = _church_id
        and coalesce(m.status, 'active') = 'active'
    );
  end if;

  if v_role is null then return false; end if;

  select case _action
    when 'view' then crp.can_view when 'create' then crp.can_create
    when 'edit' then crp.can_edit when 'delete' then crp.can_delete
    when 'approve' then crp.can_approve when 'publish' then crp.can_publish
    when 'manage' then crp.can_manage else false end
  into v_allowed
  from public.church_role_permissions crp
  join public.platform_features pf on pf.id = crp.feature_id
  where crp.church_id = _church_id and crp.role = v_role and pf.key = _feature_key;

  return coalesce(v_allowed, false);
end;
$$;

create or replace function public.get_church_feature_permission_matrix(_church_id uuid)
returns table (
  feature_id uuid, feature_key text, feature_name text, description text,
  category text, globally_enabled boolean, globally_locked boolean,
  subscription_available boolean, member_available boolean, staff_available boolean,
  church_enabled boolean, role text, can_view boolean, can_create boolean,
  can_edit boolean, can_delete boolean, can_approve boolean,
  can_publish boolean, can_manage boolean
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select pf.id, pf.key, pf.name, pf.description, pf.category,
    pf.globally_enabled, pf.globally_locked,
    public.is_feature_available_for_church(_church_id, pf.key),
    pf.member_available, pf.staff_available, coalesce(cf.enabled, true),
    crp.role, coalesce(crp.can_view,false), coalesce(crp.can_create,false),
    coalesce(crp.can_edit,false), coalesce(crp.can_delete,false),
    coalesce(crp.can_approve,false), coalesce(crp.can_publish,false),
    coalesce(crp.can_manage,false)
  from public.platform_features pf
  left join public.church_features cf on cf.church_id = _church_id and cf.feature_id = pf.id
  cross join unnest(array['church_admin','pastor','secretary','treasurer','member']) roles(role)
  left join public.church_role_permissions crp
    on crp.church_id = _church_id and crp.feature_id = pf.id and crp.role = roles.role
  where public.can_manage_church_roles(auth.uid(), _church_id)
  order by pf.category, pf.name, roles.role;
$$;

create or replace function public.set_church_feature_enabled(
  _church_id uuid, _feature_key text, _enabled boolean
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare v_feature_id uuid;
begin
  if not public.can_manage_church_roles(auth.uid(), _church_id) then
    raise exception 'Permission denied' using errcode = '42501';
  end if;
  select id into v_feature_id from public.platform_features where key = _feature_key;
  if v_feature_id is null then raise exception 'Unknown feature' using errcode = '22023'; end if;
  if _enabled and not public.is_feature_available_for_church(_church_id, _feature_key) then
    raise exception 'Feature is unavailable globally or under this subscription' using errcode = '42501';
  end if;
  insert into public.church_features (church_id, feature_id, enabled, enabled_by, enabled_at)
  values (_church_id, v_feature_id, _enabled, auth.uid(), case when _enabled then now() end)
  on conflict (church_id, feature_id) do update set
    enabled = excluded.enabled, enabled_by = auth.uid(),
    enabled_at = case when excluded.enabled then now() else public.church_features.enabled_at end,
    updated_at = now();
  perform public.create_audit_log('church_feature.updated', 'church_feature', v_feature_id,
    'Church feature setting changed', jsonb_build_object('church_id', _church_id, 'feature_key', _feature_key, 'enabled', _enabled));
end;
$$;

create or replace function public.save_church_role_permissions(
  _church_id uuid, _role text, _permissions jsonb
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare v_item jsonb; v_feature_id uuid; v_key text;
begin
  _role := lower(trim(coalesce(_role,'')));
  if not public.can_manage_church_roles(auth.uid(), _church_id) then
    raise exception 'Permission denied' using errcode = '42501';
  end if;
  if _role not in ('church_admin','pastor','secretary','treasurer','member') or jsonb_typeof(_permissions) <> 'array' then
    raise exception 'Invalid permission payload' using errcode = '22023';
  end if;
  for v_item in select value from jsonb_array_elements(_permissions) loop
    v_key := v_item->>'feature_key';
    select id into v_feature_id from public.platform_features where key = v_key;
    if v_feature_id is null then raise exception 'Unknown feature: %', v_key using errcode = '22023'; end if;
    if _role = 'church_admin' and v_key = 'roles'
       and (not coalesce((v_item->>'can_view')::boolean,false) or not coalesce((v_item->>'can_manage')::boolean,false)) then
      raise exception 'The final administrative path to Features & Permissions cannot be removed' using errcode = '42501';
    end if;
    insert into public.church_role_permissions (
      church_id, role, feature_id, can_view, can_create, can_edit, can_delete,
      can_approve, can_publish, can_manage, updated_by
    ) values (
      _church_id, _role, v_feature_id,
      coalesce((v_item->>'can_view')::boolean,false), coalesce((v_item->>'can_create')::boolean,false),
      coalesce((v_item->>'can_edit')::boolean,false), coalesce((v_item->>'can_delete')::boolean,false),
      coalesce((v_item->>'can_approve')::boolean,false), coalesce((v_item->>'can_publish')::boolean,false),
      coalesce((v_item->>'can_manage')::boolean,false), auth.uid()
    ) on conflict (church_id, role, feature_id) do update set
      can_view=excluded.can_view, can_create=excluded.can_create, can_edit=excluded.can_edit,
      can_delete=excluded.can_delete, can_approve=excluded.can_approve,
      can_publish=excluded.can_publish, can_manage=excluded.can_manage, updated_by=auth.uid();
  end loop;
  perform public.create_audit_log('church_permissions.updated', 'church_role_permissions', null,
    'Church role permissions changed', jsonb_build_object('church_id', _church_id, 'role', _role, 'permissions', _permissions));
end;
$$;

alter table public.church_role_permissions enable row level security;
drop policy if exists "Church members read role permissions" on public.church_role_permissions;
create policy "Church members read role permissions" on public.church_role_permissions
for select to authenticated using (
  public.is_super_admin(auth.uid()) or public.is_platform_super_admin(auth.uid())
  or public.can_manage_church_roles(auth.uid(), church_role_permissions.church_id)
  or exists (select 1 from public.user_roles ur where ur.user_id=auth.uid() and ur.church_id=church_role_permissions.church_id and lower(ur.role::text)=church_role_permissions.role)
  or (church_role_permissions.role='member' and exists (select 1 from public.members m where m.user_id=auth.uid() and m.church_id=church_role_permissions.church_id))
);

drop policy if exists "Church admins read church features" on public.church_features;
create policy "Church admins read church features" on public.church_features
for select to authenticated using (
  public.is_super_admin(auth.uid()) or public.is_platform_super_admin(auth.uid())
  or exists (select 1 from public.user_roles ur where ur.user_id=auth.uid() and ur.church_id=church_features.church_id)
  or exists (select 1 from public.members m where m.user_id=auth.uid() and m.church_id=church_features.church_id)
);

revoke all on public.church_role_permissions from anon, authenticated;
grant select on public.church_role_permissions to authenticated;
grant execute on function public.is_feature_available_for_church(uuid,text) to authenticated;
grant execute on function public.has_church_feature_permission(uuid,uuid,text,text) to authenticated;
grant execute on function public.get_church_feature_permission_matrix(uuid) to authenticated;
grant execute on function public.set_church_feature_enabled(uuid,text,boolean) to authenticated;
grant execute on function public.save_church_role_permissions(uuid,text,jsonb) to authenticated;

-- Restrictive policies complement (rather than replace) existing tenant and
-- ownership policies. A row must still pass its original record-level policy,
-- including member-own-record checks, as well as the feature/action decision.
do $$
declare
  v_entry record;
  v_action text;
  v_command text;
begin
  for v_entry in
    select * from (values
      ('announcements','announcements'), ('events','events'),
      ('prayer_requests','prayer_requests'), ('mass_intentions','mass_intentions'),
      ('contributions','contributions'), ('pledges','pledges'),
      ('ministries','ministries'), ('community_help_requests','community_help')
    ) as entries(table_name, feature_key)
  loop
    if to_regclass('public.' || v_entry.table_name) is null then continue; end if;
    for v_action, v_command in select * from (values
      ('view','select'), ('create','insert'), ('edit','update'), ('delete','delete')
    ) actions(action_name, command_name)
    loop
      execute format('drop policy if exists %I on public.%I',
        'feature permission ' || v_command, v_entry.table_name);
      if v_command = 'insert' then
        execute format('create policy %I on public.%I as restrictive for insert to authenticated with check (public.has_church_feature_permission(auth.uid(), church_id, %L, %L))',
          'feature permission ' || v_command, v_entry.table_name, v_entry.feature_key, v_action);
      elsif v_command = 'update' then
        execute format('create policy %I on public.%I as restrictive for update to authenticated using (public.has_church_feature_permission(auth.uid(), church_id, %L, %L)) with check (public.has_church_feature_permission(auth.uid(), church_id, %L, %L))',
          'feature permission ' || v_command, v_entry.table_name, v_entry.feature_key, v_action, v_entry.feature_key, v_action);
      else
        execute format('create policy %I on public.%I as restrictive for %s to authenticated using (public.has_church_feature_permission(auth.uid(), church_id, %L, %L))',
          'feature permission ' || v_command, v_entry.table_name, v_command, v_entry.feature_key, v_action);
      end if;
    end loop;
  end loop;
end;
$$;

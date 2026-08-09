-- Security hardening for tenant feature permissions.
-- This migration is additive/forward-only and intentionally contains no DROP TABLE,
-- DROP COLUMN, data deletion, or destructive backfill.

alter table public.platform_features
  add column if not exists church_configurable boolean not null default true,
  add column if not exists is_mandatory boolean not null default false;

alter table public.platform_features
  alter column available_plans set default array[]::text[];

alter table public.church_role_permissions
  drop constraint if exists church_role_permissions_role_check;

-- A separate, mandatory recovery capability prevents the feature editor from
-- disabling the only route that can repair feature and role permissions.
insert into public.platform_features (
  key, name, description, category, globally_enabled, globally_locked,
  member_available, staff_available, available_plans, church_configurable, is_mandatory
)
values (
  'feature_permissions_admin', 'Features & Permissions',
  'Mandatory church administration recovery capability.', 'Administration',
  true, true, false, true,
  array['free','basic','intermediate','pro','enterprise'], true, true
)
on conflict (key) do update set
  name = excluded.name,
  description = excluded.description,
  category = excluded.category,
  globally_enabled = true,
  globally_locked = true,
  member_available = false,
  staff_available = true,
  available_plans = excluded.available_plans,
  church_configurable = true,
  is_mandatory = true;

-- Explicit plan mapping. This mirrors the cumulative application billing model:
-- Free core; Basic parish records; Intermediate media; Pro collaboration and
-- intelligence; Enterprise operational tooling. Unknown/new features get no plan.
update public.platform_features pf
set available_plans = catalog.available_plans
from (values
  ('feature_permissions_admin', array['free','basic','intermediate','pro','enterprise']::text[]),
  ('bible_verses', array['free','basic','intermediate','pro','enterprise']::text[]),
  ('catholic_content', array['free','basic','intermediate','pro','enterprise']::text[]),
  ('prayer_requests', array['free','basic','intermediate','pro','enterprise']::text[]),
  ('mass_intentions', array['free','basic','intermediate','pro','enterprise']::text[]),
  ('announcements', array['free','basic','intermediate','pro','enterprise']::text[]),
  ('give', array['basic','intermediate','pro','enterprise']::text[]),
  ('members', array['basic','intermediate','pro','enterprise']::text[]),
  ('families', array['basic','intermediate','pro','enterprise']::text[]),
  ('contributions', array['basic','intermediate','pro','enterprise']::text[]),
  ('pledges', array['basic','intermediate','pro','enterprise']::text[]),
  ('events', array['basic','intermediate','pro','enterprise']::text[]),
  ('event_requests', array['basic','intermediate','pro','enterprise']::text[]),
  ('reports', array['basic','intermediate','pro','enterprise']::text[]),
  ('audio_processing', array['intermediate','pro','enterprise']::text[]),
  ('communities', array['pro','enterprise']::text[]),
  ('ministries', array['pro','enterprise']::text[]),
  ('community_help', array['pro','enterprise']::text[]),
  ('channels', array['pro','enterprise']::text[]),
  ('notifications', array['pro','enterprise']::text[]),
  ('sermons', array['pro','enterprise']::text[]),
  ('sacraments', array['pro','enterprise']::text[]),
  ('finance_intelligence', array['pro','enterprise']::text[]),
  ('kanisa_ai', array['pro','enterprise']::text[]),
  ('operations', array['enterprise']::text[]),
  ('roles', array['basic','intermediate','pro','enterprise']::text[])
) as catalog(feature_key, available_plans)
where pf.key = catalog.feature_key;

-- Unknown catalog entries are deliberately unavailable until assigned to plans.
update public.platform_features
set available_plans = array[]::text[]
where key not in (
  'feature_permissions_admin','bible_verses','catholic_content','prayer_requests',
  'mass_intentions','announcements','give','members','families','contributions',
  'pledges','events','event_requests','reports','audio_processing','communities',
  'ministries','community_help','channels','notifications','sermons','sacraments',
  'finance_intelligence','kanisa_ai','operations','roles'
);

insert into public.church_features (church_id, feature_id, enabled, locked, enabled_at)
select c.id, pf.id, true, true, now()
from public.churches c
join public.platform_features pf on pf.key = 'feature_permissions_admin'
on conflict (church_id, feature_id) do update set enabled = true, locked = true;

insert into public.church_role_permissions (
  church_id, role, feature_id, can_view, can_manage
)
select c.id, 'church_admin', pf.id, true, true
from public.churches c
join public.platform_features pf on pf.key = 'feature_permissions_admin'
on conflict (church_id, role, feature_id) do update
set can_view = true, can_manage = true;

-- Compatibility repairs for established self-service and staff workflows. RLS
-- ownership predicates remain authoritative, so these action grants do not let
-- members operate on another member's rows or create staff-owned parent records.
update public.church_role_permissions crp set
  can_create = case when pf.key in ('events','contributions','ministries') then true else crp.can_create end,
  can_edit = case when pf.key in ('events','prayer_requests','mass_intentions','community_help','pledges') then true else crp.can_edit end,
  can_delete = case when pf.key in ('prayer_requests','ministries') then true else crp.can_delete end
from public.platform_features pf
where crp.feature_id = pf.id and crp.role = 'member';

update public.church_role_permissions crp set
  can_approve = case
    when crp.role = 'treasurer' and pf.key in ('pledges','contributions') then true
    when crp.role = 'secretary' and pf.key in ('events','event_requests') then true
    else crp.can_approve end
from public.platform_features pf
where crp.feature_id = pf.id;

update public.church_role_permissions crp set can_manage = true
from public.platform_features pf
where crp.feature_id = pf.id and (
  (crp.role = 'secretary' and pf.key = 'events')
  or (crp.role = 'pastor' and pf.key = 'mass_intentions')
  or (crp.role = 'treasurer' and pf.key in ('reports','finance_intelligence'))
);

update public.church_role_permissions crp set
  can_create = true, can_edit = true, can_delete = true
from public.platform_features pf
where crp.feature_id = pf.id and crp.role in ('pastor','secretary') and pf.key = 'sermons';

update public.church_role_permissions crp set can_publish = true
from public.platform_features pf
where crp.feature_id = pf.id and crp.role = 'secretary' and pf.key = 'notifications';

create or replace function public.is_feature_available_for_church(_church_id uuid, _feature_key text)
returns boolean
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $$
begin
  if auth.uid() is null or _church_id is null or nullif(trim(_feature_key), '') is null then
    return false;
  end if;
  if not (
    public.is_platform_super_admin(auth.uid())
    or public.is_super_admin(auth.uid())
    or exists (select 1 from public.user_roles ur where ur.user_id = auth.uid() and ur.church_id = _church_id)
    or exists (select 1 from public.members m where m.user_id = auth.uid() and m.church_id = _church_id and coalesce(m.status, 'active') = 'active')
  ) then
    return false;
  end if;
  return exists (
    select 1
    from public.platform_features pf
    join lateral (
      select s.plan::text as plan
      from public.subscriptions s
      where s.church_id = _church_id
        and s.status in ('active', 'trial')
        and (s.expires_at is null or s.expires_at > now())
      order by s.started_at desc
      limit 1
    ) subscription on true
    where pf.key = _feature_key
      and pf.globally_enabled
      and subscription.plan = any(pf.available_plans)
  );
end;
$$;

create or replace function public.is_service_feature_available(_church_id uuid, _feature_key text)
returns boolean language sql stable security invoker set search_path = pg_catalog, public
as $$
  select auth.role() = 'service_role' and exists (
    select 1 from public.platform_features pf
    join public.church_features cf on cf.feature_id = pf.id and cf.church_id = _church_id and cf.enabled
    join lateral (
      select s.plan::text as plan from public.subscriptions s
      where s.church_id = _church_id and s.status in ('active','trial')
        and (s.expires_at is null or s.expires_at > now())
      order by s.started_at desc limit 1
    ) subscription on true
    where pf.key = _feature_key and pf.globally_enabled and not pf.globally_locked and not cf.locked
      and subscription.plan = any(pf.available_plans)
  );
$$;

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
  v_role text;
  v_allowed boolean;
  v_member_available boolean;
  v_staff_available boolean;
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

  select pf.member_available, pf.staff_available, pf.is_mandatory, pf.globally_locked
    into v_member_available, v_staff_available, v_mandatory, v_global_locked
  from public.platform_features pf
  where pf.key = _feature_key;
  if not found then return false; end if;

  -- Super Admin bypass is intentionally limited to authenticated platform
  -- super administrators. Tenant feature state and plan eligibility still apply.
  if not public.is_feature_available_for_church(_church_id, _feature_key) then return false; end if;
  select cf.locked into v_church_locked
    from public.church_features cf
    join public.platform_features pf on pf.id = cf.feature_id
    where cf.church_id = _church_id and pf.key = _feature_key
      and cf.enabled;
  if not found then return false; end if;
  if not v_mandatory and _action <> 'view' and (v_global_locked or v_church_locked) then return false; end if;

  if public.is_platform_super_admin(_user_id) or public.is_super_admin(_user_id) then return true; end if;

  select lower(ur.role::text) into v_role
  from public.user_roles ur
  where ur.user_id = _user_id and ur.church_id = _church_id
  limit 1;
  if v_role is null and exists (
    select 1 from public.members m
    where m.user_id = _user_id and m.church_id = _church_id
      and coalesce(m.status, 'active') = 'active'
  ) then v_role := 'member'; end if;
  if v_role is null then return false; end if;
  if v_role = 'member' and not v_member_available then return false; end if;
  if v_role <> 'member' and not v_staff_available then return false; end if;

  -- Mandatory recovery remains available to an active Church Admin even if a
  -- malformed permission row was introduced outside the supported RPC.
  if v_mandatory and _feature_key = 'feature_permissions_admin'
     and v_role = 'church_admin' and _action in ('view','manage') then return true; end if;

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
    select unnest(array['church_admin','pastor','secretary','treasurer','member']) as role
    union
    select lower(ur.role::text) from public.user_roles ur where ur.church_id = _church_id
  ) roles
  left join public.church_features cf on cf.church_id = _church_id and cf.feature_id = pf.id
  left join public.church_role_permissions crp
    on crp.church_id = _church_id and crp.feature_id = pf.id and crp.role = roles.role
  where auth.uid() is not null and public.can_manage_church_roles(auth.uid(), _church_id)
  order by pf.category, pf.name, roles.role;
$$;

create or replace function public.set_church_feature_enabled(_church_id uuid, _feature_key text, _enabled boolean)
returns void language plpgsql security definer set search_path = pg_catalog, public
as $$
declare v_feature public.platform_features%rowtype;
begin
  if auth.uid() is null or not public.has_church_feature_permission(auth.uid(), _church_id, 'feature_permissions_admin', 'manage') then
    raise exception 'Permission denied' using errcode = '42501';
  end if;
  select * into v_feature from public.platform_features where key = _feature_key;
  if v_feature.id is null then raise exception 'Unknown feature' using errcode = '22023'; end if;
  if not v_feature.church_configurable then raise exception 'Feature is not church configurable' using errcode = '42501'; end if;
  if v_feature.is_mandatory and not _enabled then raise exception 'Mandatory recovery feature cannot be disabled' using errcode = '42501'; end if;
  if _enabled and not public.is_feature_available_for_church(_church_id, _feature_key) then
    raise exception 'Feature is unavailable globally or under this subscription' using errcode = '42501';
  end if;
  insert into public.church_features (church_id, feature_id, enabled, locked, enabled_by, enabled_at)
  values (_church_id, v_feature.id, _enabled, v_feature.is_mandatory, auth.uid(), case when _enabled then now() end)
  on conflict (church_id, feature_id) do update set
    enabled = excluded.enabled,
    locked = case when v_feature.is_mandatory then true else public.church_features.locked end,
    enabled_by = auth.uid(), enabled_at = case when excluded.enabled then now() else null end,
    updated_at = now();
  perform public.create_audit_log(
    'church_feature.updated', 'church_feature', v_feature.id,
    'Church feature setting changed',
    jsonb_build_object('church_id', _church_id, 'feature_key', _feature_key, 'enabled', _enabled)
  );
end;
$$;

create or replace function public.save_church_role_permissions(_church_id uuid, _role text, _permissions jsonb)
returns void language plpgsql security definer set search_path = pg_catalog, public
as $$
declare v_item jsonb; v_feature public.platform_features%rowtype; v_key text;
begin
  _role := lower(trim(coalesce(_role,'')));
  if auth.uid() is null or not public.has_church_feature_permission(auth.uid(), _church_id, 'feature_permissions_admin', 'manage') then
    raise exception 'Permission denied' using errcode = '42501';
  end if;
  if (_role not in ('church_admin','pastor','secretary','treasurer','member') and not exists (
        select 1 from public.user_roles ur where ur.church_id = _church_id and lower(ur.role::text) = _role
      )) or jsonb_typeof(_permissions) <> 'array' then
    raise exception 'Invalid permission payload' using errcode = '22023';
  end if;
  for v_item in select value from jsonb_array_elements(_permissions) loop
    v_key := nullif(trim(v_item->>'feature_key'), '');
    select * into v_feature from public.platform_features where key = v_key;
    if v_feature.id is null then raise exception 'Unknown feature: %', v_key using errcode = '22023'; end if;
    if not v_feature.church_configurable then raise exception 'Feature is not church configurable: %', v_key using errcode = '42501'; end if;
    if (_role = 'member' and not v_feature.member_available)
       or (_role <> 'member' and not v_feature.staff_available) then
      raise exception 'Feature is not applicable to role: % / %', v_key, _role using errcode = '42501';
    end if;
    if v_feature.is_mandatory and _role = 'church_admin'
       and (not coalesce((v_item->>'can_view')::boolean,false)
         or not coalesce((v_item->>'can_manage')::boolean,false)) then
      raise exception 'The final administrative recovery path cannot be removed' using errcode = '42501';
    end if;
    insert into public.church_role_permissions (
      church_id, role, feature_id, can_view, can_create, can_edit, can_delete,
      can_approve, can_publish, can_manage, updated_by
    ) values (
      _church_id, _role, v_feature.id,
      coalesce((v_item->>'can_view')::boolean,false), coalesce((v_item->>'can_create')::boolean,false),
      coalesce((v_item->>'can_edit')::boolean,false), coalesce((v_item->>'can_delete')::boolean,false),
      coalesce((v_item->>'can_approve')::boolean,false), coalesce((v_item->>'can_publish')::boolean,false),
      coalesce((v_item->>'can_manage')::boolean,false), auth.uid()
    ) on conflict (church_id, role, feature_id) do update set
      can_view=excluded.can_view, can_create=excluded.can_create, can_edit=excluded.can_edit,
      can_delete=excluded.can_delete, can_approve=excluded.can_approve,
      can_publish=excluded.can_publish, can_manage=excluded.can_manage,
      updated_by=auth.uid();
  end loop;
  perform public.create_audit_log(
    'church_permissions.updated', 'church_role_permissions', null,
    'Church role permissions changed',
    jsonb_build_object('church_id', _church_id, 'role', _role, 'permissions', _permissions)
  );
end;
$$;

create or replace function public.recommended_church_feature_permission(_role text, _feature_key text, _action text, _member_available boolean, _staff_available boolean)
returns boolean language sql immutable set search_path = pg_catalog
as $$
  select case
    when _role = 'church_admin' then true
    when _action = 'view' then case when _role = 'member' then _member_available else _staff_available end
    when _role = 'member' and _action = 'create' and _feature_key in ('prayer_requests','mass_intentions','event_requests','community_help','give','contributions','pledges','events') then true
    when _role = 'member' and _action = 'edit' and _feature_key in ('prayer_requests','mass_intentions','community_help','pledges') then true
    when _role = 'member' and _action = 'edit' and _feature_key = 'events' then true
    when _role = 'member' and _action = 'delete' and _feature_key in ('prayer_requests','ministries') then true
    when _role = 'member' and _action = 'create' and _feature_key = 'ministries' then true
    when _role = 'pastor' and _action in ('create','edit') and _feature_key in ('prayer_requests','mass_intentions','sacraments','announcements','community_help') then true
    when _role = 'pastor' and _action = 'approve' and _feature_key in ('prayer_requests','mass_intentions','sacraments','community_help') then true
    when _role = 'pastor' and _action = 'publish' and _feature_key in ('announcements','sermons') then true
    when _role = 'pastor' and _action in ('create','edit','delete') and _feature_key = 'sermons' then true
    when _role = 'secretary' and _action in ('create','edit') and _feature_key in ('members','families','communities','ministries','events','event_requests','announcements','mass_intentions','notifications','channels') then true
    when _role = 'secretary' and _action = 'delete' and _feature_key in ('events','announcements') then true
    when _role = 'secretary' and _action = 'approve' and _feature_key in ('events','event_requests') then true
    when _role = 'secretary' and _action = 'publish' and _feature_key in ('events','announcements') then true
    when _role = 'secretary' and _action = 'publish' and _feature_key = 'notifications' then true
    when _role = 'secretary' and _action in ('create','edit','delete') and _feature_key = 'sermons' then true
    when _role = 'treasurer' and _action in ('create','edit') and _feature_key in ('contributions','pledges','reports','finance_intelligence') then true
    when _role = 'treasurer' and _action = 'approve' and _feature_key in ('contributions','pledges') then true
    when _role = 'secretary' and _action = 'manage' and _feature_key = 'events' then true
    when _role = 'pastor' and _action = 'manage' and _feature_key = 'mass_intentions' then true
    when _role = 'treasurer' and _action = 'manage' and _feature_key in ('reports','finance_intelligence') then true
    else false end;
$$;

-- Provision every future church explicitly. Future catalog features are seeded
-- disabled with no role permissions, so a missing row can never grant access.
create or replace function public.provision_church_feature_permissions()
returns trigger language plpgsql security definer set search_path = pg_catalog, public
as $$
begin
  if auth.uid() is null and auth.role() <> 'service_role' and session_user not in ('postgres','supabase_admin') then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  insert into public.church_features (church_id, feature_id, enabled, locked, enabled_at)
  select new.id, pf.id, pf.is_mandatory or cardinality(pf.available_plans) > 0, pf.is_mandatory,
    case when pf.is_mandatory or cardinality(pf.available_plans) > 0 then now() else null end
  from public.platform_features pf where true
  on conflict (church_id, feature_id) do nothing;
  insert into public.church_role_permissions (
    church_id, role, feature_id, can_view, can_create, can_edit, can_delete,
    can_approve, can_publish, can_manage
  )
  select new.id, r.role, pf.id,
    public.recommended_church_feature_permission(r.role,pf.key,'view',pf.member_available,pf.staff_available),
    public.recommended_church_feature_permission(r.role,pf.key,'create',pf.member_available,pf.staff_available),
    public.recommended_church_feature_permission(r.role,pf.key,'edit',pf.member_available,pf.staff_available),
    public.recommended_church_feature_permission(r.role,pf.key,'delete',pf.member_available,pf.staff_available),
    public.recommended_church_feature_permission(r.role,pf.key,'approve',pf.member_available,pf.staff_available),
    public.recommended_church_feature_permission(r.role,pf.key,'publish',pf.member_available,pf.staff_available),
    public.recommended_church_feature_permission(r.role,pf.key,'manage',pf.member_available,pf.staff_available)
  from public.platform_features pf
  cross join unnest(array['church_admin','pastor','secretary','treasurer','member']) r(role)
  on conflict (church_id, role, feature_id) do nothing;
  return new;
end;
$$;

drop trigger if exists provision_church_feature_permissions on public.churches;
create trigger provision_church_feature_permissions after insert on public.churches
for each row execute function public.provision_church_feature_permissions();

create or replace function public.provision_new_platform_feature()
returns trigger language plpgsql security definer set search_path = pg_catalog, public
as $$
begin
  if auth.uid() is null and auth.role() <> 'service_role' and session_user not in ('postgres','supabase_admin') then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  insert into public.church_features (church_id, feature_id, enabled, locked, enabled_at)
  select c.id, new.id, new.is_mandatory, new.is_mandatory,
    case when new.is_mandatory then now() else null end
  from public.churches c where true
  on conflict (church_id, feature_id) do nothing;
  insert into public.church_role_permissions (
    church_id, role, feature_id, can_view, can_create, can_edit, can_delete,
    can_approve, can_publish, can_manage
  )
  select c.id, r.role, new.id,
    public.recommended_church_feature_permission(r.role,new.key,'view',new.member_available,new.staff_available),
    public.recommended_church_feature_permission(r.role,new.key,'create',new.member_available,new.staff_available),
    public.recommended_church_feature_permission(r.role,new.key,'edit',new.member_available,new.staff_available),
    public.recommended_church_feature_permission(r.role,new.key,'delete',new.member_available,new.staff_available),
    public.recommended_church_feature_permission(r.role,new.key,'approve',new.member_available,new.staff_available),
    public.recommended_church_feature_permission(r.role,new.key,'publish',new.member_available,new.staff_available),
    public.recommended_church_feature_permission(r.role,new.key,'manage',new.member_available,new.staff_available)
  from public.churches c
  cross join unnest(array['church_admin','pastor','secretary','treasurer','member']) r(role)
  on conflict (church_id, role, feature_id) do nothing;
  return new;
end;
$$;

drop trigger if exists provision_new_platform_feature on public.platform_features;
create trigger provision_new_platform_feature after insert on public.platform_features
for each row execute function public.provision_new_platform_feature();

create or replace function public.provision_new_church_role()
returns trigger language plpgsql security definer set search_path = pg_catalog, public
as $$
declare v_role text := lower(new.role::text);
begin
  if auth.uid() is null and auth.role() <> 'service_role' and session_user not in ('postgres','supabase_admin') then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  insert into public.church_role_permissions (
    church_id, role, feature_id, can_view, can_create, can_edit, can_delete,
    can_approve, can_publish, can_manage
  )
  select new.church_id, v_role, pf.id,
    public.recommended_church_feature_permission(v_role,pf.key,'view',pf.member_available,pf.staff_available),
    public.recommended_church_feature_permission(v_role,pf.key,'create',pf.member_available,pf.staff_available),
    public.recommended_church_feature_permission(v_role,pf.key,'edit',pf.member_available,pf.staff_available),
    public.recommended_church_feature_permission(v_role,pf.key,'delete',pf.member_available,pf.staff_available),
    public.recommended_church_feature_permission(v_role,pf.key,'approve',pf.member_available,pf.staff_available),
    public.recommended_church_feature_permission(v_role,pf.key,'publish',pf.member_available,pf.staff_available),
    public.recommended_church_feature_permission(v_role,pf.key,'manage',pf.member_available,pf.staff_available)
  from public.platform_features pf
  on conflict (church_id, role, feature_id) do nothing;
  return new;
end;
$$;

drop trigger if exists provision_new_church_role on public.user_roles;
create trigger provision_new_church_role after insert or update of role, church_id on public.user_roles
for each row execute function public.provision_new_church_role();

-- Protect the final Church Admin assignment against deletion or demotion.
create or replace function public.protect_last_church_admin()
returns trigger language plpgsql set search_path = pg_catalog, public
as $$
begin
  if lower(old.role::text) = 'church_admin'
     and (tg_op = 'DELETE' or new.church_id <> old.church_id or lower(new.role::text) <> 'church_admin')
     and (select count(*) from public.user_roles ur where ur.church_id = old.church_id and lower(ur.role::text) = 'church_admin') <= 1 then
    raise exception 'The final Church Admin cannot be removed or demoted' using errcode = '23514';
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

drop trigger if exists protect_last_church_admin on public.user_roles;
create trigger protect_last_church_admin before update or delete on public.user_roles
for each row execute function public.protect_last_church_admin();

create or replace function public.protect_mandatory_feature()
returns trigger language plpgsql set search_path = pg_catalog, public
as $$
begin
  if tg_table_name = 'platform_features' and old.is_mandatory and (
    tg_op = 'DELETE' or not new.is_mandatory or not new.globally_enabled
    or not new.globally_locked or new.key <> old.key
  ) then
    raise exception 'Mandatory recovery feature cannot be weakened or removed' using errcode = '23514';
  end if;
  if tg_table_name = 'church_features' and exists (
    select 1 from public.platform_features pf where pf.id = old.feature_id and pf.is_mandatory
  ) and (tg_op = 'DELETE' or not new.enabled or not new.locked or new.feature_id <> old.feature_id or new.church_id <> old.church_id) then
    raise exception 'Mandatory church recovery feature cannot be weakened or removed' using errcode = '23514';
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

drop trigger if exists protect_mandatory_platform_feature on public.platform_features;
create trigger protect_mandatory_platform_feature before update or delete on public.platform_features
for each row execute function public.protect_mandatory_feature();
drop trigger if exists protect_mandatory_church_feature on public.church_features;
create trigger protect_mandatory_church_feature before update or delete on public.church_features
for each row execute function public.protect_mandatory_feature();

create or replace function public.audit_feature_control_change()
returns trigger language plpgsql security definer set search_path = pg_catalog, public
as $$
begin
  if auth.uid() is null and auth.role() <> 'service_role' and session_user not in ('postgres','supabase_admin') then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  perform public.create_audit_log(
    case when tg_table_name = 'platform_features' then 'platform_feature.updated' else 'church_feature.override_updated' end,
    tg_table_name, new.id, 'Feature control changed',
    jsonb_build_object('old', to_jsonb(old), 'new', to_jsonb(new))
  );
  return new;
end;
$$;

drop trigger if exists audit_platform_feature_control on public.platform_features;
create trigger audit_platform_feature_control after update on public.platform_features
for each row when (old is distinct from new) execute function public.audit_feature_control_change();
drop trigger if exists audit_church_feature_control on public.church_features;
create trigger audit_church_feature_control after update on public.church_features
for each row when (old is distinct from new) execute function public.audit_feature_control_change();

create or replace function public.can_manage_church_roles(_user_id uuid, _church_id uuid)
returns boolean language plpgsql stable security definer set search_path = pg_catalog, public
as $$
begin
  if auth.uid() is null or _user_id is distinct from auth.uid() then return false; end if;
  return public.has_church_feature_permission(
    auth.uid(), _church_id, 'feature_permissions_admin', 'manage'
  );
end;
$$;

-- UPDATE policies cannot distinguish an ordinary edit from an approval or
-- publication transition. Remove only this migration's restrictive UPDATE
-- policies and enforce the required action in a BEFORE trigger instead.
do $$
declare v_table text;
begin
  foreach v_table in array array['announcements','events','prayer_requests','mass_intentions','contributions','pledges','ministries','community_help_requests'] loop
    if to_regclass('public.' || v_table) is not null then
      execute format('drop policy if exists %I on public.%I', 'feature permission update', v_table);
    end if;
  end loop;
end $$;

create or replace function public.enforce_feature_mutation_permission()
returns trigger language plpgsql security definer set search_path = pg_catalog, public
as $$
declare
  v_row jsonb := case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end;
  v_old jsonb := case when tg_op = 'UPDATE' then to_jsonb(old) else '{}'::jsonb end;
  v_church_id uuid;
  v_feature text;
  v_action text;
  v_allowed boolean;
begin
  -- Only the service-role JWT and database owner are explicit internal paths.
  if session_user in ('postgres','supabase_admin') then
    return case when tg_op = 'DELETE' then old else new end;
  end if;
  if auth.uid() is null and auth.role() <> 'service_role' then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  -- Account bootstrap and self-profile maintenance are record-owned operations,
  -- not tenant member-administration. Existing member RLS still constrains them.
  if tg_table_name = 'members' and auth.uid() is not null
     and tg_op in ('INSERT','UPDATE')
     and nullif(v_row->>'user_id','')::uuid = auth.uid() then
    return new;
  end if;
  if tg_table_name = 'invitations' and tg_op = 'UPDATE'
     and v_old->>'status' = 'pending' and v_row->>'status' = 'accepted'
     and lower(coalesce(v_row->>'email','')) = lower(coalesce(auth.jwt()->>'email','')) then
    return new;
  end if;
  if tg_table_name = 'notifications' and tg_op = 'UPDATE'
     and nullif(v_row->>'user_id','')::uuid = auth.uid() then
    return new;
  end if;
  if tg_table_name = 'notifications' and auth.role() = 'service_role'
     and nullif(v_row->>'church_id','') is null then
    return case when tg_op = 'DELETE' then old else new end;
  end if;
  v_church_id := nullif(v_row->>'church_id','')::uuid;
  if v_church_id is null and tg_table_name = 'pledge_payments' then
    select p.church_id into v_church_id
    from public.pledges p where p.id = nullif(v_row->>'pledge_id','')::uuid;
  elsif v_church_id is null and tg_table_name = 'event_attendances' then
    select e.church_id into v_church_id
    from public.events e where e.id = nullif(v_row->>'event_id','')::uuid;
  elsif v_church_id is null and tg_table_name = 'member_ministries' then
    select m.church_id into v_church_id
    from public.ministries m where m.id = nullif(v_row->>'ministry_id','')::uuid;
  elsif v_church_id is null and tg_table_name = 'member_communities' then
    select c.church_id into v_church_id
    from public.communities c where c.id = nullif(v_row->>'community_id','')::uuid;
  elsif v_church_id is null and tg_table_name = 'mass_responses' then
    select me.church_id into v_church_id
    from public.mass_events me where me.id = nullif(v_row->>'mass_event_id','')::uuid;
  elsif v_church_id is null and tg_table_name in ('help_comments','help_donations') then
    select h.church_id into v_church_id
    from public.community_help_requests h where h.id = nullif(v_row->>'help_request_id','')::uuid;
  end if;
  v_feature := case tg_table_name
    when 'community_help_requests' then 'community_help'
    when 'event_attendances' then 'events'
    when 'event_registration_payments' then 'events'
    when 'pledge_payments' then 'pledges'
    when 'invitations' then 'roles'
    when 'member_ministries' then 'ministries'
    when 'ministry_join_requests' then 'ministries'
    when 'member_communities' then 'communities'
    when 'event_audience_targets' then 'events'
    when 'mass_events' then 'events'
    when 'mass_responses' then 'events'
    when 'sacramental_records' then 'sacraments'
    when 'community_targets' then 'pledges'
    when 'contribution_categories' then 'contributions'
    when 'help_comments' then 'community_help'
    when 'help_donations' then 'community_help'
    when 'messages' then 'notifications'
    when 'prayer_request_comments' then 'prayer_requests'
    when 'prayer_request_prayers' then 'prayer_requests'
    else tg_table_name end;
  v_action := case tg_op when 'INSERT' then 'create' when 'DELETE' then 'delete' else 'edit' end;
  if tg_op = 'UPDATE' and tg_table_name = 'announcements'
     and (v_old->>'status' is distinct from v_row->>'status' or v_old->>'is_published' is distinct from v_row->>'is_published') then
    v_action := 'publish';
  elsif tg_op = 'UPDATE' and tg_table_name = 'messages'
     and v_old->>'status' is distinct from v_row->>'status' then
    v_action := 'publish';
  elsif tg_op = 'UPDATE' and tg_table_name in ('prayer_requests','mass_intentions','event_registration_payments')
     and v_old->>'status' is distinct from v_row->>'status' then
    v_action := 'approve';
  elsif tg_op = 'UPDATE' and tg_table_name in ('event_requests','ministry_join_requests')
     and v_old->>'status' is distinct from v_row->>'status' then
    v_action := 'approve';
  elsif tg_op = 'UPDATE' and tg_table_name = 'pledge_payments'
     and v_old->>'verification_status' is distinct from v_row->>'verification_status' then
    v_action := 'approve';
  end if;
  v_allowed := case when auth.role() = 'service_role'
    then public.is_service_feature_available(v_church_id, v_feature)
    else public.has_church_feature_permission(auth.uid(), v_church_id, v_feature, v_action)
  end;
  if v_church_id is null or not coalesce(v_allowed, false) then
    raise exception 'Missing % permission for feature %', v_action, v_feature using errcode = '42501';
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

create or replace function public.has_related_feature_permission(_table text, _row jsonb, _action text)
returns boolean language plpgsql stable security definer set search_path = pg_catalog, public
as $$
declare v_church_id uuid := nullif(_row->>'church_id','')::uuid; v_feature text;
begin
  if auth.uid() is null or _action not in ('view','create','delete') then return false; end if;
  if _table = 'members' and _action in ('view','create') and nullif(_row->>'user_id','')::uuid = auth.uid() then return true; end if;
  if _table = 'notifications' and _action = 'view' and nullif(_row->>'user_id','')::uuid = auth.uid() then return true; end if;
  if v_church_id is null and _table = 'member_ministries' then
    select m.church_id into v_church_id from public.ministries m where m.id = nullif(_row->>'ministry_id','')::uuid;
  elsif v_church_id is null and _table = 'member_communities' then
    select c.church_id into v_church_id from public.communities c where c.id = nullif(_row->>'community_id','')::uuid;
  elsif v_church_id is null and _table = 'mass_responses' then
    select me.church_id into v_church_id from public.mass_events me where me.id = nullif(_row->>'mass_event_id','')::uuid;
  elsif v_church_id is null and _table in ('help_comments','help_donations') then
    select h.church_id into v_church_id from public.community_help_requests h where h.id = nullif(_row->>'help_request_id','')::uuid;
  end if;
  v_feature := case _table
    when 'invitations' then 'roles' when 'member_ministries' then 'ministries'
    when 'ministry_join_requests' then 'ministries' when 'member_communities' then 'communities'
    when 'event_audience_targets' then 'events' when 'mass_events' then 'events'
    when 'mass_responses' then 'events' when 'sacramental_records' then 'sacraments'
    when 'community_targets' then 'pledges' when 'contribution_categories' then 'contributions'
    when 'help_comments' then 'community_help' when 'help_donations' then 'community_help'
    when 'messages' then 'notifications' when 'prayer_request_comments' then 'prayer_requests'
    when 'prayer_request_prayers' then 'prayer_requests'
    else _table end;
  return v_church_id is not null and public.has_church_feature_permission(auth.uid(), v_church_id, v_feature, _action);
end;
$$;

do $$
declare v_table text; v_action text; v_command text;
begin
  foreach v_table in array array[
    'members','families','communities','member_communities','invitations','notifications',
    'member_ministries','ministry_join_requests','event_requests','event_audience_targets',
    'sermons','mass_events','mass_responses','sacramental_records','community_targets',
    'contribution_categories','help_comments','help_donations','messages',
    'prayer_request_comments','prayer_request_prayers'
  ] loop
    if to_regclass('public.' || v_table) is null then continue; end if;
    for v_action, v_command in select * from (values ('view','select'),('create','insert'),('delete','delete')) a(action_name,command_name) loop
      execute format('drop policy if exists %I on public.%I', 'tenant feature ' || v_command, v_table);
      execute format(
        'create policy %I on public.%I as restrictive for %s to authenticated %s (public.has_related_feature_permission(%L, to_jsonb(%I), %L))',
        'tenant feature ' || v_command, v_table, v_command,
        case when v_command = 'insert' then 'with check' else 'using' end,
        v_table, v_table, v_action
      );
    end loop;
  end loop;
end $$;

do $$
declare v_table text;
begin
  foreach v_table in array array[
    'announcements','events','prayer_requests','mass_intentions','contributions',
    'pledges','pledge_payments','members','families','communities','member_communities',
    'invitations','notifications','ministries','member_ministries','ministry_join_requests',
    'community_help_requests','event_requests','event_audience_targets','event_attendances',
    'event_registration_payments','sermons','mass_events','mass_responses','sacramental_records',
    'community_targets','contribution_categories','help_comments','help_donations','messages',
    'prayer_request_comments','prayer_request_prayers'
  ] loop
    if to_regclass('public.' || v_table) is not null then
      execute format('drop trigger if exists enforce_feature_mutation_permission on public.%I', v_table);
      execute format('create trigger enforce_feature_mutation_permission before insert or update or delete on public.%I for each row execute function public.enforce_feature_mutation_permission()', v_table);
    end if;
  end loop;
end $$;

-- Function EXECUTE is granted to PUBLIC by default in PostgreSQL. Revoke first,
-- then grant only the authenticated entry points. Trigger functions are not RPCs.
revoke all on function public.is_feature_available_for_church(uuid,text) from public, anon, authenticated;
revoke all on function public.is_service_feature_available(uuid,text) from public, anon, authenticated;
revoke all on function public.has_church_feature_permission(uuid,uuid,text,text) from public, anon, authenticated;
revoke all on function public.get_church_feature_permission_matrix(uuid) from public, anon, authenticated;
revoke all on function public.set_church_feature_enabled(uuid,text,boolean) from public, anon, authenticated;
revoke all on function public.save_church_role_permissions(uuid,text,jsonb) from public, anon, authenticated;
revoke all on function public.provision_church_feature_permissions() from public, anon, authenticated;
revoke all on function public.provision_new_platform_feature() from public, anon, authenticated;
revoke all on function public.provision_new_church_role() from public, anon, authenticated;
revoke all on function public.enforce_feature_mutation_permission() from public, anon, authenticated;
revoke all on function public.has_related_feature_permission(text,jsonb,text) from public, anon, authenticated;
revoke all on function public.recommended_church_feature_permission(text,text,text,boolean,boolean) from public, anon, authenticated;
revoke all on function public.protect_mandatory_feature() from public, anon, authenticated;
revoke all on function public.audit_feature_control_change() from public, anon, authenticated;
revoke all on function public.can_manage_church_roles(uuid,uuid) from public, anon, authenticated;
grant execute on function public.is_feature_available_for_church(uuid,text) to authenticated;
grant execute on function public.is_service_feature_available(uuid,text) to service_role;
grant execute on function public.has_church_feature_permission(uuid,uuid,text,text) to authenticated;
grant execute on function public.get_church_feature_permission_matrix(uuid) to authenticated;
grant execute on function public.set_church_feature_enabled(uuid,text,boolean) to authenticated;
grant execute on function public.save_church_role_permissions(uuid,text,jsonb) to authenticated;
grant execute on function public.can_manage_church_roles(uuid,uuid) to authenticated;
grant execute on function public.has_related_feature_permission(text,jsonb,text) to authenticated;

-- Realtime invalidates permission caches in other active sessions.
do $$ begin
  alter publication supabase_realtime add table public.church_features;
exception when duplicate_object or undefined_object then null; end $$;
do $$ begin
  alter publication supabase_realtime add table public.church_role_permissions;
exception when duplicate_object or undefined_object then null; end $$;

-- Audio bucket object names are tenant-prefixed (`<church-uuid>/...`). These
-- restrictive policies add feature/action checks without replacing ownership
-- and workflow policies already attached to storage.objects. Other buckets pass
-- this restriction unchanged and retain their existing policy behavior.
do $$ begin
  drop policy if exists "tenant audio feature select" on storage.objects;
  create policy "tenant audio feature select" on storage.objects as restrictive
  for select to authenticated using (
    bucket_id not in ('audio','audio-reports','audio-indexes','audio-transcripts','audio-alignments')
    or (
      (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
      and public.has_church_feature_permission(auth.uid(), ((storage.foldername(name))[1])::uuid, 'audio_processing', 'view')
    )
  );
  drop policy if exists "tenant audio feature insert" on storage.objects;
  create policy "tenant audio feature insert" on storage.objects as restrictive
  for insert to authenticated with check (
    bucket_id not in ('audio','audio-reports','audio-indexes','audio-transcripts','audio-alignments')
    or (
      (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
      and public.has_church_feature_permission(auth.uid(), ((storage.foldername(name))[1])::uuid, 'audio_processing', 'create')
    )
  );
  drop policy if exists "tenant audio feature update" on storage.objects;
  create policy "tenant audio feature update" on storage.objects as restrictive
  for update to authenticated using (
    bucket_id not in ('audio','audio-reports','audio-indexes','audio-transcripts','audio-alignments')
    or ((storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
      and public.has_church_feature_permission(auth.uid(), ((storage.foldername(name))[1])::uuid, 'audio_processing', 'edit'))
  ) with check (
    bucket_id not in ('audio','audio-reports','audio-indexes','audio-transcripts','audio-alignments')
    or ((storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
      and public.has_church_feature_permission(auth.uid(), ((storage.foldername(name))[1])::uuid, 'audio_processing', 'edit'))
  );
  drop policy if exists "tenant audio feature delete" on storage.objects;
  create policy "tenant audio feature delete" on storage.objects as restrictive
  for delete to authenticated using (
    bucket_id not in ('audio','audio-reports','audio-indexes','audio-transcripts','audio-alignments')
    or ((storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
      and public.has_church_feature_permission(auth.uid(), ((storage.foldername(name))[1])::uuid, 'audio_processing', 'delete'))
  );
exception when undefined_table then null; end $$;

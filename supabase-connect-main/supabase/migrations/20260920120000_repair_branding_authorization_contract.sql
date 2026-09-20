-- Repair the canonical church settings/branding authorization contract after
-- production-specific feature work replaced the richer multi-role helper.
--
-- Branding storage policies and public.churches UPDATE policies intentionally
-- continue to use has_church_feature_permission(..., 'feature_permissions_admin',
-- 'manage'). This migration repairs that predicate and the mandatory recovery
-- rows it depends on, rather than weakening storage RLS.

insert into public.platform_features (
  key, name, description, category, globally_enabled, globally_locked,
  member_available, staff_available, available_plans, church_configurable,
  is_mandatory
)
values (
  'feature_permissions_admin', 'Features & Permissions',
  'Mandatory church administration recovery capability.', 'Administration',
  true, true, false, true,
  array['free','basic','intermediate','pro','enterprise'], true, true
)
on conflict (key) do update set
  globally_enabled = true,
  globally_locked = true,
  member_available = false,
  staff_available = true,
  available_plans = excluded.available_plans,
  church_configurable = true,
  is_mandatory = true;

insert into public.church_features (church_id, feature_id, enabled, locked, enabled_at)
select c.id, pf.id, true, true, now()
from public.churches c
join public.platform_features pf on pf.key = 'feature_permissions_admin'
on conflict (church_id, feature_id) do update set
  enabled = true,
  locked = true,
  enabled_at = coalesce(public.church_features.enabled_at, now()),
  updated_at = now();

insert into public.church_role_permissions (
  church_id, role, feature_id, can_view, can_manage
)
select c.id, 'church_admin', pf.id, true, true
from public.churches c
join public.platform_features pf on pf.key = 'feature_permissions_admin'
on conflict (church_id, role, feature_id) do update set
  can_view = true,
  can_manage = true;

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
  if not found then
    return false;
  end if;

  if not public.is_feature_available_for_church(_church_id, _feature_key) then
    return false;
  end if;

  select cf.locked
  into v_church_locked
  from public.church_features cf
  join public.platform_features pf on pf.id = cf.feature_id
  where cf.church_id = _church_id
    and pf.key = _feature_key
    and cf.enabled;
  if not found then
    return false;
  end if;

  if not v_mandatory and _action <> 'view' and (v_global_locked or v_church_locked) then
    return false;
  end if;

  if public.is_platform_super_admin(_user_id) or public.is_super_admin(_user_id) then
    return true;
  end if;

  -- Mandatory recovery is intentionally available to every assigned Church
  -- Admin even if a permission row was missed by legacy provisioning.
  if v_mandatory and _feature_key = 'feature_permissions_admin'
     and _action in ('view','manage')
     and exists (
       select 1
       from public.user_roles ur
       where ur.user_id = _user_id
         and ur.church_id = _church_id
         and lower(ur.role::text) = 'church_admin'
     ) then
    return true;
  end if;

  return exists (
    select 1
    from public.church_role_permissions crp
    join public.platform_features pf on pf.id = crp.feature_id
    where crp.church_id = _church_id
      and pf.key = _feature_key
      and case _action
        when 'view' then crp.can_view
        when 'create' then crp.can_create
        when 'edit' then crp.can_edit
        when 'delete' then crp.can_delete
        when 'approve' then crp.can_approve
        when 'publish' then crp.can_publish
        when 'manage' then crp.can_manage
        else false
      end
      and (
        exists (
          select 1
          from public.user_roles ur
          where ur.user_id = _user_id
            and ur.church_id = _church_id
            and lower(ur.role::text) = crp.role
        )
        or (
          crp.role = 'member'
          and exists (
            select 1
            from public.members m
            where m.user_id = _user_id
              and m.church_id = _church_id
              and coalesce(m.status, 'active') = 'active'
          )
        )
      )
      and (
        (crp.role = 'member' and pf.member_available)
        or (crp.role <> 'member' and pf.staff_available)
      )
  );
end;
$$;

revoke all on function public.has_church_feature_permission(uuid,uuid,text,text)
  from public, anon, authenticated;
grant execute on function public.has_church_feature_permission(uuid,uuid,text,text)
  to authenticated;

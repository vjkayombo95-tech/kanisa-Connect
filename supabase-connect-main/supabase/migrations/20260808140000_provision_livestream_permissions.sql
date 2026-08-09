-- Register the authoritative livestream workflow in the canonical permission
-- model and provide an atomic, platform-admin-only church activation path.

create or replace function public.church_permission_constraint_rule(
  _role text,
  _feature_key text,
  _action text
)
returns jsonb
language plpgsql
immutable
set search_path = pg_catalog
as $$
declare
  v_role text := lower(trim(coalesce(_role, '')));
  v_feature text := lower(trim(coalesce(_feature_key, '')));
  v_action text := lower(trim(coalesce(_action, '')));
  v_applicable boolean := false;
  v_classification text := 'SYSTEM_PROTECTED';
  v_scope text := 'none';
  v_reason text := 'This feature and action combination is not supported by the application.';
begin
  if v_action not in ('view','create','edit','delete','approve','publish','manage') then
    return jsonb_build_object('classification', v_classification, 'record_scope', v_scope, 'reason', 'Unknown permission action.');
  end if;

  v_applicable := case v_action
    when 'view' then v_feature in (
      'feature_permissions_admin','roles','members','families','communities','ministries',
      'contributions','give','pledges','events','event_requests','announcements',
      'sermons','bible_verses','bible_audio','audio_processing','catholic_content',
      'prayer_requests','mass_intentions','sacraments','community_help','reports',
      'channels','notifications','finance_intelligence','kanisa_ai','operations','livestream'
    )
    when 'create' then v_feature in (
      'roles','members','families','communities','ministries','contributions','give',
      'pledges','events','event_requests','announcements','sermons','prayer_requests',
      'mass_intentions','sacraments','community_help','channels','notifications','audio_processing','livestream'
    )
    when 'edit' then v_feature in (
      'roles','members','families','communities','ministries','contributions','pledges',
      'events','event_requests','announcements','sermons','prayer_requests','mass_intentions',
      'sacraments','community_help','channels','notifications','audio_processing','livestream'
    )
    when 'delete' then v_feature in (
      'roles','members','families','communities','ministries','events','event_requests',
      'announcements','sermons','prayer_requests','mass_intentions','community_help','channels','audio_processing','livestream'
    )
    when 'approve' then v_feature in (
      'contributions','pledges','events','event_requests','prayer_requests',
      'mass_intentions','sacraments','community_help'
    )
    when 'publish' then v_feature in ('events','announcements','sermons','notifications','audio_processing','livestream')
    when 'manage' then v_feature in (
      'feature_permissions_admin','roles','members','families','communities','ministries',
      'contributions','pledges','events','event_requests','announcements','sermons',
      'bible_audio','audio_processing','catholic_content','prayer_requests','mass_intentions',
      'sacraments','community_help','reports','channels','notifications',
      'finance_intelligence','kanisa_ai','operations','livestream'
    )
    else false
  end;

  if not v_applicable then
    return jsonb_build_object('classification', v_classification, 'record_scope', v_scope, 'reason', v_reason);
  end if;

  if v_feature = 'feature_permissions_admin' then
    if v_role = 'church_admin' and v_action in ('view','manage') then
      return jsonb_build_object('classification', 'RESTRICTED', 'record_scope', 'church',
        'reason', 'This mandatory administrative recovery permission is platform controlled.');
    end if;
    return jsonb_build_object('classification', 'SYSTEM_PROTECTED', 'record_scope', 'none',
      'reason', 'Only the Church Admin recovery role may hold this permission.');
  end if;

  if v_role = 'member' then
    if v_action = 'view' and v_feature not in (
      'roles','members','families','reports','finance_intelligence','operations',
      'audio_processing','bible_audio','sacraments'
    ) then
      v_classification := 'CONFIGURABLE';
      v_scope := case when v_feature in (
        'contributions','give','pledges','event_requests','prayer_requests',
        'mass_intentions','community_help','notifications'
      ) then 'own' else 'church' end;
      v_reason := 'Member viewing is constrained by feature availability and record-level policies.';
    elsif v_action = 'create' and v_feature in (
      'prayer_requests','mass_intentions','event_requests','community_help','give',
      'contributions','pledges','events','ministries'
    ) then
      v_classification := 'CONFIGURABLE'; v_scope := 'own';
      v_reason := 'The existing member workflow and database policies constrain creation.';
    elsif v_action = 'edit' and v_feature in (
      'prayer_requests','mass_intentions','community_help','pledges','events'
    ) then
      v_classification := 'CONFIGURABLE'; v_scope := 'own';
      v_reason := 'The existing member workflow and database policies constrain updates to owned records.';
    elsif v_action = 'delete' and v_feature in ('prayer_requests','ministries') then
      v_classification := 'CONFIGURABLE'; v_scope := 'own';
      v_reason := 'The existing workflow and database policies constrain removal to the member-owned relationship.';
    else
      v_reason := 'This authority exceeds the safe, server-enforced Member workflow.';
    end if;
    return jsonb_build_object('classification', v_classification, 'record_scope', v_scope, 'reason', v_reason);
  end if;

  if v_feature = 'roles' and v_role <> 'church_admin' then
    return jsonb_build_object('classification', 'SYSTEM_PROTECTED', 'record_scope', 'none',
      'reason', 'Only Church Admins may administer church role assignments.');
  end if;

  if v_role = 'church_admin' then
    return jsonb_build_object('classification', 'CONFIGURABLE', 'record_scope', 'church',
      'reason', 'This is an applicable church-level permission.');
  end if;

  if v_role = 'pastor' then
    if v_action = 'view' or v_feature in (
      'events','event_requests','announcements','sermons','catholic_content',
      'prayer_requests','mass_intentions','sacraments','community_help','notifications','channels'
    ) then
      v_classification := 'CONFIGURABLE'; v_scope := 'church';
      v_reason := 'This permission is within an existing pastoral or parish-content workflow.';
    else v_reason := 'This mutation is outside the Pastor role''s church-level pastoral authority.';
    end if;
  elsif v_role = 'secretary' then
    if v_action = 'view' or v_feature in (
      'members','families','communities','ministries','events','event_requests',
      'announcements','sermons','mass_intentions','notifications','channels'
    ) then
      v_classification := 'CONFIGURABLE'; v_scope := 'church';
      v_reason := 'This permission is within an existing operational staff workflow.';
    else v_reason := 'This mutation is outside the Secretary role''s operational authority.';
    end if;
  elsif v_role = 'treasurer' then
    if v_action = 'view' or v_feature in ('contributions','pledges','reports','finance_intelligence') then
      v_classification := 'CONFIGURABLE'; v_scope := 'church';
      v_reason := 'This permission is within an existing church finance workflow.';
    else v_reason := 'This mutation is outside the Treasurer role''s finance authority.';
    end if;
  else
    if v_action = 'view' then
      v_classification := 'CONFIGURABLE'; v_scope := 'church';
      v_reason := 'Custom roles default to church-scoped viewing until explicitly classified.';
    else v_reason := 'Custom role mutation authority requires an explicit server-enforced workflow.';
    end if;
  end if;

  return jsonb_build_object('classification', v_classification, 'record_scope', v_scope, 'reason', v_reason);
end;
$$;

-- A marker distinguishes first activation from a later re-enable. Permission
-- configuration is retained while disabled and is not inflated on re-enable.
create table if not exists public.church_feature_default_provisioning (
  church_id uuid not null references public.churches(id) on delete cascade,
  feature_id uuid not null references public.platform_features(id) on delete cascade,
  provisioned_at timestamptz not null default now(),
  provisioned_by uuid references auth.users(id) on delete set null,
  primary key (church_id, feature_id)
);

alter table public.church_feature_default_provisioning enable row level security;
revoke all on public.church_feature_default_provisioning from public, anon, authenticated;

-- Repair only churches that already have the feature enabled. Existing rows are
-- upgraded to the approved defaults without touching unrelated roles/features.
insert into public.church_role_permissions (
  church_id, role, feature_id, can_view, can_create, can_edit, can_delete,
  can_approve, can_publish, can_manage
)
select cf.church_id, 'church_admin', cf.feature_id,
  true, true, true, true, false, true, true
from public.church_features cf
join public.platform_features pf on pf.id = cf.feature_id and pf.key = 'livestream'
where cf.enabled
on conflict (church_id, role, feature_id) do update set
  can_view = public.church_role_permissions.can_view or excluded.can_view,
  can_create = public.church_role_permissions.can_create or excluded.can_create,
  can_edit = public.church_role_permissions.can_edit or excluded.can_edit,
  can_delete = public.church_role_permissions.can_delete or excluded.can_delete,
  can_publish = public.church_role_permissions.can_publish or excluded.can_publish,
  can_manage = public.church_role_permissions.can_manage or excluded.can_manage;

insert into public.church_role_permissions (
  church_id, role, feature_id, can_view, can_create, can_edit, can_delete,
  can_approve, can_publish, can_manage
)
select cf.church_id, 'member', cf.feature_id,
  true, false, false, false, false, false, false
from public.church_features cf
join public.platform_features pf on pf.id = cf.feature_id and pf.key = 'livestream'
where cf.enabled
on conflict (church_id, role, feature_id) do update set
  can_view = public.church_role_permissions.can_view or excluded.can_view;

insert into public.church_feature_default_provisioning (church_id, feature_id)
select cf.church_id, cf.feature_id
from public.church_features cf
join public.platform_features pf on pf.id = cf.feature_id and pf.key = 'livestream'
where cf.enabled
on conflict (church_id, feature_id) do nothing;

create or replace function public.set_super_admin_church_feature(
  _church_id uuid,
  _feature_key text,
  _enabled boolean,
  _locked boolean default false
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_actor uuid := auth.uid();
  v_feature public.platform_features%rowtype;
  v_should_provision boolean := false;
begin
  if v_actor is null or not (
    public.is_platform_super_admin(v_actor) or public.is_super_admin(v_actor)
  ) then
    raise exception 'Platform administrator permission required' using errcode = '42501';
  end if;

  select * into v_feature from public.platform_features where key = lower(trim(_feature_key));
  if not found then raise exception 'Unknown feature' using errcode = '22023'; end if;
  if v_feature.is_mandatory and (not _enabled or not _locked) then
    raise exception 'Mandatory recovery feature must remain enabled and locked' using errcode = '42501';
  end if;
  if _enabled and not public.is_feature_available_for_church(_church_id, v_feature.key) then
    raise exception 'Feature is unavailable globally or under this subscription' using errcode = '42501';
  end if;

  if _enabled and v_feature.key = 'livestream' then
    v_should_provision := not exists (
      select 1 from public.church_feature_default_provisioning p
      where p.church_id = _church_id and p.feature_id = v_feature.id
    );
  end if;

  insert into public.church_features (
    church_id, feature_id, enabled, locked, enabled_by, enabled_at
  ) values (
    _church_id, v_feature.id, _enabled, _locked, v_actor,
    case when _enabled then now() else null end
  )
  on conflict (church_id, feature_id) do update set
    enabled = excluded.enabled,
    locked = excluded.locked,
    enabled_by = v_actor,
    enabled_at = case when excluded.enabled then coalesce(public.church_features.enabled_at, now()) else null end,
    updated_at = now();

  if v_should_provision then
    insert into public.church_role_permissions (
      church_id, role, feature_id, can_view, can_create, can_edit, can_delete,
      can_approve, can_publish, can_manage, updated_by
    ) values (
      _church_id, 'church_admin', v_feature.id, true, true, true, true, false, true, true, v_actor
    ) on conflict (church_id, role, feature_id) do update set
      can_view = public.church_role_permissions.can_view or excluded.can_view,
      can_create = public.church_role_permissions.can_create or excluded.can_create,
      can_edit = public.church_role_permissions.can_edit or excluded.can_edit,
      can_delete = public.church_role_permissions.can_delete or excluded.can_delete,
      can_publish = public.church_role_permissions.can_publish or excluded.can_publish,
      can_manage = public.church_role_permissions.can_manage or excluded.can_manage,
      updated_by = v_actor;

    insert into public.church_role_permissions (
      church_id, role, feature_id, can_view, can_create, can_edit, can_delete,
      can_approve, can_publish, can_manage, updated_by
    ) values (
      _church_id, 'member', v_feature.id, true, false, false, false, false, false, false, v_actor
    ) on conflict (church_id, role, feature_id) do update set
      can_view = public.church_role_permissions.can_view or excluded.can_view,
      updated_by = v_actor;

    insert into public.church_feature_default_provisioning (
      church_id, feature_id, provisioned_by
    ) values (_church_id, v_feature.id, v_actor)
    on conflict (church_id, feature_id) do nothing;
  end if;

  perform public.create_audit_log(
    case when _enabled then 'church_feature.super_admin_enabled' else 'church_feature.super_admin_disabled' end,
    'church_feature', v_feature.id,
    case when _enabled then 'Super Admin enabled church feature' else 'Super Admin disabled church feature' end,
    jsonb_build_object(
      'church_id', _church_id,
      'feature_key', v_feature.key,
      'enabled', _enabled,
      'locked', _locked,
      'defaults_provisioned', v_should_provision
    )
  );
end;
$$;

revoke all on function public.set_super_admin_church_feature(uuid,text,boolean,boolean) from public, anon, authenticated;
grant execute on function public.set_super_admin_church_feature(uuid,text,boolean,boolean) to authenticated;

comment on function public.set_super_admin_church_feature(uuid,text,boolean,boolean) is
  'Atomically changes a church feature under Platform/Super Admin authority and provisions one-time approved Livestream defaults.';

-- Reflect the delegation ceiling in the editor read model as well as in the
-- save RPC. Cells above the actor's own authority are visibly restricted.
create or replace function public.get_church_permission_constraints(_church_id uuid, _role text)
returns table (
  feature_key text,
  action text,
  classification text,
  record_scope text,
  reason text
)
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $$
declare
  v_is_platform_admin boolean;
begin
  if auth.uid() is null or _church_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if not public.can_manage_church_roles(auth.uid(), _church_id) then
    raise exception 'Permission denied for this church' using errcode = '42501';
  end if;

  v_is_platform_admin := public.is_platform_super_admin(auth.uid()) or public.is_super_admin(auth.uid());

  return query
  select
    pf.key,
    permission_action.action,
    case
      when rule.value->>'classification' = 'RESTRICTED' and v_is_platform_admin then 'CONFIGURABLE'
      when rule.value->>'classification' = 'CONFIGURABLE'
        and not v_is_platform_admin
        and not public.has_church_feature_permission(
          auth.uid(), _church_id, pf.key, permission_action.action
        ) then 'RESTRICTED'
      else rule.value->>'classification'
    end,
    rule.value->>'record_scope',
    case
      when rule.value->>'classification' = 'CONFIGURABLE'
        and not v_is_platform_admin
        and not public.has_church_feature_permission(
          auth.uid(), _church_id, pf.key, permission_action.action
        ) then 'You cannot delegate a permission above your own authority.'
      else rule.value->>'reason'
    end
  from public.platform_features pf
  cross join unnest(array['view','create','edit','delete','approve','publish','manage']) permission_action(action)
  cross join lateral (
    select public.church_permission_constraint_rule(_role, pf.key, permission_action.action) as value
  ) rule
  order by pf.category, pf.name, permission_action.action;
end;
$$;

-- Preserve the canonical editor and add the missing grant ceiling: a church
-- administrator may revoke permissions, but may grant only authority they
-- currently hold for the same church, feature, and action.
create or replace function public.save_church_role_permissions(
  _church_id uuid,
  _role text,
  _permissions jsonb
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_item jsonb;
  v_feature public.platform_features%rowtype;
  v_existing public.church_role_permissions%rowtype;
  v_key text;
  v_action text;
  v_rule jsonb;
  v_classification text;
  v_new_value boolean;
  v_old_value boolean;
  v_is_platform_admin boolean;
begin
  _role := lower(trim(coalesce(_role, '')));
  if auth.uid() is null or not public.has_church_feature_permission(
    auth.uid(), _church_id, 'feature_permissions_admin', 'manage'
  ) then
    raise exception 'Permission denied for this church' using errcode = '42501';
  end if;

  v_is_platform_admin := public.is_platform_super_admin(auth.uid()) or public.is_super_admin(auth.uid());
  if (_role not in ('church_admin','pastor','secretary','treasurer','member') and not exists (
        select 1 from public.user_roles ur
        where ur.church_id = _church_id and lower(ur.role::text) = _role
      )) or jsonb_typeof(_permissions) <> 'array' then
    raise exception 'Invalid permission payload' using errcode = '22023';
  end if;

  for v_item in select value from jsonb_array_elements(_permissions) loop
    v_key := nullif(lower(trim(v_item->>'feature_key')), '');
    select * into v_feature from public.platform_features where key = v_key;
    if v_feature.id is null then raise exception 'Unknown feature: %', v_key using errcode = '22023'; end if;
    if not v_feature.church_configurable then
      raise exception 'Feature is platform controlled: %', v_key using errcode = '42501';
    end if;
    if (_role = 'member' and not v_feature.member_available)
       or (_role <> 'member' and not v_feature.staff_available) then
      raise exception 'Feature is not applicable to role: % / %', v_key, _role using errcode = '22023';
    end if;

    select * into v_existing
    from public.church_role_permissions crp
    where crp.church_id = _church_id and crp.role = _role and crp.feature_id = v_feature.id;

    foreach v_action in array array['view','create','edit','delete','approve','publish','manage'] loop
      v_rule := public.church_permission_constraint_rule(_role, v_key, v_action);
      v_classification := v_rule->>'classification';
      v_new_value := coalesce((v_item->>('can_' || v_action))::boolean, false);
      v_old_value := case v_action
        when 'view' then coalesce(v_existing.can_view, false)
        when 'create' then coalesce(v_existing.can_create, false)
        when 'edit' then coalesce(v_existing.can_edit, false)
        when 'delete' then coalesce(v_existing.can_delete, false)
        when 'approve' then coalesce(v_existing.can_approve, false)
        when 'publish' then coalesce(v_existing.can_publish, false)
        when 'manage' then coalesce(v_existing.can_manage, false)
        else false
      end;

      if v_classification = 'SYSTEM_PROTECTED' and v_new_value is distinct from v_old_value then
        raise exception 'System-protected permission cannot be changed: role=%, feature=%, action=%',
          _role, v_key, v_action using errcode = '22023';
      end if;
      if v_classification = 'RESTRICTED' and not v_is_platform_admin
         and v_new_value is distinct from v_old_value then
        raise exception 'Only a Platform Administrator can change permission: role=%, feature=%, action=%',
          _role, v_key, v_action using errcode = '42501';
      end if;
      if not v_is_platform_admin and v_new_value and not v_old_value
         and not public.has_church_feature_permission(auth.uid(), _church_id, v_key, v_action) then
        raise exception 'Cannot grant permission above your own authority: role=%, feature=%, action=%',
          _role, v_key, v_action using errcode = '42501';
      end if;
    end loop;

    if v_feature.is_mandatory and _role = 'church_admin'
       and (not coalesce((v_item->>'can_view')::boolean, false)
         or not coalesce((v_item->>'can_manage')::boolean, false)) then
      raise exception 'The final administrative recovery path cannot be removed' using errcode = '42501';
    end if;

    insert into public.church_role_permissions (
      church_id, role, feature_id, can_view, can_create, can_edit, can_delete,
      can_approve, can_publish, can_manage, updated_by
    ) values (
      _church_id, _role, v_feature.id,
      coalesce((v_item->>'can_view')::boolean, false), coalesce((v_item->>'can_create')::boolean, false),
      coalesce((v_item->>'can_edit')::boolean, false), coalesce((v_item->>'can_delete')::boolean, false),
      coalesce((v_item->>'can_approve')::boolean, false), coalesce((v_item->>'can_publish')::boolean, false),
      coalesce((v_item->>'can_manage')::boolean, false), auth.uid()
    ) on conflict (church_id, role, feature_id) do update set
      can_view = excluded.can_view, can_create = excluded.can_create, can_edit = excluded.can_edit,
      can_delete = excluded.can_delete, can_approve = excluded.can_approve,
      can_publish = excluded.can_publish, can_manage = excluded.can_manage,
      updated_by = auth.uid();
  end loop;

  perform public.create_audit_log(
    'church_permissions.updated', 'church_role_permissions', null,
    'Church role permissions changed',
    jsonb_build_object('church_id', _church_id, 'role', _role, 'permissions', _permissions)
  );
end;
$$;

revoke all on function public.save_church_role_permissions(uuid,text,jsonb) from public, anon, authenticated;
grant execute on function public.save_church_role_permissions(uuid,text,jsonb) to authenticated;

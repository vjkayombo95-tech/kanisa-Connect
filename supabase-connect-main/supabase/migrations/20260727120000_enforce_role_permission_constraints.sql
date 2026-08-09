-- Central role-permission constraints for church-scoped permission management.
--
-- This migration is forward-only and does not rewrite existing permission data.
-- Existing assignments that exceed the new boundaries are surfaced by the
-- companion preflight query and may be remediated only after product review.

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
    return jsonb_build_object(
      'classification', v_classification,
      'record_scope', v_scope,
      'reason', 'Unknown permission action.'
    );
  end if;

  -- Feature/action applicability follows existing routes, mutation triggers,
  -- RPCs, and workflow transitions. No new permission action is introduced.
  v_applicable := case v_action
    when 'view' then v_feature in (
      'feature_permissions_admin','roles','members','families','communities','ministries',
      'contributions','give','pledges','events','event_requests','announcements',
      'sermons','bible_verses','bible_audio','audio_processing','catholic_content',
      'prayer_requests','mass_intentions','sacraments','community_help','reports',
      'channels','notifications','finance_intelligence','kanisa_ai','operations'
    )
    when 'create' then v_feature in (
      'roles','members','families','communities','ministries','contributions','give',
      'pledges','events','event_requests','announcements','sermons','prayer_requests',
      'mass_intentions','sacraments','community_help','channels','notifications','audio_processing'
    )
    when 'edit' then v_feature in (
      'roles','members','families','communities','ministries','contributions','pledges',
      'events','event_requests','announcements','sermons','prayer_requests','mass_intentions',
      'sacraments','community_help','channels','notifications','audio_processing'
    )
    when 'delete' then v_feature in (
      'roles','members','families','communities','ministries','events','event_requests',
      'announcements','sermons','prayer_requests','mass_intentions','community_help','channels','audio_processing'
    )
    when 'approve' then v_feature in (
      'contributions','pledges','events','event_requests','prayer_requests',
      'mass_intentions','sacraments','community_help'
    )
    when 'publish' then v_feature in ('events','announcements','sermons','notifications','audio_processing')
    when 'manage' then v_feature in (
      'feature_permissions_admin','roles','members','families','communities','ministries',
      'contributions','pledges','events','event_requests','announcements','sermons',
      'bible_audio','audio_processing','catholic_content','prayer_requests','mass_intentions',
      'sacraments','community_help','reports','channels','notifications',
      'finance_intelligence','kanisa_ai','operations'
    )
    else false
  end;

  if not v_applicable then
    return jsonb_build_object(
      'classification', v_classification,
      'record_scope', v_scope,
      'reason', v_reason
    );
  end if;

  -- The recovery permission is mandatory. It is visible to Church Admins but
  -- remains outside church-level control, and no other church role can receive it.
  if v_feature = 'feature_permissions_admin' then
    if v_role = 'church_admin' and v_action in ('view','manage') then
      return jsonb_build_object(
        'classification', 'RESTRICTED',
        'record_scope', 'church',
        'reason', 'This mandatory administrative recovery permission is platform controlled.'
      );
    end if;
    return jsonb_build_object(
      'classification', 'SYSTEM_PROTECTED',
      'record_scope', 'none',
      'reason', 'Only the Church Admin recovery role may hold this permission.'
    );
  end if;

  -- Member mutation scopes are exposed only where existing RLS or trigger logic
  -- enforces ownership. A broad frontend label must never imply ownership.
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

    return jsonb_build_object(
      'classification', v_classification,
      'record_scope', v_scope,
      'reason', v_reason
    );
  end if;

  -- Invitations and role assignment are Church Admin responsibilities. The
  -- permission editor itself uses the separate mandatory recovery feature.
  if v_feature = 'roles' and v_role <> 'church_admin' then
    return jsonb_build_object(
      'classification', 'SYSTEM_PROTECTED',
      'record_scope', 'none',
      'reason', 'Only Church Admins may administer church role assignments.'
    );
  end if;

  if v_role = 'church_admin' then
    return jsonb_build_object(
      'classification', 'CONFIGURABLE',
      'record_scope', 'church',
      'reason', 'This is an applicable church-level permission.'
    );
  end if;

  if v_role = 'pastor' then
    if v_action = 'view' or v_feature in (
      'events','event_requests','announcements','sermons','catholic_content',
      'prayer_requests','mass_intentions','sacraments','community_help','notifications','channels'
    ) then
      v_classification := 'CONFIGURABLE'; v_scope := 'church';
      v_reason := 'This permission is within an existing pastoral or parish-content workflow.';
    else
      v_reason := 'This mutation is outside the Pastor role’s church-level pastoral authority.';
    end if;
  elsif v_role = 'secretary' then
    if v_action = 'view' or v_feature in (
      'members','families','communities','ministries','events','event_requests',
      'announcements','sermons','mass_intentions','notifications','channels'
    ) then
      v_classification := 'CONFIGURABLE'; v_scope := 'church';
      v_reason := 'This permission is within an existing operational staff workflow.';
    else
      v_reason := 'This mutation is outside the Secretary role’s operational authority.';
    end if;
  elsif v_role = 'treasurer' then
    if v_action = 'view' or v_feature in ('contributions','pledges','reports','finance_intelligence') then
      v_classification := 'CONFIGURABLE'; v_scope := 'church';
      v_reason := 'This permission is within an existing church finance workflow.';
    else
      v_reason := 'This mutation is outside the Treasurer role’s finance authority.';
    end if;
  else
    -- Data-discovered custom roles are real, but their ownership/assignment
    -- semantics are not modelled. They default to read-only maximum authority.
    if v_action = 'view' then
      v_classification := 'CONFIGURABLE'; v_scope := 'church';
      v_reason := 'Custom roles default to church-scoped viewing until explicitly classified.';
    else
      v_reason := 'Custom role mutation authority requires an explicit server-enforced workflow.';
    end if;
  end if;

  return jsonb_build_object(
    'classification', v_classification,
    'record_scope', v_scope,
    'reason', v_reason
  );
end;
$$;

-- Future church/feature provisioning must use the same maximum-authority rules.
-- This changes defaults only for rows created after this migration; existing
-- grants remain untouched and are reported by the preflight query.
create or replace function public.recommended_church_feature_permission(
  _role text,
  _feature_key text,
  _action text,
  _member_available boolean,
  _staff_available boolean
)
returns boolean
language sql
immutable
set search_path = pg_catalog, public
as $$
  select case
    when lower(_role) = 'church_admin'
      and _feature_key = 'feature_permissions_admin'
      and _action in ('view','manage') then true
    when public.church_permission_constraint_rule(_role, _feature_key, _action)->>'classification'
      <> 'CONFIGURABLE' then false
    when _action = 'view' then case when lower(_role) = 'member' then _member_available else _staff_available end
    when lower(_role) = 'church_admin' then true
    when lower(_role) = 'member' and _action = 'create'
      and _feature_key in ('prayer_requests','mass_intentions','event_requests','community_help','give','contributions','pledges','events','ministries') then true
    when lower(_role) = 'member' and _action = 'edit'
      and _feature_key in ('prayer_requests','mass_intentions','community_help','pledges','events') then true
    when lower(_role) = 'member' and _action = 'delete'
      and _feature_key in ('prayer_requests','ministries') then true
    when lower(_role) = 'pastor' and _action in ('create','edit')
      and _feature_key in ('prayer_requests','mass_intentions','sacraments','events','announcements','community_help') then true
    when lower(_role) = 'pastor' and _action = 'approve'
      and _feature_key in ('prayer_requests','mass_intentions','sacraments','community_help') then true
    when lower(_role) = 'pastor' and _action = 'publish'
      and _feature_key in ('announcements','events','sermons') then true
    when lower(_role) = 'secretary' and _action in ('create','edit')
      and _feature_key in ('members','families','communities','ministries','events','event_requests','announcements','mass_intentions','notifications','channels','sermons') then true
    when lower(_role) = 'secretary' and _action = 'delete'
      and _feature_key in ('events','announcements','sermons') then true
    when lower(_role) = 'secretary' and _action = 'approve'
      and _feature_key in ('events','event_requests') then true
    when lower(_role) = 'secretary' and _action = 'publish'
      and _feature_key in ('events','announcements','notifications') then true
    when lower(_role) = 'treasurer' and _action in ('create','edit')
      and _feature_key in ('contributions','pledges') then true
    when lower(_role) = 'treasurer' and _action = 'approve'
      and _feature_key in ('contributions','pledges') then true
    when lower(_role) = 'secretary' and _action = 'manage' and _feature_key = 'events' then true
    when lower(_role) = 'pastor' and _action = 'manage' and _feature_key = 'mass_intentions' then true
    when lower(_role) = 'treasurer' and _action = 'manage'
      and _feature_key in ('reports','finance_intelligence') then true
    else false
  end;
$$;

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
      else rule.value->>'classification'
    end,
    rule.value->>'record_scope',
    rule.value->>'reason'
  from public.platform_features pf
  cross join unnest(array['view','create','edit','delete','approve','publish','manage']) permission_action(action)
  cross join lateral (
    select public.church_permission_constraint_rule(_role, pf.key, permission_action.action) as value
  ) rule
  order by pf.category, pf.name, permission_action.action;
end;
$$;

create or replace function public.save_church_role_permissions(_church_id uuid, _role text, _permissions jsonb)
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
  _role := lower(trim(coalesce(_role,'')));
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
    if v_feature.id is null then
      raise exception 'Unknown feature: %', v_key using errcode = '22023';
    end if;
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
    end loop;

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

-- Internal rule evaluation is not an RPC. Only the read model and atomic save
-- entry point are exposed to authenticated clients.
revoke all on function public.church_permission_constraint_rule(text,text,text) from public, anon, authenticated;
revoke all on function public.recommended_church_feature_permission(text,text,text,boolean,boolean) from public, anon, authenticated;
revoke all on function public.get_church_permission_constraints(uuid,text) from public, anon, authenticated;
revoke all on function public.save_church_role_permissions(uuid,text,jsonb) from public, anon, authenticated;
grant execute on function public.get_church_permission_constraints(uuid,text) to authenticated;
grant execute on function public.save_church_role_permissions(uuid,text,jsonb) to authenticated;

comment on function public.church_permission_constraint_rule(text,text,text) is
  'Canonical role, feature, action, and record-scope constraint model for church permissions.';
comment on function public.get_church_permission_constraints(uuid,text) is
  'Returns actor-aware permission cell classifications for one church role.';
comment on function public.save_church_role_permissions(uuid,text,jsonb) is
  'Atomically validates and saves church role permissions against the canonical constraint model.';

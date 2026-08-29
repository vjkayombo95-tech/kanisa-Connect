-- Register the implemented ministry join-request review workflow and repair the
-- corresponding Church Admin default without broadening any other authority.

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
      'mass_intentions','sacraments','community_help','ministries'
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

  if v_feature = 'ministries' and v_action = 'approve' and v_role <> 'church_admin' then
    return jsonb_build_object('classification', 'SYSTEM_PROTECTED', 'record_scope', 'none',
      'reason', 'Ministry join-request review is reserved for the Church Admin role.');
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

-- Database-owner sessions are used by migrations and local SQL tests. Preserve
-- their internal path only when no JWT user is present; an authenticated actor
-- must never bypass feature mutation authorization because of the connection's
-- session owner.
do $$
declare
  v_definition text;
  v_hardened text;
begin
  select pg_get_functiondef('public.enforce_feature_mutation_permission()'::regprocedure)
  into v_definition;

  v_hardened := replace(
    v_definition,
    'if session_user in (''postgres'',''supabase_admin'') then',
    'if auth.uid() is null and session_user in (''postgres'',''supabase_admin'') then'
  );

  if v_hardened = v_definition then
    raise exception 'Expected database-owner bypass was not found in enforce_feature_mutation_permission()';
  end if;

  execute v_hardened;
end;
$$;

-- Repair only currently enabled churches. OR preserves an existing true value
-- and no other role, feature, or action is changed.
insert into public.church_role_permissions (
  church_id, role, feature_id, can_view, can_create, can_edit, can_delete,
  can_approve, can_publish, can_manage
)
select cf.church_id, 'church_admin', cf.feature_id,
  false, false, false, false, true, false, false
from public.church_features cf
join public.platform_features pf on pf.id = cf.feature_id and pf.key = 'ministries'
where cf.enabled
on conflict (church_id, role, feature_id) do update set
  can_approve = public.church_role_permissions.can_approve or excluded.can_approve;

-- Existing enabled churches have now received the approved default. Mark them
-- so disabling and re-enabling the feature cannot inflate later configuration.
insert into public.church_feature_default_provisioning (church_id, feature_id)
select cf.church_id, cf.feature_id
from public.church_features cf
join public.platform_features pf on pf.id = cf.feature_id and pf.key = 'ministries'
where cf.enabled
on conflict (church_id, feature_id) do nothing;

-- Extend the existing Super Admin activation path. On the first future
-- Ministries activation, provision only Church Admin approve authority.
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

  if _enabled and v_feature.key in ('livestream','ministries') then
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

  if v_should_provision and v_feature.key = 'livestream' then
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
  elsif v_should_provision and v_feature.key = 'ministries' then
    insert into public.church_role_permissions (
      church_id, role, feature_id, can_view, can_create, can_edit, can_delete,
      can_approve, can_publish, can_manage, updated_by
    ) values (
      _church_id, 'church_admin', v_feature.id, false, false, false, false, true, false, false, v_actor
    ) on conflict (church_id, role, feature_id) do update set
      can_approve = public.church_role_permissions.can_approve or excluded.can_approve,
      updated_by = v_actor;
  end if;

  if v_should_provision then
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
  'Atomically changes a church feature under Platform/Super Admin authority and provisions approved one-time feature defaults.';

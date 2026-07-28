\set ON_ERROR_STOP on
begin;

select '1..1';

do $$
declare
  v_rule jsonb;
  v_sqlstate text;
begin
  v_rule := public.church_permission_constraint_rule('member','members','delete');
  assert v_rule->>'classification' = 'SYSTEM_PROTECTED', 'Member delete must be system protected';
  assert public.church_permission_constraint_rule('member','events','manage')->>'classification' = 'SYSTEM_PROTECTED',
    'Member manage must be system protected';
  assert public.church_permission_constraint_rule('member','feature_permissions_admin','manage')->>'classification' = 'SYSTEM_PROTECTED',
    'Member must not manage Role Permissions';
  assert public.church_permission_constraint_rule('church_admin','events','create')->>'classification' = 'CONFIGURABLE',
    'Church Admin event creation must remain configurable';
  assert public.church_permission_constraint_rule('church_admin','reports','create')->>'classification' = 'SYSTEM_PROTECTED',
    'Non-applicable report creation must be protected';
  assert public.church_permission_constraint_rule('member','contributions','create')->>'record_scope' = 'own',
    'Member contribution creation must expose only the enforced own-record scope';
  assert public.church_permission_constraint_rule('custom_ministry_role','events','edit')->>'classification' = 'SYSTEM_PROTECTED',
    'Unclassified custom roles must fail secure for mutations';
  assert not public.recommended_church_feature_permission('church_admin','reports','create',true,true),
    'Future provisioning must not seed non-applicable permissions';
  assert not has_table_privilege('authenticated','public.church_role_permissions','INSERT,UPDATE,DELETE'),
    'Authenticated clients must not write role permissions directly';
  assert not has_function_privilege('service_role','public.save_church_role_permissions(uuid,text,jsonb)','EXECUTE'),
    'Service role must not inherit the interactive permission editor RPC';
  assert not has_function_privilege('authenticated','public.church_permission_constraint_rule(text,text,text)','EXECUTE'),
    'Internal constraint rules must not be public RPCs';
end;
$$;

insert into auth.users (
  id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values
  ('f1000000-0000-4000-8000-000000000001','authenticated','authenticated','constraint-admin@test.invalid','',now(),'{}','{}',now(),now()),
  ('f2000000-0000-4000-8000-000000000002','authenticated','authenticated','constraint-member@test.invalid','',now(),'{}','{}',now(),now());

insert into public.churches (id,name,slug) values
  ('fa000000-0000-4000-8000-000000000001','Permission Constraint Test A','permission-constraint-test-a'),
  ('fb000000-0000-4000-8000-000000000002','Permission Constraint Test B','permission-constraint-test-b');

insert into public.members (id,church_id,user_id,full_name,email,status) values
  ('fc000000-0000-4000-8000-000000000001','fa000000-0000-4000-8000-000000000001','f1000000-0000-4000-8000-000000000001','Constraint Admin','constraint-admin@test.invalid','active'),
  ('fc000000-0000-4000-8000-000000000002','fa000000-0000-4000-8000-000000000001','f2000000-0000-4000-8000-000000000002','Constraint Member','constraint-member@test.invalid','active');

insert into public.user_roles (id,user_id,church_id,role) values
  ('fd000000-0000-4000-8000-000000000001','f1000000-0000-4000-8000-000000000001','fa000000-0000-4000-8000-000000000001','church_admin'),
  ('fd000000-0000-4000-8000-000000000002','f2000000-0000-4000-8000-000000000002','fa000000-0000-4000-8000-000000000001','member');

update public.platform_features
set member_available=true, staff_available=true
where key='events';

set local role authenticated;
set local request.jwt.claim.sub = 'f1000000-0000-4000-8000-000000000001';

do $$
declare
  v_sqlstate text;
begin
  -- A crafted direct RPC payload cannot assign a system-protected permission.
  begin
    perform public.save_church_role_permissions(
      'fa000000-0000-4000-8000-000000000001', 'member',
      '[{"feature_key":"events","can_view":true,"can_create":true,"can_edit":true,"can_delete":true,"can_approve":false,"can_publish":false,"can_manage":false}]'::jsonb
    );
    raise exception 'system-protected assignment unexpectedly succeeded';
  exception when invalid_parameter_value then
    get stacked diagnostics v_sqlstate = returned_sqlstate;
    assert v_sqlstate = '22023';
  end;

  -- Church Admin cannot weaken the platform-restricted recovery permission.
  begin
    perform public.save_church_role_permissions(
      'fa000000-0000-4000-8000-000000000001', 'church_admin',
      '[{"feature_key":"feature_permissions_admin","can_view":false,"can_create":false,"can_edit":false,"can_delete":false,"can_approve":false,"can_publish":false,"can_manage":true}]'::jsonb
    );
    raise exception 'restricted permission change unexpectedly succeeded';
  exception when insufficient_privilege then
    get stacked diagnostics v_sqlstate = returned_sqlstate;
    assert v_sqlstate = '42501';
  end;

  -- Tenant identity is checked before payload processing.
  begin
    perform public.save_church_role_permissions(
      'fb000000-0000-4000-8000-000000000002', 'member', '[]'::jsonb
    );
    raise exception 'cross-tenant permission mutation unexpectedly succeeded';
  exception when insufficient_privilege then
    get stacked diagnostics v_sqlstate = returned_sqlstate;
    assert v_sqlstate = '42501';
  end;

  -- A configurable grant/revoke remains usable by an authorised Church Admin.
  perform public.save_church_role_permissions(
    'fa000000-0000-4000-8000-000000000001', 'member',
    '[{"feature_key":"events","can_view":false,"can_create":true,"can_edit":true,"can_delete":false,"can_approve":false,"can_publish":false,"can_manage":false}]'::jsonb
  );
  assert exists (
    select 1
    from public.church_role_permissions crp
    join public.platform_features pf on pf.id=crp.feature_id
    where crp.church_id='fa000000-0000-4000-8000-000000000001'
      and crp.role='member' and pf.key='events' and not crp.can_view
  ), 'Authorised configurable permission change did not persist inside the transaction';
end;
$$;

select 'ok 1 - permission constraint backend assertions passed';
rollback;

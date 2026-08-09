\set ON_ERROR_STOP on
begin;

select '1..1';

do $$
begin
  assert public.church_permission_constraint_rule('church_admin','livestream','view')->>'classification' = 'CONFIGURABLE';
  assert public.church_permission_constraint_rule('church_admin','livestream','create')->>'classification' = 'CONFIGURABLE';
  assert public.church_permission_constraint_rule('church_admin','livestream','edit')->>'classification' = 'CONFIGURABLE';
  assert public.church_permission_constraint_rule('church_admin','livestream','delete')->>'classification' = 'CONFIGURABLE';
  assert public.church_permission_constraint_rule('church_admin','livestream','publish')->>'classification' = 'CONFIGURABLE';
  assert public.church_permission_constraint_rule('church_admin','livestream','manage')->>'classification' = 'CONFIGURABLE';
  assert public.church_permission_constraint_rule('church_admin','livestream','approve')->>'classification' = 'SYSTEM_PROTECTED';
  assert public.church_permission_constraint_rule('member','livestream','view')->>'classification' = 'CONFIGURABLE';
  assert public.church_permission_constraint_rule('member','livestream','create')->>'classification' = 'SYSTEM_PROTECTED';
end;
$$;

insert into auth.users (
  id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values
  ('e1000000-0000-4000-8000-000000000001','authenticated','authenticated','livestream-platform@test.invalid','',now(),'{}','{}',now(),now()),
  ('e2000000-0000-4000-8000-000000000002','authenticated','authenticated','livestream-ordinary@test.invalid','',now(),'{}','{}',now(),now());

insert into public.super_admins (id) values ('e1000000-0000-4000-8000-000000000001');
insert into public.churches (id,name,slug) values
  ('e3000000-0000-4000-8000-000000000003','Livestream Provisioning Test','livestream-provisioning-test');
update public.subscriptions
set plan='pro', status='active', expires_at=null
where church_id='e3000000-0000-4000-8000-000000000003';

update public.church_features cf set enabled=false
from public.platform_features pf
where cf.church_id='e3000000-0000-4000-8000-000000000003'
  and cf.feature_id=pf.id and pf.key='livestream';
update public.church_role_permissions crp set
  can_view=false,can_create=false,can_edit=false,can_delete=false,
  can_approve=false,can_publish=false,can_manage=false
from public.platform_features pf
where crp.church_id='e3000000-0000-4000-8000-000000000003'
  and crp.feature_id=pf.id and pf.key='livestream';
delete from public.church_feature_default_provisioning
where church_id='e3000000-0000-4000-8000-000000000003';

set local role authenticated;
set local request.jwt.claim.sub = 'e2000000-0000-4000-8000-000000000002';
do $$
begin
  begin
    perform public.set_super_admin_church_feature(
      'e3000000-0000-4000-8000-000000000003','livestream',true,false
    );
    raise exception 'ordinary activation unexpectedly succeeded';
  exception when insufficient_privilege then null;
  end;
end;
$$;

reset role;
do $$
begin
  assert not (
    select cf.enabled
    from public.church_features cf join public.platform_features pf on pf.id=cf.feature_id
    where cf.church_id='e3000000-0000-4000-8000-000000000003' and pf.key='livestream'
  ), 'Rejected non-Super Admin activation must leave the feature disabled';
  assert not exists (
    select 1 from public.church_feature_default_provisioning
    where church_id='e3000000-0000-4000-8000-000000000003'
  ), 'Rejected activation must not provision defaults';
end;
$$;

set local role authenticated;
set local request.jwt.claim.sub = 'e1000000-0000-4000-8000-000000000001';
select public.set_super_admin_church_feature(
  'e3000000-0000-4000-8000-000000000003','livestream',true,false
);

reset role;
do $$
begin
  assert exists (
    select 1 from public.church_features cf join public.platform_features pf on pf.id=cf.feature_id
    where cf.church_id='e3000000-0000-4000-8000-000000000003' and pf.key='livestream' and cf.enabled
  );
  assert exists (
    select 1 from public.church_role_permissions crp join public.platform_features pf on pf.id=crp.feature_id
    where crp.church_id='e3000000-0000-4000-8000-000000000003' and pf.key='livestream'
      and crp.role='church_admin' and crp.can_view and crp.can_create and crp.can_edit
      and crp.can_delete and crp.can_publish and crp.can_manage and not crp.can_approve
  );
  assert exists (
    select 1 from public.church_role_permissions crp join public.platform_features pf on pf.id=crp.feature_id
    where crp.church_id='e3000000-0000-4000-8000-000000000003' and pf.key='livestream'
      and crp.role='member' and crp.can_view
  );
  assert exists (
    select 1 from public.church_feature_default_provisioning
    where church_id='e3000000-0000-4000-8000-000000000003'
  );
  assert exists (
    select 1 from public.audit_logs
    where action='church_feature.super_admin_enabled'
      and metadata->>'church_id'='e3000000-0000-4000-8000-000000000003'
  );
end;
$$;

set local role authenticated;
set local request.jwt.claim.sub = 'e1000000-0000-4000-8000-000000000001';
select public.set_super_admin_church_feature(
  'e3000000-0000-4000-8000-000000000003','livestream',false,false
);
reset role;
update public.church_role_permissions crp set can_view=false
from public.platform_features pf
where crp.church_id='e3000000-0000-4000-8000-000000000003'
  and crp.role='member' and crp.feature_id=pf.id and pf.key='livestream';
set local role authenticated;
set local request.jwt.claim.sub = 'e1000000-0000-4000-8000-000000000001';
select public.set_super_admin_church_feature(
  'e3000000-0000-4000-8000-000000000003','livestream',true,false
);
reset role;

do $$
begin
  assert (
    select not crp.can_view
    from public.church_role_permissions crp join public.platform_features pf on pf.id=crp.feature_id
    where crp.church_id='e3000000-0000-4000-8000-000000000003'
      and crp.role='member' and pf.key='livestream'
  ), 'Re-enable must retain configured permissions rather than inflate them';
  assert (
    select count(*)=1 from public.church_feature_default_provisioning
    where church_id='e3000000-0000-4000-8000-000000000003'
  ), 'Provisioning marker must remain idempotent';
end;
$$;

select 'ok 1 - livestream permission constraints and atomic provisioning passed';
rollback;

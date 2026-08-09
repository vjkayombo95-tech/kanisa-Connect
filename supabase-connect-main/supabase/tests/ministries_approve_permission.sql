\set ON_ERROR_STOP on
begin;

select '1..1';

do $$
begin
  assert public.church_permission_constraint_rule('church_admin','ministries','approve')->>'classification' = 'CONFIGURABLE';
  assert public.church_permission_constraint_rule('member','ministries','approve')->>'classification' = 'SYSTEM_PROTECTED';
  assert public.church_permission_constraint_rule('pastor','ministries','approve')->>'classification' = 'SYSTEM_PROTECTED';
  assert public.church_permission_constraint_rule('secretary','ministries','approve')->>'classification' = 'SYSTEM_PROTECTED';
  assert public.church_permission_constraint_rule('treasurer','ministries','approve')->>'classification' = 'SYSTEM_PROTECTED';
  assert public.church_permission_constraint_rule('church_admin','ministries','publish')->>'classification' = 'SYSTEM_PROTECTED';
  assert public.church_permission_constraint_rule('church_admin','ministries','approve')->>'record_scope' = 'church';
  assert position(
    'tg_table_name in (''event_requests'',''ministry_join_requests'')'
    in pg_get_functiondef('public.enforce_feature_mutation_permission()'::regprocedure)
  ) > 0, 'Installed trigger must map ministry request review transitions';
  assert position(
    'v_action := ''approve'''
    in pg_get_functiondef('public.enforce_feature_mutation_permission()'::regprocedure)
  ) > 0, 'Installed trigger must enforce approve authority';
end;
$$;

insert into auth.users (
  id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values
  ('a1000000-0000-4000-8000-000000000000','authenticated','authenticated','ministries-platform@test.invalid','',now(),'{}','{}',now(),now()),
  ('a1100000-0000-4000-8000-000000000001','authenticated','authenticated','ministries-admin@test.invalid','',now(),'{}','{}',now(),now()),
  ('a1200000-0000-4000-8000-000000000002','authenticated','authenticated','ministries-secretary@test.invalid','',now(),'{}','{}',now(),now()),
  ('a1300000-0000-4000-8000-000000000003','authenticated','authenticated','ministries-other-admin@test.invalid','',now(),'{}','{}',now(),now()),
  ('a1400000-0000-4000-8000-000000000004','authenticated','authenticated','ministries-member@test.invalid','',now(),'{}','{}',now(),now());

insert into public.super_admins (id) values ('a1000000-0000-4000-8000-000000000000');

insert into public.churches (id,name,slug) values
  ('a2100000-0000-4000-8000-000000000001','Ministries Approval A','ministries-approval-a'),
  ('a2200000-0000-4000-8000-000000000002','Ministries Approval B','ministries-approval-b');

insert into public.members (id,church_id,user_id,full_name,email,status) values
  ('a3100000-0000-4000-8000-000000000001','a2100000-0000-4000-8000-000000000001','a1100000-0000-4000-8000-000000000001','Ministries Admin','ministries-admin@test.invalid','active'),
  ('a3200000-0000-4000-8000-000000000002','a2100000-0000-4000-8000-000000000001','a1200000-0000-4000-8000-000000000002','Ministries Secretary','ministries-secretary@test.invalid','active'),
  ('a3300000-0000-4000-8000-000000000003','a2200000-0000-4000-8000-000000000002','a1300000-0000-4000-8000-000000000003','Other Church Admin','ministries-other-admin@test.invalid','active'),
  ('a3400000-0000-4000-8000-000000000004','a2100000-0000-4000-8000-000000000001','a1400000-0000-4000-8000-000000000004','Requesting Member','ministries-member@test.invalid','active');

insert into public.user_roles (user_id,church_id,role) values
  ('a1100000-0000-4000-8000-000000000001','a2100000-0000-4000-8000-000000000001','church_admin'),
  ('a1200000-0000-4000-8000-000000000002','a2100000-0000-4000-8000-000000000001','secretary'),
  ('a1300000-0000-4000-8000-000000000003','a2200000-0000-4000-8000-000000000002','church_admin'),
  ('a1400000-0000-4000-8000-000000000004','a2100000-0000-4000-8000-000000000001','member');

update public.church_features cf
set enabled = false
from public.platform_features pf
where cf.feature_id = pf.id
  and pf.key = 'ministries'
  and cf.church_id in ('a2100000-0000-4000-8000-000000000001','a2200000-0000-4000-8000-000000000002');

update public.church_role_permissions crp
set can_approve = false
from public.platform_features pf
where crp.feature_id = pf.id
  and pf.key = 'ministries'
  and crp.church_id in ('a2100000-0000-4000-8000-000000000001','a2200000-0000-4000-8000-000000000002');

delete from public.church_feature_default_provisioning p
using public.platform_features pf
where p.feature_id = pf.id
  and pf.key = 'ministries'
  and p.church_id in ('a2100000-0000-4000-8000-000000000001','a2200000-0000-4000-8000-000000000002');

set local role authenticated;
set local request.jwt.claim.sub = 'a1000000-0000-4000-8000-000000000000';
select public.set_super_admin_church_feature(
  'a2100000-0000-4000-8000-000000000001','ministries',true,false
);
reset role;

do $$
begin
  assert exists (
    select 1 from public.church_role_permissions crp
    join public.platform_features pf on pf.id = crp.feature_id
    where crp.church_id = 'a2100000-0000-4000-8000-000000000001'
      and crp.role = 'church_admin' and pf.key = 'ministries' and crp.can_approve
  ), 'Enabled church must receive Church Admin ministries approve';
  assert not public.has_church_feature_permission(
    'a1300000-0000-4000-8000-000000000003',
    'a2200000-0000-4000-8000-000000000002',
    'ministries', 'approve'
  ), 'Disabled Ministries feature must not provide active approve access';
  assert not exists (
    select 1 from public.church_role_permissions crp
    join public.platform_features pf on pf.id = crp.feature_id
    where crp.church_id = 'a2200000-0000-4000-8000-000000000002'
      and crp.role = 'church_admin' and pf.key = 'ministries' and crp.can_approve
  ), 'Disabled church must not receive stored Church Admin ministries approve';
  assert not exists (
    select 1 from public.church_role_permissions crp
    join public.platform_features pf on pf.id = crp.feature_id
    where crp.church_id = 'a2100000-0000-4000-8000-000000000001'
      and crp.role <> 'church_admin' and pf.key = 'ministries' and crp.can_approve
  ), 'No other role may gain ministries approve';
  assert not public.has_church_feature_permission(
    'a1200000-0000-4000-8000-000000000002',
    'a2100000-0000-4000-8000-000000000001',
    'ministries', 'approve'
  ), 'Secretary must not have effective ministries approve';
end;
$$;

insert into public.ministries (id,church_id,name) values
  ('a4100000-0000-4000-8000-000000000001','a2100000-0000-4000-8000-000000000001','Approval Ministry');

insert into public.ministry_join_requests (id,church_id,ministry_id,member_id,status) values
  ('a5100000-0000-4000-8000-000000000001','a2100000-0000-4000-8000-000000000001','a4100000-0000-4000-8000-000000000001','a3400000-0000-4000-8000-000000000004','pending'),
  ('a5200000-0000-4000-8000-000000000002','a2100000-0000-4000-8000-000000000001','a4100000-0000-4000-8000-000000000001','a3400000-0000-4000-8000-000000000004','cancelled'),
  ('a5300000-0000-4000-8000-000000000003','a2100000-0000-4000-8000-000000000001','a4100000-0000-4000-8000-000000000001','a3400000-0000-4000-8000-000000000004','cancelled'),
  ('a5400000-0000-4000-8000-000000000004','a2100000-0000-4000-8000-000000000001','a4100000-0000-4000-8000-000000000001','a3400000-0000-4000-8000-000000000004','cancelled'),
  ('a5500000-0000-4000-8000-000000000005','a2100000-0000-4000-8000-000000000001','a4100000-0000-4000-8000-000000000001','a3400000-0000-4000-8000-000000000004','cancelled'),
  ('a5600000-0000-4000-8000-000000000006','a2100000-0000-4000-8000-000000000001','a4100000-0000-4000-8000-000000000001','a3400000-0000-4000-8000-000000000004','cancelled');

set local role authenticated;
set local request.jwt.claim.sub = 'a1100000-0000-4000-8000-000000000001';
update public.ministry_join_requests
set status = 'approved', reviewed_by = auth.uid(), reviewed_at = now()
where id = 'a5100000-0000-4000-8000-000000000001';
update public.ministry_join_requests
set status = 'rejected', reviewed_by = auth.uid(), reviewed_at = now()
where id = 'a5200000-0000-4000-8000-000000000002';
reset role;

do $$
begin
  assert (select status = 'approved' from public.ministry_join_requests where id = 'a5100000-0000-4000-8000-000000000001');
  assert (select status = 'rejected' from public.ministry_join_requests where id = 'a5200000-0000-4000-8000-000000000002');
end;
$$;

set local role authenticated;
set local request.jwt.claim.sub = 'a1200000-0000-4000-8000-000000000002';
do $$
declare
  v_approve_rejected boolean := false;
  v_reject_rejected boolean := false;
begin
  assert auth.uid() = 'a1200000-0000-4000-8000-000000000002'::uuid,
    'Unauthorized fixture must expose the Secretary JWT user';
  assert current_user = 'authenticated',
    'Unauthorized fixture must execute as the authenticated database role';
  assert exists (
    select 1 from public.user_roles
    where user_id = auth.uid()
      and church_id = 'a2100000-0000-4000-8000-000000000001'
      and role = 'secretary'
  ), 'Unauthorized fixture must be the same-church Secretary';
  assert not public.has_church_feature_permission(
    auth.uid(), 'a2100000-0000-4000-8000-000000000001', 'ministries', 'approve'
  ), 'Unauthorized fixture unexpectedly has ministries approve';

  update public.ministry_join_requests set message = 'Permitted ordinary review note'
  where id = 'a5300000-0000-4000-8000-000000000003';
  assert found, 'Same-church permitted non-status edit was unexpectedly blocked';

  begin
    update public.ministry_join_requests set status = 'approved'
    where id = 'a5300000-0000-4000-8000-000000000003';
  exception when insufficient_privilege then
    v_approve_rejected := true;
  end;
  begin
    update public.ministry_join_requests set status = 'rejected'
    where id = 'a5500000-0000-4000-8000-000000000005';
  exception when insufficient_privilege then
    v_reject_rejected := true;
  end;
  assert v_approve_rejected, 'Same-church unauthorized approve did not raise SQLSTATE 42501';
  assert v_reject_rejected, 'Same-church unauthorized reject did not raise SQLSTATE 42501';
end;
$$;
reset role;

do $$
begin
  assert (select status = 'cancelled' from public.ministry_join_requests where id = 'a5300000-0000-4000-8000-000000000003'),
    'Same-church user without approve changed the request';
  assert (select message = 'Permitted ordinary review note' from public.ministry_join_requests where id = 'a5300000-0000-4000-8000-000000000003'),
    'Permitted non-status edit did not persist';
  assert (select status = 'cancelled' from public.ministry_join_requests where id = 'a5500000-0000-4000-8000-000000000005'),
    'Same-church user without approve rejected the request';
end;
$$;

set local role authenticated;
set local request.jwt.claim.sub = 'a1300000-0000-4000-8000-000000000003';
do $$
begin
  update public.ministry_join_requests set status = 'approved'
  where id = 'a5400000-0000-4000-8000-000000000004';
  assert not found, 'Cross-church approve unexpectedly reached a request row';
  update public.ministry_join_requests set status = 'rejected'
  where id = 'a5600000-0000-4000-8000-000000000006';
  assert not found, 'Cross-church reject unexpectedly reached a request row';
end;
$$;
reset role;

do $$
begin
  assert (select status = 'cancelled' from public.ministry_join_requests where id = 'a5400000-0000-4000-8000-000000000004'),
    'Cross-church actor changed the request';
  assert (select status = 'cancelled' from public.ministry_join_requests where id = 'a5600000-0000-4000-8000-000000000006'),
    'Cross-church actor rejected the request';
end;
$$;

select 'ok 1 - Ministries approve permission and join-review authorization passed';
rollback;

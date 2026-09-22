\set ON_ERROR_STOP on
begin;

create or replace function pg_temp.assert_true(_condition boolean, _label text)
returns void language plpgsql as $$
begin
  if not coalesce(_condition, false) then
    raise exception 'FAIL: %', _label;
  end if;
  raise notice 'PASS: %', _label;
end;
$$;

create or replace function pg_temp.assert_raises_permission_denied(_sql text, _label text)
returns void language plpgsql as $$
begin
  execute _sql;
  raise exception 'FAIL: %', _label;
exception
  when insufficient_privilege then
    raise notice 'PASS: %', _label;
end;
$$;

insert into auth.users (id, email, aud, role, created_at, updated_at) values
  ('81000000-0000-4000-8000-000000000001', 'event-owner@test.invalid', 'authenticated', 'authenticated', now(), now()),
  ('81000000-0000-4000-8000-000000000002', 'event-member@test.invalid', 'authenticated', 'authenticated', now(), now()),
  ('81000000-0000-4000-8000-000000000003', 'event-secretary@test.invalid', 'authenticated', 'authenticated', now(), now()),
  ('81000000-0000-4000-8000-000000000004', 'event-treasurer@test.invalid', 'authenticated', 'authenticated', now(), now()),
  ('81000000-0000-4000-8000-000000000005', 'event-pastor@test.invalid', 'authenticated', 'authenticated', now(), now()),
  ('81000000-0000-4000-8000-000000000006', 'event-foreign@test.invalid', 'authenticated', 'authenticated', now(), now()),
  ('81000000-0000-4000-8000-000000000007', 'event-multi-role@test.invalid', 'authenticated', 'authenticated', now(), now()),
  ('81000000-0000-4000-8000-000000000008', 'legacy-event-member@test.invalid', 'authenticated', 'authenticated', now(), now()),
  ('81000000-0000-4000-8000-000000000009', 'blank-event-member@test.invalid', 'authenticated', 'authenticated', now(), now());

insert into public.churches (id, name, slug) values
  ('82000000-0000-4000-8000-000000000001', 'Event Request RLS A', 'event-request-rls-a'),
  ('82000000-0000-4000-8000-000000000002', 'Event Request RLS B', 'event-request-rls-b');

insert into public.members (id, church_id, user_id, full_name, email, status) values
  ('83000000-0000-4000-8000-000000000001', '82000000-0000-4000-8000-000000000001', '81000000-0000-4000-8000-000000000001', 'Event Owner', null, 'active'),
  ('83000000-0000-4000-8000-000000000002', '82000000-0000-4000-8000-000000000001', '81000000-0000-4000-8000-000000000002', 'Other Member', null, 'active'),
  ('83000000-0000-4000-8000-000000000003', '82000000-0000-4000-8000-000000000002', '81000000-0000-4000-8000-000000000006', 'Foreign Member', null, 'active'),
  ('83000000-0000-4000-8000-000000000004', '82000000-0000-4000-8000-000000000001', '81000000-0000-4000-8000-000000000007', 'Multi Role Member', null, 'active'),
  ('83000000-0000-4000-8000-000000000005', '82000000-0000-4000-8000-000000000001', null, 'Legacy Email Member', 'legacy-event-member@test.invalid', 'active'),
  ('83000000-0000-4000-8000-000000000006', '82000000-0000-4000-8000-000000000001', null, 'Null Email Member', null, 'active'),
  ('83000000-0000-4000-8000-000000000007', '82000000-0000-4000-8000-000000000001', null, 'Blank Email Member', '   ', 'active');

insert into public.user_roles (user_id, church_id, role) values
  ('81000000-0000-4000-8000-000000000001', '82000000-0000-4000-8000-000000000001', 'member'),
  ('81000000-0000-4000-8000-000000000002', '82000000-0000-4000-8000-000000000001', 'member'),
  ('81000000-0000-4000-8000-000000000003', '82000000-0000-4000-8000-000000000001', 'secretary'),
  ('81000000-0000-4000-8000-000000000004', '82000000-0000-4000-8000-000000000001', 'treasurer'),
  ('81000000-0000-4000-8000-000000000005', '82000000-0000-4000-8000-000000000001', 'pastor'),
  ('81000000-0000-4000-8000-000000000006', '82000000-0000-4000-8000-000000000002', 'member'),
  ('81000000-0000-4000-8000-000000000007', '82000000-0000-4000-8000-000000000001', 'member'),
  ('81000000-0000-4000-8000-000000000007', '82000000-0000-4000-8000-000000000001', 'secretary'),
  ('81000000-0000-4000-8000-000000000007', '82000000-0000-4000-8000-000000000001', 'treasurer'),
  ('81000000-0000-4000-8000-000000000008', '82000000-0000-4000-8000-000000000001', 'member'),
  ('81000000-0000-4000-8000-000000000009', '82000000-0000-4000-8000-000000000001', 'member');

insert into public.church_features (church_id, feature_id, enabled)
select c.id, pf.id, true
from public.churches c
cross join public.platform_features pf
where c.id in ('82000000-0000-4000-8000-000000000001', '82000000-0000-4000-8000-000000000002')
  and pf.key = 'event_requests'
on conflict (church_id, feature_id) do update set enabled = excluded.enabled;

insert into public.church_role_permissions
  (church_id, role, feature_id, can_view, can_create, can_edit, can_delete, can_approve, can_publish, can_manage)
select '82000000-0000-4000-8000-000000000001', r.role, pf.id,
  r.role in ('member', 'secretary'),
  r.role = 'member',
  r.role = 'treasurer',
  false,
  r.role = 'pastor',
  false,
  false
from (values ('member'), ('secretary'), ('treasurer'), ('pastor')) r(role)
cross join public.platform_features pf
where pf.key = 'event_requests'
on conflict (church_id, role, feature_id) do update set
  can_view = excluded.can_view,
  can_create = excluded.can_create,
  can_edit = excluded.can_edit,
  can_delete = excluded.can_delete,
  can_approve = excluded.can_approve,
  can_publish = excluded.can_publish,
  can_manage = excluded.can_manage;

insert into public.event_requests
  (id, church_id, member_id, request_type, type, title, status, description)
values
  ('84000000-0000-4000-8000-000000000001', '82000000-0000-4000-8000-000000000001', '83000000-0000-4000-8000-000000000001', 'parish_event', 'wedding', 'Ndoa', 'submitted', 'Wedding request'),
  ('84000000-0000-4000-8000-000000000002', '82000000-0000-4000-8000-000000000002', '83000000-0000-4000-8000-000000000003', 'parish_event', 'baptism', 'Ubatizo', 'submitted', 'Foreign baptism request'),
  ('84000000-0000-4000-8000-000000000003', '82000000-0000-4000-8000-000000000001', '83000000-0000-4000-8000-000000000005', 'parish_event', 'funeral', 'Legacy email request', 'submitted', 'Legacy email request'),
  ('84000000-0000-4000-8000-000000000004', '82000000-0000-4000-8000-000000000001', '83000000-0000-4000-8000-000000000006', 'parish_event', 'other', 'Null email request', 'submitted', 'Null email request'),
  ('84000000-0000-4000-8000-000000000005', '82000000-0000-4000-8000-000000000001', '83000000-0000-4000-8000-000000000007', 'parish_event', 'other', 'Blank email request', 'submitted', 'Blank email request');

revoke select on public.church_role_permissions from authenticated;

set local role authenticated;

select pg_temp.assert_raises_permission_denied(
  'select 1 from public.church_role_permissions limit 1',
  'authenticated has no direct SELECT on church_role_permissions'
);

select set_config('request.jwt.claim.sub', '81000000-0000-4000-8000-000000000001', true);
select set_config('request.jwt.claim.email', '', true);
select set_config('request.jwt.claims', '{}', true);
select pg_temp.assert_true(exists (select 1 from public.event_requests where id = '84000000-0000-4000-8000-000000000001'), 'linked member can read own event request through user_id');
select pg_temp.assert_true(not exists (select 1 from public.event_requests where id = '84000000-0000-4000-8000-000000000002'), 'member cannot read cross-church event request');

select set_config('request.jwt.claim.sub', '81000000-0000-4000-8000-000000000002', true);
select set_config('request.jwt.claim.email', '', true);
select set_config('request.jwt.claims', '{}', true);
select pg_temp.assert_true(not exists (select 1 from public.event_requests where id = '84000000-0000-4000-8000-000000000001'), 'member cannot read another member event request');
select pg_temp.assert_true(not exists (select 1 from public.event_requests where id = '84000000-0000-4000-8000-000000000004'), 'null member email and null jwt email do not match');
select pg_temp.assert_true(not exists (select 1 from public.event_requests where id = '84000000-0000-4000-8000-000000000005'), 'blank member email and blank jwt email do not match');

do $$
begin
  insert into public.event_requests (id, church_id, member_id, request_type, type, title, status, description)
  values ('84000000-0000-4000-8000-000000000006', '82000000-0000-4000-8000-000000000001', '83000000-0000-4000-8000-000000000001', 'parish_event', 'other', 'Forbidden blank email insert', 'submitted', 'Forbidden blank email insert');
  raise exception 'FAIL: member cannot insert for another member through null or blank email values';
exception when insufficient_privilege then
  raise notice 'PASS: member cannot insert for another member through null or blank email values';
end $$;

select set_config('request.jwt.claim.sub', '81000000-0000-4000-8000-000000000003', true);
select set_config('request.jwt.claim.email', 'event-secretary@test.invalid', true);
select set_config('request.jwt.claims', '{"email":"event-secretary@test.invalid"}', true);
select pg_temp.assert_true(exists (select 1 from public.event_requests where id = '84000000-0000-4000-8000-000000000001'), 'view-only staff can read church event request');
select pg_temp.assert_true(
  not exists (
    select 1 from public.event_requests
    where id = '84000000-0000-4000-8000-000000000002'
  ),
  'secretary cannot read cross-church event request'
);
update public.event_requests set admin_notes = 'Secretary attempted edit' where id = '84000000-0000-4000-8000-000000000001';

reset role;
select pg_temp.assert_true(not exists (select 1 from public.event_requests where id = '84000000-0000-4000-8000-000000000001' and admin_notes = 'Secretary attempted edit'), 'view-only staff cannot edit event request');

set local role authenticated;
select set_config('request.jwt.claim.sub', '81000000-0000-4000-8000-000000000004', true);
select set_config('request.jwt.claim.email', 'event-treasurer@test.invalid', true);
select set_config('request.jwt.claims', '{"email":"event-treasurer@test.invalid"}', true);
select pg_temp.assert_true(exists (select 1 from public.event_requests where id = '84000000-0000-4000-8000-000000000001'), 'edit-only staff can see row targeted for review update');
update public.event_requests set admin_notes = 'Reviewed by edit-only treasurer' where id = '84000000-0000-4000-8000-000000000001';
do $$
begin
  update public.event_requests set status = 'approved' where id = '84000000-0000-4000-8000-000000000001';
  raise exception 'FAIL: edit-only staff cannot perform approval transition';
exception when insufficient_privilege then
  raise notice 'PASS: edit-only staff cannot perform approval transition';
end $$;

reset role;
select pg_temp.assert_true(exists (select 1 from public.event_requests where id = '84000000-0000-4000-8000-000000000001' and admin_notes = 'Reviewed by edit-only treasurer'), 'edit-only staff can update review notes');
select pg_temp.assert_true(not exists (select 1 from public.event_requests where id = '84000000-0000-4000-8000-000000000001' and status = 'approved'), 'edit-only staff cannot perform approval transition');

set local role authenticated;
select set_config('request.jwt.claim.sub', '81000000-0000-4000-8000-000000000005', true);
select set_config('request.jwt.claim.email', 'event-pastor@test.invalid', true);
select set_config('request.jwt.claims', '{"email":"event-pastor@test.invalid"}', true);
select pg_temp.assert_true(exists (select 1 from public.event_requests where id = '84000000-0000-4000-8000-000000000001'), 'approve-only staff can see row targeted for approval update');
do $$
begin
  update public.event_requests set admin_notes = 'Pastor attempted edit-only notes' where id = '84000000-0000-4000-8000-000000000001';
  raise exception 'FAIL: approve-only staff cannot edit ordinary review notes';
exception when insufficient_privilege then
  raise notice 'PASS: approve-only staff cannot edit ordinary review notes';
end $$;
update public.event_requests set status = 'approved', reviewed_by = '81000000-0000-4000-8000-000000000005', reviewed_at = now() where id = '84000000-0000-4000-8000-000000000001';

reset role;
select pg_temp.assert_true(not exists (select 1 from public.event_requests where id = '84000000-0000-4000-8000-000000000001' and admin_notes = 'Pastor attempted edit-only notes'), 'approve-only staff cannot edit ordinary review notes');
select pg_temp.assert_true(exists (select 1 from public.event_requests where id = '84000000-0000-4000-8000-000000000001' and status = 'approved'), 'approve-only staff can perform approval transition');

-- Regression: edit-only staff may update notes on an already-approved request.
set local role authenticated;
select set_config('request.jwt.claim.sub', '81000000-0000-4000-8000-000000000004', true);
update public.event_requests
set admin_notes = 'Notes updated after approval'
where id = '84000000-0000-4000-8000-000000000001';
reset role;
select pg_temp.assert_true(
  exists (
    select 1 from public.event_requests
    where id = '84000000-0000-4000-8000-000000000001'
      and status = 'approved'
      and admin_notes = 'Notes updated after approval'
  ),
  'edit-only staff can update notes on an already-approved request'
);


set local role authenticated;
select set_config('request.jwt.claim.sub', '81000000-0000-4000-8000-000000000007', true);
select set_config('request.jwt.claim.email', '', true);
select set_config('request.jwt.claims', '{}', true);
do $$
begin
  update public.event_requests set status = 'converted' where id = '84000000-0000-4000-8000-000000000001';
  raise exception 'FAIL: multi-role partial permissions cannot combine into approval transition';
exception when insufficient_privilege then
  raise notice 'PASS: multi-role partial permissions cannot combine into approval transition';
end $$;

reset role;
select pg_temp.assert_true(not exists (select 1 from public.event_requests where id = '84000000-0000-4000-8000-000000000001' and status = 'converted'), 'multi-role partial permissions cannot combine into approval transition');

set local role authenticated;
select set_config('request.jwt.claim.sub', '81000000-0000-4000-8000-000000000008', true);
select set_config('request.jwt.claim.email', 'legacy-event-member@test.invalid', true);
select set_config('request.jwt.claims', '{"email":"legacy-event-member@test.invalid"}', true);
select pg_temp.assert_true(not exists (select 1 from public.event_requests where id = '84000000-0000-4000-8000-000000000003'), 'legacy unlinked member cannot read through matching email alone');

do $$
begin
  insert into public.event_requests (id, church_id, member_id, request_type, type, title, status, description)
  values ('84000000-0000-4000-8000-000000000007', '82000000-0000-4000-8000-000000000001', '83000000-0000-4000-8000-000000000005', 'parish_event', 'other', 'Forbidden legacy email insert', 'submitted', 'Forbidden legacy email insert');
  raise exception 'FAIL: legacy unlinked member cannot insert through matching email alone';
exception when insufficient_privilege then
  raise notice 'PASS: legacy unlinked member cannot insert through matching email alone';
end $$;

select set_config('request.jwt.claim.email', '', true);
select set_config('request.jwt.claims', '{}', true);
select pg_temp.assert_true(not exists (select 1 from public.event_requests where id = '84000000-0000-4000-8000-000000000003'), 'legacy unlinked member with blank jwt email cannot read unlinked event request');

reset role;
update public.church_features cf
set enabled = false
from public.platform_features pf
where cf.feature_id = pf.id
  and pf.key = 'event_requests'
  and cf.church_id = '82000000-0000-4000-8000-000000000001';

set local role authenticated;
select set_config('request.jwt.claim.sub', '81000000-0000-4000-8000-000000000003', true);
select pg_temp.assert_true(not exists (select 1 from public.event_requests where id = '84000000-0000-4000-8000-000000000001'), 'disabled feature blocks staff read permission');
update public.event_requests set admin_notes = 'Disabled feature attempted update' where id = '84000000-0000-4000-8000-000000000001';

reset role;
select pg_temp.assert_true(not exists (select 1 from public.event_requests where id = '84000000-0000-4000-8000-000000000001' and admin_notes = 'Disabled feature attempted update'), 'disabled feature blocks staff update permission');

update public.church_features cf
set enabled = true
from public.platform_features pf
where cf.feature_id = pf.id
  and pf.key = 'event_requests'
  and cf.church_id = '82000000-0000-4000-8000-000000000001';

set local role authenticated;
select set_config('request.jwt.claim.sub', '81000000-0000-4000-8000-000000000004', true);
do $$
begin
  update public.event_requests set church_id = '82000000-0000-4000-8000-000000000002' where id = '84000000-0000-4000-8000-000000000001';
  raise exception 'FAIL: staff cannot reassign church';
exception when insufficient_privilege then
  raise notice 'PASS: staff cannot reassign church';
end $$;
do $$
begin
  update public.event_requests set member_id = '83000000-0000-4000-8000-000000000002' where id = '84000000-0000-4000-8000-000000000001';
  raise exception 'FAIL: staff cannot reassign owner';
exception when insufficient_privilege then
  raise notice 'PASS: staff cannot reassign owner';
end $$;
do $$
begin
  update public.event_requests set description = 'Edited submitted description' where id = '84000000-0000-4000-8000-000000000001';
  raise exception 'FAIL: staff cannot edit submitted member details';
exception when insufficient_privilege then
  raise notice 'PASS: staff cannot edit submitted member details';
end $$;

reset role;
select pg_temp.assert_true(
  exists (
    select 1 from public.event_requests
    where id = '84000000-0000-4000-8000-000000000001'
      and church_id = '82000000-0000-4000-8000-000000000001'
      and member_id = '83000000-0000-4000-8000-000000000001'
      and description = 'Wedding request'
  ),
  'staff cannot reassign church, reassign owner, or edit submitted member details'
);

select pg_temp.assert_true(exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'event_requests' and policyname = 'Members can read own event requests'), 'hardened member owner read policy exists');
select pg_temp.assert_true(exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'event_requests' and policyname = 'Members can create own event requests'), 'hardened member owner insert policy exists');
select pg_temp.assert_true(exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'event_requests' and policyname = 'Church staff can read permitted event requests'), 'permission-based staff read policy exists');
select pg_temp.assert_true(exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'event_requests' and policyname = 'Church staff can review permitted event requests'), 'permission-based staff update policy exists');
select pg_temp.assert_true(not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'event_requests' and policyname in ('event requests same church', 'Church members can view event requests', 'Church managers can read event requests')), 'historical broad event request select policies do not exist');
select pg_temp.assert_true(not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'event_requests' and policyname like 'tenant feature %'), 'generic tenant feature event request policies are absent');
select pg_temp.assert_true(
  not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'event_requests'
      and policyname in ('Church staff can read permitted event requests', 'Church staff can review permitted event requests')
      and (coalesce(qual, '') || coalesce(with_check, '')) ~ 'church_role_permissions|user_roles|platform_features'
  ),
  'staff policies do not directly join permission tables'
);

-- Regression: service_role can perform an internal event-request update.
set local role service_role;
select set_config('request.jwt.claim.role', 'service_role', true);

update public.event_requests
set admin_notes = 'Updated by internal service'
where id = '84000000-0000-4000-8000-000000000001';

reset role;

select pg_temp.assert_true(
  exists (
    select 1 from public.event_requests
    where id = '84000000-0000-4000-8000-000000000001'
      and admin_notes = 'Updated by internal service'
  ),
  'service_role can update event request'
);

-- A normal authenticated user cannot impersonate service_role.
set local role authenticated;
select set_config('request.jwt.claim.sub', '81000000-0000-4000-8000-000000000002', true);
select set_config('request.jwt.claim.role', 'service_role', true);

do $$
declare
  v_rows integer;
begin
  update public.event_requests
  set admin_notes = 'Unauthorized service impersonation'
  where id = '84000000-0000-4000-8000-000000000001';

  get diagnostics v_rows = row_count;

  if v_rows <> 0 then
    raise exception 'FAIL: authenticated user updated % rows while impersonating service_role', v_rows;
  end if;

  raise notice 'PASS: authenticated user updated 0 rows';
exception
  when insufficient_privilege then
    raise notice 'PASS: authenticated user received permission denied';
end $$;

reset role;
select set_config('request.jwt.claim.role', 'authenticated', true);

-- Wave23D: manage-only regression fixtures
reset role;

insert into auth.users (id, email, aud, role, created_at, updated_at)
values (
  '81000000-0000-4000-8000-000000000010',
  'event-manager@test.invalid',
  'authenticated',
  'authenticated',
  now(),
  now()
);

insert into public.user_roles (user_id, church_id, role)
values (
  '81000000-0000-4000-8000-000000000010',
  '82000000-0000-4000-8000-000000000001',
  'church_admin'
);

insert into public.church_role_permissions
  (church_id, role, feature_id, can_view, can_create, can_edit,
   can_delete, can_approve, can_publish, can_manage)
select
  '82000000-0000-4000-8000-000000000001',
  'church_admin',
  pf.id,
  false, false, false, false, false, false, true
from public.platform_features pf
where pf.key = 'event_requests'
on conflict (church_id, role, feature_id) do update
set can_view = false,
    can_create = false,
    can_edit = false,
    can_delete = false,
    can_approve = false,
    can_publish = false,
    can_manage = true;
-- Wave23D: manage and approval regression tests
set local role authenticated;
select set_config('request.jwt.claim.sub', '81000000-0000-4000-8000-000000000010', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

select pg_temp.assert_true(
  public.has_event_request_staff_permission(
    auth.uid(),
    '82000000-0000-4000-8000-000000000001',
    'manage'
  ),
  'manage-only staff has manage permission'
);

select pg_temp.assert_true(
  not public.has_event_request_staff_permission(
    auth.uid(),
    '82000000-0000-4000-8000-000000000001',
    'edit'
  )
  and not public.has_event_request_staff_permission(
    auth.uid(),
    '82000000-0000-4000-8000-000000000001',
    'approve'
  ),
  'manage-only staff has neither edit nor approve permission'
);

update public.event_requests
set admin_notes = 'Updated by manage-only staff'
where id = '84000000-0000-4000-8000-000000000001';

reset role;

select pg_temp.assert_true(
  exists (
    select 1 from public.event_requests
    where id = '84000000-0000-4000-8000-000000000001'
      and admin_notes = 'Updated by manage-only staff'
  ),
  'manage-only staff can edit notes'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '81000000-0000-4000-8000-000000000010', true);

update public.event_requests
set status = case when status = 'approved' then 'submitted' else 'approved' end,
    reviewed_by = '81000000-0000-4000-8000-000000000010',
    reviewed_at = now()
where id = '84000000-0000-4000-8000-000000000001';

reset role;

select pg_temp.assert_true(
  exists (
    select 1 from public.event_requests
    where id = '84000000-0000-4000-8000-000000000001'
      and reviewed_by = '81000000-0000-4000-8000-000000000010'
      and reviewed_at is not null
  ),
  'manage-only staff can change approval fields and status'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '81000000-0000-4000-8000-000000000004', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

do $$
begin
  update public.event_requests
  set reviewed_by = null
  where id = '84000000-0000-4000-8000-000000000001';

  raise exception 'FAIL: edit-only staff cleared reviewed_by';
exception
  when insufficient_privilege then
    raise notice 'PASS: edit-only staff cannot clear reviewed_by';
end $$;

do $$
begin
  update public.event_requests
  set reviewed_at = null
  where id = '84000000-0000-4000-8000-000000000001';

  raise exception 'FAIL: edit-only staff cleared reviewed_at';
exception
  when insufficient_privilege then
    raise notice 'PASS: edit-only staff cannot clear reviewed_at';
end $$;

reset role;

select pg_temp.assert_true(
  exists (
    select 1 from public.event_requests
    where id = '84000000-0000-4000-8000-000000000001'
      and reviewed_by = '81000000-0000-4000-8000-000000000010'
      and reviewed_at is not null
  ),
  'edit-only staff cannot erase approval information'
);
rollback;

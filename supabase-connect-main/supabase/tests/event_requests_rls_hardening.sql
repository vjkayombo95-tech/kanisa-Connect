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
  ('81000000-0000-4000-8000-000000000007', '82000000-0000-4000-8000-000000000001', 'office_assistant'),
  ('81000000-0000-4000-8000-000000000008', '82000000-0000-4000-8000-000000000001', 'member'),
  ('81000000-0000-4000-8000-000000000009', '82000000-0000-4000-8000-000000000001', 'member');

insert into public.church_features (church_id, feature_id, enabled)
select c.id, pf.id, true
from public.churches c
cross join public.platform_features pf
where c.id in (
  '82000000-0000-4000-8000-000000000001',
  '82000000-0000-4000-8000-000000000002'
)
and pf.key = 'event_requests'
on conflict (church_id, feature_id) do update set enabled = excluded.enabled;

insert into public.church_role_permissions
  (church_id, role, feature_id, can_view, can_create, can_edit, can_delete, can_approve, can_publish, can_manage)
select
  '82000000-0000-4000-8000-000000000001',
  r.role,
  pf.id,
  r.role = 'secretary',
  false,
  r.role = 'secretary',
  false,
  false,
  false,
  false
from (values ('secretary'), ('treasurer'), ('pastor')) r(role)
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

insert into public.church_role_permissions
  (church_id, role, feature_id, can_view, can_create, can_edit, can_delete, can_approve, can_publish, can_manage)
select
  '82000000-0000-4000-8000-000000000001',
  r.role,
  pf.id,
  r.role = 'member',
  r.role = 'member',
  false,
  false,
  false,
  false,
  false
from (values ('member'), ('office_assistant')) r(role)
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
  (
    '84000000-0000-4000-8000-000000000001',
    '82000000-0000-4000-8000-000000000001',
    '83000000-0000-4000-8000-000000000001',
    'parish_event',
    'wedding',
    'Ndoa',
    'submitted',
    'Wedding request'
  ),
  (
    '84000000-0000-4000-8000-000000000002',
    '82000000-0000-4000-8000-000000000002',
    '83000000-0000-4000-8000-000000000003',
    'parish_event',
    'baptism',
    'Ubatizo',
    'submitted',
    'Foreign baptism request'
  ),
  (
    '84000000-0000-4000-8000-000000000003',
    '82000000-0000-4000-8000-000000000001',
    '83000000-0000-4000-8000-000000000005',
    'parish_event',
    'funeral',
    'Legacy email request',
    'submitted',
    'Legacy email request'
  ),
  (
    '84000000-0000-4000-8000-000000000004',
    '82000000-0000-4000-8000-000000000001',
    '83000000-0000-4000-8000-000000000006',
    'parish_event',
    'other',
    'Null email request',
    'submitted',
    'Null email request'
  ),
  (
    '84000000-0000-4000-8000-000000000005',
    '82000000-0000-4000-8000-000000000001',
    '83000000-0000-4000-8000-000000000007',
    'parish_event',
    'other',
    'Blank email request',
    'submitted',
    'Blank email request'
  );

set local role authenticated;

select set_config('request.jwt.claim.sub', '81000000-0000-4000-8000-000000000001', true);
select set_config('request.jwt.claim.email', '', true);
select set_config('request.jwt.claims', '{}', true);
select pg_temp.assert_true(
  exists (
    select 1 from public.event_requests
    where id = '84000000-0000-4000-8000-000000000001'
  ),
  'linked member can read own event request through user_id'
);
select pg_temp.assert_true(
  not exists (
    select 1 from public.event_requests
    where id = '84000000-0000-4000-8000-000000000002'
  ),
  'member cannot read cross-church event request'
);

select set_config('request.jwt.claim.sub', '81000000-0000-4000-8000-000000000002', true);
select set_config('request.jwt.claim.email', '', true);
select set_config('request.jwt.claims', '{}', true);
select pg_temp.assert_true(
  not exists (
    select 1 from public.event_requests
    where id = '84000000-0000-4000-8000-000000000001'
  ),
  'member cannot read another member event request'
);

select pg_temp.assert_true(
  not exists (
    select 1 from public.event_requests
    where id = '84000000-0000-4000-8000-000000000004'
  ),
  'null member email and null jwt email do not match'
);

select pg_temp.assert_true(
  not exists (
    select 1 from public.event_requests
    where id = '84000000-0000-4000-8000-000000000005'
  ),
  'blank member email and blank jwt email do not match'
);

do $$
begin
  insert into public.event_requests
    (id, church_id, member_id, request_type, type, title, status, description)
  values (
    '84000000-0000-4000-8000-000000000006',
    '82000000-0000-4000-8000-000000000001',
    '83000000-0000-4000-8000-000000000001',
    'parish_event',
    'other',
    'Forbidden blank email insert',
    'submitted',
    'Forbidden blank email insert'
  );
  raise exception 'FAIL: member cannot insert for another member through null or blank email values';
exception when insufficient_privilege then
  raise notice 'PASS: member cannot insert for another member through null or blank email values';
end $$;

select set_config('request.jwt.claim.sub', '81000000-0000-4000-8000-000000000003', true);
select set_config('request.jwt.claim.email', 'event-secretary@test.invalid', true);
select set_config('request.jwt.claims', '{"email":"event-secretary@test.invalid"}', true);
select pg_temp.assert_true(
  exists (
    select 1 from public.event_requests
    where id = '84000000-0000-4000-8000-000000000001'
  ),
  'secretary with view permission can read church event request'
);

update public.event_requests
set admin_notes = 'Reviewed by secretary'
where id = '84000000-0000-4000-8000-000000000001';

select pg_temp.assert_true(
  exists (
    select 1 from public.event_requests
    where id = '84000000-0000-4000-8000-000000000001'
      and admin_notes = 'Reviewed by secretary'
  ),
  'secretary with edit permission can update church event request'
);

select pg_temp.assert_true(
  not exists (
    select 1 from public.event_requests
    where id = '84000000-0000-4000-8000-000000000002'
  ),
  'secretary cannot read cross-church event request'
);

select set_config('request.jwt.claim.sub', '81000000-0000-4000-8000-000000000004', true);
select set_config('request.jwt.claim.email', 'event-treasurer@test.invalid', true);
select set_config('request.jwt.claims', '{"email":"event-treasurer@test.invalid"}', true);
select pg_temp.assert_true(
  not exists (
    select 1 from public.event_requests
    where id = '84000000-0000-4000-8000-000000000001'
  ),
  'treasurer without event request permission cannot read request'
);

update public.event_requests
set admin_notes = 'Treasurer attempted update'
where id = '84000000-0000-4000-8000-000000000001';

reset role;

select pg_temp.assert_true(
  exists (
    select 1 from public.event_requests
    where id = '84000000-0000-4000-8000-000000000001'
      and admin_notes = 'Reviewed by secretary'
  ),
  'treasurer without event request permission cannot update request'
);

set local role authenticated;

select set_config('request.jwt.claim.sub', '81000000-0000-4000-8000-000000000005', true);
select set_config('request.jwt.claim.email', 'event-pastor@test.invalid', true);
select set_config('request.jwt.claims', '{"email":"event-pastor@test.invalid"}', true);
select pg_temp.assert_true(
  not exists (
    select 1 from public.event_requests
    where id = '84000000-0000-4000-8000-000000000001'
  ),
  'pastor without event request permission cannot read request'
);

update public.event_requests
set admin_notes = 'Pastor attempted update'
where id = '84000000-0000-4000-8000-000000000001';

reset role;

select pg_temp.assert_true(
  exists (
    select 1 from public.event_requests
    where id = '84000000-0000-4000-8000-000000000001'
      and admin_notes = 'Reviewed by secretary'
  ),
  'pastor without event request permission cannot update request'
);

set local role authenticated;

select set_config('request.jwt.claim.sub', '81000000-0000-4000-8000-000000000008', true);
select set_config('request.jwt.claim.email', 'legacy-event-member@test.invalid', true);
select set_config('request.jwt.claims', '{"email":"legacy-event-member@test.invalid"}', true);
select pg_temp.assert_true(
  not exists (
    select 1 from public.event_requests
    where id = '84000000-0000-4000-8000-000000000003'
  ),
  'legacy unlinked member cannot read through matching email alone'
);

do $$
begin
  insert into public.event_requests
    (id, church_id, member_id, request_type, type, title, status, description)
  values (
    '84000000-0000-4000-8000-000000000007',
    '82000000-0000-4000-8000-000000000001',
    '83000000-0000-4000-8000-000000000005',
    'parish_event',
    'other',
    'Forbidden legacy email insert',
    'submitted',
    'Forbidden legacy email insert'
  );
  raise exception 'FAIL: legacy unlinked member cannot insert through matching email alone';
exception when insufficient_privilege then
  raise notice 'PASS: legacy unlinked member cannot insert through matching email alone';
end $$;

select set_config('request.jwt.claim.email', '', true);
select set_config('request.jwt.claims', '{}', true);
select pg_temp.assert_true(
  not exists (
    select 1 from public.event_requests
    where id = '84000000-0000-4000-8000-000000000003'
  ),
  'legacy unlinked member with blank jwt email cannot read unlinked event request'
);

select set_config('request.jwt.claim.sub', '81000000-0000-4000-8000-000000000007', true);
select set_config('request.jwt.claim.email', '', true);
select set_config('request.jwt.claims', '{}', true);

select pg_temp.assert_true(
  not exists (
    select 1 from public.event_requests
    where id = '84000000-0000-4000-8000-000000000001'
  ),
  'multi-role member plus unpermitted staff role cannot read another member event request'
);

update public.event_requests
set admin_notes = 'Multi-role attempted update'
where id = '84000000-0000-4000-8000-000000000001';

reset role;

select pg_temp.assert_true(
  exists (
    select 1 from public.event_requests
    where id = '84000000-0000-4000-8000-000000000001'
      and admin_notes = 'Reviewed by secretary'
  ),
  'multi-role member plus unpermitted staff role cannot update another member event request'
);

select pg_temp.assert_true(
  exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'event_requests'
      and policyname = 'Members can read own event requests'
  ),
  'hardened member owner read policy exists'
);

select pg_temp.assert_true(
  exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'event_requests'
      and policyname = 'Members can create own event requests'
  ),
  'hardened member owner insert policy exists'
);

select pg_temp.assert_true(
  exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'event_requests'
      and policyname = 'Church staff can read permitted event requests'
  ),
  'permission-based staff read policy exists'
);

select pg_temp.assert_true(
  exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'event_requests'
      and policyname = 'Church staff can review permitted event requests'
  ),
  'permission-based staff update policy exists'
);

select pg_temp.assert_true(
  not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'event_requests'
      and policyname in (
        'event requests same church',
        'Church members can view event requests'
      )
  ),
  'historical broad event request select policies do not exist'
);

rollback;




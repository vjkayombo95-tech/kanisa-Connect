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

create or replace function pg_temp.assert_false(_condition boolean, _label text)
returns void language plpgsql as $$
begin
  if coalesce(_condition, false) then
    raise exception 'FAIL: %', _label;
  end if;
  raise notice 'PASS: %', _label;
end;
$$;

create or replace function pg_temp.assert_permission_denied(_sql text, _label text)
returns void language plpgsql as $$
begin
  execute _sql;
  raise exception 'FAIL: %', _label;
exception
  when insufficient_privilege then
    raise notice 'PASS: %', _label;
end;
$$;

create or replace function pg_temp.assert_check_violation(_sql text, _label text)
returns void language plpgsql as $$
begin
  execute _sql;
  raise exception 'FAIL: %', _label;
exception
  when check_violation then
    raise notice 'PASS: %', _label;
end;
$$;

insert into auth.users (id, email, aud, role, raw_user_meta_data, created_at, updated_at) values
  ('a1000000-0000-4000-8000-000000000001', 'slice2-super-admin@test.invalid', 'authenticated', 'authenticated', '{"full_name":"Slice Two Super Admin"}', now(), now()),
  ('a1000000-0000-4000-8000-000000000002', 'slice2-diocese-admin@test.invalid', 'authenticated', 'authenticated', '{"full_name":"Slice Two Diocese Admin"}', now(), now()),
  ('a1000000-0000-4000-8000-000000000003', 'slice2-ordinary@test.invalid', 'authenticated', 'authenticated', '{"full_name":"Slice Two Ordinary"}', now(), now()),
  ('a1000000-0000-4000-8000-000000000004', 'slice2-staff-candidate@test.invalid', 'authenticated', 'authenticated', '{"full_name":"Slice Two Staff Candidate"}', now(), now()),
  ('a1000000-0000-4000-8000-000000000005', 'slice2-church-admin@test.invalid', 'authenticated', 'authenticated', '{"full_name":"Slice Two Church Admin"}', now(), now());

insert into public.profiles (id, full_name) values
  ('a1000000-0000-4000-8000-000000000001', 'Slice Two Super Admin'),
  ('a1000000-0000-4000-8000-000000000002', 'Slice Two Diocese Admin'),
  ('a1000000-0000-4000-8000-000000000003', 'Slice Two Ordinary'),
  ('a1000000-0000-4000-8000-000000000004', 'Slice Two Staff Candidate'),
  ('a1000000-0000-4000-8000-000000000005', 'Slice Two Church Admin');

insert into public.super_admins (id)
values ('a1000000-0000-4000-8000-000000000001');

insert into public.churches (id, name, slug, created_by) values
  ('a2000000-0000-4000-8000-000000000001', 'Slice Two Parish A', 'slice-two-parish-a', 'a1000000-0000-4000-8000-000000000001'),
  ('a2000000-0000-4000-8000-000000000002', 'Slice Two Parish B', 'slice-two-parish-b', 'a1000000-0000-4000-8000-000000000001');

insert into public.user_roles (id, user_id, church_id, role) values
  ('a6000000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000000005', 'a2000000-0000-4000-8000-000000000001', 'church_admin');

insert into public.dioceses (id, name, slug, status, created_by) values
  ('a3000000-0000-4000-8000-000000000001', 'Slice Two Diocese X', 'slice-two-diocese-x', 'active', 'a1000000-0000-4000-8000-000000000001'),
  ('a3000000-0000-4000-8000-000000000002', 'Slice Two Diocese Y', 'slice-two-diocese-y', 'active', 'a1000000-0000-4000-8000-000000000001');

insert into public.diocese_staff (id, diocese_id, user_id, role, status) values
  ('a5000000-0000-4000-8000-000000000001', 'a3000000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000000002', 'diocese_admin', 'active');

set local role authenticated;
select set_config('request.jwt.claim.sub', 'a1000000-0000-4000-8000-000000000003', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.email', 'slice2-ordinary@test.invalid', true);
select set_config('request.jwt.claims', '{"email":"slice2-ordinary@test.invalid"}', true);

select pg_temp.assert_permission_denied(
  'select * from public.search_super_admin_user_directory(''slice'', 10)',
  'ordinary authenticated user cannot use Super Admin user directory'
);

select pg_temp.assert_false(
  exists (select 1 from public.dioceses),
  'ordinary authenticated user cannot read Diocese management rows'
);

select set_config('request.jwt.claim.sub', 'a1000000-0000-4000-8000-000000000005', true);
select set_config('request.jwt.claim.email', 'slice2-church-admin@test.invalid', true);
select set_config('request.jwt.claims', '{"email":"slice2-church-admin@test.invalid"}', true);

select pg_temp.assert_true(
  public.is_church_admin('a1000000-0000-4000-8000-000000000005', 'a2000000-0000-4000-8000-000000000001'),
  'church admin fixture has church authority'
);

select pg_temp.assert_permission_denied(
  'select * from public.search_super_admin_user_directory(''slice'', 10)',
  'Church Admin cannot use Super Admin user directory'
);

select pg_temp.assert_false(
  exists (select 1 from public.dioceses),
  'Church Admin cannot read Diocese management rows'
);

select set_config('request.jwt.claim.sub', 'a1000000-0000-4000-8000-000000000002', true);
select set_config('request.jwt.claim.email', 'slice2-diocese-admin@test.invalid', true);
select set_config('request.jwt.claims', '{"email":"slice2-diocese-admin@test.invalid"}', true);

select pg_temp.assert_permission_denied(
  'select * from public.search_super_admin_user_directory(''slice'', 10)',
  'Diocese staff cannot use Super Admin user directory'
);

select pg_temp.assert_true(
  exists (select 1 from public.dioceses where id = 'a3000000-0000-4000-8000-000000000001'),
  'Diocese staff can still read their own Diocese through Slice 1 helper'
);

select pg_temp.assert_false(
  exists (select 1 from public.dioceses where id = 'a3000000-0000-4000-8000-000000000002'),
  'Diocese staff cannot read other Dioceses through management tables'
);

select pg_temp.assert_false(
  public.is_church_admin('a1000000-0000-4000-8000-000000000002', 'a2000000-0000-4000-8000-000000000001'),
  'Diocese Admin does not become Church Admin'
);

select set_config('request.jwt.claim.sub', 'a1000000-0000-4000-8000-000000000001', true);
select set_config('request.jwt.claim.email', 'slice2-super-admin@test.invalid', true);
select set_config('request.jwt.claims', '{"email":"slice2-super-admin@test.invalid"}', true);

select pg_temp.assert_true(
  exists (select 1 from public.search_super_admin_user_directory('candidate', 10) where user_id = 'a1000000-0000-4000-8000-000000000004'),
  'Super Admin can search minimal user directory'
);

insert into public.dioceses (id, name, slug, description, status, created_by)
values ('a3000000-0000-4000-8000-000000000003', 'Slice Two Diocese Z', 'slice-two-diocese-z', 'created through RLS', 'active', auth.uid());

select pg_temp.assert_true(
  exists (
    select 1
    from public.dioceses
    where id = 'a3000000-0000-4000-8000-000000000003'
      and created_by = 'a1000000-0000-4000-8000-000000000001'
  ),
  'Super Admin can create Diocese records through RLS'
);

update public.dioceses
set description = 'updated through RLS'
where id = 'a3000000-0000-4000-8000-000000000003';

select pg_temp.assert_true(
  exists (
    select 1
    from public.dioceses
    where id = 'a3000000-0000-4000-8000-000000000003'
      and description = 'updated through RLS'
  ),
  'Super Admin can update Diocese records through RLS'
);

insert into public.diocese_churches (id, diocese_id, church_id, status, added_by)
values ('a4000000-0000-4000-8000-000000000001', 'a3000000-0000-4000-8000-000000000001', 'a2000000-0000-4000-8000-000000000001', 'active', auth.uid());

select pg_temp.assert_true(
  exists (
    select 1
    from public.diocese_churches
    where id = 'a4000000-0000-4000-8000-000000000001'
      and status = 'active'
  ),
  'Super Admin can assign parish to Diocese'
);

do $$
begin
  insert into public.diocese_churches (id, diocese_id, church_id, status, added_by)
  values ('a4000000-0000-4000-8000-000000000002', 'a3000000-0000-4000-8000-000000000002', 'a2000000-0000-4000-8000-000000000001', 'active', auth.uid());
  raise exception 'FAIL: one-active-Diocese-per-church uniqueness is enforced';
exception
  when unique_violation then
    raise notice 'PASS: one-active-Diocese-per-church uniqueness is enforced';
end $$;

update public.diocese_churches
set status = 'ended', ended_at = now()
where id = 'a4000000-0000-4000-8000-000000000001';

select pg_temp.assert_true(
  exists (
    select 1
    from public.diocese_churches
    where id = 'a4000000-0000-4000-8000-000000000001'
      and status = 'ended'
      and ended_at is not null
  ),
  'Super Admin can deactivate parish assignment without deleting history'
);

select pg_temp.assert_false(
  exists (
    select 1
    from public.diocese_churches
    where church_id = 'a2000000-0000-4000-8000-000000000002'
      and status = 'active'
  ),
  'Independent parish remains unassigned by Diocese operations'
);

insert into public.diocese_staff (id, diocese_id, user_id, role, status)
values ('a5000000-0000-4000-8000-000000000002', 'a3000000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000000004', 'diocese_secretary', 'active');

select pg_temp.assert_check_violation(
  'insert into public.diocese_staff (id, diocese_id, user_id, role, status) values (''a5000000-0000-4000-8000-000000000003'', ''a3000000-0000-4000-8000-000000000001'', ''a1000000-0000-4000-8000-000000000003'', ''church_admin'', ''active'')',
  'Database rejects church roles in Diocese staff'
);

select pg_temp.assert_false(
  exists (
    select 1
    from public.user_roles
    where user_id = 'a1000000-0000-4000-8000-000000000004'
  ),
  'Adding Diocese staff does not create church roles'
);

select pg_temp.assert_false(
  exists (
    select 1
    from public.members
    where user_id = 'a1000000-0000-4000-8000-000000000004'
  ),
  'Adding Diocese staff does not create member records'
);

update public.diocese_staff
set role = 'diocese_finance'
where id = 'a5000000-0000-4000-8000-000000000002';

select pg_temp.assert_true(
  exists (
    select 1
    from public.diocese_staff
    where id = 'a5000000-0000-4000-8000-000000000002'
      and role = 'diocese_finance'
  ),
  'Super Admin can change supported Diocese staff role'
);

update public.diocese_staff
set status = 'revoked'
where id = 'a5000000-0000-4000-8000-000000000002';

select pg_temp.assert_true(
  exists (
    select 1
    from public.diocese_staff
    where id = 'a5000000-0000-4000-8000-000000000002'
      and status = 'revoked'
  ),
  'Super Admin can deactivate Diocese staff'
);

rollback;

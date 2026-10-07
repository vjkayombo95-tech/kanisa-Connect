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

insert into auth.users (id, email, aud, role, created_at, updated_at) values
  ('91000000-0000-4000-8000-000000000001', 'diocese-x-admin@test.invalid', 'authenticated', 'authenticated', now(), now()),
  ('91000000-0000-4000-8000-000000000002', 'diocese-y-admin@test.invalid', 'authenticated', 'authenticated', now(), now()),
  ('91000000-0000-4000-8000-000000000003', 'church-a-admin@test.invalid', 'authenticated', 'authenticated', now(), now()),
  ('91000000-0000-4000-8000-000000000004', 'dual-diocese-church-admin@test.invalid', 'authenticated', 'authenticated', now(), now()),
  ('91000000-0000-4000-8000-000000000005', 'normal-member@test.invalid', 'authenticated', 'authenticated', now(), now()),
  ('91000000-0000-4000-8000-000000000006', 'independent-church-admin@test.invalid', 'authenticated', 'authenticated', now(), now()),
  ('91000000-0000-4000-8000-000000000007', 'diocese-super-admin@test.invalid', 'authenticated', 'authenticated', now(), now()),
  ('91000000-0000-4000-8000-000000000008', 'ordinary-unrelated@test.invalid', 'authenticated', 'authenticated', now(), now()),
  ('91000000-0000-4000-8000-000000000009', 'diocese-secretary@test.invalid', 'authenticated', 'authenticated', now(), now());

insert into public.super_admins (id)
values ('91000000-0000-4000-8000-000000000007');

insert into public.churches (id, name, slug, created_by) values
  ('92000000-0000-4000-8000-000000000001', 'Diocese Security Church A', 'diocese-security-church-a', '91000000-0000-4000-8000-000000000003'),
  ('92000000-0000-4000-8000-000000000002', 'Diocese Security Church B', 'diocese-security-church-b', '91000000-0000-4000-8000-000000000006'),
  ('92000000-0000-4000-8000-000000000003', 'Independent Security Church C', 'independent-security-church-c', '91000000-0000-4000-8000-000000000006');

insert into public.dioceses (id, name, slug, status, created_by) values
  ('93000000-0000-4000-8000-000000000001', 'Diocese X', 'diocese-x', 'active', '91000000-0000-4000-8000-000000000007'),
  ('93000000-0000-4000-8000-000000000002', 'Diocese Y', 'diocese-y', 'active', '91000000-0000-4000-8000-000000000007');

insert into public.diocese_churches (id, diocese_id, church_id, status, added_by) values
  ('94000000-0000-4000-8000-000000000001', '93000000-0000-4000-8000-000000000001', '92000000-0000-4000-8000-000000000001', 'active', '91000000-0000-4000-8000-000000000007'),
  ('94000000-0000-4000-8000-000000000002', '93000000-0000-4000-8000-000000000002', '92000000-0000-4000-8000-000000000002', 'active', '91000000-0000-4000-8000-000000000007');

insert into public.diocese_staff (id, diocese_id, user_id, role, status) values
  ('95000000-0000-4000-8000-000000000001', '93000000-0000-4000-8000-000000000001', '91000000-0000-4000-8000-000000000001', 'diocese_admin', 'active'),
  ('95000000-0000-4000-8000-000000000002', '93000000-0000-4000-8000-000000000002', '91000000-0000-4000-8000-000000000002', 'diocese_admin', 'active'),
  ('95000000-0000-4000-8000-000000000003', '93000000-0000-4000-8000-000000000001', '91000000-0000-4000-8000-000000000004', 'diocese_admin', 'active'),
  ('95000000-0000-4000-8000-000000000005', '93000000-0000-4000-8000-000000000001', '91000000-0000-4000-8000-000000000009', 'diocese_secretary', 'active');

insert into public.members (id, church_id, user_id, full_name, email, status) values
  ('96000000-0000-4000-8000-000000000001', '92000000-0000-4000-8000-000000000001', '91000000-0000-4000-8000-000000000003', 'Church A Admin', 'church-a-admin@test.invalid', 'active'),
  ('96000000-0000-4000-8000-000000000002', '92000000-0000-4000-8000-000000000001', '91000000-0000-4000-8000-000000000004', 'Dual Admin', 'dual-diocese-church-admin@test.invalid', 'active'),
  ('96000000-0000-4000-8000-000000000003', '92000000-0000-4000-8000-000000000001', '91000000-0000-4000-8000-000000000005', 'Normal Member', 'normal-member@test.invalid', 'active'),
  ('96000000-0000-4000-8000-000000000004', '92000000-0000-4000-8000-000000000003', '91000000-0000-4000-8000-000000000006', 'Independent Admin', 'independent-church-admin@test.invalid', 'active');

insert into public.user_roles (user_id, church_id, role) values
  ('91000000-0000-4000-8000-000000000003', '92000000-0000-4000-8000-000000000001', 'church_admin'),
  ('91000000-0000-4000-8000-000000000004', '92000000-0000-4000-8000-000000000001', 'church_admin'),
  ('91000000-0000-4000-8000-000000000005', '92000000-0000-4000-8000-000000000001', 'member'),
  ('91000000-0000-4000-8000-000000000006', '92000000-0000-4000-8000-000000000003', 'church_admin');

insert into public.announcements (id, church_id, title, content, is_published, created_by) values
  ('97000000-0000-4000-8000-000000000001', '92000000-0000-4000-8000-000000000001', 'Church A Admin Announcement', 'Staff-only draft', false, '91000000-0000-4000-8000-000000000003');

insert into public.events (id, church_id, title, description, created_by) values
  ('98000000-0000-4000-8000-000000000001', '92000000-0000-4000-8000-000000000001', 'Church A Admin Event', 'Staff-only event', '91000000-0000-4000-8000-000000000003');

insert into public.contributions (id, church_id, member_id, amount, donor_name, created_by) values
  ('99000000-0000-4000-8000-000000000001', '92000000-0000-4000-8000-000000000001', '96000000-0000-4000-8000-000000000001', 100, 'Church A Donor', '91000000-0000-4000-8000-000000000003');

-- Scenario A: Diocese X admin can access permitted Diocese X records.
set local role authenticated;
select set_config('request.jwt.claim.sub', '91000000-0000-4000-8000-000000000001', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.email', 'diocese-x-admin@test.invalid', true);
select set_config('request.jwt.claims', '{"email":"diocese-x-admin@test.invalid"}', true);

select pg_temp.assert_true(
  exists (select 1 from public.dioceses where id = '93000000-0000-4000-8000-000000000001'),
  'Scenario A: Diocese X admin can read Diocese X'
);
select pg_temp.assert_true(
  exists (select 1 from public.diocese_churches where diocese_id = '93000000-0000-4000-8000-000000000001'),
  'Scenario A: Diocese X admin can read Diocese X church relationship'
);
select pg_temp.assert_true(
  public.current_user_can_manage_diocese('93000000-0000-4000-8000-000000000001'),
  'Scenario A: Diocese X admin can manage Diocese X'
);

-- Scenario B: Diocese X admin cannot access Diocese Y.
select pg_temp.assert_false(
  exists (select 1 from public.dioceses where id = '93000000-0000-4000-8000-000000000002'),
  'Scenario B: Diocese X admin cannot read Diocese Y'
);
select pg_temp.assert_false(
  public.current_user_can_view_diocese('93000000-0000-4000-8000-000000000002'),
  'Scenario B: Diocese X admin helper denies Diocese Y'
);

select pg_temp.assert_permission_denied(
  'select public.is_diocese_staff(''91000000-0000-4000-8000-000000000002'', ''93000000-0000-4000-8000-000000000002'')',
  'authenticated users cannot directly execute arbitrary Diocese staff helper'
);

-- Scenario C: Diocese X admin is not Church A admin and cannot access protected Church A data.
select pg_temp.assert_false(
  exists (select 1 from public.members where church_id = '92000000-0000-4000-8000-000000000001'),
  'Scenario C: Diocese X admin cannot read Church A members'
);
select pg_temp.assert_false(
  exists (select 1 from public.contributions where church_id = '92000000-0000-4000-8000-000000000001'),
  'Scenario C: Diocese X admin cannot read Church A contributions'
);
select pg_temp.assert_false(
  exists (select 1 from public.announcements where id = '97000000-0000-4000-8000-000000000001'),
  'Scenario C: Diocese X admin cannot read Church A administrative announcements'
);
select pg_temp.assert_false(
  exists (select 1 from public.events where id = '98000000-0000-4000-8000-000000000001'),
  'Scenario C: Diocese X admin cannot read Church A administrative events'
);
select pg_temp.assert_false(
  exists (select 1 from public.churches where id = '92000000-0000-4000-8000-000000000001'),
  'Scenario C: Diocese X admin cannot read Church A settings/church row'
);
select pg_temp.assert_false(
  exists (select 1 from public.user_roles where church_id = '92000000-0000-4000-8000-000000000001'),
  'Scenario C: Diocese X admin cannot read Church A user roles'
);

-- Scenario D: Diocese X admin cannot use existing church authorization helpers.
select pg_temp.assert_false(public.is_church_admin('91000000-0000-4000-8000-000000000001', '92000000-0000-4000-8000-000000000001'), 'Scenario D: is_church_admin remains false');
select pg_temp.assert_false(public.is_church_member('91000000-0000-4000-8000-000000000001', '92000000-0000-4000-8000-000000000001'), 'Scenario D: is_church_member remains false');
select pg_temp.assert_false(public.can_view_church_workspace('91000000-0000-4000-8000-000000000001', '92000000-0000-4000-8000-000000000001'), 'Scenario D: can_view_church_workspace remains false');
select pg_temp.assert_false(public.can_manage_church_workspace('91000000-0000-4000-8000-000000000001', '92000000-0000-4000-8000-000000000001'), 'Scenario D: can_manage_church_workspace remains false');
select pg_temp.assert_false(public.can_manage_church_roles('91000000-0000-4000-8000-000000000001', '92000000-0000-4000-8000-000000000001'), 'Scenario D: can_manage_church_roles remains false');
select pg_temp.assert_false(public.has_church_feature_permission('91000000-0000-4000-8000-000000000001', '92000000-0000-4000-8000-000000000001', 'events', 'manage'), 'Scenario D: feature permission remains false');

-- Scenario E: dual Diocese X admin and Church A admin receives Church A authority only through Church A role.
select set_config('request.jwt.claim.sub', '91000000-0000-4000-8000-000000000004', true);
select set_config('request.jwt.claim.email', 'dual-diocese-church-admin@test.invalid', true);
select set_config('request.jwt.claims', '{"email":"dual-diocese-church-admin@test.invalid"}', true);

select pg_temp.assert_true(public.current_user_can_manage_diocese('93000000-0000-4000-8000-000000000001'), 'Scenario E: dual admin has Diocese X authority');
select pg_temp.assert_true(public.is_church_admin('91000000-0000-4000-8000-000000000004', '92000000-0000-4000-8000-000000000001'), 'Scenario E: dual admin has Church A role authority');

reset role;
delete from public.user_roles
where user_id = '91000000-0000-4000-8000-000000000004'
  and church_id = '92000000-0000-4000-8000-000000000001';

set local role authenticated;
select set_config('request.jwt.claim.sub', '91000000-0000-4000-8000-000000000004', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.email', 'dual-diocese-church-admin@test.invalid', true);
select set_config('request.jwt.claims', '{"email":"dual-diocese-church-admin@test.invalid"}', true);

select pg_temp.assert_true(public.current_user_can_manage_diocese('93000000-0000-4000-8000-000000000001'), 'Scenario E: Diocese authority remains after Church A role removal');
select pg_temp.assert_false(public.is_church_admin('91000000-0000-4000-8000-000000000004', '92000000-0000-4000-8000-000000000001'), 'Scenario E: Church A admin authority disappears with Church A role');
select pg_temp.assert_false(public.can_manage_church_workspace('91000000-0000-4000-8000-000000000004', '92000000-0000-4000-8000-000000000001'), 'Scenario E: Diocese role alone does not manage Church A workspace');

-- Scenario F: independent Church C remains unchanged.
select set_config('request.jwt.claim.sub', '91000000-0000-4000-8000-000000000006', true);
select set_config('request.jwt.claim.email', 'independent-church-admin@test.invalid', true);
select set_config('request.jwt.claims', '{"email":"independent-church-admin@test.invalid"}', true);

select pg_temp.assert_true(public.can_manage_church_workspace('91000000-0000-4000-8000-000000000006', '92000000-0000-4000-8000-000000000003'), 'Scenario F: independent Church C admin still manages Church C');
select pg_temp.assert_false(public.current_user_can_view_diocese('93000000-0000-4000-8000-000000000001'), 'Scenario F: independent Church C admin has no Diocese access');

-- Scenario G: normal Church A member cannot access Diocese administration because Church A belongs to Diocese X.
select set_config('request.jwt.claim.sub', '91000000-0000-4000-8000-000000000005', true);
select set_config('request.jwt.claim.email', 'normal-member@test.invalid', true);
select set_config('request.jwt.claims', '{"email":"normal-member@test.invalid"}', true);

select pg_temp.assert_false(
  exists (select 1 from public.dioceses where id = '93000000-0000-4000-8000-000000000001'),
  'Scenario G: normal Church A member cannot read Diocese X'
);
select pg_temp.assert_false(
  public.current_user_can_view_diocese('93000000-0000-4000-8000-000000000001'),
  'Scenario G: normal Church A member helper denies Diocese X'
);

-- Non-manager Diocese staff can read their own Diocese but cannot mutate
-- Diocese records, relationships, staff, or gain church authority.
select set_config('request.jwt.claim.sub', '91000000-0000-4000-8000-000000000009', true);
select set_config('request.jwt.claim.email', 'diocese-secretary@test.invalid', true);
select set_config('request.jwt.claims', '{"email":"diocese-secretary@test.invalid"}', true);

select pg_temp.assert_true(
  exists (select 1 from public.dioceses where id = '93000000-0000-4000-8000-000000000001'),
  'diocese_secretary can read own Diocese'
);
select pg_temp.assert_false(
  exists (select 1 from public.dioceses where id = '93000000-0000-4000-8000-000000000002'),
  'diocese_secretary cannot read another Diocese'
);
select pg_temp.assert_false(
  public.current_user_can_manage_diocese('93000000-0000-4000-8000-000000000001'),
  'diocese_secretary is not a Diocese manager'
);

do $$
begin
  insert into public.dioceses (id, name, slug, status, created_by)
  values ('93000000-0000-4000-8000-000000000004', 'Forbidden Diocese', 'forbidden-diocese', 'active', auth.uid());
  raise exception 'FAIL: diocese_secretary cannot insert dioceses';
exception
  when insufficient_privilege then
    raise notice 'PASS: diocese_secretary cannot insert dioceses';
end $$;

update public.dioceses
set description = 'Forbidden secretary update'
where id = '93000000-0000-4000-8000-000000000001';
select pg_temp.assert_false(
  exists (
    select 1 from public.dioceses
    where id = '93000000-0000-4000-8000-000000000001'
      and description = 'Forbidden secretary update'
  ),
  'diocese_secretary cannot update dioceses'
);

delete from public.dioceses
where id = '93000000-0000-4000-8000-000000000001';
select pg_temp.assert_true(
  exists (select 1 from public.dioceses where id = '93000000-0000-4000-8000-000000000001'),
  'diocese_secretary cannot delete dioceses'
);

do $$
begin
  insert into public.diocese_churches (id, diocese_id, church_id, status, added_by)
  values ('94000000-0000-4000-8000-000000000003', '93000000-0000-4000-8000-000000000001', '92000000-0000-4000-8000-000000000003', 'active', auth.uid());
  raise exception 'FAIL: diocese_secretary cannot insert Diocese church links';
exception
  when insufficient_privilege then
    raise notice 'PASS: diocese_secretary cannot insert Diocese church links';
end $$;

update public.diocese_churches
set status = 'inactive', ended_at = now()
where id = '94000000-0000-4000-8000-000000000001';
select pg_temp.assert_true(
  exists (
    select 1 from public.diocese_churches
    where id = '94000000-0000-4000-8000-000000000001'
      and status = 'active'
      and ended_at is null
  ),
  'diocese_secretary cannot update Diocese church links'
);

delete from public.diocese_churches
where id = '94000000-0000-4000-8000-000000000001';
select pg_temp.assert_true(
  exists (select 1 from public.diocese_churches where id = '94000000-0000-4000-8000-000000000001'),
  'diocese_secretary cannot delete Diocese church links'
);

do $$
begin
  insert into public.diocese_staff (id, diocese_id, user_id, role, status)
  values ('95000000-0000-4000-8000-000000000006', '93000000-0000-4000-8000-000000000001', '91000000-0000-4000-8000-000000000008', 'diocese_staff', 'active');
  raise exception 'FAIL: diocese_secretary cannot insert Diocese staff';
exception
  when insufficient_privilege then
    raise notice 'PASS: diocese_secretary cannot insert Diocese staff';
end $$;

update public.diocese_staff
set role = 'bishop'
where id = '95000000-0000-4000-8000-000000000005';
select pg_temp.assert_true(
  exists (
    select 1 from public.diocese_staff
    where id = '95000000-0000-4000-8000-000000000005'
      and role = 'diocese_secretary'
  ),
  'diocese_secretary cannot update Diocese staff'
);

delete from public.diocese_staff
where id = '95000000-0000-4000-8000-000000000005';
select pg_temp.assert_true(
  exists (select 1 from public.diocese_staff where id = '95000000-0000-4000-8000-000000000005'),
  'diocese_secretary cannot delete Diocese staff'
);

select pg_temp.assert_false(public.is_church_admin('91000000-0000-4000-8000-000000000009', '92000000-0000-4000-8000-000000000001'), 'diocese_secretary is not Church Admin');
select pg_temp.assert_false(public.can_view_church_workspace('91000000-0000-4000-8000-000000000009', '92000000-0000-4000-8000-000000000001'), 'diocese_secretary cannot view Church A workspace');
select pg_temp.assert_false(public.can_manage_church_workspace('91000000-0000-4000-8000-000000000009', '92000000-0000-4000-8000-000000000001'), 'diocese_secretary cannot manage Church A workspace');

-- Scenario H: Super Admin can perform intended Diocese management operations.
select set_config('request.jwt.claim.sub', '91000000-0000-4000-8000-000000000007', true);
select set_config('request.jwt.claim.email', 'diocese-super-admin@test.invalid', true);
select set_config('request.jwt.claims', '{"email":"diocese-super-admin@test.invalid"}', true);

select pg_temp.assert_true(public.current_user_can_manage_diocese('93000000-0000-4000-8000-000000000001'), 'Scenario H: Super Admin can manage Diocese X');

insert into public.dioceses (id, name, slug, status, created_by)
values ('93000000-0000-4000-8000-000000000003', 'Diocese Super Admin Managed', 'diocese-super-admin-managed', 'active', '91000000-0000-4000-8000-000000000007');

update public.dioceses
set description = 'Updated by Super Admin'
where id = '93000000-0000-4000-8000-000000000003';

insert into public.diocese_staff (id, diocese_id, user_id, role, status)
values ('95000000-0000-4000-8000-000000000004', '93000000-0000-4000-8000-000000000003', '91000000-0000-4000-8000-000000000001', 'bishop', 'active');

select pg_temp.assert_true(
  exists (
    select 1
    from public.dioceses
    where id = '93000000-0000-4000-8000-000000000003'
      and description = 'Updated by Super Admin'
  ),
  'Scenario H: Super Admin inserted and updated Diocese'
);
select pg_temp.assert_true(
  exists (
    select 1
    from public.diocese_staff
    where id = '95000000-0000-4000-8000-000000000004'
  ),
  'Scenario H: Super Admin inserted Diocese staff'
);

-- Ordinary unrelated user cannot access Diocese administrative data.
select set_config('request.jwt.claim.sub', '91000000-0000-4000-8000-000000000008', true);
select set_config('request.jwt.claim.email', 'ordinary-unrelated@test.invalid', true);
select set_config('request.jwt.claims', '{"email":"ordinary-unrelated@test.invalid"}', true);

select pg_temp.assert_false(exists (select 1 from public.dioceses), 'ordinary unrelated user cannot read dioceses');
select pg_temp.assert_false(exists (select 1 from public.diocese_churches), 'ordinary unrelated user cannot read Diocese church links');
select pg_temp.assert_false(exists (select 1 from public.diocese_staff), 'ordinary unrelated user cannot read Diocese staff');

reset role;

select pg_temp.assert_true(
  exists (
    select 1
    from pg_class i
    join pg_namespace n on n.oid = i.relnamespace
    join pg_index ix on ix.indexrelid = i.oid
    where n.nspname = 'public'
      and i.relname = 'diocese_churches_one_active_diocese_per_church_idx'
      and pg_get_indexdef(i.oid) like '%diocese_churches%'
      and pg_get_expr(ix.indpred, 'public.diocese_churches'::regclass) = '(status = ''active''::text)'
  ),
  'active Diocese assignment uniqueness index exists'
);

select pg_temp.assert_true(
  not exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in (
        'can_manage_church_workspace',
        'can_view_church_workspace',
        'can_manage_church_roles',
        'is_church_admin',
        'is_church_member',
        'has_church_feature_permission'
      )
      and pg_get_functiondef(p.oid) ~ 'diocese'
  ),
  'existing church helpers do not reference Diocese tables or helpers'
);

rollback;

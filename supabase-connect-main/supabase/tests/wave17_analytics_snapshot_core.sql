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

create or replace function pg_temp.assert_raises(_sql text, _label text)
returns void language plpgsql as $$
begin
  begin
    execute _sql;
  exception
    when others then
      raise notice 'PASS: % [%]', _label, sqlstate;
      return;
  end;

  raise exception 'FAIL: %', _label;
end;
$$;

insert into auth.users (id, email, aud, role, created_at, updated_at) values
  ('97000000-0000-4000-8000-000000000001', 'wave17-admin@test.invalid', 'authenticated', 'authenticated', now(), now()),
  ('97000000-0000-4000-8000-000000000002', 'wave17-pastor@test.invalid', 'authenticated', 'authenticated', now(), now()),
  ('97000000-0000-4000-8000-000000000003', 'wave17-platform-admin@test.invalid', 'authenticated', 'authenticated', now(), now()),
  ('97000000-0000-4000-8000-000000000004', 'wave17-member@test.invalid', 'authenticated', 'authenticated', now(), now()),
  ('97000000-0000-4000-8000-000000000005', 'wave17-foreign-admin@test.invalid', 'authenticated', 'authenticated', now(), now());

insert into public.churches (id, name, slug, church_code, owner_id, created_by) values
  ('97000000-0000-4000-8000-000000000101', 'Wave 17 Analytics Parish A', 'wave17-analytics-a', 'KC-W17-AAA-001', '97000000-0000-4000-8000-000000000001', '97000000-0000-4000-8000-000000000001'),
  ('97000000-0000-4000-8000-000000000102', 'Wave 17 Analytics Parish B', 'wave17-analytics-b', 'KC-W17-BBB-001', '97000000-0000-4000-8000-000000000005', '97000000-0000-4000-8000-000000000005');

insert into public.user_roles (user_id, church_id, role) values
  ('97000000-0000-4000-8000-000000000001', '97000000-0000-4000-8000-000000000101', 'church_admin'),
  ('97000000-0000-4000-8000-000000000002', '97000000-0000-4000-8000-000000000101', 'pastor'),
  ('97000000-0000-4000-8000-000000000003', '97000000-0000-4000-8000-000000000101', 'admin'),
  ('97000000-0000-4000-8000-000000000004', '97000000-0000-4000-8000-000000000101', 'member'),
  ('97000000-0000-4000-8000-000000000005', '97000000-0000-4000-8000-000000000102', 'church_admin');

create temporary table wave17_generated_snapshots (
  role_name text primary key,
  user_id uuid not null,
  snapshot_id uuid not null,
  generated_by uuid
) on commit drop;

grant select, insert, update on wave17_generated_snapshots to authenticated;

select pg_temp.assert_true(
  not has_function_privilege('public', 'public.generate_church_analytics_snapshot_internal(uuid, uuid)', 'execute'),
  'internal generator is not executable by PUBLIC'
);

select pg_temp.assert_true(
  not has_function_privilege('anon', 'public.generate_church_analytics_snapshot_internal(uuid, uuid)', 'execute'),
  'internal generator is not executable by anon'
);

select pg_temp.assert_true(
  not has_function_privilege('authenticated', 'public.generate_church_analytics_snapshot_internal(uuid, uuid)', 'execute'),
  'internal generator is not executable by authenticated'
);

select pg_temp.assert_true(
  has_function_privilege('authenticated', 'public.generate_church_analytics_snapshot(uuid)', 'execute'),
  'manual generator remains executable by authenticated'
);

set local role anon;
select set_config('request.jwt.claim.sub', '', true);
select pg_temp.assert_raises(
  'select * from public.generate_church_analytics_snapshot(''97000000-0000-4000-8000-000000000101''::uuid)',
  'anon cannot execute manual analytics snapshot RPC'
);
select pg_temp.assert_true(
  not exists (
    select 1
    from public.analytics_snapshots
    where church_id = '97000000-0000-4000-8000-000000000101'
  ),
  'anon denial does not create a snapshot'
);
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub', '97000000-0000-4000-8000-000000000001', true);
select pg_temp.assert_raises(
  'select * from public.generate_church_analytics_snapshot_internal(''97000000-0000-4000-8000-000000000101''::uuid, ''97000000-0000-4000-8000-000000000001''::uuid)',
  'authenticated cannot call internal generator directly'
);
select set_config('request.jwt.claim.sub', '', true);
select pg_temp.assert_raises(
  'select * from public.generate_church_analytics_snapshot(''97000000-0000-4000-8000-000000000101''::uuid)',
  'authenticated request without auth.uid() cannot generate snapshots'
);
select set_config('request.jwt.claim.sub', '97000000-0000-4000-8000-000000000004', true);
select pg_temp.assert_raises(
  'select * from public.generate_church_analytics_snapshot(''97000000-0000-4000-8000-000000000101''::uuid)',
  'same-church member role cannot generate snapshots'
);
select set_config('request.jwt.claim.sub', '97000000-0000-4000-8000-000000000001', true);
select pg_temp.assert_raises(
  'select * from public.generate_church_analytics_snapshot(''97000000-0000-4000-8000-000000000102''::uuid)',
  'church admin cannot generate cross-church snapshots'
);

insert into wave17_generated_snapshots (role_name, user_id, snapshot_id, generated_by)
select 'church_admin', '97000000-0000-4000-8000-000000000001'::uuid, id, generated_by
from public.generate_church_analytics_snapshot('97000000-0000-4000-8000-000000000101'::uuid);
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub', '97000000-0000-4000-8000-000000000002', true);
insert into wave17_generated_snapshots (role_name, user_id, snapshot_id, generated_by)
select 'pastor', '97000000-0000-4000-8000-000000000002'::uuid, id, generated_by
from public.generate_church_analytics_snapshot('97000000-0000-4000-8000-000000000101'::uuid);
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub', '97000000-0000-4000-8000-000000000003', true);
insert into wave17_generated_snapshots (role_name, user_id, snapshot_id, generated_by)
select 'admin', '97000000-0000-4000-8000-000000000003'::uuid, id, generated_by
from public.generate_church_analytics_snapshot('97000000-0000-4000-8000-000000000101'::uuid);
reset role;

select pg_temp.assert_true(
  (
    select count(*) = 3
    from wave17_generated_snapshots
  ),
  'church_admin, pastor, and admin each generate a snapshot'
);

select pg_temp.assert_true(
  (
    select bool_and(generated_by = user_id)
    from wave17_generated_snapshots
  ),
  'manual generator records generated_by as auth.uid()'
);

select pg_temp.assert_true(
  (
    select count(distinct snapshot_id) = 3
    from wave17_generated_snapshots
  ) and (
    select count(*) = 3
    from public.analytics_snapshots a
    join wave17_generated_snapshots g on g.snapshot_id = a.id
    where a.church_id = '97000000-0000-4000-8000-000000000101'
  ),
  'manual generator appends distinct analytics snapshot rows'
);

update public.analytics_snapshots a
set generated_at = case g.role_name
  when 'church_admin' then timestamptz '2026-09-15 10:00:00+00'
  when 'pastor' then timestamptz '2026-09-15 10:01:00+00'
  when 'admin' then timestamptz '2026-09-15 10:02:00+00'
end
from wave17_generated_snapshots g
where a.id = g.snapshot_id;

select pg_temp.assert_true(
  (
    select a.id
    from public.analytics_snapshots a
    where a.church_id = '97000000-0000-4000-8000-000000000101'
    order by a.generated_at desc
    limit 1
  ) = (
    select snapshot_id
    from wave17_generated_snapshots
    where role_name = 'admin'
  ),
  'latest snapshot is selected by newest generated_at for the church'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '97000000-0000-4000-8000-000000000001', true);
select pg_temp.assert_raises(
  'select * from public.generate_church_analytics_snapshot(''97000000-0000-4000-8000-000000000101''::uuid)',
  'fourth same-church generation within one hour is rate limited'
);
reset role;

select pg_temp.assert_true(
  (
    select count(*) = 3
    from public.analytics_snapshots
    where church_id = '97000000-0000-4000-8000-000000000101'
  ),
  'rate-limited attempt does not append another snapshot'
);

rollback;

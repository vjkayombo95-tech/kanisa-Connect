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
  ('98000000-0000-4000-8000-000000000001', 'wave17-service-admin@test.invalid', 'authenticated', 'authenticated', now(), now());

insert into public.churches (id, name, slug, church_code, owner_id, created_by, status) values
  ('ffff0000-0000-4000-8000-000000000101', 'Wave 17 Service Active Single', 'wave17-service-active-single', 'KC-W17-SVA-001', '98000000-0000-4000-8000-000000000001', '98000000-0000-4000-8000-000000000001', 'active'),
  ('ffff0000-0000-4000-8000-000000000102', 'Wave 17 Service Pending', 'wave17-service-pending', 'KC-W17-SVP-001', '98000000-0000-4000-8000-000000000001', '98000000-0000-4000-8000-000000000001', 'pending'),
  ('ffff0000-0000-4000-8000-000000000103', 'Wave 17 Service Inactive', 'wave17-service-inactive', 'KC-W17-SVI-001', '98000000-0000-4000-8000-000000000001', '98000000-0000-4000-8000-000000000001', 'inactive'),
  ('ffff0000-0000-4000-8000-000000000104', 'Wave 17 Service Suspended', 'wave17-service-suspended', 'KC-W17-SVS-001', '98000000-0000-4000-8000-000000000001', '98000000-0000-4000-8000-000000000001', 'suspended'),
  ('ffff0000-0000-4000-8000-000000000201', 'Wave 17 Batch Active First', 'wave17-batch-active-first', 'KC-W17-BAF-001', '98000000-0000-4000-8000-000000000001', '98000000-0000-4000-8000-000000000001', 'active'),
  ('ffff0000-0000-4000-8000-000000000202', 'Wave 17 Batch Active Fails', 'wave17-batch-active-fails', 'KC-W17-BAD-001', '98000000-0000-4000-8000-000000000001', '98000000-0000-4000-8000-000000000001', 'active'),
  ('ffff0000-0000-4000-8000-000000000203', 'Wave 17 Batch Active Later', 'wave17-batch-active-later', 'KC-W17-BAL-001', '98000000-0000-4000-8000-000000000001', '98000000-0000-4000-8000-000000000001', 'active'),
  ('ffff0000-0000-4000-8000-000000000204', 'Wave 17 Batch Pending', 'wave17-batch-pending', 'KC-W17-BPN-001', '98000000-0000-4000-8000-000000000001', '98000000-0000-4000-8000-000000000001', 'pending'),
  ('ffff0000-0000-4000-8000-000000000205', 'Wave 17 Batch Inactive', 'wave17-batch-inactive', 'KC-W17-BIN-001', '98000000-0000-4000-8000-000000000001', '98000000-0000-4000-8000-000000000001', 'inactive'),
  ('ffff0000-0000-4000-8000-000000000206', 'Wave 17 Batch Suspended', 'wave17-batch-suspended', 'KC-W17-BSU-001', '98000000-0000-4000-8000-000000000001', '98000000-0000-4000-8000-000000000001', 'suspended'),
  ('ffff0000-0000-4000-8000-000000000151', 'Wave 17 Bound Active One', 'wave17-bound-active-one', 'KC-W17-BAO-001', '98000000-0000-4000-8000-000000000001', '98000000-0000-4000-8000-000000000001', 'active'),
  ('ffff0000-0000-4000-8000-000000000152', 'Wave 17 Bound Active Two', 'wave17-bound-active-two', 'KC-W17-BAT-001', '98000000-0000-4000-8000-000000000001', '98000000-0000-4000-8000-000000000001', 'active'),
  ('ffff0000-0000-4000-8000-000000000153', 'Wave 17 Bound Active Three', 'wave17-bound-active-three', 'KC-W17-BAH-001', '98000000-0000-4000-8000-000000000001', '98000000-0000-4000-8000-000000000001', 'active');

insert into public.user_roles (user_id, church_id, role) values
  ('98000000-0000-4000-8000-000000000001', 'ffff0000-0000-4000-8000-000000000101', 'church_admin');

create temporary table wave17_service_generated_snapshots (
  label text primary key,
  snapshot_id uuid not null,
  generated_by uuid
) on commit drop;

create temporary table wave17_batch_result (
  label text primary key,
  result jsonb not null
) on commit drop;

create temporary table wave17_traversal (
  church_id uuid not null,
  status text not null
) on commit drop;

grant select, insert, update on wave17_service_generated_snapshots to service_role, authenticated;
grant select, insert, update on wave17_batch_result to service_role;
grant select, insert, update on wave17_traversal to service_role;

select pg_temp.assert_true(
  not has_function_privilege('public', 'public.generate_church_analytics_snapshot_as_service(uuid)', 'execute'),
  'service single-church wrapper is not executable by PUBLIC'
);

select pg_temp.assert_true(
  not has_function_privilege('anon', 'public.generate_church_analytics_snapshot_as_service(uuid)', 'execute'),
  'service single-church wrapper is not executable by anon'
);

select pg_temp.assert_true(
  not has_function_privilege('authenticated', 'public.generate_church_analytics_snapshot_as_service(uuid)', 'execute'),
  'service single-church wrapper is not executable by authenticated'
);

select pg_temp.assert_true(
  has_function_privilege('service_role', 'public.generate_church_analytics_snapshot_as_service(uuid)', 'execute'),
  'service single-church wrapper is executable by service_role'
);

select pg_temp.assert_true(
  not has_function_privilege('service_role', 'public.generate_church_analytics_snapshot_internal(uuid, uuid)', 'execute'),
  'service_role cannot directly execute the internal analytics core'
);

select pg_temp.assert_true(
  not has_function_privilege('public', 'public.run_active_church_analytics_snapshot_generation(uuid, integer)', 'execute'),
  'batch runner is not executable by PUBLIC'
);

select pg_temp.assert_true(
  not has_function_privilege('anon', 'public.run_active_church_analytics_snapshot_generation(uuid, integer)', 'execute'),
  'batch runner is not executable by anon'
);

select pg_temp.assert_true(
  not has_function_privilege('authenticated', 'public.run_active_church_analytics_snapshot_generation(uuid, integer)', 'execute'),
  'batch runner is not executable by authenticated'
);

select pg_temp.assert_true(
  has_function_privilege('service_role', 'public.run_active_church_analytics_snapshot_generation(uuid, integer)', 'execute'),
  'batch runner is executable by service_role'
);

set local role anon;
select set_config('request.jwt.claim.role', 'anon', true);
select pg_temp.assert_raises(
  'select * from public.generate_church_analytics_snapshot_as_service(''ffff0000-0000-4000-8000-000000000101''::uuid)',
  'anon cannot execute service single-church wrapper'
);
select pg_temp.assert_raises(
  'select public.run_active_church_analytics_snapshot_generation(null, 25)',
  'anon cannot execute batch runner'
);
reset role;

set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.sub', '98000000-0000-4000-8000-000000000001', true);
select pg_temp.assert_raises(
  'select * from public.generate_church_analytics_snapshot_as_service(''ffff0000-0000-4000-8000-000000000101''::uuid)',
  'authenticated cannot execute service single-church wrapper'
);
select pg_temp.assert_raises(
  'select public.run_active_church_analytics_snapshot_generation(null, 25)',
  'authenticated cannot execute batch runner'
);
select pg_temp.assert_raises(
  'select * from public.generate_church_analytics_snapshot_internal(''ffff0000-0000-4000-8000-000000000101''::uuid, ''98000000-0000-4000-8000-000000000001''::uuid)',
  'authenticated cannot execute internal analytics core directly'
);
reset role;

set local role service_role;
select set_config('request.jwt.claim.role', 'service_role', true);
select pg_temp.assert_raises(
  'select * from public.generate_church_analytics_snapshot_internal(''ffff0000-0000-4000-8000-000000000101''::uuid, ''98000000-0000-4000-8000-000000000001''::uuid)',
  'service_role direct internal-core execution is denied'
);
select pg_temp.assert_raises(
  'select * from public.generate_church_analytics_snapshot_as_service(''ffff0000-0000-4000-8000-000000000199''::uuid)',
  'service wrapper rejects nonexistent churches'
);
select pg_temp.assert_raises(
  'select * from public.generate_church_analytics_snapshot_as_service(''ffff0000-0000-4000-8000-000000000102''::uuid)',
  'service wrapper rejects pending churches'
);
select pg_temp.assert_raises(
  'select * from public.generate_church_analytics_snapshot_as_service(''ffff0000-0000-4000-8000-000000000103''::uuid)',
  'service wrapper rejects inactive churches'
);
select pg_temp.assert_raises(
  'select * from public.generate_church_analytics_snapshot_as_service(''ffff0000-0000-4000-8000-000000000104''::uuid)',
  'service wrapper rejects suspended churches'
);

insert into wave17_service_generated_snapshots (label, snapshot_id, generated_by)
select 'service-first', id, generated_by
from public.generate_church_analytics_snapshot_as_service('ffff0000-0000-4000-8000-000000000101'::uuid);

insert into wave17_service_generated_snapshots (label, snapshot_id, generated_by)
select 'service-second', id, generated_by
from public.generate_church_analytics_snapshot_as_service('ffff0000-0000-4000-8000-000000000101'::uuid);
reset role;

select pg_temp.assert_true(
  (
    select count(*) = 2
    from wave17_service_generated_snapshots
  ) and (
    select count(distinct snapshot_id) = 2
    from wave17_service_generated_snapshots
  ),
  'repeated service generation appends distinct snapshot rows'
);

select pg_temp.assert_true(
  (
    select bool_and(generated_by is null)
    from wave17_service_generated_snapshots
  ),
  'automated service snapshots record generated_by as null'
);

select pg_temp.assert_true(
  not exists (
    select 1
    from public.rate_limits
    where action = 'analytics_snapshot'
      and scope_key = 'ffff0000-0000-4000-8000-000000000101'
  ),
  'service generation does not consume manual analytics snapshot rate limits'
);

set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.sub', '98000000-0000-4000-8000-000000000001', true);
insert into wave17_service_generated_snapshots (label, snapshot_id, generated_by)
select 'manual-after-service', id, generated_by
from public.generate_church_analytics_snapshot('ffff0000-0000-4000-8000-000000000101'::uuid);
reset role;

select pg_temp.assert_true(
  (
    select generated_by = '98000000-0000-4000-8000-000000000001'::uuid
    from wave17_service_generated_snapshots
    where label = 'manual-after-service'
  ),
  'manual RPC still works after internal privilege hardening and service generations'
);

create or replace function public.wave17_fail_one_analytics_snapshot_insert()
returns trigger
language plpgsql
as $$
begin
  if new.church_id = 'ffff0000-0000-4000-8000-000000000202'::uuid then
    raise exception 'wave17 deterministic analytics insert failure';
  end if;

  return new;
end;
$$;

create trigger wave17_fail_one_analytics_snapshot_insert
before insert on public.analytics_snapshots
for each row
execute function public.wave17_fail_one_analytics_snapshot_insert();

set local role service_role;
select set_config('request.jwt.claim.role', 'service_role', true);

insert into wave17_batch_result (label, result)
select 'default-limit', public.run_active_church_analytics_snapshot_generation(
  'fffeffff-ffff-ffff-ffff-ffffffffffff'::uuid,
  null
);

insert into wave17_batch_result (label, result)
select 'oversized-limit', public.run_active_church_analytics_snapshot_generation(
  'fffeffff-ffff-ffff-ffff-ffffffffffff'::uuid,
  10000
);

insert into wave17_batch_result (label, result)
select 'page-one', public.run_active_church_analytics_snapshot_generation(
  'ffff0000-0000-4000-8000-000000000200'::uuid,
  2
);

insert into wave17_traversal (church_id, status)
select (detail->>'churchId')::uuid, detail->>'status'
from wave17_batch_result,
  lateral jsonb_array_elements(result->'results') detail
where label = 'page-one';

insert into wave17_batch_result (label, result)
select 'page-two', public.run_active_church_analytics_snapshot_generation(
  (select (result->>'next_cursor')::uuid from wave17_batch_result where label = 'page-one'),
  2
);

insert into wave17_traversal (church_id, status)
select (detail->>'churchId')::uuid, detail->>'status'
from wave17_batch_result,
  lateral jsonb_array_elements(result->'results') detail
where label = 'page-two';
reset role;

select pg_temp.assert_true(
  (select (result->>'effective_limit')::integer from wave17_batch_result where label = 'default-limit') = 25,
  'batch default size is bounded to 25'
);

select pg_temp.assert_true(
  (select (result->>'effective_limit')::integer from wave17_batch_result where label = 'oversized-limit') = 100,
  'requested batch size above hard maximum is clamped to 100'
);

select pg_temp.assert_true(
  not exists (
    select 1
    from wave17_batch_result
    where jsonb_array_length(result->'results') > (result->>'effective_limit')::integer
  ),
  'result detail count never exceeds effective batch limit'
);

select pg_temp.assert_true(
  (select result->>'attempted' from wave17_batch_result where label = 'page-one') = '2'
    and (select result->>'failed' from wave17_batch_result where label = 'page-one') = '1'
    and (select result->>'succeeded' from wave17_batch_result where label = 'page-one') = '1',
  'first page reports current-page attempted, succeeded, and failed counts'
);

select pg_temp.assert_true(
  (select result->>'has_more' from wave17_batch_result where label = 'page-one') = 'true'
    and (select result->>'next_cursor' from wave17_batch_result where label = 'page-one') = 'ffff0000-0000-4000-8000-000000000202',
  'first page has_more and next_cursor advance deterministically'
);

select pg_temp.assert_true(
  (select result->>'attempted' from wave17_batch_result where label = 'page-two') = '1'
    and (select result->>'has_more' from wave17_batch_result where label = 'page-two') = 'false'
    and (select result->>'next_cursor' from wave17_batch_result where label = 'page-two') = 'ffff0000-0000-4000-8000-000000000203',
  'second page completes deterministic traversal'
);

select pg_temp.assert_true(
  (
    select array_agg(church_id order by church_id) = array[
      'ffff0000-0000-4000-8000-000000000201'::uuid,
      'ffff0000-0000-4000-8000-000000000202'::uuid,
      'ffff0000-0000-4000-8000-000000000203'::uuid
    ]
    from wave17_traversal
  ),
  'pagination traversal processes expected active churches'
);

select pg_temp.assert_true(
  (
    select count(*) = count(distinct church_id)
    from wave17_traversal
  ),
  'pagination traversal does not duplicate churches'
);

select pg_temp.assert_true(
  exists (
    select 1
    from public.analytics_snapshots
    where church_id = 'ffff0000-0000-4000-8000-000000000201'
  ) and exists (
    select 1
    from public.analytics_snapshots
    where church_id = 'ffff0000-0000-4000-8000-000000000203'
  ),
  'batch keeps successful snapshots before and after an isolated failure'
);

select pg_temp.assert_true(
  exists (
    select 1
    from jsonb_array_elements((select result->'results' from wave17_batch_result where label = 'page-one')) detail
    where detail->>'churchId' = 'ffff0000-0000-4000-8000-000000000202'
      and detail->>'status' = 'failed'
      and detail->>'errorCode' = 'P0001'
      and detail->>'message' = 'generation_failed'
      and detail->>'error' is null
  ),
  'batch reports deterministic failure with sanitized bounded metadata'
);

select pg_temp.assert_true(
  not exists (
    select 1
    from public.analytics_snapshots
    where church_id in (
      'ffff0000-0000-4000-8000-000000000204',
      'ffff0000-0000-4000-8000-000000000205',
      'ffff0000-0000-4000-8000-000000000206'
    )
  ),
  'batch skips pending, inactive, and suspended churches'
);

rollback;

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

create temporary table wave17_lease_claims (
  label text primary key,
  result jsonb not null
) on commit drop;

grant select, insert, update on wave17_lease_claims to service_role;

select pg_temp.assert_true(
  has_function_privilege('service_role', 'public.claim_analytics_automation_run(text, interval)', 'execute')
    and has_function_privilege('service_role', 'public.renew_analytics_automation_run(uuid, uuid, interval)', 'execute')
    and has_function_privilege('service_role', 'public.record_analytics_automation_page(uuid, integer, integer, integer, uuid, jsonb, uuid, interval)', 'execute')
    and has_function_privilege('service_role', 'public.finish_analytics_automation_run(uuid, text, text, text, uuid)', 'execute'),
  'all scheduler lease RPCs are executable by service_role'
);

select pg_temp.assert_true(
  not has_function_privilege('public', 'public.renew_analytics_automation_run(uuid, uuid, interval)', 'execute')
    and not has_function_privilege('anon', 'public.renew_analytics_automation_run(uuid, uuid, interval)', 'execute')
    and not has_function_privilege('authenticated', 'public.renew_analytics_automation_run(uuid, uuid, interval)', 'execute'),
  'renew function is service-role only'
);

select pg_temp.assert_true(
  to_regprocedure('public.record_analytics_automation_page(uuid, integer, integer, integer, uuid, jsonb, interval)') is null
    and to_regprocedure('public.finish_analytics_automation_run(uuid, text, text, text)') is null,
  'old unfenced scheduler mutation signatures are removed'
);

set local role anon;
select set_config('request.jwt.claim.role', 'anon', true);
select pg_temp.assert_raises(
  'select public.renew_analytics_automation_run(''00000000-0000-4000-8000-000000000001''::uuid, ''00000000-0000-4000-8000-000000000002''::uuid, interval ''15 minutes'')',
  'anon cannot renew analytics scheduler lease'
);
reset role;

set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);
select pg_temp.assert_raises(
  'select public.renew_analytics_automation_run(''00000000-0000-4000-8000-000000000001''::uuid, ''00000000-0000-4000-8000-000000000002''::uuid, interval ''15 minutes'')',
  'authenticated cannot renew analytics scheduler lease'
);
reset role;

set local role service_role;
select set_config('request.jwt.claim.role', 'service_role', true);

insert into wave17_lease_claims (label, result)
select 'a', public.claim_analytics_automation_run('scheduler', interval '15 minutes');

insert into wave17_lease_claims (label, result)
select 'overlap', public.claim_analytics_automation_run('scheduler', interval '15 minutes');

select public.renew_analytics_automation_run(
  (select (result->>'run_id')::uuid from wave17_lease_claims where label = 'a'),
  (select (result->>'lease_owner')::uuid from wave17_lease_claims where label = 'a'),
  interval '15 minutes'
);

select pg_temp.assert_raises(
  format(
    'select public.renew_analytics_automation_run(%L::uuid, %L::uuid, interval ''15 minutes'')',
    (select result->>'run_id' from wave17_lease_claims where label = 'a'),
    '00000000-0000-4000-8000-000000000099'
  ),
  'wrong owner cannot renew active scheduler lease'
);

update public.analytics_automation_runs
set lease_expires_at = now() - interval '1 minute'
where id = (select (result->>'run_id')::uuid from wave17_lease_claims where label = 'a');

insert into wave17_lease_claims (label, result)
select 'b', public.claim_analytics_automation_run('scheduler', interval '15 minutes');

select pg_temp.assert_raises(
  format(
    'select public.renew_analytics_automation_run(%L::uuid, %L::uuid, interval ''15 minutes'')',
    (select result->>'run_id' from wave17_lease_claims where label = 'a'),
    (select result->>'lease_owner' from wave17_lease_claims where label = 'a')
  ),
  'previous owner cannot renew after stale lease reclaim'
);

select pg_temp.assert_raises(
  format(
    'select public.record_analytics_automation_page(%L::uuid, 1, 1, 0, null, ''[]''::jsonb, %L::uuid, interval ''15 minutes'')',
    (select result->>'run_id' from wave17_lease_claims where label = 'a'),
    (select result->>'lease_owner' from wave17_lease_claims where label = 'a')
  ),
  'previous owner cannot record page after stale lease reclaim'
);

select pg_temp.assert_raises(
  format(
    'select public.finish_analytics_automation_run(%L::uuid, ''completed'', null, null, %L::uuid)',
    (select result->>'run_id' from wave17_lease_claims where label = 'a'),
    (select result->>'lease_owner' from wave17_lease_claims where label = 'a')
  ),
  'previous owner cannot complete after stale lease reclaim'
);

select pg_temp.assert_raises(
  format(
    'select public.finish_analytics_automation_run(%L::uuid, ''failed'', ''orchestration_failed'', ''stale'', %L::uuid)',
    (select result->>'run_id' from wave17_lease_claims where label = 'a'),
    (select result->>'lease_owner' from wave17_lease_claims where label = 'a')
  ),
  'previous owner cannot fail after stale lease reclaim'
);

select public.record_analytics_automation_page(
  (select (result->>'run_id')::uuid from wave17_lease_claims where label = 'b'),
  1,
  1,
  0,
  'ffff0000-0000-4000-8000-000000000303'::uuid,
  '[]'::jsonb,
  (select (result->>'lease_owner')::uuid from wave17_lease_claims where label = 'b'),
  interval '15 minutes'
);

select public.finish_analytics_automation_run(
  (select (result->>'run_id')::uuid from wave17_lease_claims where label = 'b'),
  'completed',
  null,
  null,
  (select (result->>'lease_owner')::uuid from wave17_lease_claims where label = 'b')
);

insert into wave17_lease_claims (label, result)
select 'c', public.claim_analytics_automation_run('scheduler', interval '15 minutes');

select public.finish_analytics_automation_run(
  (select (result->>'run_id')::uuid from wave17_lease_claims where label = 'c'),
  'failed',
  'orchestration_failed',
  'owned failure',
  (select (result->>'lease_owner')::uuid from wave17_lease_claims where label = 'c')
);
reset role;

select pg_temp.assert_true(
  (select result->>'claimed' from wave17_lease_claims where label = 'a') = 'true'
    and (select result->>'lease_owner' from wave17_lease_claims where label = 'a') is not null,
  'service_role claim returns a fenced lease owner token'
);

select pg_temp.assert_true(
  (select result->>'claimed' from wave17_lease_claims where label = 'overlap') = 'false',
  'overlapping claim is denied while valid lease exists'
);

select pg_temp.assert_true(
  (select result->>'claimed' from wave17_lease_claims where label = 'b') = 'true'
    and (select result->>'lease_owner' from wave17_lease_claims where label = 'b') <> (select result->>'lease_owner' from wave17_lease_claims where label = 'a'),
  'expired lease can be reclaimed with a new owner'
);

select pg_temp.assert_true(
  exists (
    select 1
    from public.analytics_automation_runs
    where id = (select (result->>'run_id')::uuid from wave17_lease_claims where label = 'b')
      and status = 'completed'
      and pages_processed = 1
      and heartbeat_at is not null
      and lease_expires_at is null
  ),
  'current owner can record progress and complete'
);

select pg_temp.assert_true(
  exists (
    select 1
    from public.analytics_automation_runs
    where id = (select (result->>'run_id')::uuid from wave17_lease_claims where label = 'c')
      and status = 'failed'
      and error_code = 'orchestration_failed'
      and error_message = 'owned failure'
  ),
  'current owner can fail its own run'
);

rollback;

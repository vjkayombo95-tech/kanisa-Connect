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

create temporary table wave17_scheduler_claims (
  label text primary key,
  result jsonb not null
) on commit drop;

grant select, insert, update on wave17_scheduler_claims to service_role;

select pg_temp.assert_true(
  not has_function_privilege('public', 'public.claim_analytics_automation_run(text, interval)', 'execute'),
  'claim function is not executable by PUBLIC'
);

select pg_temp.assert_true(
  not has_function_privilege('anon', 'public.claim_analytics_automation_run(text, interval)', 'execute'),
  'claim function is not executable by anon'
);

select pg_temp.assert_true(
  not has_function_privilege('authenticated', 'public.claim_analytics_automation_run(text, interval)', 'execute'),
  'claim function is not executable by authenticated'
);

select pg_temp.assert_true(
  has_function_privilege('service_role', 'public.claim_analytics_automation_run(text, interval)', 'execute'),
  'claim function is executable by service_role'
);

select pg_temp.assert_true(
  not has_function_privilege('authenticated', 'public.record_analytics_automation_page(uuid, integer, integer, integer, uuid, jsonb, uuid, interval)', 'execute')
    and not has_function_privilege('authenticated', 'public.finish_analytics_automation_run(uuid, text, text, text, uuid)', 'execute'),
  'authenticated cannot execute progress or finish functions'
);

set local role anon;
select set_config('request.jwt.claim.role', 'anon', true);
select pg_temp.assert_raises(
  'select public.claim_analytics_automation_run(''scheduler'', interval ''15 minutes'')',
  'anon cannot claim analytics scheduler run'
);
select pg_temp.assert_raises(
  'insert into public.analytics_automation_runs (status) values (''running'')',
  'anon cannot mutate analytics automation run history'
);
reset role;

set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.sub', '98000000-0000-4000-8000-000000000001', true);
select pg_temp.assert_raises(
  'select public.claim_analytics_automation_run(''scheduler'', interval ''15 minutes'')',
  'authenticated cannot claim analytics scheduler run'
);
select pg_temp.assert_raises(
  'insert into public.analytics_automation_runs (status) values (''running'')',
  'authenticated cannot insert analytics automation run history'
);
select pg_temp.assert_raises(
  'update public.analytics_automation_runs set status = ''failed''',
  'authenticated cannot update analytics automation run history'
);
reset role;

set local role service_role;
select set_config('request.jwt.claim.role', 'service_role', true);

insert into wave17_scheduler_claims (label, result)
select 'first', public.claim_analytics_automation_run('scheduler', interval '15 minutes');

insert into wave17_scheduler_claims (label, result)
select 'overlap', public.claim_analytics_automation_run('scheduler', interval '15 minutes');
reset role;

select pg_temp.assert_true(
  (select result->>'claimed' from wave17_scheduler_claims where label = 'first') = 'true',
  'service_role can claim analytics scheduler run'
);

select pg_temp.assert_true(
  (select result->>'claimed' from wave17_scheduler_claims where label = 'overlap') = 'false'
    and (select result->>'status' from wave17_scheduler_claims where label = 'overlap') = 'already_running',
  'second overlapping scheduler run cannot acquire active lease'
);

select pg_temp.assert_true(
  exists (
    select 1
    from public.analytics_automation_runs
    where id = (select (result->>'run_id')::uuid from wave17_scheduler_claims where label = 'overlap')
      and status = 'skipped'
      and error_code = 'already_running'
  ),
  'overlapping scheduler invocation records skipped no-op run'
);

update public.analytics_automation_runs
set lease_expires_at = now() - interval '1 minute'
where id = (select (result->>'run_id')::uuid from wave17_scheduler_claims where label = 'first');

set local role service_role;
select set_config('request.jwt.claim.role', 'service_role', true);
insert into wave17_scheduler_claims (label, result)
select 'after-expiry', public.claim_analytics_automation_run('scheduler', interval '15 minutes');

select public.record_analytics_automation_page(
  (select (result->>'run_id')::uuid from wave17_scheduler_claims where label = 'after-expiry'),
  2,
  1,
  1,
  'ffff0000-0000-4000-8000-000000000202'::uuid,
  jsonb_build_array(jsonb_build_object(
    'churchId', 'ffff0000-0000-4000-8000-000000000202',
    'errorCode', 'P0001',
    'message', 'generation_failed'
  )),
  (select (result->>'lease_owner')::uuid from wave17_scheduler_claims where label = 'after-expiry'),
  interval '15 minutes'
);

select public.finish_analytics_automation_run(
  (select (result->>'run_id')::uuid from wave17_scheduler_claims where label = 'after-expiry'),
  'completed',
  null,
  null,
  (select (result->>'lease_owner')::uuid from wave17_scheduler_claims where label = 'after-expiry')
);

insert into wave17_scheduler_claims (label, result)
select 'after-complete', public.claim_analytics_automation_run('scheduler', interval '15 minutes');

select public.finish_analytics_automation_run(
  (select (result->>'run_id')::uuid from wave17_scheduler_claims where label = 'after-complete'),
  'failed',
  'orchestration_failed',
  repeat('x', 400),
  (select (result->>'lease_owner')::uuid from wave17_scheduler_claims where label = 'after-complete')
);

insert into wave17_scheduler_claims (label, result)
select 'after-failure', public.claim_analytics_automation_run('scheduler', interval '15 minutes');
reset role;

select pg_temp.assert_true(
  (select result->>'claimed' from wave17_scheduler_claims where label = 'after-expiry') = 'true',
  'expired stale scheduler lease can be recovered safely'
);

select pg_temp.assert_true(
  exists (
    select 1
    from public.analytics_automation_runs
    where id = (select (result->>'run_id')::uuid from wave17_scheduler_claims where label = 'after-expiry')
      and status = 'completed'
      and completed_at is not null
      and lease_expires_at is null
      and pages_processed = 1
      and churches_attempted = 2
      and churches_succeeded = 1
      and churches_failed = 1
      and last_cursor = 'ffff0000-0000-4000-8000-000000000202'::uuid
      and jsonb_array_length(failure_summary) = 1
  ),
  'operational summary counts persist correctly on completed run'
);

select pg_temp.assert_true(
  (select result->>'claimed' from wave17_scheduler_claims where label = 'after-complete') = 'true',
  'run completion releases scheduler ownership'
);

select pg_temp.assert_true(
  exists (
    select 1
    from public.analytics_automation_runs
    where id = (select (result->>'run_id')::uuid from wave17_scheduler_claims where label = 'after-complete')
      and status = 'failed'
      and completed_at is not null
      and lease_expires_at is null
      and error_code = 'orchestration_failed'
      and length(error_message) = 240
  ),
  'failed run stores bounded sanitized error metadata'
);

select pg_temp.assert_true(
  (select result->>'claimed' from wave17_scheduler_claims where label = 'after-failure') = 'true',
  'failed run releases scheduler ownership'
);

select pg_temp.assert_true(
  exists (
    select 1
    from public.system_jobs
    where job_name = 'Analytics Snapshots'
      and enabled = false
      and schedule = 'Daily at 02:00 local operational time'
  ),
  'analytics scheduler job metadata is present but not enabled'
);

rollback;

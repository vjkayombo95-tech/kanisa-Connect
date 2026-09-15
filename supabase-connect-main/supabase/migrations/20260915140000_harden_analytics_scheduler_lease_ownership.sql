alter table public.analytics_automation_runs
add column if not exists lease_owner uuid;

alter table public.analytics_automation_runs
add column if not exists heartbeat_at timestamptz;

create index if not exists analytics_automation_runs_owner_idx
on public.analytics_automation_runs (id, lease_owner)
where status = 'running';

create or replace function public.claim_analytics_automation_run(
  p_invocation_source text default 'scheduler',
  p_lease_duration interval default interval '15 minutes'
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_active_run public.analytics_automation_runs%rowtype;
  v_run public.analytics_automation_runs%rowtype;
  v_lease_duration interval := least(
    greatest(coalesce(p_lease_duration, interval '15 minutes'), interval '1 minute'),
    interval '1 hour'
  );
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'Only service role can claim analytics automation runs'
      using errcode = '42501';
  end if;

  if not pg_try_advisory_xact_lock(hashtextextended('claim_analytics_automation_run', 0)) then
    insert into public.analytics_automation_runs (
      status,
      invocation_source,
      completed_at,
      failure_summary,
      error_code,
      error_message
    )
    values (
      'skipped',
      coalesce(nullif(left(p_invocation_source, 80), ''), 'scheduler'),
      now(),
      jsonb_build_array(jsonb_build_object('reason', 'claim_lock_unavailable')),
      'claim_lock_unavailable',
      'Another analytics automation claim is in progress.'
    )
    returning * into v_run;

    return jsonb_build_object(
      'claimed', false,
      'status', 'claim_lock_unavailable',
      'run_id', v_run.id,
      'lease_owner', null,
      'lease_expires_at', null
    );
  end if;

  select *
  into v_active_run
  from public.analytics_automation_runs r
  where r.status = 'running'
    and r.lease_expires_at > now()
  order by r.started_at asc
  limit 1
  for update;

  if found then
    insert into public.analytics_automation_runs (
      status,
      invocation_source,
      completed_at,
      failure_summary,
      error_code,
      error_message
    )
    values (
      'skipped',
      coalesce(nullif(left(p_invocation_source, 80), ''), 'scheduler'),
      now(),
      jsonb_build_array(jsonb_build_object(
        'reason', 'already_running',
        'active_run_id', v_active_run.id
      )),
      'already_running',
      'Analytics automation is already running.'
    )
    returning * into v_run;

    return jsonb_build_object(
      'claimed', false,
      'status', 'already_running',
      'run_id', v_run.id,
      'active_run_id', v_active_run.id,
      'lease_owner', null,
      'lease_expires_at', v_active_run.lease_expires_at
    );
  end if;

  insert into public.analytics_automation_runs (
    status,
    invocation_source,
    lease_owner,
    heartbeat_at,
    lease_expires_at
  )
  values (
    'running',
    coalesce(nullif(left(p_invocation_source, 80), ''), 'scheduler'),
    gen_random_uuid(),
    now(),
    now() + v_lease_duration
  )
  returning * into v_run;

  return jsonb_build_object(
    'claimed', true,
    'status', v_run.status,
    'run_id', v_run.id,
    'lease_owner', v_run.lease_owner,
    'lease_expires_at', v_run.lease_expires_at
  );
end;
$$;

create or replace function public.renew_analytics_automation_run(
  p_run_id uuid,
  p_lease_owner uuid,
  p_lease_duration interval default interval '15 minutes'
)
returns public.analytics_automation_runs
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_run public.analytics_automation_runs%rowtype;
  v_lease_duration interval := least(
    greatest(coalesce(p_lease_duration, interval '15 minutes'), interval '1 minute'),
    interval '1 hour'
  );
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'Only service role can renew analytics automation runs'
      using errcode = '42501';
  end if;

  if p_run_id is null or p_lease_owner is null then
    raise exception 'Run id and lease owner are required'
      using errcode = '22023';
  end if;

  update public.analytics_automation_runs
  set
    heartbeat_at = now(),
    lease_expires_at = now() + v_lease_duration,
    updated_at = now()
  where id = p_run_id
    and lease_owner = p_lease_owner
    and status = 'running'
    and lease_expires_at > now()
  returning * into v_run;

  if not found then
    raise exception 'Analytics automation lease ownership was lost'
      using errcode = '55P03';
  end if;

  return v_run;
end;
$$;

drop function if exists public.record_analytics_automation_page(uuid, integer, integer, integer, uuid, jsonb, interval);

create or replace function public.record_analytics_automation_page(
  p_run_id uuid,
  p_attempted integer,
  p_succeeded integer,
  p_failed integer,
  p_last_cursor uuid,
  p_failures jsonb default '[]'::jsonb,
  p_lease_owner uuid default null,
  p_lease_duration interval default interval '15 minutes'
)
returns public.analytics_automation_runs
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_run public.analytics_automation_runs%rowtype;
  v_lease_duration interval := least(
    greatest(coalesce(p_lease_duration, interval '15 minutes'), interval '1 minute'),
    interval '1 hour'
  );
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'Only service role can record analytics automation progress'
      using errcode = '42501';
  end if;

  if p_run_id is null or p_lease_owner is null then
    raise exception 'Run id and lease owner are required'
      using errcode = '22023';
  end if;

  if jsonb_typeof(coalesce(p_failures, '[]'::jsonb)) <> 'array' then
    raise exception 'Failure summary must be a JSON array'
      using errcode = '22023';
  end if;

  update public.analytics_automation_runs
  set
    pages_processed = pages_processed + 1,
    churches_attempted = churches_attempted + greatest(coalesce(p_attempted, 0), 0),
    churches_succeeded = churches_succeeded + greatest(coalesce(p_succeeded, 0), 0),
    churches_failed = churches_failed + greatest(coalesce(p_failed, 0), 0),
    last_cursor = p_last_cursor,
    failure_summary = (
      select coalesce(jsonb_agg(value), '[]'::jsonb)
      from (
        select value
        from jsonb_array_elements(
          coalesce(failure_summary, '[]'::jsonb) || coalesce(p_failures, '[]'::jsonb)
        ) as value
        limit 25
      ) bounded
    ),
    heartbeat_at = now(),
    lease_expires_at = now() + v_lease_duration,
    updated_at = now()
  where id = p_run_id
    and lease_owner = p_lease_owner
    and status = 'running'
    and lease_expires_at > now()
  returning * into v_run;

  if not found then
    raise exception 'Analytics automation lease ownership was lost'
      using errcode = '55P03';
  end if;

  return v_run;
end;
$$;

drop function if exists public.finish_analytics_automation_run(uuid, text, text, text);

create or replace function public.finish_analytics_automation_run(
  p_run_id uuid,
  p_status text,
  p_error_code text default null,
  p_error_message text default null,
  p_lease_owner uuid default null
)
returns public.analytics_automation_runs
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_run public.analytics_automation_runs%rowtype;
  v_status text := lower(coalesce(p_status, ''));
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'Only service role can finish analytics automation runs'
      using errcode = '42501';
  end if;

  if p_run_id is null or p_lease_owner is null then
    raise exception 'Run id and lease owner are required'
      using errcode = '22023';
  end if;

  if v_status not in ('completed', 'failed') then
    raise exception 'Analytics automation finish status must be completed or failed'
      using errcode = '22023';
  end if;

  update public.analytics_automation_runs
  set
    status = v_status,
    completed_at = now(),
    lease_expires_at = null,
    error_code = case when v_status = 'failed' then nullif(left(coalesce(p_error_code, 'orchestration_failed'), 80), '') else null end,
    error_message = case when v_status = 'failed' then left(coalesce(p_error_message, 'Analytics automation failed.'), 240) else null end,
    updated_at = now()
  where id = p_run_id
    and lease_owner = p_lease_owner
    and status = 'running'
    and lease_expires_at > now()
  returning * into v_run;

  if not found then
    raise exception 'Analytics automation lease ownership was lost'
      using errcode = '55P03';
  end if;

  update public.system_jobs
  set
    last_run_at = now(),
    last_status = v_status,
    updated_at = now()
  where job_name = 'Analytics Snapshots';

  return v_run;
end;
$$;

revoke all on function public.claim_analytics_automation_run(text, interval) from public;
revoke all on function public.claim_analytics_automation_run(text, interval) from anon;
revoke all on function public.claim_analytics_automation_run(text, interval) from authenticated;
grant execute on function public.claim_analytics_automation_run(text, interval) to service_role;

revoke all on function public.renew_analytics_automation_run(uuid, uuid, interval) from public;
revoke all on function public.renew_analytics_automation_run(uuid, uuid, interval) from anon;
revoke all on function public.renew_analytics_automation_run(uuid, uuid, interval) from authenticated;
grant execute on function public.renew_analytics_automation_run(uuid, uuid, interval) to service_role;

drop function if exists public.record_analytics_automation_page(uuid, integer, integer, integer, uuid, jsonb, interval);

revoke all on function public.record_analytics_automation_page(uuid, integer, integer, integer, uuid, jsonb, uuid, interval) from public;
revoke all on function public.record_analytics_automation_page(uuid, integer, integer, integer, uuid, jsonb, uuid, interval) from anon;
revoke all on function public.record_analytics_automation_page(uuid, integer, integer, integer, uuid, jsonb, uuid, interval) from authenticated;
grant execute on function public.record_analytics_automation_page(uuid, integer, integer, integer, uuid, jsonb, uuid, interval) to service_role;

drop function if exists public.finish_analytics_automation_run(uuid, text, text, text);

revoke all on function public.finish_analytics_automation_run(uuid, text, text, text, uuid) from public;
revoke all on function public.finish_analytics_automation_run(uuid, text, text, text, uuid) from anon;
revoke all on function public.finish_analytics_automation_run(uuid, text, text, text, uuid) from authenticated;
grant execute on function public.finish_analytics_automation_run(uuid, text, text, text, uuid) to service_role;

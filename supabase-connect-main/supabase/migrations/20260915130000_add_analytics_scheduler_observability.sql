create table if not exists public.analytics_automation_runs (
  id uuid primary key default gen_random_uuid(),
  job_name text not null default 'Analytics Snapshots',
  status text not null check (status in ('running', 'completed', 'failed', 'skipped')),
  invocation_source text not null default 'scheduler',
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  lease_expires_at timestamptz,
  pages_processed integer not null default 0 check (pages_processed >= 0),
  churches_attempted integer not null default 0 check (churches_attempted >= 0),
  churches_succeeded integer not null default 0 check (churches_succeeded >= 0),
  churches_failed integer not null default 0 check (churches_failed >= 0),
  last_cursor uuid,
  failure_summary jsonb not null default '[]'::jsonb,
  error_code text,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.analytics_automation_runs enable row level security;

revoke all on table public.analytics_automation_runs from public;
revoke all on table public.analytics_automation_runs from anon;
revoke all on table public.analytics_automation_runs from authenticated;
grant select, insert, update on table public.analytics_automation_runs to service_role;

create index if not exists analytics_automation_runs_status_lease_idx
on public.analytics_automation_runs (status, lease_expires_at);

create index if not exists analytics_automation_runs_started_at_idx
on public.analytics_automation_runs (started_at desc);

insert into public.system_jobs (
  job_name,
  description,
  schedule,
  enabled
)
values (
  'Analytics Snapshots',
  'Runs scheduled active-church analytics snapshot generation',
  'Daily at 02:00 local operational time',
  false
)
on conflict (job_name) do nothing;

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
    interval '60 minutes'
  );
  v_invocation_source text := left(coalesce(nullif(trim(p_invocation_source), ''), 'scheduler'), 80);
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'Only the backend service role may claim analytics automation runs.'
      using errcode = '42501';
  end if;

  if not pg_try_advisory_xact_lock(
    hashtextextended('claim_analytics_automation_run', 0)
  ) then
    insert into public.analytics_automation_runs (
      status,
      invocation_source,
      started_at,
      completed_at,
      error_code,
      error_message
    )
    values (
      'skipped',
      v_invocation_source,
      now(),
      now(),
      'already_running',
      'analytics automation claim already running'
    )
    returning * into v_run;

    return jsonb_build_object(
      'claimed', false,
      'status', 'already_running',
      'run_id', v_run.id,
      'active_run_id', null,
      'lease_expires_at', null
    );
  end if;

  select *
  into v_active_run
  from public.analytics_automation_runs r
  where r.status = 'running'
    and r.lease_expires_at > now()
  order by r.started_at desc
  limit 1;

  if v_active_run.id is not null then
    insert into public.analytics_automation_runs (
      status,
      invocation_source,
      started_at,
      completed_at,
      error_code,
      error_message
    )
    values (
      'skipped',
      v_invocation_source,
      now(),
      now(),
      'already_running',
      'analytics automation already running'
    )
    returning * into v_run;

    return jsonb_build_object(
      'claimed', false,
      'status', 'already_running',
      'run_id', v_run.id,
      'active_run_id', v_active_run.id,
      'lease_expires_at', v_active_run.lease_expires_at
    );
  end if;

  insert into public.analytics_automation_runs (
    status,
    invocation_source,
    lease_expires_at
  )
  values (
    'running',
    v_invocation_source,
    now() + v_lease_duration
  )
  returning * into v_run;

  return jsonb_build_object(
    'claimed', true,
    'status', 'running',
    'run_id', v_run.id,
    'lease_expires_at', v_run.lease_expires_at
  );
end;
$$;

create or replace function public.record_analytics_automation_page(
  p_run_id uuid,
  p_attempted integer,
  p_succeeded integer,
  p_failed integer,
  p_last_cursor uuid,
  p_failures jsonb default '[]'::jsonb,
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
    interval '60 minutes'
  );
  v_failures jsonb := coalesce(p_failures, '[]'::jsonb);
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'Only the backend service role may record analytics automation progress.'
      using errcode = '42501';
  end if;

  if p_run_id is null then
    raise exception 'Run id is required.' using errcode = '22023';
  end if;

  if jsonb_typeof(v_failures) <> 'array' then
    raise exception 'Failure summary must be a JSON array.' using errcode = '22023';
  end if;

  update public.analytics_automation_runs
  set
    pages_processed = pages_processed + 1,
    churches_attempted = churches_attempted + greatest(coalesce(p_attempted, 0), 0),
    churches_succeeded = churches_succeeded + greatest(coalesce(p_succeeded, 0), 0),
    churches_failed = churches_failed + greatest(coalesce(p_failed, 0), 0),
    last_cursor = coalesce(p_last_cursor, last_cursor),
    failure_summary = (
      select coalesce(jsonb_agg(item), '[]'::jsonb)
      from (
        select item
        from jsonb_array_elements(failure_summary || v_failures) item
        limit 25
      ) bounded
    ),
    lease_expires_at = now() + v_lease_duration,
    updated_at = now()
  where id = p_run_id
    and status = 'running'
    and lease_expires_at > now()
  returning * into v_run;

  if v_run.id is null then
    raise exception 'Analytics automation run is not active.' using errcode = 'P0002';
  end if;

  return v_run;
end;
$$;

create or replace function public.finish_analytics_automation_run(
  p_run_id uuid,
  p_status text,
  p_error_code text default null,
  p_error_message text default null
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
    raise exception 'Only the backend service role may finish analytics automation runs.'
      using errcode = '42501';
  end if;

  if p_run_id is null then
    raise exception 'Run id is required.' using errcode = '22023';
  end if;

  if v_status not in ('completed', 'failed') then
    raise exception 'Analytics automation run status must be completed or failed.'
      using errcode = '22023';
  end if;

  update public.analytics_automation_runs
  set
    status = v_status,
    completed_at = now(),
    lease_expires_at = null,
    error_code = left(nullif(p_error_code, ''), 80),
    error_message = left(nullif(p_error_message, ''), 240),
    updated_at = now()
  where id = p_run_id
    and status = 'running'
  returning * into v_run;

  if v_run.id is null then
    raise exception 'Analytics automation run is not active.' using errcode = 'P0002';
  end if;

  update public.system_jobs
  set
    last_run_at = v_run.completed_at,
    last_status = case when v_status = 'completed' then 'success' else 'failed' end,
    last_duration_ms = floor(extract(epoch from (v_run.completed_at - v_run.started_at)) * 1000)::integer,
    updated_at = now()
  where job_name = 'Analytics Snapshots';

  return v_run;
end;
$$;

revoke all on function public.claim_analytics_automation_run(text, interval) from public;
revoke all on function public.claim_analytics_automation_run(text, interval) from anon;
revoke all on function public.claim_analytics_automation_run(text, interval) from authenticated;
grant execute on function public.claim_analytics_automation_run(text, interval) to service_role;

revoke all on function public.record_analytics_automation_page(uuid, integer, integer, integer, uuid, jsonb, interval) from public;
revoke all on function public.record_analytics_automation_page(uuid, integer, integer, integer, uuid, jsonb, interval) from anon;
revoke all on function public.record_analytics_automation_page(uuid, integer, integer, integer, uuid, jsonb, interval) from authenticated;
grant execute on function public.record_analytics_automation_page(uuid, integer, integer, integer, uuid, jsonb, interval) to service_role;

revoke all on function public.finish_analytics_automation_run(uuid, text, text, text) from public;
revoke all on function public.finish_analytics_automation_run(uuid, text, text, text) from anon;
revoke all on function public.finish_analytics_automation_run(uuid, text, text, text) from authenticated;
grant execute on function public.finish_analytics_automation_run(uuid, text, text, text) to service_role;

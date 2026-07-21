-- RC-7.3 Production operations.
-- Additive health, metrics, heartbeat, and operational logging support.

create table if not exists public.operational_events (
  id uuid primary key default gen_random_uuid(),
  church_id uuid references public.churches(id) on delete cascade,
  job_id uuid references public.audio_jobs(id) on delete set null,
  event_type text not null,
  severity text not null default 'info' check (severity in ('debug', 'info', 'warning', 'error', 'critical')),
  source text not null default 'system',
  message text,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_operational_events_church_created
on public.operational_events (church_id, created_at desc);

create index if not exists idx_operational_events_type_created
on public.operational_events (event_type, created_at desc);

create table if not exists public.audio_worker_heartbeats (
  id uuid primary key default gen_random_uuid(),
  worker_id text not null unique,
  worker_type text not null default 'edge' check (worker_type in ('edge', 'python', 'audio')),
  status text not null default 'idle',
  current_job_id uuid references public.audio_jobs(id) on delete set null,
  last_seen_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_audio_worker_heartbeats_type_seen
on public.audio_worker_heartbeats (worker_type, last_seen_at desc);

drop trigger if exists update_audio_worker_heartbeats_updated_at on public.audio_worker_heartbeats;
create trigger update_audio_worker_heartbeats_updated_at
before update on public.audio_worker_heartbeats
for each row execute function public.update_updated_at_column();

alter table public.operational_events enable row level security;
alter table public.audio_worker_heartbeats enable row level security;

drop policy if exists "Workspace managers can read operational events" on public.operational_events;
create policy "Workspace managers can read operational events"
on public.operational_events for select to authenticated
using (
  church_id is not null
  and public.can_manage_church_workspace(auth.uid(), church_id)
);

drop policy if exists "Workspace managers can read audio worker heartbeats" on public.audio_worker_heartbeats;
create policy "Workspace managers can read audio worker heartbeats"
on public.audio_worker_heartbeats for select to authenticated
using (
  public.is_super_admin(auth.uid())
  or exists (
    select 1
    from public.audio_jobs j
    where j.id = current_job_id
      and public.can_manage_church_workspace(auth.uid(), j.church_id)
  )
  or current_job_id is null
);

create or replace function public.log_operational_event(
  _church_id uuid,
  _job_id uuid,
  _event_type text,
  _severity text default 'info',
  _source text default 'system',
  _message text default null,
  _metadata jsonb default '{}'::jsonb
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event_id uuid;
  v_actor uuid := auth.uid();
  v_severity text := coalesce(nullif(btrim(_severity), ''), 'info');
begin
  if coalesce(auth.role(), '') <> 'service_role'
    and (_church_id is null or not public.can_manage_church_workspace(v_actor, _church_id)) then
    raise exception 'not authorized to write operational events';
  end if;

  if v_severity not in ('debug', 'info', 'warning', 'error', 'critical') then
    v_severity := 'info';
  end if;

  insert into public.operational_events (
    church_id,
    job_id,
    event_type,
    severity,
    source,
    message,
    metadata,
    created_by
  )
  values (
    _church_id,
    _job_id,
    coalesce(nullif(btrim(_event_type), ''), 'operation'),
    v_severity,
    coalesce(nullif(btrim(_source), ''), 'system'),
    _message,
    coalesce(_metadata, '{}'::jsonb),
    v_actor
  )
  returning id into v_event_id;

  return v_event_id;
end;
$$;

create or replace function public.record_audio_worker_heartbeat(
  _worker_id text,
  _worker_type text default 'edge',
  _status text default 'idle',
  _current_job_id uuid default null,
  _metadata jsonb default '{}'::jsonb
) returns public.audio_worker_heartbeats
language plpgsql
security definer
set search_path = public
as $$
declare
  v_heartbeat public.audio_worker_heartbeats;
  v_worker_type text := coalesce(nullif(btrim(_worker_type), ''), 'edge');
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'worker credentials required';
  end if;

  if v_worker_type not in ('edge', 'python', 'audio') then
    v_worker_type := 'edge';
  end if;

  insert into public.audio_worker_heartbeats (
    worker_id,
    worker_type,
    status,
    current_job_id,
    last_seen_at,
    metadata
  )
  values (
    coalesce(nullif(btrim(_worker_id), ''), 'audio-worker'),
    v_worker_type,
    coalesce(nullif(btrim(_status), ''), 'idle'),
    _current_job_id,
    now(),
    coalesce(_metadata, '{}'::jsonb)
  )
  on conflict (worker_id) do update
  set worker_type = excluded.worker_type,
      status = excluded.status,
      current_job_id = excluded.current_job_id,
      last_seen_at = excluded.last_seen_at,
      metadata = excluded.metadata
  returning * into v_heartbeat;

  return v_heartbeat;
end;
$$;

create or replace function public.get_audio_operations_metrics(
  _church_id uuid
) returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_result jsonb;
  v_worker jsonb;
  v_python_worker jsonb;
begin
  if not public.can_manage_church_workspace(auth.uid(), _church_id)
    and coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'not authorized to view audio operations metrics';
  end if;

  select to_jsonb(w)
  into v_worker
  from (
    select
      worker_id,
      worker_type,
      status,
      current_job_id,
      last_seen_at,
      case when last_seen_at >= now() - interval '5 minutes' then 'online' else 'stale' end as health
    from public.audio_worker_heartbeats
    where worker_type in ('edge', 'audio')
    order by last_seen_at desc
    limit 1
  ) w;

  select to_jsonb(w)
  into v_python_worker
  from (
    select
      worker_id,
      worker_type,
      status,
      current_job_id,
      last_seen_at,
      case when last_seen_at >= now() - interval '5 minutes' then 'online' else 'stale' end as health
    from public.audio_worker_heartbeats
    where worker_type = 'python'
    order by last_seen_at desc
    limit 1
  ) w;

  select jsonb_build_object(
    'queueDepth', count(*) filter (where status in ('QUEUED', 'queued', 'VALIDATING', 'validating')),
    'processingJobs', count(*) filter (where status in ('processing', 'TRANSCRIBING', 'ALIGNING', 'BUILDING_INDEX', 'VALIDATING_INDEX')),
    'failedJobs', count(*) filter (where status in ('FAILED', 'failed')),
    'averageProcessingSeconds', coalesce(avg(extract(epoch from (completed_at - started_at))) filter (where started_at is not null and completed_at is not null), 0),
    'storageBytes', coalesce((select sum(file_size) from public.audio_assets where church_id = _church_id), 0),
    'publishedAudioCount', coalesce((select count(*) from public.audio_versions where church_id = _church_id and status = 'published'), 0),
    'pendingReviews', coalesce((select count(*) from public.audio_reviews where church_id = _church_id and status in ('pending', 'changes_requested')), 0),
    'averageQaConfidence', coalesce((select avg(confidence) from public.audio_verse_reviews where church_id = _church_id), 0),
    'errorRate', case
      when count(*) = 0 then 0
      else round((count(*) filter (where status in ('FAILED', 'failed'))::numeric / count(*)::numeric) * 100, 2)
    end,
    'workerStatus', coalesce(v_worker, jsonb_build_object('health', 'missing', 'status', 'unknown')),
    'pythonWorkerStatus', coalesce(v_python_worker, jsonb_build_object('health', 'missing', 'status', 'unknown')),
    'recentEvents', coalesce((
      select jsonb_agg(to_jsonb(e) order by e.created_at desc)
      from (
        select id, event_type, severity, source, message, job_id, metadata, created_at
        from public.operational_events
        where church_id = _church_id
        order by created_at desc
        limit 20
      ) e
    ), '[]'::jsonb)
  )
  into v_result
  from public.audio_jobs
  where church_id = _church_id;

  return coalesce(v_result, jsonb_build_object(
    'queueDepth', 0,
    'processingJobs', 0,
    'failedJobs', 0,
    'averageProcessingSeconds', 0,
    'storageBytes', 0,
    'publishedAudioCount', 0,
    'pendingReviews', 0,
    'averageQaConfidence', 0,
    'errorRate', 0,
    'workerStatus', coalesce(v_worker, jsonb_build_object('health', 'missing', 'status', 'unknown')),
    'pythonWorkerStatus', coalesce(v_python_worker, jsonb_build_object('health', 'missing', 'status', 'unknown')),
    'recentEvents', '[]'::jsonb
  ));
end;
$$;

create or replace function public.get_audio_operations_health(
  _church_id uuid
) returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_metrics jsonb;
begin
  v_metrics := public.get_audio_operations_metrics(_church_id);

  return jsonb_build_object(
    'database', jsonb_build_object('status', 'ok', 'checkedAt', now()),
    'queue', jsonb_build_object(
      'status', case when (v_metrics ->> 'failedJobs')::integer > 0 then 'warning' else 'ok' end,
      'depth', (v_metrics ->> 'queueDepth')::integer,
      'failedJobs', (v_metrics ->> 'failedJobs')::integer
    ),
    'worker', v_metrics -> 'workerStatus',
    'pythonWorker', v_metrics -> 'pythonWorkerStatus',
    'metrics', v_metrics
  );
end;
$$;

create or replace function public.log_audio_job_operational_event()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event_type text;
  v_severity text := 'info';
  v_message text;
begin
  if tg_op = 'INSERT' then
    v_event_type := 'job_created';
    v_message := 'Audio job created.';
  elsif new.status is distinct from old.status then
    v_event_type := case
      when new.status in ('FAILED', 'failed') then 'worker_failure'
      when new.status in ('COMPLETED', 'completed', 'REVIEW_REQUIRED', 'needs_review') then 'worker_finished'
      when new.status = 'approved' then 'approval'
      when new.status = 'published' then 'publishing'
      else null
    end;
    v_severity := case when new.status in ('FAILED', 'failed') then 'error' else 'info' end;
    v_message := 'Audio job status changed from ' || coalesce(old.status, 'unknown') || ' to ' || new.status || '.';
  end if;

  if v_event_type is not null then
    insert into public.operational_events (
      church_id,
      job_id,
      event_type,
      severity,
      source,
      message,
      metadata,
      created_by
    )
    values (
      new.church_id,
      new.id,
      v_event_type,
      v_severity,
      'database',
      v_message,
      jsonb_build_object(
        'status', new.status,
        'processingStage', new.processing_stage,
        'progress', new.progress
      ),
      coalesce(new.created_by, auth.uid())
    );
  end if;

  return new;
end;
$$;

drop trigger if exists log_audio_job_operational_events on public.audio_jobs;
create trigger log_audio_job_operational_events
after insert or update on public.audio_jobs
for each row execute function public.log_audio_job_operational_event();

grant select on public.operational_events to authenticated;
grant select on public.audio_worker_heartbeats to authenticated;
grant execute on function public.log_operational_event(uuid, uuid, text, text, text, text, jsonb) to authenticated, service_role;
grant execute on function public.record_audio_worker_heartbeat(text, text, text, uuid, jsonb) to service_role;
grant execute on function public.get_audio_operations_metrics(uuid) to authenticated, service_role;
grant execute on function public.get_audio_operations_health(uuid) to authenticated, service_role;

-- Provider-neutral livestream status synchronization with YouTube as the first adapter.

alter table public.church_livestreams
  add column if not exists provider_external_id text,
  add column if not exists provider_status text
    check (provider_status is null or provider_status in ('scheduled','live','ended','cancelled','unknown')),
  add column if not exists provider_last_checked_at timestamptz,
  add column if not exists provider_next_sync_at timestamptz,
  add column if not exists provider_failure_count integer not null default 0 check (provider_failure_count >= 0),
  add column if not exists provider_last_error_category text,
  add column if not exists status_source text not null default 'manual'
    check (status_source in ('manual','provider','system'));

create index if not exists church_livestreams_provider_sync_idx
  on public.church_livestreams(provider, status, provider_next_sync_at, scheduled_start)
  where provider_external_id is not null and status in ('scheduled','live');

create or replace function public.youtube_video_id(_url text)
returns text language plpgsql immutable set search_path = pg_catalog as $$
declare
  v_match text[];
  v_id text;
begin
  if _url is null or _url !~* '^https://' then return null; end if;
  v_match := regexp_match(_url, '^https://(?:www\.|m\.)?youtube\.com/watch\?[^#]*v=([A-Za-z0-9_-]{11})(?:[&#].*)?$', 'i');
  if v_match is null then v_match := regexp_match(_url, '^https://youtu\.be/([A-Za-z0-9_-]{11})(?:[/?#].*)?$', 'i'); end if;
  if v_match is null then v_match := regexp_match(_url, '^https://(?:www\.|m\.)?youtube\.com/(?:live|embed|shorts)/([A-Za-z0-9_-]{11})(?:[/?#].*)?$', 'i'); end if;
  v_id := v_match[1];
  return v_id;
end;
$$;

update public.church_livestreams
set provider_external_id = public.youtube_video_id(watch_url)
where provider = 'youtube' and provider_external_id is null
  and public.youtube_video_id(watch_url) is not null;

create or replace function public.set_livestream_provider_external_id()
returns trigger language plpgsql set search_path = pg_catalog, public as $$
declare v_id text;
begin
  if new.provider = 'youtube' then
    v_id := public.youtube_video_id(new.watch_url);
    if v_id is null then
      raise exception 'A supported YouTube watch URL is required' using errcode = '22023';
    end if;
    new.provider_external_id := v_id;
  else
    new.provider_external_id := null;
    new.provider_status := null;
    new.provider_last_checked_at := null;
    new.provider_next_sync_at := null;
    new.provider_failure_count := 0;
    new.provider_last_error_category := null;
  end if;
  return new;
end;
$$;

drop trigger if exists set_livestream_provider_external_id_trigger on public.church_livestreams;
create trigger set_livestream_provider_external_id_trigger
before insert or update of provider, watch_url on public.church_livestreams
for each row execute function public.set_livestream_provider_external_id();

-- Extend the canonical lifecycle trigger without changing its transition graph.
-- A provider job is trusted only for a service-role request that opted into the
-- transaction-local synchronization path.
do $$
declare v_definition text; v_hardened text;
begin
  select pg_get_functiondef('public.enforce_church_livestream_lifecycle()'::regprocedure) into v_definition;
  v_hardened := replace(v_definition,
    'elsif new.status <> old.status then',
    'elsif new.status <> old.status then
    new.status_source := case when auth.role() = ''service_role'' and current_setting(''app.livestream_provider_sync'', true) = ''on'' then ''provider'' else ''manual'' end;');
  v_hardened := replace(v_hardened,
    'if not public.has_church_feature_permission(auth.uid(), old.church_id, ''livestream'', ''manage'') then',
    'if not (auth.role() = ''service_role'' and current_setting(''app.livestream_provider_sync'', true) = ''on'')
       and not public.has_church_feature_permission(auth.uid(), old.church_id, ''livestream'', ''manage'') then');
  v_hardened := replace(v_hardened, 'new.actual_started_at := clock_timestamp();', 'new.actual_started_at := coalesce(new.actual_started_at, clock_timestamp());');
  v_hardened := replace(v_hardened, 'new.actual_ended_at := clock_timestamp();', 'new.actual_ended_at := coalesce(new.actual_ended_at, clock_timestamp());');
  if v_hardened = v_definition then raise exception 'Livestream lifecycle function did not match the expected canonical definition'; end if;
  execute v_hardened;
end;
$$;

create or replace function public.apply_livestream_provider_check(
  _livestream_id uuid, _church_id uuid, _provider text, _provider_external_id text,
  _provider_status text, _checked_at timestamptz, _actual_started_at timestamptz default null,
  _actual_ended_at timestamptz default null, _thumbnail_url text default null,
  _recording_url text default null, _error_category text default null
)
returns public.church_livestreams
language plpgsql security definer set search_path = pg_catalog, public as $$
declare
  v_stream public.church_livestreams%rowtype;
  v_previous_status text;
  v_new_status text;
  v_failure_count integer;
begin
  if auth.role() <> 'service_role' then raise exception 'Service role required' using errcode = '42501'; end if;
  if _provider <> 'youtube' or _provider_status not in ('scheduled','live','ended','cancelled','unknown') then
    raise exception 'Unsupported provider result' using errcode = '22023';
  end if;
  select * into v_stream from public.church_livestreams
  where id = _livestream_id and church_id = _church_id for update;
  if not found then raise exception 'Livestream not found for church' using errcode = 'P0002'; end if;
  if v_stream.provider <> _provider or v_stream.provider_external_id <> _provider_external_id then
    raise exception 'Provider identity mismatch' using errcode = '22023';
  end if;
  if not public.is_service_feature_available(_church_id, 'livestream') then
    raise exception 'Livestream feature unavailable for church' using errcode = '42501';
  end if;

  v_previous_status := v_stream.status;
  v_new_status := case
    when v_stream.status = 'scheduled' and _provider_status = 'live' then 'live'
    when v_stream.status = 'live' and _provider_status = 'ended' then 'ended'
    else v_stream.status end;
  v_failure_count := case when _error_category is null then 0 else v_stream.provider_failure_count + 1 end;
  perform set_config('app.livestream_provider_sync', 'on', true);
  update public.church_livestreams set
    status = v_new_status,
    provider_status = _provider_status,
    provider_last_checked_at = coalesce(_checked_at, clock_timestamp()),
    provider_failure_count = v_failure_count,
    provider_last_error_category = _error_category,
    provider_next_sync_at = case when _error_category is null then clock_timestamp() + interval '1 minute'
      else clock_timestamp() + make_interval(mins => least(30, (2 * power(2, least(v_failure_count - 1, 4)))::integer)) end,
    actual_started_at = case when v_new_status = 'live' and v_stream.status = 'scheduled' then coalesce(_actual_started_at, clock_timestamp()) else v_stream.actual_started_at end,
    actual_ended_at = case when v_new_status = 'ended' and v_stream.status = 'live' then coalesce(_actual_ended_at, clock_timestamp()) else v_stream.actual_ended_at end,
    thumbnail_url = coalesce(_thumbnail_url, v_stream.thumbnail_url),
    recording_url = coalesce(_recording_url, v_stream.recording_url),
    status_source = case when v_new_status <> v_stream.status then 'provider' else v_stream.status_source end
  where id = _livestream_id and church_id = _church_id returning * into v_stream;

  if v_new_status <> v_stream.status then
    raise exception 'Provider transition state mismatch';
  end if;
  if v_new_status <> v_previous_status then
    perform public.create_audit_log(
      case when v_new_status = 'live' then 'livestream.auto_started' else 'livestream.auto_ended' end,
      'church_livestream', _livestream_id, 'Livestream status synchronized from provider',
      jsonb_build_object('church_id',_church_id,'provider',_provider,'provider_external_id',_provider_external_id,
        'previous_status',v_previous_status,'status',v_new_status,'provider_status',_provider_status)
    );
  end if;
  return v_stream;
end;
$$;

revoke all on function public.apply_livestream_provider_check(uuid,uuid,text,text,text,timestamptz,timestamptz,timestamptz,text,text,text) from public, anon, authenticated;
grant execute on function public.apply_livestream_provider_check(uuid,uuid,text,text,text,timestamptz,timestamptz,timestamptz,text,text,text) to service_role;

insert into public.system_jobs(job_name, description, schedule, enabled)
values ('Livestream Provider Sync', 'Synchronizes authoritative livestream lifecycle from supported providers', 'Every minute', true)
on conflict (job_name) do update set description = excluded.description, schedule = excluded.schedule;

comment on column public.church_livestreams.provider_external_id is 'Validated provider identifier used by server-side adapters; never a provider credential.';
comment on function public.apply_livestream_provider_check(uuid,uuid,text,text,text,timestamptz,timestamptz,timestamptz,text,text,text) is 'Service-only, tenant-explicit forward lifecycle synchronization for trusted provider results.';

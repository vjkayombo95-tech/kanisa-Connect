-- RC-7.1 Audio security and trust-boundary hardening.

alter table public.audio_jobs
  add column if not exists queued_at timestamptz,
  add column if not exists cancelled_at timestamptz,
  add column if not exists published_at timestamptz,
  add column if not exists published_by uuid references auth.users(id) on delete set null;

alter table public.audio_versions
  add column if not exists approved_at timestamptz,
  add column if not exists approved_by uuid references auth.users(id) on delete set null,
  add column if not exists published_at timestamptz,
  add column if not exists published_by uuid references auth.users(id) on delete set null;

do $$
declare
  constraint_name text;
begin
  select c.conname into constraint_name
  from pg_constraint c
  join pg_class t on t.oid = c.conrelid
  join pg_namespace n on n.oid = t.relnamespace
  where n.nspname = 'public'
    and t.relname = 'audio_jobs'
    and c.contype = 'c'
    and pg_get_constraintdef(c.oid) like '%status%';

  if constraint_name is not null then
    execute format('alter table public.audio_jobs drop constraint %I', constraint_name);
  end if;
end $$;

alter table public.audio_jobs
add constraint audio_jobs_status_check
check (
  status in (
    'draft', 'uploading', 'validating', 'queued', 'processing', 'needs_review', 'completed',
    'approved', 'published', 'archived', 'failed', 'cancelled',
    'DRAFT', 'UPLOADING', 'VALIDATING', 'QUEUED', 'TRANSCRIBING', 'ALIGNING',
    'BUILDING_INDEX', 'VALIDATING_INDEX', 'COMPLETED', 'FAILED', 'REVIEW_REQUIRED',
    'CANCELLED'
  )
);

do $$
declare
  constraint_name text;
begin
  select c.conname into constraint_name
  from pg_constraint c
  join pg_class t on t.oid = c.conrelid
  join pg_namespace n on n.oid = t.relnamespace
  where n.nspname = 'public'
    and t.relname = 'audio_versions'
    and c.contype = 'c'
    and pg_get_constraintdef(c.oid) like '%status%';

  if constraint_name is not null then
    execute format('alter table public.audio_versions drop constraint %I', constraint_name);
  end if;
end $$;

alter table public.audio_versions
add constraint audio_versions_status_check
check (status in ('draft', 'approved', 'published', 'archived', 'failed', 'active'));

create or replace function public.has_audio_reviewer_role(_user_id uuid, _church_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(auth.role(), '') = 'service_role'
    or public.is_super_admin(_user_id)
    or exists (
      select 1
      from public.user_roles ur
      where ur.user_id = _user_id
        and ur.church_id = _church_id
        and lower(coalesce(ur.role, '')) in ('audio_reviewer', 'reviewer', 'church_admin', 'pastor')
    );
$$;

create or replace function public.has_audio_publisher_role(_user_id uuid, _church_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(auth.role(), '') = 'service_role'
    or public.is_super_admin(_user_id)
    or exists (
      select 1
      from public.user_roles ur
      where ur.user_id = _user_id
        and ur.church_id = _church_id
        and lower(coalesce(ur.role, '')) in ('audio_publisher', 'publisher', 'church_admin', 'pastor')
    );
$$;

create or replace function public.is_active_church_member(_user_id uuid, _church_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.can_view_church_workspace(_user_id, _church_id)
    or exists (
      select 1
      from public.members m
      where m.church_id = _church_id
        and (m.user_id = _user_id or lower(coalesce(m.email, '')) = lower(coalesce((auth.jwt() ->> 'email'), '')))
        and coalesce(lower(m.status), 'active') in ('active', 'approved')
    );
$$;

create or replace function public.assert_audio_job_client_update_safe()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  trusted_context text := coalesce(current_setting('app.audio_trusted_context', true), '');
begin
  if coalesce(auth.role(), '') = 'service_role' or trusted_context in ('client_job_control', 'reviewer_action', 'publisher_action', 'worker') then
    return new;
  end if;

  if new.status is distinct from old.status
    or new.processing_stage is distinct from old.processing_stage
    or new.progress is distinct from old.progress
    or new.completed_at is distinct from old.completed_at
    or new.report_url is distinct from old.report_url
    or new.manifest_url is distinct from old.manifest_url
    or new.index_url is distinct from old.index_url then
    raise exception 'audio job execution fields are worker-controlled';
  end if;

  return new;
end;
$$;

drop trigger if exists protect_audio_job_execution_fields on public.audio_jobs;
create trigger protect_audio_job_execution_fields
before update on public.audio_jobs
for each row execute function public.assert_audio_job_client_update_safe();

create or replace function public.create_audio_job_draft(
  _church_id uuid,
  _content_type text,
  _book text,
  _chapter integer
) returns public.audio_jobs
language plpgsql
security definer
set search_path = public
as $$
declare
  v_job public.audio_jobs;
begin
  if not public.can_manage_church_workspace(auth.uid(), _church_id) then
    raise exception 'not authorized to create audio jobs';
  end if;

  if _content_type not in ('bible', 'readings', 'saints', 'catechism', 'homilies') then
    raise exception 'unsupported audio content type';
  end if;

  insert into public.audio_jobs (
    church_id, created_by, content_type, book, chapter, status, processing_stage, progress
  )
  values (
    _church_id, auth.uid(), _content_type, btrim(_book), _chapter, 'DRAFT', 'DRAFT', 0
  )
  returning * into v_job;

  return v_job;
end;
$$;

create or replace function public.register_audio_asset(
  _job_id uuid,
  _asset_type text,
  _storage_bucket text,
  _storage_path text,
  _content_type text default null,
  _file_name text default null,
  _file_size bigint default null
) returns public.audio_assets
language plpgsql
security definer
set search_path = public
as $$
declare
  v_job public.audio_jobs;
  v_asset public.audio_assets;
begin
  select * into v_job from public.audio_jobs where id = _job_id for update;
  if not found then
    raise exception 'audio job not found';
  end if;

  if not public.can_manage_church_workspace(auth.uid(), v_job.church_id) then
    raise exception 'not authorized to register audio assets';
  end if;

  if v_job.status not in ('DRAFT', 'UPLOADING', 'draft', 'uploading') then
    raise exception 'audio job is not accepting upload assets';
  end if;

  if split_part(_storage_path, '/', 1) <> v_job.church_id::text or split_part(_storage_path, '/', 2) <> v_job.id::text then
    raise exception 'asset path does not match audio job ownership';
  end if;

  perform set_config('app.audio_trusted_context', 'client_job_control', true);
  update public.audio_jobs
  set status = 'UPLOADING',
      processing_stage = 'UPLOADING',
      progress = greatest(progress, 5)
  where id = v_job.id;

  insert into public.audio_assets (
    church_id, job_id, created_by, asset_type, storage_bucket, storage_path,
    public_url, content_type, file_name, file_size
  )
  values (
    v_job.church_id, v_job.id, auth.uid(), _asset_type, _storage_bucket, _storage_path,
    null, _content_type, _file_name, _file_size
  )
  returning * into v_asset;

  return v_asset;
end;
$$;

create or replace function public.enqueue_audio_job(_job_id uuid)
returns public.audio_jobs
language plpgsql
security definer
set search_path = public
as $$
declare
  v_job public.audio_jobs;
  v_audio_count integer;
  v_text_count integer;
begin
  select * into v_job from public.audio_jobs where id = _job_id for update;
  if not found then
    raise exception 'audio job not found';
  end if;

  if not public.can_manage_church_workspace(auth.uid(), v_job.church_id) then
    raise exception 'not authorized to queue audio job';
  end if;

  if v_job.status not in ('DRAFT', 'UPLOADING', 'VALIDATING', 'draft', 'uploading', 'validating') then
    raise exception 'audio job cannot be queued from this state';
  end if;

  perform set_config('app.audio_trusted_context', 'client_job_control', true);
  update public.audio_jobs
  set status = 'VALIDATING',
      processing_stage = 'VALIDATING',
      progress = greatest(progress, 15)
  where id = v_job.id;

  select count(*) into v_audio_count from public.audio_assets where job_id = v_job.id and asset_type = 'audio';
  select count(*) into v_text_count from public.audio_assets where job_id = v_job.id and asset_type = 'text';
  if v_audio_count = 0 or v_text_count = 0 then
    raise exception 'audio and text assets are required before queueing';
  end if;

  update public.audio_jobs
  set status = 'QUEUED',
      processing_stage = 'QUEUED',
      progress = 5,
      queued_at = now(),
      started_at = null,
      completed_at = null,
      error_message = null,
      audio_url = (select storage_path from public.audio_assets where job_id = v_job.id and asset_type = 'audio' order by created_at desc limit 1),
      text_url = (select storage_path from public.audio_assets where job_id = v_job.id and asset_type = 'text' order by created_at desc limit 1)
  where id = v_job.id
  returning * into v_job;

  return v_job;
end;
$$;

create or replace function public.retry_audio_job(_job_id uuid)
returns public.audio_jobs
language plpgsql
security definer
set search_path = public
as $$
declare
  v_job public.audio_jobs;
begin
  select * into v_job from public.audio_jobs where id = _job_id for update;
  if not found then
    raise exception 'audio job not found';
  end if;

  if not public.can_manage_church_workspace(auth.uid(), v_job.church_id) then
    raise exception 'not authorized to retry audio job';
  end if;

  if v_job.status not in ('FAILED', 'failed', 'CANCELLED', 'cancelled', 'REVIEW_REQUIRED', 'needs_review') then
    raise exception 'audio job cannot be retried from this state';
  end if;

  perform set_config('app.audio_trusted_context', 'client_job_control', true);
  update public.audio_jobs
  set status = 'QUEUED',
      processing_stage = 'QUEUED',
      progress = 5,
      queued_at = now(),
      started_at = null,
      completed_at = null,
      error_message = null
  where id = v_job.id
  returning * into v_job;

  return v_job;
end;
$$;

create or replace function public.cancel_audio_job(_job_id uuid)
returns public.audio_jobs
language plpgsql
security definer
set search_path = public
as $$
declare
  v_job public.audio_jobs;
begin
  select * into v_job from public.audio_jobs where id = _job_id for update;
  if not found then
    raise exception 'audio job not found';
  end if;

  if not public.can_manage_church_workspace(auth.uid(), v_job.church_id) then
    raise exception 'not authorized to cancel audio job';
  end if;

  if v_job.status not in ('QUEUED', 'VALIDATING', 'TRANSCRIBING', 'ALIGNING', 'BUILDING_INDEX', 'VALIDATING_INDEX', 'queued', 'processing') then
    raise exception 'audio job cannot be cancelled from this state';
  end if;

  perform set_config('app.audio_trusted_context', 'client_job_control', true);
  update public.audio_jobs
  set status = 'CANCELLED',
      processing_stage = 'CANCELLED',
      completed_at = now(),
      cancelled_at = now()
  where id = v_job.id
  returning * into v_job;

  return v_job;
end;
$$;

create or replace function public.worker_update_audio_job(
  _job_id uuid,
  _status text,
  _processing_stage text,
  _progress integer,
  _audio_url text default null,
  _text_url text default null,
  _index_url text default null,
  _report_url text default null,
  _manifest_url text default null,
  _error_message text default null
) returns public.audio_jobs
language plpgsql
security definer
set search_path = public
as $$
declare
  v_job public.audio_jobs;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'worker credentials required';
  end if;

  select * into v_job from public.audio_jobs where id = _job_id for update;
  if not found then
    raise exception 'audio job not found';
  end if;

  if _progress < 0 or _progress > 100 then
    raise exception 'invalid progress value';
  end if;

  perform set_config('app.audio_trusted_context', 'worker', true);
  update public.audio_jobs
  set status = _status,
      processing_stage = _processing_stage,
      progress = _progress,
      audio_url = coalesce(_audio_url, audio_url),
      text_url = coalesce(_text_url, text_url),
      index_url = coalesce(_index_url, index_url),
      report_url = coalesce(_report_url, report_url),
      manifest_url = coalesce(_manifest_url, manifest_url),
      error_message = _error_message,
      started_at = case when started_at is null and _status not in ('QUEUED', 'queued') then now() else started_at end,
      completed_at = case when _status in ('COMPLETED', 'FAILED', 'REVIEW_REQUIRED') then now() else completed_at end
  where id = v_job.id
  returning * into v_job;

  return v_job;
end;
$$;

create or replace function public.save_audio_verse_review(
  _job_id uuid,
  _review_id uuid,
  _verse_number integer,
  _verse_text text,
  _start_time numeric,
  _end_time numeric,
  _confidence numeric,
  _notes text default null
) returns public.audio_verse_reviews
language plpgsql
security definer
set search_path = public
as $$
declare
  v_job public.audio_jobs;
  v_previous jsonb := '{}'::jsonb;
  v_saved public.audio_verse_reviews;
begin
  select * into v_job from public.audio_jobs where id = _job_id;
  if not found then
    raise exception 'audio job not found';
  end if;

  if not public.has_audio_reviewer_role(auth.uid(), v_job.church_id) then
    raise exception 'audio reviewer role required';
  end if;

  select to_jsonb(avr) into v_previous
  from public.audio_verse_reviews avr
  where avr.job_id = _job_id and avr.verse_number = _verse_number;

  insert into public.audio_verse_reviews (
    church_id, job_id, review_id, verse_number, verse_text, start_time, end_time,
    duration, confidence, status, notes, manually_edited, created_by, updated_by
  )
  values (
    v_job.church_id, v_job.id, _review_id, _verse_number, coalesce(_verse_text, ''),
    _start_time, _end_time, greatest(0, _end_time - _start_time), _confidence, 'edited',
    _notes, true, auth.uid(), auth.uid()
  )
  on conflict (job_id, verse_number) do update
  set review_id = excluded.review_id,
      verse_text = excluded.verse_text,
      start_time = excluded.start_time,
      end_time = excluded.end_time,
      duration = excluded.duration,
      confidence = excluded.confidence,
      status = 'edited',
      notes = excluded.notes,
      manually_edited = true,
      updated_by = auth.uid()
  returning * into v_saved;

  insert into public.audio_review_audit (
    church_id, job_id, review_id, verse_review_id, reviewer_id, action, reason, previous_values, new_values
  )
  values (
    v_job.church_id, v_job.id, _review_id, v_saved.id, auth.uid(), 'verse_edited',
    coalesce(_notes, 'Verse timing edited.'), coalesce(v_previous, '{}'::jsonb), to_jsonb(v_saved)
  );

  return v_saved;
end;
$$;

create or replace function public.update_audio_review_decision(
  _review_id uuid,
  _status text,
  _reason text default null
) returns public.audio_reviews
language plpgsql
security definer
set search_path = public
as $$
declare
  v_review public.audio_reviews;
  v_previous jsonb;
begin
  select * into v_review from public.audio_reviews where id = _review_id for update;
  if not found then
    raise exception 'audio review not found';
  end if;

  if _status not in ('rejected', 'needs_reprocessing', 'changes_requested') then
    raise exception 'unsupported review decision';
  end if;

  if not public.has_audio_reviewer_role(auth.uid(), v_review.church_id) then
    raise exception 'audio reviewer role required';
  end if;

  v_previous := to_jsonb(v_review);
  update public.audio_reviews
  set status = _status,
      reviewer_id = auth.uid(),
      notes = _reason,
      completed_at = case when _status in ('rejected', 'needs_reprocessing') then now() else null end
  where id = _review_id
  returning * into v_review;

  insert into public.audio_review_audit (
    church_id, job_id, review_id, reviewer_id, action, reason, previous_values, new_values
  )
  values (
    v_review.church_id, v_review.job_id, v_review.id, auth.uid(), 'review_' || _status,
    _reason, v_previous, to_jsonb(v_review)
  );

  return v_review;
end;
$$;

create or replace function public.approve_audio_review(
  _review_id uuid,
  _reason text default null
) returns public.audio_versions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_review public.audio_reviews;
  v_job public.audio_jobs;
  v_previous_review jsonb;
  v_version public.audio_versions;
  v_next_version integer;
begin
  select * into v_review from public.audio_reviews where id = _review_id for update;
  if not found then
    raise exception 'audio review not found';
  end if;

  select * into v_job from public.audio_jobs where id = v_review.job_id for update;
  if not found then
    raise exception 'audio job not found';
  end if;

  if not public.has_audio_reviewer_role(auth.uid(), v_review.church_id) then
    raise exception 'audio reviewer role required';
  end if;

  if not exists (select 1 from public.audio_verse_reviews where job_id = v_job.id) then
    raise exception 'verse timing snapshot is required before approval';
  end if;

  v_previous_review := to_jsonb(v_review);
  select coalesce(max(version_number), 0) + 1 into v_next_version
  from public.audio_versions where job_id = v_job.id;

  perform set_config('app.audio_trusted_context', 'reviewer_action', true);

  update public.audio_reviews
  set status = 'approved',
      reviewer_id = auth.uid(),
      notes = _reason,
      completed_at = now()
  where id = v_review.id
  returning * into v_review;

  insert into public.audio_versions (
    church_id, job_id, created_by, version_number, status, processing_stage, progress,
    audio_url, text_url, index_url, report_url, manifest_url, started_at, completed_at,
    approved_at, approved_by
  )
  values (
    v_job.church_id, v_job.id, auth.uid(), v_next_version, 'approved', 'review_approved', 100,
    v_job.audio_url, v_job.text_url, v_job.index_url, v_job.report_url, v_job.manifest_url,
    v_job.started_at, now(), now(), auth.uid()
  )
  returning * into v_version;

  insert into public.audio_version_verses (
    church_id, version_id, job_id, verse_number, verse_text, start_time, end_time,
    duration, confidence, notes, manually_edited
  )
  select
    church_id, v_version.id, job_id, verse_number, verse_text, start_time, end_time,
    duration, confidence, notes, manually_edited
  from public.audio_verse_reviews
  where job_id = v_job.id
  order by verse_number;

  update public.audio_jobs
  set status = 'approved',
      processing_stage = 'approved',
      progress = 100,
      completed_at = now()
  where id = v_job.id;

  insert into public.audio_review_audit (
    church_id, job_id, review_id, reviewer_id, action, reason, previous_values, new_values
  )
  values (
    v_review.church_id, v_review.job_id, v_review.id, auth.uid(), 'review_approved',
    _reason, v_previous_review, jsonb_build_object('review', to_jsonb(v_review), 'version', to_jsonb(v_version))
  );

  if v_job.created_by is not null then
    insert into public.notifications (church_id, user_id, title, message, type)
    values (
      v_job.church_id, v_job.created_by, 'Audio review approved',
      v_job.book || ' ' || v_job.chapter || ' was approved and is waiting for publishing.',
      'success'
    );
  end if;

  return v_version;
end;
$$;

create or replace function public.publish_audio_version(_version_id uuid)
returns public.audio_versions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_version public.audio_versions;
begin
  select * into v_version from public.audio_versions where id = _version_id for update;
  if not found then
    raise exception 'audio version not found';
  end if;

  if not public.has_audio_publisher_role(auth.uid(), v_version.church_id) then
    raise exception 'audio publisher role required';
  end if;

  if v_version.status not in ('approved', 'published', 'active') then
    raise exception 'only approved audio versions can be published';
  end if;

  perform set_config('app.audio_trusted_context', 'publisher_action', true);

  update public.audio_versions
  set status = 'archived'
  where job_id = v_version.job_id and id <> v_version.id and status in ('published', 'active');

  update public.audio_versions
  set status = 'published',
      published_at = now(),
      published_by = auth.uid()
  where id = v_version.id
  returning * into v_version;

  update public.audio_jobs
  set status = 'published',
      published_at = now(),
      published_by = auth.uid()
  where id = v_version.job_id;

  insert into public.audio_review_audit (
    church_id, job_id, reviewer_id, action, reason, new_values
  )
  values (
    v_version.church_id, v_version.job_id, auth.uid(), 'version_published',
    'Audio version published for member playback.', to_jsonb(v_version)
  );

  return v_version;
end;
$$;

create or replace function public.unpublish_audio_version(_version_id uuid)
returns public.audio_versions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_version public.audio_versions;
begin
  select * into v_version from public.audio_versions where id = _version_id for update;
  if not found then
    raise exception 'audio version not found';
  end if;

  if not public.has_audio_publisher_role(auth.uid(), v_version.church_id) then
    raise exception 'audio publisher role required';
  end if;

  perform set_config('app.audio_trusted_context', 'publisher_action', true);
  update public.audio_versions
  set status = 'approved',
      published_at = null,
      published_by = null
  where id = v_version.id
  returning * into v_version;

  update public.audio_jobs
  set status = 'approved',
      published_at = null,
      published_by = null
  where id = v_version.job_id and status = 'published';

  return v_version;
end;
$$;

create or replace function public.archive_audio_version(_version_id uuid)
returns public.audio_versions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_version public.audio_versions;
begin
  select * into v_version from public.audio_versions where id = _version_id for update;
  if not found then
    raise exception 'audio version not found';
  end if;

  if not public.has_audio_publisher_role(auth.uid(), v_version.church_id) then
    raise exception 'audio publisher role required';
  end if;

  perform set_config('app.audio_trusted_context', 'publisher_action', true);
  update public.audio_versions
  set status = 'archived',
      published_at = null,
      published_by = null
  where id = v_version.id
  returning * into v_version;

  update public.audio_jobs
  set status = 'archived',
      published_at = null,
      published_by = null
  where id = v_version.job_id and status = 'published';

  return v_version;
end;
$$;

drop policy if exists "Church admins can manage audio jobs" on public.audio_jobs;
create policy "Church admins can create audio jobs"
on public.audio_jobs for insert to authenticated
with check (public.can_manage_church_workspace(auth.uid(), church_id));

drop policy if exists "Church admins can manage audio reviews" on public.audio_reviews;
create policy "Audio reviewers can manage reviews"
on public.audio_reviews for all to authenticated
using (public.has_audio_reviewer_role(auth.uid(), church_id))
with check (public.has_audio_reviewer_role(auth.uid(), church_id));

drop policy if exists "Church admins can manage audio verse reviews" on public.audio_verse_reviews;
create policy "Audio reviewers can manage verse reviews"
on public.audio_verse_reviews for all to authenticated
using (public.has_audio_reviewer_role(auth.uid(), church_id))
with check (public.has_audio_reviewer_role(auth.uid(), church_id));

drop policy if exists "Church admins can manage audio review audit" on public.audio_review_audit;
create policy "Audio reviewer actions can write review audit"
on public.audio_review_audit for insert to authenticated
with check (public.has_audio_reviewer_role(auth.uid(), church_id) or public.has_audio_publisher_role(auth.uid(), church_id));

drop policy if exists "Church admins can manage audio versions" on public.audio_versions;
create policy "Audio publishers can manage audio versions"
on public.audio_versions for all to authenticated
using (public.has_audio_publisher_role(auth.uid(), church_id))
with check (public.has_audio_publisher_role(auth.uid(), church_id));

drop policy if exists "Church admins can manage audio version verses" on public.audio_version_verses;
create policy "Audio publishers can manage version verses"
on public.audio_version_verses for all to authenticated
using (public.has_audio_publisher_role(auth.uid(), church_id))
with check (public.has_audio_publisher_role(auth.uid(), church_id));

drop policy if exists "Members can read published audio versions" on public.audio_versions;
drop policy if exists "Members can read published audio version verses" on public.audio_version_verses;

grant execute on function public.has_audio_reviewer_role(uuid, uuid) to authenticated;
grant execute on function public.has_audio_publisher_role(uuid, uuid) to authenticated;
grant execute on function public.is_active_church_member(uuid, uuid) to authenticated;
grant execute on function public.create_audio_job_draft(uuid, text, text, integer) to authenticated;
grant execute on function public.register_audio_asset(uuid, text, text, text, text, text, bigint) to authenticated;
grant execute on function public.enqueue_audio_job(uuid) to authenticated;
grant execute on function public.retry_audio_job(uuid) to authenticated;
grant execute on function public.cancel_audio_job(uuid) to authenticated;
grant execute on function public.save_audio_verse_review(uuid, uuid, integer, text, numeric, numeric, numeric, text) to authenticated;
grant execute on function public.update_audio_review_decision(uuid, text, text) to authenticated;
grant execute on function public.approve_audio_review(uuid, text) to authenticated;
grant execute on function public.publish_audio_version(uuid) to authenticated;
grant execute on function public.unpublish_audio_version(uuid) to authenticated;
grant execute on function public.archive_audio_version(uuid) to authenticated;
grant execute on function public.worker_update_audio_job(uuid, text, text, integer, text, text, text, text, text, text) to service_role;

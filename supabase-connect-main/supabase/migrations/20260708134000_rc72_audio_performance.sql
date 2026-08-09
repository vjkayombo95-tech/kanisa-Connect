-- RC-7.2 Audio performance optimization.
-- Read-only RPCs and indexes; no security role, worker, or lifecycle changes.

create index if not exists idx_audio_jobs_church_created_id
on public.audio_jobs (church_id, created_at desc, id desc);

create index if not exists idx_audio_jobs_church_status_created_id
on public.audio_jobs (church_id, status, created_at desc, id desc);

create index if not exists idx_audio_jobs_member_lookup
on public.audio_jobs (
  church_id,
  content_type,
  chapter,
  (regexp_replace(lower(coalesce(book, '')), '[^a-z0-9]', '', 'g')),
  created_at desc
);

create index if not exists idx_audio_versions_published_lookup
on public.audio_versions (church_id, job_id, status, published_at desc, version_number desc)
where status = 'published';

create index if not exists idx_audio_version_verses_version_verse
on public.audio_version_verses (version_id, verse_number);

create or replace function public.list_audio_jobs_page(
  _church_id uuid,
  _search text default null,
  _status text default null,
  _sort_asc boolean default false,
  _limit integer default 25,
  _offset integer default 0
) returns table (
  id uuid,
  church_id uuid,
  created_by uuid,
  content_type text,
  book text,
  chapter integer,
  status text,
  processing_stage text,
  progress integer,
  audio_url text,
  text_url text,
  index_url text,
  report_url text,
  manifest_url text,
  error_message text,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz,
  updated_at timestamptz,
  total_count bigint
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_limit integer := least(greatest(coalesce(_limit, 25), 1), 100);
  v_offset integer := greatest(coalesce(_offset, 0), 0);
  v_search text := nullif(btrim(coalesce(_search, '')), '');
  v_status text := nullif(btrim(coalesce(_status, '')), '');
begin
  if not public.can_view_church_workspace(auth.uid(), _church_id) then
    raise exception 'not authorized to view audio jobs';
  end if;

  return query
  with filtered as (
    select j.*
    from public.audio_jobs j
    where j.church_id = _church_id
      and (v_status is null or lower(v_status) = 'all' or j.status = v_status)
      and (
        v_search is null
        or j.book ilike '%' || v_search || '%'
        or j.content_type ilike '%' || v_search || '%'
        or j.chapter::text = v_search
      )
  ),
  counted as (
    select f.*, count(*) over() as total_count
    from filtered f
  )
  select
    c.id,
    c.church_id,
    c.created_by,
    c.content_type,
    c.book,
    c.chapter,
    c.status,
    c.processing_stage,
    c.progress,
    c.audio_url,
    c.text_url,
    c.index_url,
    c.report_url,
    c.manifest_url,
    c.error_message,
    c.started_at,
    c.completed_at,
    c.created_at,
    c.updated_at,
    c.total_count
  from counted c
  order by
    case when _sort_asc then c.created_at end asc,
    case when not _sort_asc then c.created_at end desc,
    c.id desc
  limit v_limit offset v_offset;
end;
$$;

create or replace function public.get_audio_dashboard_summary(
  _church_id uuid,
  _recent_limit integer default 6
) returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_recent_limit integer := least(greatest(coalesce(_recent_limit, 6), 1), 20);
  v_result jsonb;
begin
  if not public.can_view_church_workspace(auth.uid(), _church_id) then
    raise exception 'not authorized to view audio dashboard';
  end if;

  select jsonb_build_object(
    'processing', count(*) filter (where status in ('queued', 'processing', 'QUEUED', 'VALIDATING', 'TRANSCRIBING', 'ALIGNING', 'BUILDING_INDEX', 'VALIDATING_INDEX')),
    'completed', count(*) filter (where status in ('completed', 'COMPLETED')),
    'needsReview', count(*) filter (where status in ('needs_review', 'REVIEW_REQUIRED')),
    'published', count(*) filter (where status = 'published'),
    'failed', count(*) filter (where status in ('failed', 'FAILED')),
    'recentJobs', coalesce((
      select jsonb_agg(to_jsonb(r) order by r.created_at desc)
      from (
        select
          id,
          church_id,
          created_by,
          content_type,
          book,
          chapter,
          status,
          processing_stage,
          progress,
          audio_url,
          text_url,
          index_url,
          report_url,
          manifest_url,
          error_message,
          started_at,
          completed_at,
          created_at,
          updated_at
        from public.audio_jobs
        where church_id = _church_id
        order by created_at desc
        limit v_recent_limit
      ) r
    ), '[]'::jsonb)
  )
  into v_result
  from public.audio_jobs
  where church_id = _church_id;

  return coalesce(v_result, jsonb_build_object(
    'processing', 0,
    'completed', 0,
    'needsReview', 0,
    'published', 0,
    'failed', 0,
    'recentJobs', '[]'::jsonb
  ));
end;
$$;

create or replace function public.get_published_audio_lookup(
  _church_id uuid,
  _content_type text,
  _book_normalized text,
  _chapter integer
) returns table (
  job_id uuid,
  version_id uuid,
  version_number integer,
  audio_url text,
  published_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    j.id as job_id,
    v.id as version_id,
    v.version_number,
    v.audio_url,
    v.published_at
  from public.audio_jobs j
  join public.audio_versions v on v.job_id = j.id
  where j.church_id = _church_id
    and j.content_type = _content_type
    and j.chapter = _chapter
    and regexp_replace(lower(coalesce(j.book, '')), '[^a-z0-9]', '', 'g') = _book_normalized
    and v.church_id = _church_id
    and v.status = 'published'
    and v.audio_url is not null
  order by v.published_at desc nulls last, v.version_number desc
  limit 1;
$$;

grant execute on function public.list_audio_jobs_page(uuid, text, text, boolean, integer, integer) to authenticated;
grant execute on function public.get_audio_dashboard_summary(uuid, integer) to authenticated;
grant execute on function public.get_published_audio_lookup(uuid, text, text, integer) to service_role;

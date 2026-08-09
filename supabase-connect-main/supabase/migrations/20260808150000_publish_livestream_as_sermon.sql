-- Preserve the boundary between time-sensitive broadcasts and evergreen sermon
-- media while allowing an explicit, traceable, permission-checked conversion.

alter table public.church_livestreams
  add constraint church_livestreams_id_church_key unique (id, church_id);

alter table public.sermons
  add column source_livestream_id uuid,
  add constraint sermons_source_livestream_same_church_fkey
    foreign key (source_livestream_id, church_id)
    references public.church_livestreams (id, church_id)
    on delete restrict;

create unique index sermons_one_per_source_livestream_idx
  on public.sermons (source_livestream_id)
  where source_livestream_id is not null;

create or replace function public.publish_livestream_as_sermon(
  _livestream_id uuid,
  _title text,
  _preacher text default null,
  _sermon_date date default null,
  _content text default null
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_actor uuid := auth.uid();
  v_stream public.church_livestreams%rowtype;
  v_sermon_id uuid;
begin
  if v_actor is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  select * into v_stream
  from public.church_livestreams
  where id = _livestream_id
  for share;

  if not found then raise exception 'Livestream not found' using errcode = 'P0002'; end if;
  if v_stream.status <> 'ended' then
    raise exception 'Only an ended livestream can be published as a sermon' using errcode = '22023';
  end if;
  if nullif(trim(coalesce(v_stream.recording_url, '')), '') is null then
    raise exception 'A recording URL is required before publishing as a sermon' using errcode = '22023';
  end if;
  if nullif(trim(coalesce(_title, '')), '') is null then
    raise exception 'Sermon title is required' using errcode = '22023';
  end if;

  if not public.has_church_feature_permission(v_actor, v_stream.church_id, 'livestream', 'view')
     or not public.has_church_feature_permission(v_actor, v_stream.church_id, 'sermons', 'create')
     or not public.has_church_feature_permission(v_actor, v_stream.church_id, 'sermons', 'publish') then
    raise exception 'Livestream viewing and sermon create/publish permissions are required'
      using errcode = '42501';
  end if;

  if exists (select 1 from public.sermons where source_livestream_id = v_stream.id) then
    raise exception 'This livestream has already been published as a sermon'
      using errcode = '23505';
  end if;

  insert into public.sermons (
    church_id, title, preacher, date, content, video_url, created_by, source_livestream_id
  ) values (
    v_stream.church_id,
    trim(_title),
    nullif(trim(coalesce(_preacher, '')), ''),
    coalesce(_sermon_date, v_stream.actual_started_at::date, v_stream.scheduled_start::date, current_date),
    nullif(trim(coalesce(_content, '')), ''),
    v_stream.recording_url,
    v_actor,
    v_stream.id
  )
  returning id into v_sermon_id;

  perform public.create_audit_log(
    'livestream.published_as_sermon', 'sermon', v_sermon_id,
    'Ended livestream recording published as sermon',
    jsonb_build_object(
      'church_id', v_stream.church_id,
      'source_livestream_id', v_stream.id,
      'sermon_id', v_sermon_id
    )
  );

  return v_sermon_id;
exception
  when unique_violation then
    raise exception 'This livestream has already been published as a sermon'
      using errcode = '23505';
end;
$$;

revoke all on function public.publish_livestream_as_sermon(uuid,text,text,date,text)
  from public, anon, authenticated, service_role;
grant execute on function public.publish_livestream_as_sermon(uuid,text,text,date,text)
  to authenticated;

comment on column public.sermons.source_livestream_id is
  'Authoritative source broadcast for an explicitly converted recorded sermon.';
comment on function public.publish_livestream_as_sermon(uuid,text,text,date,text) is
  'Creates one sermon from an ended same-church livestream recording after independent livestream and sermon permission checks.';

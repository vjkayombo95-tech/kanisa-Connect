-- RC-AUDIO-01: Universal Audio Platform foundation.
-- Generic audio catalog and member playback state for Bible audio, readings,
-- homilies, prayers, saints, and future spoken content.

create table if not exists public.audio_content (
  id uuid primary key default gen_random_uuid(),
  church_id uuid not null references public.churches(id) on delete cascade,
  content_type text not null,
  title text not null,
  subtitle text,
  description text,
  language_code text not null default 'en',
  image_url text,
  source_table text,
  source_id uuid,
  external_ref text,
  metadata jsonb not null default '{}'::jsonb,
  visibility text not null default 'members' check (visibility in ('private', 'members', 'public')),
  status text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  published_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint audio_content_type_not_blank check (length(btrim(content_type)) > 0),
  constraint audio_content_title_not_blank check (length(btrim(title)) > 0)
);

create table if not exists public.audio_tracks (
  id uuid primary key default gen_random_uuid(),
  church_id uuid not null references public.churches(id) on delete cascade,
  content_id uuid not null references public.audio_content(id) on delete cascade,
  title text not null,
  subtitle text,
  track_number integer not null default 1 check (track_number > 0),
  duration_seconds numeric(12,3) check (duration_seconds is null or duration_seconds >= 0),
  storage_bucket text,
  storage_path text,
  stream_url text,
  mime_type text,
  file_size_bytes bigint check (file_size_bytes is null or file_size_bytes >= 0),
  transcript_path text,
  alignment_path text,
  index_path text,
  metadata jsonb not null default '{}'::jsonb,
  status text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  published_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint audio_tracks_title_not_blank check (length(btrim(title)) > 0),
  constraint audio_tracks_storage_or_stream check (storage_path is not null or stream_url is not null)
);

create table if not exists public.audio_progress (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  church_id uuid not null references public.churches(id) on delete cascade,
  content_id uuid not null references public.audio_content(id) on delete cascade,
  track_id uuid references public.audio_tracks(id) on delete cascade,
  position_seconds numeric(12,3) not null default 0 check (position_seconds >= 0),
  duration_seconds numeric(12,3) check (duration_seconds is null or duration_seconds >= 0),
  completed boolean not null default false,
  completed_at timestamptz,
  last_played_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, content_id, track_id)
);

create table if not exists public.audio_bookmarks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  church_id uuid not null references public.churches(id) on delete cascade,
  content_id uuid not null references public.audio_content(id) on delete cascade,
  track_id uuid references public.audio_tracks(id) on delete cascade,
  position_seconds numeric(12,3) not null check (position_seconds >= 0),
  label text,
  note text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.audio_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  church_id uuid not null references public.churches(id) on delete cascade,
  content_id uuid not null references public.audio_content(id) on delete cascade,
  track_id uuid references public.audio_tracks(id) on delete set null,
  event_type text not null check (event_type in ('play', 'pause', 'resume', 'seek', 'complete', 'error')),
  position_seconds numeric(12,3) not null default 0 check (position_seconds >= 0),
  duration_seconds numeric(12,3) check (duration_seconds is null or duration_seconds >= 0),
  session_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_audio_content_church_type_status
  on public.audio_content (church_id, content_type, status, published_at desc);
create index if not exists idx_audio_content_source
  on public.audio_content (source_table, source_id);
create unique index if not exists idx_audio_content_external_ref_unique
  on public.audio_content (church_id, external_ref)
  where external_ref is not null;
create index if not exists idx_audio_tracks_content_order
  on public.audio_tracks (content_id, track_number);
create index if not exists idx_audio_progress_user_content
  on public.audio_progress (user_id, content_id, updated_at desc);
create unique index if not exists idx_audio_progress_user_content_track_unique
  on public.audio_progress (user_id, content_id, coalesce(track_id, '00000000-0000-0000-0000-000000000000'::uuid));
create index if not exists idx_audio_bookmarks_user_content
  on public.audio_bookmarks (user_id, content_id, position_seconds);
create index if not exists idx_audio_history_user_created
  on public.audio_history (user_id, created_at desc);
create index if not exists idx_audio_history_content_created
  on public.audio_history (content_id, created_at desc);

drop trigger if exists update_audio_content_updated_at on public.audio_content;
create trigger update_audio_content_updated_at
before update on public.audio_content
for each row execute function public.update_updated_at_column();

drop trigger if exists update_audio_tracks_updated_at on public.audio_tracks;
create trigger update_audio_tracks_updated_at
before update on public.audio_tracks
for each row execute function public.update_updated_at_column();

drop trigger if exists update_audio_progress_updated_at on public.audio_progress;
create trigger update_audio_progress_updated_at
before update on public.audio_progress
for each row execute function public.update_updated_at_column();

drop trigger if exists update_audio_bookmarks_updated_at on public.audio_bookmarks;
create trigger update_audio_bookmarks_updated_at
before update on public.audio_bookmarks
for each row execute function public.update_updated_at_column();

create or replace function public.can_access_audio_content(_user_id uuid, _content_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.audio_content ac
    where ac.id = _content_id
      and (
        public.can_view_church_workspace(_user_id, ac.church_id)
        or (
          ac.status = 'published'
          and ac.visibility in ('members', 'public')
          and public.is_active_church_member(_user_id, ac.church_id)
        )
        or (
          ac.status = 'published'
          and ac.visibility = 'public'
        )
      )
  );
$$;

create or replace function public.audio_track_matches_content_church()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_church_id uuid;
begin
  select church_id into v_church_id from public.audio_content where id = new.content_id;
  if v_church_id is null then
    raise exception 'audio content not found';
  end if;
  if new.church_id <> v_church_id then
    raise exception 'audio track church_id must match content church_id';
  end if;
  return new;
end;
$$;

drop trigger if exists enforce_audio_track_content_church on public.audio_tracks;
create trigger enforce_audio_track_content_church
before insert or update on public.audio_tracks
for each row execute function public.audio_track_matches_content_church();

create or replace function public.audio_state_matches_content_church()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_church_id uuid;
begin
  select church_id into v_church_id from public.audio_content where id = new.content_id;
  if v_church_id is null then
    raise exception 'audio content not found';
  end if;
  if new.church_id <> v_church_id then
    raise exception 'audio state church_id must match content church_id';
  end if;
  if new.track_id is not null and not exists (
    select 1 from public.audio_tracks t
    where t.id = new.track_id
      and t.content_id = new.content_id
      and t.church_id = new.church_id
  ) then
    raise exception 'audio track must belong to the same content item';
  end if;
  return new;
end;
$$;

drop trigger if exists enforce_audio_progress_content_church on public.audio_progress;
create trigger enforce_audio_progress_content_church
before insert or update on public.audio_progress
for each row execute function public.audio_state_matches_content_church();

drop trigger if exists enforce_audio_bookmarks_content_church on public.audio_bookmarks;
create trigger enforce_audio_bookmarks_content_church
before insert or update on public.audio_bookmarks
for each row execute function public.audio_state_matches_content_church();

drop trigger if exists enforce_audio_history_content_church on public.audio_history;
create trigger enforce_audio_history_content_church
before insert or update on public.audio_history
for each row execute function public.audio_state_matches_content_church();

alter table public.audio_content enable row level security;
alter table public.audio_tracks enable row level security;
alter table public.audio_progress enable row level security;
alter table public.audio_bookmarks enable row level security;
alter table public.audio_history enable row level security;

drop policy if exists "Members can read published audio content" on public.audio_content;
create policy "Members can read published audio content"
on public.audio_content for select to authenticated
using (public.can_access_audio_content(auth.uid(), id));

drop policy if exists "Workspace managers can manage audio content" on public.audio_content;
create policy "Workspace managers can manage audio content"
on public.audio_content for all to authenticated
using (public.can_manage_church_workspace(auth.uid(), church_id))
with check (public.can_manage_church_workspace(auth.uid(), church_id));

drop policy if exists "Members can read published audio tracks" on public.audio_tracks;
create policy "Members can read published audio tracks"
on public.audio_tracks for select to authenticated
using (
  status = 'published'
  and exists (
    select 1 from public.audio_content ac
    where ac.id = audio_tracks.content_id
      and public.can_access_audio_content(auth.uid(), ac.id)
  )
);

drop policy if exists "Workspace managers can manage audio tracks" on public.audio_tracks;
create policy "Workspace managers can manage audio tracks"
on public.audio_tracks for all to authenticated
using (public.can_manage_church_workspace(auth.uid(), church_id))
with check (public.can_manage_church_workspace(auth.uid(), church_id));

drop policy if exists "Users can manage own audio progress" on public.audio_progress;
create policy "Users can manage own audio progress"
on public.audio_progress for all to authenticated
using (
  user_id = auth.uid()
  and public.can_access_audio_content(auth.uid(), content_id)
)
with check (
  user_id = auth.uid()
  and public.can_access_audio_content(auth.uid(), content_id)
);

drop policy if exists "Users can manage own audio bookmarks" on public.audio_bookmarks;
create policy "Users can manage own audio bookmarks"
on public.audio_bookmarks for all to authenticated
using (
  user_id = auth.uid()
  and public.can_access_audio_content(auth.uid(), content_id)
)
with check (
  user_id = auth.uid()
  and public.can_access_audio_content(auth.uid(), content_id)
);

drop policy if exists "Users can read own audio history" on public.audio_history;
create policy "Users can read own audio history"
on public.audio_history for select to authenticated
using (user_id = auth.uid());

drop policy if exists "Users can append own audio history" on public.audio_history;
create policy "Users can append own audio history"
on public.audio_history for insert to authenticated
with check (
  user_id = auth.uid()
  and public.can_access_audio_content(auth.uid(), content_id)
);

drop policy if exists "Workspace managers can read church audio history" on public.audio_history;
create policy "Workspace managers can read church audio history"
on public.audio_history for select to authenticated
using (public.can_manage_church_workspace(auth.uid(), church_id));

grant select on public.audio_content, public.audio_tracks to authenticated;
grant select, insert, update, delete on public.audio_progress, public.audio_bookmarks to authenticated;
grant select, insert on public.audio_history to authenticated;
grant execute on function public.can_access_audio_content(uuid, uuid) to authenticated;

-- Seed John 3 into the universal catalog from the first published Bible audio
-- version available in this environment. No row is inserted when no published
-- John 3 audio exists yet.
insert into public.audio_content (
  church_id,
  content_type,
  title,
  subtitle,
  description,
  language_code,
  source_table,
  source_id,
  external_ref,
  metadata,
  visibility,
  status,
  published_at,
  created_by
)
select
  av.church_id,
  'bible_chapter',
  'John 3',
  'Bible audio',
  'Seed universal audio content item for John chapter 3.',
  'sw',
  'audio_versions',
  av.id,
  'bible:JHN:3',
  jsonb_build_object(
    'book', aj.book,
    'chapter', aj.chapter,
    'content_family', 'bible',
    'seed', 'rc-audio-01'
  ),
  'members',
  'published',
  coalesce(av.published_at, now()),
  av.created_by
from public.audio_versions av
join public.audio_jobs aj on aj.id = av.job_id
where lower(aj.content_type) = 'bible'
  and (lower(aj.book) = 'john' or upper(aj.book) = 'JHN')
  and aj.chapter = 3
  and av.status = 'published'
  and av.published_at is not null
  and av.audio_url is not null
order by av.published_at desc
limit 1
on conflict do nothing;

insert into public.audio_tracks (
  church_id,
  content_id,
  title,
  subtitle,
  track_number,
  storage_bucket,
  storage_path,
  index_path,
  metadata,
  status,
  published_at,
  created_by
)
select
  ac.church_id,
  ac.id,
  ac.title,
  ac.subtitle,
  1,
  'audio',
  av.audio_url,
  av.index_url,
  jsonb_build_object(
    'source_version_id', av.id,
    'source_job_id', av.job_id,
    'seed', 'rc-audio-01'
  ),
  'published',
  ac.published_at,
  av.created_by
from public.audio_content ac
join public.audio_versions av on av.id = ac.source_id
where ac.external_ref = 'bible:JHN:3'
  and ac.source_table = 'audio_versions'
  and not exists (
    select 1 from public.audio_tracks t where t.content_id = ac.id
  );

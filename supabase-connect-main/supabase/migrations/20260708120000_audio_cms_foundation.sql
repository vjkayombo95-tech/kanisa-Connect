-- Audio CMS foundation for Church Admin workspace.

create table if not exists public.audio_jobs (
  id uuid primary key default gen_random_uuid(),
  church_id uuid not null references public.churches(id) on delete cascade,
  created_by uuid references auth.users(id) on delete set null,
  content_type text not null check (content_type in ('bible', 'readings', 'saints', 'catechism', 'homilies')),
  book text not null,
  chapter integer not null check (chapter > 0),
  status text not null default 'draft' check (status in ('draft', 'queued', 'processing', 'needs_review', 'completed', 'published', 'failed', 'cancelled')),
  processing_stage text not null default 'created',
  progress integer not null default 0 check (progress >= 0 and progress <= 100),
  audio_url text,
  text_url text,
  index_url text,
  report_url text,
  manifest_url text,
  error_message text,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (church_id, content_type, book, chapter, created_at)
);

create table if not exists public.audio_assets (
  id uuid primary key default gen_random_uuid(),
  church_id uuid not null references public.churches(id) on delete cascade,
  job_id uuid not null references public.audio_jobs(id) on delete cascade,
  created_by uuid references auth.users(id) on delete set null,
  asset_type text not null check (asset_type in ('audio', 'text', 'transcript', 'alignment', 'index', 'report', 'manifest')),
  storage_bucket text not null,
  storage_path text not null,
  public_url text,
  content_type text,
  file_name text,
  file_size bigint,
  checksum_sha256 text,
  status text not null default 'uploaded' check (status in ('uploaded', 'processing', 'ready', 'failed')),
  processing_stage text not null default 'uploaded',
  progress integer not null default 0 check (progress >= 0 and progress <= 100),
  audio_url text,
  text_url text,
  index_url text,
  report_url text,
  manifest_url text,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.audio_reviews (
  id uuid primary key default gen_random_uuid(),
  church_id uuid not null references public.churches(id) on delete cascade,
  job_id uuid not null references public.audio_jobs(id) on delete cascade,
  created_by uuid references auth.users(id) on delete set null,
  reviewer_id uuid references auth.users(id) on delete set null,
  status text not null default 'pending' check (status in ('pending', 'approved', 'changes_requested', 'rejected')),
  processing_stage text not null default 'review',
  progress integer not null default 0 check (progress >= 0 and progress <= 100),
  notes text,
  audio_url text,
  text_url text,
  index_url text,
  report_url text,
  manifest_url text,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.audio_versions (
  id uuid primary key default gen_random_uuid(),
  church_id uuid not null references public.churches(id) on delete cascade,
  job_id uuid not null references public.audio_jobs(id) on delete cascade,
  created_by uuid references auth.users(id) on delete set null,
  version_number integer not null default 1 check (version_number > 0),
  status text not null default 'draft' check (status in ('draft', 'active', 'archived', 'failed')),
  processing_stage text not null default 'versioned',
  progress integer not null default 0 check (progress >= 0 and progress <= 100),
  audio_url text,
  text_url text,
  index_url text,
  report_url text,
  manifest_url text,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (job_id, version_number)
);

create index if not exists idx_audio_jobs_church_status on public.audio_jobs (church_id, status);
create index if not exists idx_audio_jobs_church_content on public.audio_jobs (church_id, content_type, book, chapter);
create index if not exists idx_audio_jobs_created_at on public.audio_jobs (created_at desc);
create index if not exists idx_audio_assets_job on public.audio_assets (job_id, asset_type);
create index if not exists idx_audio_reviews_job on public.audio_reviews (job_id, status);
create index if not exists idx_audio_versions_job on public.audio_versions (job_id, version_number desc);

drop trigger if exists update_audio_jobs_updated_at on public.audio_jobs;
create trigger update_audio_jobs_updated_at
before update on public.audio_jobs
for each row execute function public.update_updated_at_column();

drop trigger if exists update_audio_assets_updated_at on public.audio_assets;
create trigger update_audio_assets_updated_at
before update on public.audio_assets
for each row execute function public.update_updated_at_column();

drop trigger if exists update_audio_reviews_updated_at on public.audio_reviews;
create trigger update_audio_reviews_updated_at
before update on public.audio_reviews
for each row execute function public.update_updated_at_column();

drop trigger if exists update_audio_versions_updated_at on public.audio_versions;
create trigger update_audio_versions_updated_at
before update on public.audio_versions
for each row execute function public.update_updated_at_column();

alter table public.audio_jobs enable row level security;
alter table public.audio_assets enable row level security;
alter table public.audio_reviews enable row level security;
alter table public.audio_versions enable row level security;

drop policy if exists "Church admins can read audio jobs" on public.audio_jobs;
create policy "Church admins can read audio jobs"
on public.audio_jobs for select to authenticated
using (public.can_view_church_workspace(auth.uid(), church_id));

drop policy if exists "Church admins can manage audio jobs" on public.audio_jobs;
create policy "Church admins can manage audio jobs"
on public.audio_jobs for all to authenticated
using (public.can_manage_church_workspace(auth.uid(), church_id))
with check (public.can_manage_church_workspace(auth.uid(), church_id));

drop policy if exists "Church admins can read audio assets" on public.audio_assets;
create policy "Church admins can read audio assets"
on public.audio_assets for select to authenticated
using (public.can_view_church_workspace(auth.uid(), church_id));

drop policy if exists "Church admins can manage audio assets" on public.audio_assets;
create policy "Church admins can manage audio assets"
on public.audio_assets for all to authenticated
using (public.can_manage_church_workspace(auth.uid(), church_id))
with check (public.can_manage_church_workspace(auth.uid(), church_id));

drop policy if exists "Church admins can read audio reviews" on public.audio_reviews;
create policy "Church admins can read audio reviews"
on public.audio_reviews for select to authenticated
using (public.can_view_church_workspace(auth.uid(), church_id));

drop policy if exists "Church admins can manage audio reviews" on public.audio_reviews;
create policy "Church admins can manage audio reviews"
on public.audio_reviews for all to authenticated
using (public.can_manage_church_workspace(auth.uid(), church_id))
with check (public.can_manage_church_workspace(auth.uid(), church_id));

drop policy if exists "Church admins can read audio versions" on public.audio_versions;
create policy "Church admins can read audio versions"
on public.audio_versions for select to authenticated
using (public.can_view_church_workspace(auth.uid(), church_id));

drop policy if exists "Church admins can manage audio versions" on public.audio_versions;
create policy "Church admins can manage audio versions"
on public.audio_versions for all to authenticated
using (public.can_manage_church_workspace(auth.uid(), church_id))
with check (public.can_manage_church_workspace(auth.uid(), church_id));

insert into storage.buckets (id, name, public)
values
  ('audio', 'audio', false),
  ('audio-reports', 'audio-reports', false),
  ('audio-indexes', 'audio-indexes', false),
  ('audio-transcripts', 'audio-transcripts', false),
  ('audio-alignments', 'audio-alignments', false)
on conflict (id) do update set public = false;

drop policy if exists "Church admins can read audio cms storage" on storage.objects;
create policy "Church admins can read audio cms storage"
on storage.objects for select to authenticated
using (
  bucket_id in ('audio', 'audio-reports', 'audio-indexes', 'audio-transcripts', 'audio-alignments')
  and exists (
    select 1
    from public.churches c
    where c.id::text = (storage.foldername(name))[1]
      and public.can_view_church_workspace(auth.uid(), c.id)
  )
);

drop policy if exists "Church admins can upload audio cms storage" on storage.objects;
create policy "Church admins can upload audio cms storage"
on storage.objects for insert to authenticated
with check (
  bucket_id in ('audio', 'audio-reports', 'audio-indexes', 'audio-transcripts', 'audio-alignments')
  and exists (
    select 1
    from public.churches c
    where c.id::text = (storage.foldername(name))[1]
      and public.can_manage_church_workspace(auth.uid(), c.id)
  )
);

drop policy if exists "Church admins can update audio cms storage" on storage.objects;
create policy "Church admins can update audio cms storage"
on storage.objects for update to authenticated
using (
  bucket_id in ('audio', 'audio-reports', 'audio-indexes', 'audio-transcripts', 'audio-alignments')
  and exists (
    select 1
    from public.churches c
    where c.id::text = (storage.foldername(name))[1]
      and public.can_manage_church_workspace(auth.uid(), c.id)
  )
)
with check (
  bucket_id in ('audio', 'audio-reports', 'audio-indexes', 'audio-transcripts', 'audio-alignments')
  and exists (
    select 1
    from public.churches c
    where c.id::text = (storage.foldername(name))[1]
      and public.can_manage_church_workspace(auth.uid(), c.id)
  )
);

grant select, insert, update, delete on public.audio_jobs to authenticated;
grant select, insert, update, delete on public.audio_assets to authenticated;
grant select, insert, update, delete on public.audio_reviews to authenticated;
grant select, insert, update, delete on public.audio_versions to authenticated;

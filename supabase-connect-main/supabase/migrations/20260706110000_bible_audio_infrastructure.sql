-- RC-3.0.0 - Bible Audio Infrastructure & ElevenLabs Integration
-- Adds dormant Bible Audio controls, explicit translation audio eligibility,
-- deterministic cache metadata, and a private storage bucket.

alter table public.bible_translations
  add column if not exists audio_generation_allowed boolean not null default false,
  add column if not exists audio_generation_notes text;

update public.bible_translations
set
  audio_generation_allowed = false,
  audio_generation_notes = coalesce(
    audio_generation_notes,
    'AI audio generation is disabled until documented audio narration and distribution rights are approved.'
  )
where code = 'sw-biblica';

insert into public.platform_features (key, name, description, globally_enabled, globally_locked)
values (
  'bible_audio',
  'Bible Audio',
  'AI-assisted Bible chapter narration, cache, and member playback controls.',
  false,
  false
)
on conflict (key) do update
set
  name = excluded.name,
  description = excluded.description,
  globally_enabled = false,
  updated_at = now();

create table if not exists public.bible_audio_assets (
  id uuid primary key default gen_random_uuid(),
  translation_id uuid not null references public.bible_translations(id) on delete restrict,
  book_id uuid not null references public.bible_books(id) on delete restrict,
  chapter_number integer not null check (chapter_number > 0),
  language_code text not null,
  voice_id text not null,
  audio_version text not null,
  cache_key text not null unique,
  storage_bucket text not null default 'bible-audio',
  storage_path text,
  provider text not null default 'elevenlabs',
  provider_model text not null default 'eleven_multilingual_v2',
  status text not null default 'pending'
    check (status in ('pending', 'generating', 'ready', 'failed')),
  duration_seconds numeric,
  byte_size bigint,
  content_hash text,
  error_message text,
  requested_by uuid,
  generation_started_at timestamptz,
  generated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (storage_bucket = 'bible-audio'),
  check (status <> 'ready' or storage_path is not null),
  unique (translation_id, book_id, chapter_number, language_code, voice_id, audio_version, provider_model)
);

create index if not exists idx_bible_audio_assets_lookup
  on public.bible_audio_assets (translation_id, book_id, chapter_number, language_code, voice_id, audio_version, provider_model);

create index if not exists idx_bible_audio_assets_status
  on public.bible_audio_assets (status);

alter table public.bible_audio_assets enable row level security;

drop policy if exists "Super admins can read bible audio assets" on public.bible_audio_assets;
create policy "Super admins can read bible audio assets"
on public.bible_audio_assets
for select
to authenticated
using (public.is_platform_super_admin(auth.uid()) or public.is_super_admin(auth.uid()));

drop policy if exists "Super admins can manage bible audio assets" on public.bible_audio_assets;
create policy "Super admins can manage bible audio assets"
on public.bible_audio_assets
for all
to authenticated
using (public.is_platform_super_admin(auth.uid()) or public.is_super_admin(auth.uid()))
with check (public.is_platform_super_admin(auth.uid()) or public.is_super_admin(auth.uid()));

insert into storage.buckets (id, name, public)
values ('bible-audio', 'bible-audio', false)
on conflict (id) do update
set public = false;

drop policy if exists "Super admins can read bible audio storage" on storage.objects;
create policy "Super admins can read bible audio storage"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'bible-audio'
  and (public.is_platform_super_admin(auth.uid()) or public.is_super_admin(auth.uid()))
);

grant select on public.bible_audio_assets to authenticated;

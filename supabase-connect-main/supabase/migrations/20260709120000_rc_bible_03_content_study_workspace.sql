-- RC-BIBLE-03: generic personal study workspace tables.
-- These tables are intentionally content-agnostic. Bible verses, daily readings,
-- prayers, saints, homilies, catechism passages, and future segmentable content
-- all address rows through content_type/content_id/segment_id.

create table if not exists public.content_bookmarks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  church_id uuid references public.churches(id) on delete set null,
  content_type text not null,
  content_id text not null,
  segment_id text,
  label text,
  reference text,
  excerpt text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.content_highlights (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  church_id uuid references public.churches(id) on delete set null,
  content_type text not null,
  content_id text not null,
  segment_id text,
  color text not null default 'yellow' check (color in ('yellow', 'green', 'blue', 'purple', 'pink', 'orange')),
  reference text,
  excerpt text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.content_notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  church_id uuid references public.churches(id) on delete set null,
  content_type text not null,
  content_id text not null,
  segment_id text,
  title text,
  body text not null,
  body_format text not null default 'plain' check (body_format in ('plain', 'markdown', 'rich_text')),
  reference text,
  excerpt text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.content_favorites (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  church_id uuid references public.churches(id) on delete set null,
  content_type text not null,
  content_id text not null,
  segment_id text,
  label text,
  reference text,
  excerpt text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists content_bookmarks_unique_target_idx
  on public.content_bookmarks (user_id, content_type, content_id, coalesce(segment_id, ''));
create unique index if not exists content_highlights_unique_target_idx
  on public.content_highlights (user_id, content_type, content_id, coalesce(segment_id, ''));
create unique index if not exists content_favorites_unique_target_idx
  on public.content_favorites (user_id, content_type, content_id, coalesce(segment_id, ''));

create index if not exists content_bookmarks_lookup_idx on public.content_bookmarks (user_id, content_type, content_id);
create index if not exists content_highlights_lookup_idx on public.content_highlights (user_id, content_type, content_id);
create index if not exists content_notes_lookup_idx on public.content_notes (user_id, content_type, content_id);
create index if not exists content_favorites_lookup_idx on public.content_favorites (user_id, content_type, content_id);
create index if not exists content_notes_search_idx on public.content_notes using gin (to_tsvector('simple', coalesce(title, '') || ' ' || body));
create index if not exists content_study_metadata_idx on public.content_notes using gin (metadata);

alter table public.content_bookmarks enable row level security;
alter table public.content_highlights enable row level security;
alter table public.content_notes enable row level security;
alter table public.content_favorites enable row level security;

drop policy if exists "Users manage own content bookmarks" on public.content_bookmarks;
create policy "Users manage own content bookmarks"
  on public.content_bookmarks for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users manage own content highlights" on public.content_highlights;
create policy "Users manage own content highlights"
  on public.content_highlights for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users manage own content notes" on public.content_notes;
create policy "Users manage own content notes"
  on public.content_notes for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users manage own content favorites" on public.content_favorites;
create policy "Users manage own content favorites"
  on public.content_favorites for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop trigger if exists set_content_bookmarks_updated_at on public.content_bookmarks;
create trigger set_content_bookmarks_updated_at
  before update on public.content_bookmarks
  for each row execute function public.update_updated_at_column();

drop trigger if exists set_content_highlights_updated_at on public.content_highlights;
create trigger set_content_highlights_updated_at
  before update on public.content_highlights
  for each row execute function public.update_updated_at_column();

drop trigger if exists set_content_notes_updated_at on public.content_notes;
create trigger set_content_notes_updated_at
  before update on public.content_notes
  for each row execute function public.update_updated_at_column();

drop trigger if exists set_content_favorites_updated_at on public.content_favorites;
create trigger set_content_favorites_updated_at
  before update on public.content_favorites
  for each row execute function public.update_updated_at_column();

grant select, insert, update, delete on public.content_bookmarks to authenticated;
grant select, insert, update, delete on public.content_highlights to authenticated;
grant select, insert, update, delete on public.content_notes to authenticated;
grant select, insert, update, delete on public.content_favorites to authenticated;

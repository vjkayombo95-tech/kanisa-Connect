alter table public.bible_verses
  add column if not exists archived_at timestamptz;

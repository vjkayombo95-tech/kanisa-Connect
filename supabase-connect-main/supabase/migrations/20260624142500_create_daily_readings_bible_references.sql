-- Phase 10.5.1 - Daily Readings Bible References
-- Keeps the existing text-based daily readings shape while adding structured
-- Bible passage references for future reader integration.

create table if not exists public.daily_readings (
  id uuid primary key default gen_random_uuid(),
  reading_date date not null unique,
  liturgical_season text,
  first_reading text,
  psalm text,
  second_reading text,
  gospel text,
  reflection text,
  prayer text,
  is_published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.daily_reading_passages (
  id uuid primary key default gen_random_uuid(),
  daily_reading_id uuid not null references public.daily_readings(id) on delete cascade,
  reading_kind text not null check (reading_kind in ('first', 'psalm', 'second', 'gospel')),
  title text,
  reference text,
  text text,
  book_id uuid references public.bible_books(id) on delete restrict,
  chapter_start integer check (chapter_start is null or chapter_start > 0),
  verse_start integer check (verse_start is null or verse_start > 0),
  chapter_end integer check (chapter_end is null or chapter_end > 0),
  verse_end integer check (verse_end is null or verse_end > 0),
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (daily_reading_id, reading_kind)
);

create index if not exists idx_daily_readings_reading_date
  on public.daily_readings (reading_date);

create index if not exists idx_daily_reading_passages_daily_reading_id
  on public.daily_reading_passages (daily_reading_id);

create index if not exists idx_daily_reading_passages_book_reference
  on public.daily_reading_passages (book_id, chapter_start, verse_start, chapter_end, verse_end);

alter table public.daily_readings enable row level security;
alter table public.daily_reading_passages enable row level security;

drop policy if exists "Authenticated users view published daily readings" on public.daily_readings;
create policy "Authenticated users view published daily readings"
on public.daily_readings
for select
to authenticated
using (is_published = true);

drop policy if exists "Authenticated users view published daily reading passages" on public.daily_reading_passages;
create policy "Authenticated users view published daily reading passages"
on public.daily_reading_passages
for select
to authenticated
using (
  exists (
    select 1
    from public.daily_readings dr
    where dr.id = daily_reading_passages.daily_reading_id
      and dr.is_published = true
  )
);

grant select on public.daily_readings to authenticated;
grant select on public.daily_reading_passages to authenticated;

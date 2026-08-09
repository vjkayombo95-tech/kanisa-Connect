-- Phase 10.1 - Bible Foundation
-- Creates normalized Bible content tables and upgrades the existing legacy
-- bible_verses table in place for forward-compatible imports.

create extension if not exists pg_trgm with schema extensions;

create table if not exists public.bible_translations (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  language_code text not null default 'en',
  description text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.bible_books (
  id uuid primary key default gen_random_uuid(),
  translation_id uuid not null references public.bible_translations(id) on delete cascade,
  book_number integer not null check (book_number > 0),
  name text not null,
  abbreviation text,
  testament text not null check (testament in ('old', 'new', 'deuterocanonical')),
  created_at timestamptz not null default now(),
  unique (translation_id, book_number),
  unique (translation_id, name)
);

create table if not exists public.bible_chapters (
  id uuid primary key default gen_random_uuid(),
  translation_id uuid not null references public.bible_translations(id) on delete cascade,
  book_id uuid not null references public.bible_books(id) on delete cascade,
  chapter_number integer not null check (chapter_number > 0),
  created_at timestamptz not null default now(),
  unique (book_id, chapter_number)
);

create table if not exists public.bible_verses (
  id uuid primary key default gen_random_uuid(),
  translation_id uuid references public.bible_translations(id) on delete cascade,
  book_id uuid references public.bible_books(id) on delete cascade,
  chapter_id uuid references public.bible_chapters(id) on delete cascade,
  chapter_number integer check (chapter_number > 0),
  verse_number integer check (verse_number > 0),
  verse_text text not null,
  created_at timestamptz not null default now()
);

alter table public.bible_verses
  add column if not exists translation_id uuid references public.bible_translations(id) on delete cascade,
  add column if not exists book_id uuid references public.bible_books(id) on delete cascade,
  add column if not exists chapter_id uuid references public.bible_chapters(id) on delete cascade,
  add column if not exists chapter_number integer,
  add column if not exists verse_number integer;

create unique index if not exists bible_chapters_id_book_id_key
  on public.bible_chapters (id, book_id);

do $$
begin
  if not exists (
    select 1
    from information_schema.table_constraints
    where constraint_schema = 'public'
      and table_name = 'bible_verses'
      and constraint_name = 'bible_verses_chapter_number_positive'
  ) then
    alter table public.bible_verses
      add constraint bible_verses_chapter_number_positive
      check (chapter_number is null or chapter_number > 0);
  end if;

  if not exists (
    select 1
    from information_schema.table_constraints
    where constraint_schema = 'public'
      and table_name = 'bible_verses'
      and constraint_name = 'bible_verses_verse_number_positive'
  ) then
    alter table public.bible_verses
      add constraint bible_verses_verse_number_positive
      check (verse_number is null or verse_number > 0);
  end if;

  if not exists (
    select 1
    from information_schema.table_constraints
    where constraint_schema = 'public'
      and table_name = 'bible_verses'
      and constraint_name = 'bible_verses_chapter_fk_matches_book'
  ) then
    alter table public.bible_verses
      add constraint bible_verses_chapter_fk_matches_book
      foreign key (chapter_id, book_id)
      references public.bible_chapters(id, book_id)
      not valid;
  end if;
end $$;

create unique index if not exists bible_verses_unique_reference
  on public.bible_verses (translation_id, book_id, chapter_number, verse_number)
  where translation_id is not null
    and book_id is not null
    and chapter_number is not null
    and verse_number is not null;

create index if not exists idx_bible_translations_code
  on public.bible_translations (code);

create index if not exists idx_bible_books_translation_id
  on public.bible_books (translation_id);

create index if not exists idx_bible_books_book_number
  on public.bible_books (translation_id, book_number);

create index if not exists idx_bible_chapters_translation_id
  on public.bible_chapters (translation_id);

create index if not exists idx_bible_chapters_book_id
  on public.bible_chapters (book_id);

create index if not exists idx_bible_chapters_chapter_number
  on public.bible_chapters (book_id, chapter_number);

create index if not exists idx_bible_verses_translation_id
  on public.bible_verses (translation_id);

create index if not exists idx_bible_verses_book_id
  on public.bible_verses (book_id);

create index if not exists idx_bible_verses_chapter_id
  on public.bible_verses (chapter_id);

create index if not exists idx_bible_verses_chapter_number
  on public.bible_verses (chapter_id, chapter_number);

create index if not exists idx_bible_verses_verse_number
  on public.bible_verses (chapter_id, verse_number);

create index if not exists idx_bible_verses_reference_lookup
  on public.bible_verses (translation_id, book_id, chapter_number, verse_number);

do $$
declare
  v_has_legacy_text boolean := false;
  v_has_legacy_reference boolean := false;
  v_expression text := 'coalesce(verse_text, '''')';
begin
  select exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'bible_verses'
      and column_name = 'text'
  )
  into v_has_legacy_text;

  select exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'bible_verses'
      and column_name = 'reference'
  )
  into v_has_legacy_reference;

  if v_has_legacy_text then
    v_expression := v_expression || ' || '' '' || coalesce(text, '''')';
  end if;

  if v_has_legacy_reference then
    v_expression := v_expression || ' || '' '' || coalesce(reference, '''')';
  end if;

  execute format(
    'create index if not exists idx_bible_verses_fts on public.bible_verses using gin (to_tsvector(''simple'', %s))',
    v_expression
  );
end $$;

create index if not exists idx_bible_verses_text_trgm
  on public.bible_verses
  using gin (verse_text extensions.gin_trgm_ops);

alter table public.bible_translations enable row level security;
alter table public.bible_books enable row level security;
alter table public.bible_chapters enable row level security;
alter table public.bible_verses enable row level security;

drop policy if exists "Security hardening: users view global or church bible verses" on public.bible_verses;
drop policy if exists "Security hardening: managers manage church bible verses" on public.bible_verses;

drop policy if exists "Authenticated users can read bible translations" on public.bible_translations;
create policy "Authenticated users can read bible translations"
on public.bible_translations
for select
to authenticated
using (true);

drop policy if exists "Super admins can manage bible translations" on public.bible_translations;
create policy "Super admins can manage bible translations"
on public.bible_translations
for all
to authenticated
using (public.is_super_admin())
with check (public.is_super_admin());

drop policy if exists "Authenticated users can read bible books" on public.bible_books;
create policy "Authenticated users can read bible books"
on public.bible_books
for select
to authenticated
using (true);

drop policy if exists "Super admins can manage bible books" on public.bible_books;
create policy "Super admins can manage bible books"
on public.bible_books
for all
to authenticated
using (public.is_super_admin())
with check (public.is_super_admin());

drop policy if exists "Authenticated users can read bible chapters" on public.bible_chapters;
create policy "Authenticated users can read bible chapters"
on public.bible_chapters
for select
to authenticated
using (true);

drop policy if exists "Super admins can manage bible chapters" on public.bible_chapters;
create policy "Super admins can manage bible chapters"
on public.bible_chapters
for all
to authenticated
using (public.is_super_admin())
with check (public.is_super_admin());

drop policy if exists "Authenticated users can read bible verses" on public.bible_verses;
create policy "Authenticated users can read bible verses"
on public.bible_verses
for select
to authenticated
using (true);

drop policy if exists "Super admins can manage bible verses" on public.bible_verses;
create policy "Super admins can manage bible verses"
on public.bible_verses
for all
to authenticated
using (public.is_super_admin())
with check (public.is_super_admin());

grant select on public.bible_translations to authenticated;
grant select on public.bible_books to authenticated;
grant select on public.bible_chapters to authenticated;
grant select on public.bible_verses to authenticated;

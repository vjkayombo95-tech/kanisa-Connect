-- RC-3.1 - Bible translation attribution metadata

alter table public.bible_translations
  add column if not exists canon text,
  add column if not exists license_name text,
  add column if not exists license_url text,
  add column if not exists source text,
  add column if not exists publisher text,
  add column if not exists copyright text,
  add column if not exists attribution text,
  add column if not exists canon_type text,
  add column if not exists copyright_notice text,
  add column if not exists source_url text,
  add column if not exists attribution_text text,
  add column if not exists ai_processing_allowed boolean not null default false,
  add column if not exists active boolean not null default true,
  add column if not exists default_translation boolean not null default false;

update public.bible_translations
set
  canon_type = coalesce(canon_type, canon),
  copyright_notice = coalesce(copyright_notice, copyright),
  source_url = coalesce(source_url, source),
  attribution_text = coalesce(attribution_text, attribution),
  active = coalesce(active, is_active, true);

update public.bible_translations
set
  audio_generation_allowed = true,
  ai_processing_allowed = true,
  default_translation = true
where code = 'sw-open-bible';

create or replace view public.bible_translation_metadata as
select
  t.id,
  t.code,
  t.name,
  t.language_code,
  coalesce(t.canon_type, t.canon) as canon_type,
  t.publisher,
  coalesce(t.copyright_notice, t.copyright) as copyright_notice,
  coalesce(t.source_url, t.source) as source_url,
  t.license_name,
  t.license_url,
  coalesce(t.attribution_text, t.attribution) as attribution_text,
  t.audio_generation_allowed,
  t.ai_processing_allowed,
  coalesce(t.active, t.is_active) as active,
  t.default_translation,
  t.created_at,
  coalesce(book_counts.book_count, 0)::integer as book_count,
  coalesce(chapter_counts.chapter_count, 0)::integer as chapter_count,
  coalesce(verse_counts.verse_count, 0)::integer as verse_count
from public.bible_translations t
left join (
  select translation_id, count(*) as book_count
  from public.bible_books
  group by translation_id
) book_counts on book_counts.translation_id = t.id
left join (
  select translation_id, count(*) as chapter_count
  from public.bible_chapters
  group by translation_id
) chapter_counts on chapter_counts.translation_id = t.id
left join (
  select translation_id, count(*) as verse_count
  from public.bible_verses
  group by translation_id
) verse_counts on verse_counts.translation_id = t.id;

grant select on public.bible_translation_metadata to anon, authenticated;

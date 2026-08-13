-- The production-backup rehearsal found no existing Bible verse violations.
-- Validation is forward-only and does not rewrite the underlying table data.

alter table public.bible_verses
  validate constraint bible_verses_chapter_fk_matches_book;

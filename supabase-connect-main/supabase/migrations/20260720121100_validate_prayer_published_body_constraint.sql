-- Keep this migration in the same release as
-- 20260718120000_expand_catholic_prayer_library.sql, which creates the
-- constraint. The production-backup rehearsal found no existing violations.

alter table public.content_prayers
  validate constraint content_prayers_published_body_check;

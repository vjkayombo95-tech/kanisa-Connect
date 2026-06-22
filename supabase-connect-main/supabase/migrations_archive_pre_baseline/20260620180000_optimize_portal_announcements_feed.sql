-- Speed up the member portal announcements feed.
-- The portal only needs published, non-archived announcements for one church.

create index if not exists idx_announcements_portal_feed
  on public.announcements(church_id, is_published, created_at desc)
  where archived_at is null;

ALTER TABLE public.announcements
  ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;

ALTER TABLE public.sermons
  ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;

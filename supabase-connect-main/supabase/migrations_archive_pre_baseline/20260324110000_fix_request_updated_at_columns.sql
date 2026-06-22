-- Ensure request tables have updated_at because shared update triggers depend on it.
ALTER TABLE public.prayer_requests
ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

ALTER TABLE public.mass_intentions
ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

ALTER TABLE public.community_help_requests
ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

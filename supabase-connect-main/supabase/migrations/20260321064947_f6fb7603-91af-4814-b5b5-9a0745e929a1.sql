
-- Add globally_enabled and globally_locked to platform_features
ALTER TABLE public.platform_features
  ADD COLUMN IF NOT EXISTS globally_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS globally_locked boolean NOT NULL DEFAULT false;

-- Seed default features if not already present
INSERT INTO public.platform_features (key, name, description, is_global, globally_enabled, globally_locked) VALUES
  ('members', 'Members', 'Member management', true, true, false),
  ('contributions', 'Contributions', 'Giving and tithes', true, true, false),
  ('events', 'Events', 'Event management', true, true, false),
  ('communities', 'Communities', 'Jumuiya groups', true, true, false),
  ('ministries', 'Ministries', 'Church groups', true, true, false),
  ('families', 'Families', 'Family records', true, true, false),
  ('announcements', 'Announcements', 'Church announcements', true, true, false),
  ('sermons', 'Sermons', 'Sermon archive', true, true, false),
  ('bible_verses', 'Bible Verses', 'Daily verses', true, true, false),
  ('prayer_requests', 'Prayer Requests', 'Prayer submissions', true, true, false),
  ('mass_intentions', 'Mass Intentions', 'Mass intention requests', true, true, false),
  ('community_help', 'Community Help', 'Help requests', true, true, false),
  ('qr_giving', 'QR Giving', 'QR code donations', true, true, false),
  ('reports', 'Reports', 'Analytics reports', true, true, false),
  ('data_import', 'Data Import', 'Bulk data import', true, true, false),
  ('ai_copilot', 'AI Copilot', 'AI-powered assistant', true, true, false)
ON CONFLICT DO NOTHING;

-- Create church_features table for per-church overrides
CREATE TABLE IF NOT EXISTS public.church_features (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  church_id uuid NOT NULL REFERENCES public.churches(id) ON DELETE CASCADE,
  feature_id uuid NOT NULL REFERENCES public.platform_features(id) ON DELETE CASCADE,
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(church_id, feature_id)
);

ALTER TABLE public.church_features ENABLE ROW LEVEL SECURITY;

-- Super admins can do everything
CREATE POLICY "Super admins manage church features"
  ON public.church_features FOR ALL
  USING (is_super_admin(auth.uid()));

-- Church admins can view their own church features
CREATE POLICY "Church admins can view own church features"
  ON public.church_features FOR SELECT
  USING (is_church_admin(auth.uid(), church_id));

-- Anyone can view church features for their church
CREATE POLICY "Church members can view church features"
  ON public.church_features FOR SELECT
  USING (is_church_member(auth.uid(), church_id));

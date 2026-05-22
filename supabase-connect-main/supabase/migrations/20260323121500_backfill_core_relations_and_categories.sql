-- Backfill compatibility for older projects without changing the current app schema.

ALTER TABLE public.families
  ADD COLUMN IF NOT EXISTS church_id uuid REFERENCES public.churches(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_families_church ON public.families(church_id);

CREATE TABLE IF NOT EXISTS public.community_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  community_id uuid NOT NULL REFERENCES public.communities(id) ON DELETE CASCADE,
  member_id uuid NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  joined_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_community_members_unique
  ON public.community_members(community_id, member_id);

CREATE TABLE IF NOT EXISTS public.ministry_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ministry_id uuid NOT NULL REFERENCES public.ministries(id) ON DELETE CASCADE,
  member_id uuid NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  joined_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_ministry_members_unique
  ON public.ministry_members(ministry_id, member_id);

CREATE TABLE IF NOT EXISTS public.contribution_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  church_id uuid NOT NULL REFERENCES public.churches(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  is_special boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_contribution_categories_church
  ON public.contribution_categories(church_id);

INSERT INTO public.contribution_categories (church_id, name, description, is_special)
SELECT
  churches.id,
  categories.name,
  categories.description,
  categories.is_special
FROM public.churches
CROSS JOIN (
  VALUES
    ('Tithe', 'Regular tithe', false),
    ('Offering', 'General offering', false),
    ('Building Fund', 'Church building fund', true),
    ('Donations', 'General donations', false)
) AS categories(name, description, is_special)
WHERE NOT EXISTS (
  SELECT 1
  FROM public.contribution_categories existing
  WHERE existing.church_id = churches.id
    AND lower(existing.name) = lower(categories.name)
);

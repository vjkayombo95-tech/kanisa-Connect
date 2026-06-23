-- Restore the church-scoped contribution category contract expected by the app.
-- Legacy rows are retained; newly created and default rows are always church scoped.

ALTER TABLE public.contribution_categories
  ADD COLUMN IF NOT EXISTS church_id uuid REFERENCES public.churches(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS is_special boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();

-- The frozen baseline used a global unique name constraint. Categories now belong
-- to a church, so different churches may each have Tithe, Offering, and so on.
ALTER TABLE public.contribution_categories
  DROP CONSTRAINT IF EXISTS contribution_categories_name_key;

CREATE INDEX IF NOT EXISTS idx_contribution_categories_church_id
  ON public.contribution_categories (church_id);

-- Create the standard categories for every existing church without replacing
-- existing church-specific records. Legacy rows with no church_id are preserved
-- unchanged and are not exposed by the tenant-scoped policies below.
INSERT INTO public.contribution_categories (church_id, name, description, is_special)
SELECT
  c.id,
  defaults.name,
  defaults.description,
  defaults.is_special
FROM public.churches c
CROSS JOIN (
  VALUES
    ('Tithe'::text, 'Regular tithe'::text, false),
    ('Offering'::text, 'General offering'::text, false),
    ('Building Fund'::text, 'Church building fund'::text, true),
    ('Donations'::text, 'General donations'::text, false)
) AS defaults(name, description, is_special)
WHERE NOT EXISTS (
  SELECT 1
  FROM public.contribution_categories existing
  WHERE existing.church_id = c.id
    AND existing.name = defaults.name
);

ALTER TABLE public.contribution_categories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "read categories safe" ON public.contribution_categories;
DROP POLICY IF EXISTS "Church members can view categories" ON public.contribution_categories;
DROP POLICY IF EXISTS "Church admins can manage categories" ON public.contribution_categories;

CREATE POLICY "Church users can read contribution categories"
ON public.contribution_categories
FOR SELECT
TO authenticated
USING (public.can_view_church_workspace(auth.uid(), church_id));

CREATE POLICY "Church managers can manage contribution categories"
ON public.contribution_categories
FOR ALL
TO authenticated
USING (public.can_manage_church_workspace(auth.uid(), church_id))
WITH CHECK (public.can_manage_church_workspace(auth.uid(), church_id));

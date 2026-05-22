-- Ensure community help interaction tables exist in production.

CREATE TABLE IF NOT EXISTS public.help_donations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  help_request_id uuid NOT NULL REFERENCES public.community_help_requests(id) ON DELETE CASCADE,
  donor_name text NOT NULL,
  amount numeric(12,2) NOT NULL,
  is_anonymous boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.help_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  help_request_id uuid NOT NULL REFERENCES public.community_help_requests(id) ON DELETE CASCADE,
  member_id uuid REFERENCES public.members(id) ON DELETE SET NULL,
  author_name text NOT NULL,
  comment text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.help_donations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.help_comments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "View help donations" ON public.help_donations;
DROP POLICY IF EXISTS "Create help donations" ON public.help_donations;
DROP POLICY IF EXISTS "View help comments" ON public.help_comments;
DROP POLICY IF EXISTS "Create help comments" ON public.help_comments;
DROP POLICY IF EXISTS "Delete own help comments" ON public.help_comments;

CREATE POLICY "View help donations"
ON public.help_donations
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.community_help_requests h
    WHERE h.id = help_donations.help_request_id
      AND h.church_id IN (
        SELECT ur.church_id
        FROM public.user_roles ur
        WHERE ur.user_id = auth.uid()
      )
  )
);

CREATE POLICY "Create help donations"
ON public.help_donations
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.community_help_requests h
    WHERE h.id = help_donations.help_request_id
      AND h.status = 'approved'
      AND h.church_id IN (
        SELECT ur.church_id
        FROM public.user_roles ur
        WHERE ur.user_id = auth.uid()
      )
  )
);

CREATE POLICY "View help comments"
ON public.help_comments
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.community_help_requests h
    WHERE h.id = help_comments.help_request_id
      AND h.church_id IN (
        SELECT ur.church_id
        FROM public.user_roles ur
        WHERE ur.user_id = auth.uid()
      )
  )
);

CREATE POLICY "Create help comments"
ON public.help_comments
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.community_help_requests h
    WHERE h.id = help_comments.help_request_id
      AND h.church_id IN (
        SELECT ur.church_id
        FROM public.user_roles ur
        WHERE ur.user_id = auth.uid()
      )
  )
);

CREATE POLICY "Delete own help comments"
ON public.help_comments
FOR DELETE
USING (
  member_id IN (
    SELECT m.id
    FROM public.members m
    WHERE m.user_id = auth.uid()
  )
);

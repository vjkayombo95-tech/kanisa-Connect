-- Align community_help_requests with app expectations and fix RLS.

ALTER TABLE public.community_help_requests
ADD COLUMN IF NOT EXISTS current_amount numeric NOT NULL DEFAULT 0;

DROP POLICY IF EXISTS "Submitters can view own help requests" ON public.community_help_requests;
DROP POLICY IF EXISTS "Users manage own help requests" ON public.community_help_requests;
DROP POLICY IF EXISTS "Members can insert own help requests" ON public.community_help_requests;
DROP POLICY IF EXISTS "Allow all inserts" ON public.community_help_requests;
DROP POLICY IF EXISTS "Allow select for authenticated" ON public.community_help_requests;
DROP POLICY IF EXISTS "Church members can view help requests" ON public.community_help_requests;
DROP POLICY IF EXISTS "Church members can create help requests" ON public.community_help_requests;
DROP POLICY IF EXISTS "Church admins can manage help requests" ON public.community_help_requests;

CREATE POLICY "Church members can view help requests"
ON public.community_help_requests
FOR SELECT
USING (
  church_id IN (
    SELECT ur.church_id
    FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
  )
);

CREATE POLICY "Members can create own help requests"
ON public.community_help_requests
FOR INSERT
WITH CHECK (
  member_id IN (
    SELECT m.id
    FROM public.members m
    WHERE m.user_id = auth.uid()
      AND m.church_id = community_help_requests.church_id
  )
);

CREATE POLICY "Members can update own help requests"
ON public.community_help_requests
FOR UPDATE
USING (
  member_id IN (
    SELECT m.id
    FROM public.members m
    WHERE m.user_id = auth.uid()
      AND m.church_id = community_help_requests.church_id
  )
)
WITH CHECK (
  member_id IN (
    SELECT m.id
    FROM public.members m
    WHERE m.user_id = auth.uid()
      AND m.church_id = community_help_requests.church_id
  )
);

CREATE POLICY "Church admins can manage help requests"
ON public.community_help_requests
FOR UPDATE
USING (
  church_id IN (
    SELECT ur.church_id
    FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
      AND ur.role IN ('church_admin', 'pastor', 'secretary', 'treasurer')
  )
)
WITH CHECK (
  church_id IN (
    SELECT ur.church_id
    FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
      AND ur.role IN ('church_admin', 'pastor', 'secretary', 'treasurer')
  )
);

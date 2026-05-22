-- Fix prayer request RLS so members and church admins can update rows correctly.

DROP POLICY IF EXISTS "Users manage own prayers" ON public.prayer_requests;
DROP POLICY IF EXISTS "Members can insert own prayer requests" ON public.prayer_requests;
DROP POLICY IF EXISTS "Allow all inserts" ON public.prayer_requests;
DROP POLICY IF EXISTS "Allow select for authenticated" ON public.prayer_requests;
DROP POLICY IF EXISTS "Church members can view prayer requests" ON public.prayer_requests;
DROP POLICY IF EXISTS "Church members can create prayer requests" ON public.prayer_requests;
DROP POLICY IF EXISTS "Church admins can manage prayer requests" ON public.prayer_requests;

CREATE POLICY "Church members can view prayer requests"
ON public.prayer_requests
FOR SELECT
USING (
  church_id IN (
    SELECT ur.church_id
    FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
  )
);

CREATE POLICY "Members can create own prayer requests"
ON public.prayer_requests
FOR INSERT
WITH CHECK (
  member_id IN (
    SELECT m.id
    FROM public.members m
    WHERE m.user_id = auth.uid()
      AND m.church_id = prayer_requests.church_id
  )
);

CREATE POLICY "Members can update own prayer requests"
ON public.prayer_requests
FOR UPDATE
USING (
  member_id IN (
    SELECT m.id
    FROM public.members m
    WHERE m.user_id = auth.uid()
      AND m.church_id = prayer_requests.church_id
  )
)
WITH CHECK (
  member_id IN (
    SELECT m.id
    FROM public.members m
    WHERE m.user_id = auth.uid()
      AND m.church_id = prayer_requests.church_id
  )
);

CREATE POLICY "Church admins can manage prayer requests"
ON public.prayer_requests
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

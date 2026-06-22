DROP POLICY IF EXISTS "Church admins can manage event requests" ON public.event_requests;

CREATE POLICY "Church admins can manage event requests"
ON public.event_requests
FOR UPDATE
USING (public.is_church_admin(auth.uid(), church_id))
WITH CHECK (public.is_church_admin(auth.uid(), church_id));

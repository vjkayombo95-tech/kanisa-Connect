
-- Allow authenticated church members to insert their own contributions (for portal Give, mass intentions, prayer offerings, help donations)
CREATE POLICY "Members can insert own contributions"
ON public.contributions
FOR INSERT
TO authenticated
WITH CHECK (
  is_church_member(auth.uid(), church_id)
  AND (created_by = auth.uid())
);

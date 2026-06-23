-- Allow authorized workspace managers to record contributions for their church.
-- Existing SELECT, UPDATE, and DELETE policies remain unchanged.

CREATE POLICY "Church managers can insert contributions"
ON public.contributions
FOR INSERT
TO authenticated
WITH CHECK (
  public.can_manage_church_workspace(auth.uid(), church_id)
  AND (created_by IS NULL OR created_by = auth.uid())
  AND (
    member_id IS NULL
    OR EXISTS (
      SELECT 1
      FROM public.members m
      WHERE m.id = contributions.member_id
        AND m.church_id = contributions.church_id
    )
  )
);

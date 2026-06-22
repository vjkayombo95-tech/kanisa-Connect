
-- Allow church creators to assign themselves a role during onboarding
CREATE POLICY "Church creators can self-assign role"
ON public.user_roles FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = user_id
  AND EXISTS (
    SELECT 1 FROM public.churches
    WHERE id = church_id AND created_by = auth.uid()
  )
);

-- Also allow church creators to insert members during onboarding
CREATE POLICY "Church creators can insert members"
ON public.members FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.churches
    WHERE id = church_id AND created_by = auth.uid()
  )
);

-- Allow church creators to insert contribution categories during onboarding
CREATE POLICY "Church creators can insert categories"
ON public.contribution_categories FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.churches
    WHERE id = church_id AND created_by = auth.uid()
  )
);

-- Allow church creators to insert subscriptions during onboarding
CREATE POLICY "Church creators can insert subscription"
ON public.church_subscriptions FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.churches
    WHERE id = church_id AND created_by = auth.uid()
  )
);

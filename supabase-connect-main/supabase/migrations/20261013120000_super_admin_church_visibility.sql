-- Allow verified platform Super Admins to view all churches.
-- Preserve existing church-specific SELECT policies.
-- Diocese staff receive no additional access unless they
-- are separately authorized as platform Super Admins.

DROP POLICY IF EXISTS "platform_super_admin_select_all_churches"
ON public.churches;

CREATE POLICY "platform_super_admin_select_all_churches"
ON public.churches
FOR SELECT
TO authenticated
USING (
    public.is_platform_super_admin((SELECT auth.uid()))
    OR public.is_super_admin((SELECT auth.uid()))
);

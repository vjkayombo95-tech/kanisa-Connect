DROP POLICY IF EXISTS "Admins can view automation runs"
ON public.automation_runs;

CREATE POLICY "Super admins can view automation runs"
ON public.automation_runs
FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1
        FROM public.profiles p
        WHERE p.id = auth.uid()
        AND p.role = 'super_admin'
    )
);

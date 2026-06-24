CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.profiles
        WHERE id = auth.uid()
        AND role = 'super_admin'
    );
$$;

DROP POLICY IF EXISTS "Super admins can view automation runs"
ON public.automation_runs;

CREATE POLICY "Super admins can view automation runs"
ON public.automation_runs
FOR SELECT
TO authenticated
USING (
    public.is_super_admin()
);

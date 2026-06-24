GRANT SELECT
ON public.automation_runs
TO authenticated;

GRANT EXECUTE
ON FUNCTION public.is_super_admin()
TO authenticated;

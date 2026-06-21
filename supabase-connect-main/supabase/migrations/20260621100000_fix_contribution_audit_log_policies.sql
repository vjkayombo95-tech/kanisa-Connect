-- Church owners can manage contributions even when a legacy workspace does not
-- have a matching user_roles row. Give them the same scoped access to the
-- contribution audit trail.
-- Some existing workspaces were created before this table's original migration,
-- so create it here as well when it is missing.
CREATE TABLE IF NOT EXISTS public.contribution_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  church_id uuid NOT NULL REFERENCES public.churches(id) ON DELETE CASCADE,
  contribution_id uuid REFERENCES public.contributions(id) ON DELETE SET NULL,
  action text NOT NULL,
  reason text NOT NULL,
  old_values jsonb,
  new_values jsonb,
  performed_by uuid,
  performer_name text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS contribution_audit_logs_church_created_at_idx
  ON public.contribution_audit_logs (church_id, created_at DESC);

ALTER TABLE public.contribution_audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Church admins can view audit logs" ON public.contribution_audit_logs;
DROP POLICY IF EXISTS "Church admins can insert audit logs" ON public.contribution_audit_logs;

CREATE POLICY "Church admins and owners can view contribution audit logs"
ON public.contribution_audit_logs
FOR SELECT
USING (
  public.is_church_admin(auth.uid(), church_id)
  OR public.is_super_admin(auth.uid())
  OR EXISTS (
    SELECT 1
    FROM public.churches
    WHERE churches.id = contribution_audit_logs.church_id
      AND churches.created_by = auth.uid()
  )
);

CREATE POLICY "Church admins and owners can insert contribution audit logs"
ON public.contribution_audit_logs
FOR INSERT
WITH CHECK (
  public.is_church_admin(auth.uid(), church_id)
  OR public.is_super_admin(auth.uid())
  OR EXISTS (
    SELECT 1
    FROM public.churches
    WHERE churches.id = contribution_audit_logs.church_id
      AND churches.created_by = auth.uid()
  )
);

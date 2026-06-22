
-- 1. Add wedding_date to families
ALTER TABLE public.families ADD COLUMN IF NOT EXISTS wedding_date date;

-- 2. Add Jumuiya leadership columns to communities
ALTER TABLE public.communities ADD COLUMN IF NOT EXISTS mwenyekiti_id uuid REFERENCES public.members(id) ON DELETE SET NULL;
ALTER TABLE public.communities ADD COLUMN IF NOT EXISTS makamu_mwenyekiti_id uuid REFERENCES public.members(id) ON DELETE SET NULL;
ALTER TABLE public.communities ADD COLUMN IF NOT EXISTS mweka_hazina_id uuid REFERENCES public.members(id) ON DELETE SET NULL;
ALTER TABLE public.communities ADD COLUMN IF NOT EXISTS katibu_id uuid REFERENCES public.members(id) ON DELETE SET NULL;

-- 3. Create contribution_audit_logs table for tracking contribution edits/deletes
CREATE TABLE public.contribution_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  church_id uuid NOT NULL REFERENCES public.churches(id) ON DELETE CASCADE,
  contribution_id uuid REFERENCES public.contributions(id) ON DELETE SET NULL,
  action text NOT NULL, -- 'edit' or 'delete'
  reason text NOT NULL,
  old_values jsonb,
  new_values jsonb,
  performed_by uuid,
  performer_name text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.contribution_audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Church admins can view audit logs"
ON public.contribution_audit_logs FOR SELECT
USING (is_church_admin(auth.uid(), church_id) OR is_super_admin(auth.uid()));

CREATE POLICY "Church admins can insert audit logs"
ON public.contribution_audit_logs FOR INSERT
WITH CHECK (is_church_admin(auth.uid(), church_id));

-- 4. Add DELETE policy for contributions (currently missing)
CREATE POLICY "Church admins can delete contributions"
ON public.contributions FOR DELETE
USING (is_church_admin(auth.uid(), church_id));

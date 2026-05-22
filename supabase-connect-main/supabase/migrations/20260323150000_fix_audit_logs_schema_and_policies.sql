ALTER TABLE public.audit_logs
ADD COLUMN IF NOT EXISTS details text,
ADD COLUMN IF NOT EXISTS entity text,
ADD COLUMN IF NOT EXISTS entity_id uuid;

ALTER TABLE public.audit_logs
ALTER COLUMN created_at SET DEFAULT now();

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow audit logs insert" ON public.audit_logs;
CREATE POLICY "Allow audit logs insert"
ON public.audit_logs
FOR INSERT
WITH CHECK (true);

DROP POLICY IF EXISTS "Allow read audit logs" ON public.audit_logs;
CREATE POLICY "Allow read audit logs"
ON public.audit_logs
FOR SELECT
USING (true);

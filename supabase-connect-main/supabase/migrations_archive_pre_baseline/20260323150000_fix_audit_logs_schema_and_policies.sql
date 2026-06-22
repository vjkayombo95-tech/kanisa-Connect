DO $$
BEGIN
  -- The base schema has activity_logs, not audit_logs. Keep the optional
  -- compatibility path idempotent for projects that do provide audit_logs.
  IF to_regclass('public.audit_logs') IS NULL THEN
    RAISE NOTICE 'Skipping audit_logs schema and policy repair because public.audit_logs is absent.';
    RETURN;
  END IF;

  ALTER TABLE public.audit_logs
    ADD COLUMN IF NOT EXISTS details text,
    ADD COLUMN IF NOT EXISTS entity text,
    ADD COLUMN IF NOT EXISTS entity_id uuid;
  ALTER TABLE public.audit_logs ALTER COLUMN created_at SET DEFAULT now();
  ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'audit_logs' AND policyname = 'Allow audit logs insert'
  ) THEN
    CREATE POLICY "Allow audit logs insert" ON public.audit_logs FOR INSERT WITH CHECK (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'audit_logs' AND policyname = 'Allow read audit logs'
  ) THEN
    CREATE POLICY "Allow read audit logs" ON public.audit_logs FOR SELECT USING (true);
  END IF;
END $$;

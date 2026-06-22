DO $$
BEGIN
  -- audit_logs is optional in the base schema. Do not stop a fresh project
  -- when an older deployment-only audit table is absent.
  IF to_regclass('public.audit_logs') IS NOT NULL
     AND NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'audit_logs'
      AND policyname = 'Allow audit logs insert'
  ) THEN
    CREATE POLICY "Allow audit logs insert"
      ON public.audit_logs
      FOR INSERT
      WITH CHECK (true);
  END IF;
END $$;

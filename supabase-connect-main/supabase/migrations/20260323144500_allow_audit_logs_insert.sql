DO $$
BEGIN
  IF NOT EXISTS (
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

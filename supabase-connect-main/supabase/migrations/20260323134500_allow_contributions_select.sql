DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'contributions'
      AND policyname = 'Allow contributions select'
  ) THEN
    CREATE POLICY "Allow contributions select"
      ON public.contributions
      FOR SELECT
      USING (true);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'contributions'
      AND policyname = 'Allow contributions update'
  ) THEN
    CREATE POLICY "Allow contributions update"
      ON public.contributions
      FOR UPDATE
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;

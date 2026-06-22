DO $$
BEGIN
  IF to_regclass('public.member_ministries') IS NULL
     OR to_regclass('public.members') IS NULL THEN
    RAISE NOTICE 'Skipping member_ministries FK repair because a required table is absent.';
    RETURN;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE constraint_schema = 'public'
      AND table_name = 'member_ministries'
      AND constraint_name = 'member_ministries_member_id_fkey'
  ) THEN
    ALTER TABLE public.member_ministries DROP CONSTRAINT member_ministries_member_id_fkey;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.member_ministries'::regclass
      AND conname = 'member_ministries_member_id_fkey'
  ) THEN
    ALTER TABLE public.member_ministries ADD CONSTRAINT member_ministries_member_id_fkey
      FOREIGN KEY (member_id) REFERENCES public.members(id) ON DELETE CASCADE;
  END IF;

  CREATE INDEX IF NOT EXISTS idx_member_ministries_member_id ON public.member_ministries(member_id);
  CREATE INDEX IF NOT EXISTS idx_member_ministries_ministry_id ON public.member_ministries(ministry_id);
  CREATE UNIQUE INDEX IF NOT EXISTS idx_member_ministries_unique_member_ministry ON public.member_ministries(member_id, ministry_id);
END $$;

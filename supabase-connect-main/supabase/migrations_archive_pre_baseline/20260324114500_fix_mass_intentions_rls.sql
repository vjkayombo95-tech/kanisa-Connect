-- Fix mass intention RLS without assuming production-only schema drift.
-- A missing optional table/column must not stop a fresh database migration.
DO $$
BEGIN
  IF to_regclass('public.mass_intentions') IS NULL
     OR to_regclass('public.members') IS NULL
     OR to_regclass('public.user_roles') IS NULL THEN
    RAISE NOTICE 'Skipping mass_intentions RLS repair because a required table is absent.';
    RETURN;
  END IF;

  IF (SELECT count(*) FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'mass_intentions'
        AND column_name IN ('member_id', 'church_id')) <> 2
     OR (SELECT count(*) FROM information_schema.columns
         WHERE table_schema = 'public' AND table_name = 'members'
           AND column_name IN ('id', 'user_id', 'church_id')) <> 3
     OR (SELECT count(*) FROM information_schema.columns
         WHERE table_schema = 'public' AND table_name = 'user_roles'
           AND column_name IN ('user_id', 'church_id', 'role')) <> 3 THEN
    RAISE NOTICE 'Skipping mass_intentions RLS repair because required policy columns are absent.';
    RETURN;
  END IF;

  ALTER TABLE public.mass_intentions ENABLE ROW LEVEL SECURITY;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'mass_intentions' AND policyname = 'Church members can view mass intentions') THEN
    CREATE POLICY "Church members can view mass intentions" ON public.mass_intentions FOR SELECT
    USING (church_id IN (SELECT ur.church_id FROM public.user_roles ur WHERE ur.user_id = auth.uid()));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'mass_intentions' AND policyname = 'Members can create own mass intentions') THEN
    CREATE POLICY "Members can create own mass intentions" ON public.mass_intentions FOR INSERT
    WITH CHECK (member_id IN (SELECT m.id FROM public.members m WHERE m.user_id = auth.uid() AND m.church_id = mass_intentions.church_id));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'mass_intentions' AND policyname = 'Members can update own mass intentions') THEN
    CREATE POLICY "Members can update own mass intentions" ON public.mass_intentions FOR UPDATE
    USING (member_id IN (SELECT m.id FROM public.members m WHERE m.user_id = auth.uid() AND m.church_id = mass_intentions.church_id))
    WITH CHECK (member_id IN (SELECT m.id FROM public.members m WHERE m.user_id = auth.uid() AND m.church_id = mass_intentions.church_id));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'mass_intentions' AND policyname = 'Church admins can manage mass intentions') THEN
    CREATE POLICY "Church admins can manage mass intentions" ON public.mass_intentions FOR UPDATE
    USING (church_id IN (SELECT ur.church_id FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.role IN ('church_admin', 'pastor', 'secretary', 'treasurer')))
    WITH CHECK (church_id IN (SELECT ur.church_id FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.role IN ('church_admin', 'pastor', 'secretary', 'treasurer')));
  END IF;
END $$;

-- Align optional community help records with app expectations without assuming
-- deployment-only schema drift exists on a new project.
DO $$
BEGIN
  IF to_regclass('public.community_help_requests') IS NULL
     OR to_regclass('public.members') IS NULL
     OR to_regclass('public.user_roles') IS NULL THEN
    RAISE NOTICE 'Skipping community_help_requests RLS repair because a required table is absent.';
    RETURN;
  END IF;

  ALTER TABLE public.community_help_requests
    ADD COLUMN IF NOT EXISTS current_amount numeric NOT NULL DEFAULT 0;

  IF (SELECT count(*) FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'community_help_requests'
        AND column_name IN ('member_id', 'church_id')) <> 2
     OR (SELECT count(*) FROM information_schema.columns
         WHERE table_schema = 'public' AND table_name = 'members'
           AND column_name IN ('id', 'user_id', 'church_id')) <> 3
     OR (SELECT count(*) FROM information_schema.columns
         WHERE table_schema = 'public' AND table_name = 'user_roles'
           AND column_name IN ('user_id', 'church_id', 'role')) <> 3 THEN
    RAISE NOTICE 'Skipping community_help_requests policies because required columns are absent.';
    RETURN;
  END IF;

  ALTER TABLE public.community_help_requests ENABLE ROW LEVEL SECURITY;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'community_help_requests' AND policyname = 'Church members can view help requests') THEN
    CREATE POLICY "Church members can view help requests" ON public.community_help_requests FOR SELECT
    USING (church_id IN (SELECT ur.church_id FROM public.user_roles ur WHERE ur.user_id = auth.uid()));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'community_help_requests' AND policyname = 'Members can create own help requests') THEN
    CREATE POLICY "Members can create own help requests" ON public.community_help_requests FOR INSERT
    WITH CHECK (member_id IN (SELECT m.id FROM public.members m WHERE m.user_id = auth.uid() AND m.church_id = community_help_requests.church_id));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'community_help_requests' AND policyname = 'Members can update own help requests') THEN
    CREATE POLICY "Members can update own help requests" ON public.community_help_requests FOR UPDATE
    USING (member_id IN (SELECT m.id FROM public.members m WHERE m.user_id = auth.uid() AND m.church_id = community_help_requests.church_id))
    WITH CHECK (member_id IN (SELECT m.id FROM public.members m WHERE m.user_id = auth.uid() AND m.church_id = community_help_requests.church_id));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'community_help_requests' AND policyname = 'Church admins can manage help requests') THEN
    CREATE POLICY "Church admins can manage help requests" ON public.community_help_requests FOR UPDATE
    USING (church_id IN (SELECT ur.church_id FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.role IN ('church_admin', 'pastor', 'secretary', 'treasurer')))
    WITH CHECK (church_id IN (SELECT ur.church_id FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.role IN ('church_admin', 'pastor', 'secretary', 'treasurer')));
  END IF;
END $$;

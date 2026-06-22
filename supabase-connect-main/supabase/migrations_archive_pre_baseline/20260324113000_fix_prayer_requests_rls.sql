-- Fresh-project safe member ownership policies for prayer requests.
DO $$
BEGIN
  IF to_regclass('public.prayer_requests') IS NULL OR to_regclass('public.members') IS NULL OR to_regclass('public.user_roles') IS NULL THEN
    RAISE NOTICE 'Skipping prayer_requests RLS repair because a required table is absent.';
    RETURN;
  END IF;
  IF (SELECT count(*) FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'prayer_requests' AND column_name IN ('member_id', 'church_id')) <> 2
     OR (SELECT count(*) FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'members' AND column_name IN ('id', 'user_id', 'church_id')) <> 3
     OR (SELECT count(*) FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'user_roles' AND column_name IN ('user_id', 'church_id', 'role')) <> 3 THEN
    RAISE NOTICE 'Skipping prayer_requests policies because required columns are absent.';
    RETURN;
  END IF;
  ALTER TABLE public.prayer_requests ENABLE ROW LEVEL SECURITY;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='prayer_requests' AND policyname='Church members can view prayer requests') THEN
    CREATE POLICY "Church members can view prayer requests" ON public.prayer_requests FOR SELECT USING (church_id IN (SELECT ur.church_id FROM public.user_roles ur WHERE ur.user_id=auth.uid()));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='prayer_requests' AND policyname='Members can create own prayer requests') THEN
    CREATE POLICY "Members can create own prayer requests" ON public.prayer_requests FOR INSERT WITH CHECK (member_id IN (SELECT m.id FROM public.members m WHERE m.user_id=auth.uid() AND m.church_id=prayer_requests.church_id));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='prayer_requests' AND policyname='Members can update own prayer requests') THEN
    CREATE POLICY "Members can update own prayer requests" ON public.prayer_requests FOR UPDATE USING (member_id IN (SELECT m.id FROM public.members m WHERE m.user_id=auth.uid() AND m.church_id=prayer_requests.church_id)) WITH CHECK (member_id IN (SELECT m.id FROM public.members m WHERE m.user_id=auth.uid() AND m.church_id=prayer_requests.church_id));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='prayer_requests' AND policyname='Church admins can manage prayer requests') THEN
    CREATE POLICY "Church admins can manage prayer requests" ON public.prayer_requests FOR UPDATE USING (church_id IN (SELECT ur.church_id FROM public.user_roles ur WHERE ur.user_id=auth.uid() AND ur.role IN ('church_admin','pastor','secretary','treasurer'))) WITH CHECK (church_id IN (SELECT ur.church_id FROM public.user_roles ur WHERE ur.user_id=auth.uid() AND ur.role IN ('church_admin','pastor','secretary','treasurer')));
  END IF;
END $$;

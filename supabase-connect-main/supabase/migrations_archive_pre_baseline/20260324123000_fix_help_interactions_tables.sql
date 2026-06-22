-- Ensure community help interaction tables exist in production.

CREATE TABLE IF NOT EXISTS public.help_donations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  help_request_id uuid NOT NULL REFERENCES public.community_help_requests(id) ON DELETE CASCADE,
  donor_name text NOT NULL,
  amount numeric(12,2) NOT NULL,
  is_anonymous boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.help_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  help_request_id uuid NOT NULL REFERENCES public.community_help_requests(id) ON DELETE CASCADE,
  member_id uuid REFERENCES public.members(id) ON DELETE SET NULL,
  author_name text NOT NULL,
  comment text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

DO $$
BEGIN
  -- All policy dependencies are optional compatibility features on legacy
  -- projects. Validate relations and columns before RLS or policy DDL.
  IF to_regclass('public.help_donations') IS NOT NULL THEN
    ALTER TABLE public.help_donations ENABLE ROW LEVEL SECURITY;
  END IF;
  IF to_regclass('public.help_comments') IS NOT NULL THEN
    ALTER TABLE public.help_comments ENABLE ROW LEVEL SECURITY;
  END IF;

  IF to_regclass('public.help_donations') IS NOT NULL
     AND to_regclass('public.community_help_requests') IS NOT NULL
     AND to_regclass('public.user_roles') IS NOT NULL
     AND (SELECT count(*) FROM information_schema.columns WHERE table_schema='public' AND table_name='help_donations' AND column_name='help_request_id') = 1
     AND (SELECT count(*) FROM information_schema.columns WHERE table_schema='public' AND table_name='community_help_requests' AND column_name IN ('id','status','church_id')) = 3
     AND (SELECT count(*) FROM information_schema.columns WHERE table_schema='public' AND table_name='user_roles' AND column_name IN ('church_id','user_id')) = 2 THEN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='help_donations' AND policyname='View help donations') THEN
      CREATE POLICY "View help donations" ON public.help_donations FOR SELECT USING (EXISTS (SELECT 1 FROM public.community_help_requests h WHERE h.id=help_donations.help_request_id AND h.church_id IN (SELECT ur.church_id FROM public.user_roles ur WHERE ur.user_id=auth.uid())));
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='help_donations' AND policyname='Create help donations') THEN
      CREATE POLICY "Create help donations" ON public.help_donations FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM public.community_help_requests h WHERE h.id=help_donations.help_request_id AND h.status='approved' AND h.church_id IN (SELECT ur.church_id FROM public.user_roles ur WHERE ur.user_id=auth.uid())));
    END IF;
  END IF;

  IF to_regclass('public.help_comments') IS NOT NULL
     AND to_regclass('public.community_help_requests') IS NOT NULL
     AND to_regclass('public.user_roles') IS NOT NULL
     AND to_regclass('public.members') IS NOT NULL
     AND (SELECT count(*) FROM information_schema.columns WHERE table_schema='public' AND table_name='help_comments' AND column_name IN ('help_request_id','member_id')) = 2
     AND (SELECT count(*) FROM information_schema.columns WHERE table_schema='public' AND table_name='community_help_requests' AND column_name IN ('id','church_id')) = 2
     AND (SELECT count(*) FROM information_schema.columns WHERE table_schema='public' AND table_name='user_roles' AND column_name IN ('church_id','user_id')) = 2
     AND (SELECT count(*) FROM information_schema.columns WHERE table_schema='public' AND table_name='members' AND column_name IN ('id','user_id')) = 2 THEN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='help_comments' AND policyname='View help comments') THEN
      CREATE POLICY "View help comments" ON public.help_comments FOR SELECT USING (EXISTS (SELECT 1 FROM public.community_help_requests h WHERE h.id=help_comments.help_request_id AND h.church_id IN (SELECT ur.church_id FROM public.user_roles ur WHERE ur.user_id=auth.uid())));
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='help_comments' AND policyname='Create help comments') THEN
      CREATE POLICY "Create help comments" ON public.help_comments FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM public.community_help_requests h WHERE h.id=help_comments.help_request_id AND h.church_id IN (SELECT ur.church_id FROM public.user_roles ur WHERE ur.user_id=auth.uid())));
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='help_comments' AND policyname='Delete own help comments') THEN
      CREATE POLICY "Delete own help comments" ON public.help_comments FOR DELETE USING (member_id IN (SELECT m.id FROM public.members m WHERE m.user_id=auth.uid()));
    END IF;
  END IF;
END $$;

create table if not exists public.message_templates (
  id uuid primary key default gen_random_uuid(),
  church_id uuid references public.churches(id) on delete cascade,
  title text not null,
  body text not null,
  type text not null default 'announcement',
  category text not null default 'announcement',
  language text not null default 'sw',
  tone text,
  occasion text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

DO $$
BEGIN
  IF to_regclass('public.message_templates') IS NULL THEN
    RAISE NOTICE 'Skipping message template compatibility work because the table is absent.';
    RETURN;
  END IF;

  ALTER TABLE public.message_templates
    ADD COLUMN IF NOT EXISTS title text,
    ADD COLUMN IF NOT EXISTS body text,
    ADD COLUMN IF NOT EXISTS content text,
    ADD COLUMN IF NOT EXISTS type text NOT NULL DEFAULT 'announcement',
    ADD COLUMN IF NOT EXISTS category text NOT NULL DEFAULT 'announcement',
    ADD COLUMN IF NOT EXISTS language text NOT NULL DEFAULT 'sw',
    ADD COLUMN IF NOT EXISTS tone text,
    ADD COLUMN IF NOT EXISTS occasion text;

  -- occasion belongs only to a later/legacy template schema. Fresh projects
  -- can legitimately have type without occasion, so do not reference it.
  IF (SELECT count(*) FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'message_templates'
        AND column_name IN ('type', 'occasion')) = 2 THEN
    UPDATE public.message_templates
    SET type = occasion
    WHERE type = 'announcement'
      AND occasion IS NOT NULL
      AND occasion <> '';
  END IF;
END $$;

DO $$
BEGIN
  IF to_regclass('public.message_templates') IS NOT NULL
     AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='message_templates' AND column_name='church_id') THEN
    CREATE INDEX IF NOT EXISTS message_templates_church_id_idx ON public.message_templates(church_id);
  END IF;
  IF (SELECT count(*) FROM information_schema.columns WHERE table_schema='public' AND table_name='message_templates' AND column_name IN ('type','language')) = 2 THEN
    CREATE INDEX IF NOT EXISTS message_templates_type_language_idx ON public.message_templates(type, language);
  END IF;
  IF (SELECT count(*) FROM information_schema.columns WHERE table_schema='public' AND table_name='message_templates' AND column_name IN ('category','language')) = 2 THEN
    CREATE INDEX IF NOT EXISTS message_templates_category_language_idx ON public.message_templates(category, language);
  END IF;
END $$;

DO $$
BEGIN
  IF to_regclass('public.message_templates') IS NOT NULL
     AND to_regclass('public.user_roles') IS NOT NULL
     AND to_regclass('public.members') IS NOT NULL
     AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='message_templates' AND column_name='church_id')
     AND (SELECT count(*) FROM information_schema.columns WHERE table_schema='public' AND table_name='user_roles' AND column_name IN ('user_id','church_id')) = 2
     AND (SELECT count(*) FROM information_schema.columns WHERE table_schema='public' AND table_name='members' AND column_name IN ('user_id','church_id')) = 2 THEN
    ALTER TABLE public.message_templates ENABLE ROW LEVEL SECURITY;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='message_templates' AND policyname='message_templates_select_access') THEN
      EXECUTE 'CREATE POLICY "message_templates_select_access" ON public.message_templates FOR SELECT TO authenticated USING (church_id is null OR exists (select 1 from public.user_roles ur where ur.user_id=auth.uid() and ur.church_id=message_templates.church_id) OR exists (select 1 from public.members m where m.user_id=auth.uid() and m.church_id=message_templates.church_id))';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='message_templates' AND policyname='message_templates_manage_by_role') THEN
      EXECUTE 'CREATE POLICY "message_templates_manage_by_role" ON public.message_templates FOR ALL TO authenticated USING (exists (select 1 from public.user_roles ur where ur.user_id=auth.uid() and ur.church_id=message_templates.church_id)) WITH CHECK (exists (select 1 from public.user_roles ur where ur.user_id=auth.uid() and ur.church_id=message_templates.church_id))';
    END IF;
    GRANT SELECT, INSERT, UPDATE, DELETE ON public.message_templates TO authenticated;
  END IF;
END $$;

insert into public.message_templates (title, content, type, category, language, tone, occasion)
values
  (
    'Ibada ya Jumapili Wiki Hii',
    'Kanisa linawakaribisha waumini wote kwenye ibada ya Jumapili hii. Njoo tushirikiane katika kuabudu, kusikiliza neno la Mungu na kuombeana kama familia ya imani.',
    'service',
    'announcement',
    'sw',
    'warm',
    'sunday_service'
  ),
  (
    'Tusikose Ibada ya Jumapili',
    'Tunawakumbusha waumini wote kuhusu ibada ya Jumapili ijayo. Huu ni wakati wa kujengwa kiroho, kuungana na wengine na kumtukuza Mungu pamoja.',
    'service',
    'announcement',
    'sw',
    'encouraging',
    'sunday_service'
  ),
  (
    'Youth Meeting',
    'All youth are invited to join our upcoming meeting for fellowship, prayer and planning. Come ready to participate and grow together.',
    'youth',
    'announcement',
    'en',
    'friendly',
    'youth_meeting'
  ),
  (
    'Prayer Meeting',
    'You are warmly invited to our prayer meeting. Let us gather in faith, share our needs and seek God together.',
    'prayer',
    'announcement',
    'en',
    'warm',
    'prayer_meeting'
  ),
  (
    'Mkutano wa Vijana',
    'Tunawaalika vijana wote kwenye mkutano wetu ujao kwa ushirika, maombi na kupanga huduma. Karibuni tushiriki na kukua pamoja.',
    'youth',
    'announcement',
    'sw',
    'friendly',
    'youth_meeting'
  ),
  (
    'Mkutano wa Maombi',
    'Karibuni kwenye mkutano wa maombi. Tukutane kwa imani, tushirikishe mahitaji yetu na tumtafute Mungu pamoja.',
    'prayer',
    'announcement',
    'sw',
    'warm',
    'prayer_meeting'
  ),
  (
    'Tukio Maalum',
    'Kanisa linawatangazia tukio maalum lijalo. Karibuni kushiriki, kualika wengine na kuwa sehemu ya wakati huu muhimu wa jumuiya yetu.',
    'event',
    'announcement',
    'sw',
    'warm',
    'special_event'
  ),
  (
    'Special Event',
    'The church invites everyone to our upcoming special event. Please join us, invite others and be part of this meaningful community moment.',
    'event',
    'announcement',
    'en',
    'warm',
    'special_event'
  )
on conflict do nothing;

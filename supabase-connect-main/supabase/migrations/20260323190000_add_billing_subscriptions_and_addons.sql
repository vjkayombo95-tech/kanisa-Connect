DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type
    WHERE typname = 'billing_plan'
  ) THEN
    CREATE TYPE public.billing_plan AS ENUM ('free', 'basic', 'intermediate', 'pro', 'enterprise');
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_type
    WHERE typname = 'billing_status'
  ) THEN
    CREATE TYPE public.billing_status AS ENUM ('active', 'expired');
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_type
    WHERE typname = 'billing_addon_name'
  ) THEN
    CREATE TYPE public.billing_addon_name AS ENUM ('member_portal');
  END IF;
END
$$;

CREATE TABLE IF NOT EXISTS public.subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  church_id uuid NOT NULL REFERENCES public.churches(id) ON DELETE CASCADE,
  plan public.billing_plan NOT NULL DEFAULT 'free',
  status public.billing_status NOT NULL DEFAULT 'active',
  started_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.addons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  church_id uuid NOT NULL REFERENCES public.churches(id) ON DELETE CASCADE,
  addon_name public.billing_addon_name NOT NULL,
  purchased boolean NOT NULL DEFAULT false,
  purchased_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (church_id, addon_name)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_subscriptions_one_active_per_church
  ON public.subscriptions(church_id)
  WHERE status = 'active';

CREATE INDEX IF NOT EXISTS idx_subscriptions_church
  ON public.subscriptions(church_id, status);

CREATE INDEX IF NOT EXISTS idx_addons_church
  ON public.addons(church_id);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_proc
    WHERE proname = 'update_updated_at_column'
      AND pg_function_is_visible(oid)
  ) THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_trigger
      WHERE tgname = 'update_subscriptions_updated_at'
    ) THEN
      CREATE TRIGGER update_subscriptions_updated_at
      BEFORE UPDATE ON public.subscriptions
      FOR EACH ROW
      EXECUTE FUNCTION public.update_updated_at_column();
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM pg_trigger
      WHERE tgname = 'update_addons_updated_at'
    ) THEN
      CREATE TRIGGER update_addons_updated_at
      BEFORE UPDATE ON public.addons
      FOR EACH ROW
      EXECUTE FUNCTION public.update_updated_at_column();
    END IF;
  END IF;
END
$$;

ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.addons ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'subscriptions' AND policyname = 'Church members view subscriptions'
  ) THEN
    CREATE POLICY "Church members view subscriptions"
      ON public.subscriptions
      FOR SELECT
      USING (public.is_church_member(auth.uid(), church_id) OR public.is_super_admin(auth.uid()));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'subscriptions' AND policyname = 'Church admins manage subscriptions'
  ) THEN
    CREATE POLICY "Church admins manage subscriptions"
      ON public.subscriptions
      FOR ALL
      USING (public.is_church_admin(auth.uid(), church_id) OR public.is_super_admin(auth.uid()))
      WITH CHECK (public.is_church_admin(auth.uid(), church_id) OR public.is_super_admin(auth.uid()));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'addons' AND policyname = 'Church members view addons'
  ) THEN
    CREATE POLICY "Church members view addons"
      ON public.addons
      FOR SELECT
      USING (public.is_church_member(auth.uid(), church_id) OR public.is_super_admin(auth.uid()));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'addons' AND policyname = 'Church admins manage addons'
  ) THEN
    CREATE POLICY "Church admins manage addons"
      ON public.addons
      FOR ALL
      USING (public.is_church_admin(auth.uid(), church_id) OR public.is_super_admin(auth.uid()))
      WITH CHECK (public.is_church_admin(auth.uid(), church_id) OR public.is_super_admin(auth.uid()));
  END IF;
END
$$;

CREATE OR REPLACE FUNCTION public.ensure_default_subscription()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO public.subscriptions (church_id, plan, status)
  VALUES (NEW.id, 'free', 'active')
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'create_default_subscription_for_church'
  ) THEN
    CREATE TRIGGER create_default_subscription_for_church
    AFTER INSERT ON public.churches
    FOR EACH ROW
    EXECUTE FUNCTION public.ensure_default_subscription();
  END IF;
END
$$;

INSERT INTO public.subscriptions (church_id, plan, status)
SELECT c.id, 'free', 'active'
FROM public.churches c
WHERE NOT EXISTS (
  SELECT 1
  FROM public.subscriptions s
  WHERE s.church_id = c.id
);

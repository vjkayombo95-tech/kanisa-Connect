DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum
    WHERE enumlabel = 'trial'
      AND enumtypid = 'public.billing_status'::regtype
  ) THEN
    ALTER TYPE public.billing_status ADD VALUE 'trial';
  END IF;
END
$$;

CREATE OR REPLACE FUNCTION public.ensure_default_subscription()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO public.subscriptions (church_id, plan, status, started_at, expires_at)
  VALUES (
    NEW.id,
    'pro',
    'trial',
    now(),
    now() + interval '7 days'
  )
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END;
$$;

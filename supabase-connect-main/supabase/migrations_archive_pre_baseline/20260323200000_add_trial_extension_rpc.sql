CREATE TABLE IF NOT EXISTS public.trial_extensions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  church_id uuid NOT NULL REFERENCES public.churches(id) ON DELETE CASCADE,
  extended_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  days_added integer NOT NULL CHECK (days_added > 0),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_trial_extensions_church
  ON public.trial_extensions(church_id, created_at DESC);

ALTER TABLE public.trial_extensions ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'trial_extensions' AND policyname = 'Super admins manage trial extensions'
  ) THEN
    CREATE POLICY "Super admins manage trial extensions"
      ON public.trial_extensions
      FOR ALL
      USING (public.is_super_admin(auth.uid()))
      WITH CHECK (public.is_super_admin(auth.uid()));
  END IF;
END
$$;

CREATE OR REPLACE FUNCTION public.extend_trial(_church_id uuid, _days integer)
RETURNS public.subscriptions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target_subscription public.subscriptions%ROWTYPE;
  computed_expires_at timestamptz;
BEGIN
  IF NOT public.is_super_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Only super admins can extend trials';
  END IF;

  IF _days IS NULL OR _days <= 0 THEN
    RAISE EXCEPTION 'Days must be greater than zero';
  END IF;

  SELECT *
  INTO target_subscription
  FROM public.subscriptions
  WHERE church_id = _church_id
    AND status IN ('active', 'trial')
  ORDER BY started_at DESC
  LIMIT 1;

  IF target_subscription.id IS NULL THEN
    RAISE EXCEPTION 'No active or trial subscription found for church %', _church_id;
  END IF;

  computed_expires_at := COALESCE(
    GREATEST(target_subscription.expires_at, now()),
    now()
  ) + make_interval(days => _days);

  UPDATE public.subscriptions
  SET
    status = 'trial',
    expires_at = computed_expires_at,
    updated_at = now()
  WHERE id = target_subscription.id
  RETURNING *
  INTO target_subscription;

  INSERT INTO public.trial_extensions (church_id, extended_by, days_added)
  VALUES (_church_id, auth.uid(), _days);

  RETURN target_subscription;
END;
$$;

REVOKE ALL ON FUNCTION public.extend_trial(uuid, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.extend_trial(uuid, integer) TO authenticated;

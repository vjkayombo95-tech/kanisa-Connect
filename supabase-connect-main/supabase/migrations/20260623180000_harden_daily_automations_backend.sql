-- Phase 4B: run daily automations from a trusted backend only and retain
-- operational state without changing existing automation_logs records.

CREATE TABLE IF NOT EXISTS public.automation_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_date date NOT NULL,
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  status text NOT NULL DEFAULT 'running',
  error_message text,
  processed_count integer NOT NULL DEFAULT 0,
  CONSTRAINT automation_runs_status_check CHECK (status IN ('running', 'completed', 'failed'))
);

CREATE UNIQUE INDEX IF NOT EXISTS automation_runs_run_date_key
  ON public.automation_runs (run_date);

ALTER TABLE public.automation_runs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.automation_runs FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.run_daily_automations()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pastor text := 'Pastor John';
  v_run_date date := CURRENT_DATE;
  v_run_id uuid;
  v_existing_status text;
  v_processed_count integer := 0;
  v_batch_count integer := 0;
BEGIN
  IF coalesce(auth.role(), '') <> 'service_role' THEN
    RAISE EXCEPTION 'Only the backend service role may run daily automations'
      USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.automation_runs (run_date, status, started_at, completed_at, error_message, processed_count)
  VALUES (v_run_date, 'running', now(), NULL, NULL, 0)
  ON CONFLICT (run_date) DO NOTHING
  RETURNING id INTO v_run_id;

  IF v_run_id IS NULL THEN
    SELECT id, status
    INTO v_run_id, v_existing_status
    FROM public.automation_runs
    WHERE run_date = v_run_date;

    IF v_existing_status IN ('running', 'completed') THEN
      RETURN;
    END IF;

    UPDATE public.automation_runs
    SET status = 'running',
        started_at = now(),
        completed_at = NULL,
        error_message = NULL,
        processed_count = 0
    WHERE id = v_run_id;
  END IF;

  BEGIN
    WITH due AS (
      SELECT
        m.id AS member_id,
        m.full_name,
        m.church_id,
        m.date_of_birth
      FROM public.members m
      WHERE m.date_of_birth IS NOT NULL
        AND m.church_id IS NOT NULL
        AND EXTRACT(MONTH FROM m.date_of_birth) = EXTRACT(MONTH FROM CURRENT_DATE)
        AND EXTRACT(DAY FROM m.date_of_birth) = EXTRACT(DAY FROM CURRENT_DATE)
    ),
    picked AS (
      SELECT
        d.member_id,
        d.full_name,
        d.church_id,
        a2.message_template
      FROM due d
      JOIN LATERAL (
        SELECT a2.message_template
        FROM public.automations a2
        WHERE a2.church_id IS NOT DISTINCT FROM d.church_id
          AND a2.type = 'birthday'
          AND a2.is_enabled = true
        ORDER BY a2.created_at DESC
        LIMIT 1
      ) a2 ON true
    ),
    to_send AS (
      SELECT
        p.member_id,
        p.church_id,
        REPLACE(
          REPLACE(p.message_template, '{{name}}', p.full_name),
          '{{pastor}}', v_pastor
        ) AS content,
        'Birthday 🎉'::text AS title,
        'birthday'::text AS automation_type
      FROM picked p
      WHERE p.message_template IS NOT NULL
        AND NOT EXISTS (
          SELECT 1
          FROM public.automation_logs l
          WHERE l.member_id = p.member_id
            AND l.automation_type = 'birthday'
            AND DATE(l.sent_at) = CURRENT_DATE
        )
    ),
    inserted_announcements AS (
      INSERT INTO public.announcements (title, content, is_published, church_id)
      SELECT title, content, true, church_id
      FROM to_send
      RETURNING id
    ),
    inserted_logs AS (
      INSERT INTO public.automation_logs (member_id, automation_type, message)
      SELECT member_id, automation_type, content
      FROM to_send
      RETURNING id
    )
    SELECT count(*)::integer
    INTO v_batch_count
    FROM inserted_logs;

    v_processed_count := v_processed_count + coalesce(v_batch_count, 0);

    WITH due AS (
      SELECT
        m.id AS member_id,
        m.full_name,
        m.church_id,
        m.wedding_date
      FROM public.members m
      WHERE m.wedding_date IS NOT NULL
        AND m.church_id IS NOT NULL
        AND EXTRACT(MONTH FROM m.wedding_date) = EXTRACT(MONTH FROM CURRENT_DATE)
        AND EXTRACT(DAY FROM m.wedding_date) = EXTRACT(DAY FROM CURRENT_DATE)
    ),
    picked AS (
      SELECT
        d.member_id,
        d.full_name,
        d.church_id,
        a2.message_template
      FROM due d
      JOIN LATERAL (
        SELECT a2.message_template
        FROM public.automations a2
        WHERE a2.church_id IS NOT DISTINCT FROM d.church_id
          AND a2.type = 'anniversary'
          AND a2.is_enabled = true
        ORDER BY a2.created_at DESC
        LIMIT 1
      ) a2 ON true
    ),
    to_send AS (
      SELECT
        p.member_id,
        p.church_id,
        REPLACE(
          REPLACE(p.message_template, '{{name}}', p.full_name),
          '{{pastor}}', v_pastor
        ) AS content,
        'Anniversary 💍'::text AS title,
        'anniversary'::text AS automation_type
      FROM picked p
      WHERE p.message_template IS NOT NULL
        AND NOT EXISTS (
          SELECT 1
          FROM public.automation_logs l
          WHERE l.member_id = p.member_id
            AND l.automation_type = 'anniversary'
            AND DATE(l.sent_at) = CURRENT_DATE
        )
    ),
    inserted_announcements AS (
      INSERT INTO public.announcements (title, content, is_published, church_id)
      SELECT title, content, true, church_id
      FROM to_send
      RETURNING id
    ),
    inserted_logs AS (
      INSERT INTO public.automation_logs (member_id, automation_type, message)
      SELECT member_id, automation_type, content
      FROM to_send
      RETURNING id
    )
    SELECT count(*)::integer
    INTO v_batch_count
    FROM inserted_logs;

    v_processed_count := v_processed_count + coalesce(v_batch_count, 0);

    UPDATE public.automation_runs
    SET status = 'completed',
        completed_at = now(),
        processed_count = v_processed_count,
        error_message = NULL
    WHERE id = v_run_id;
  EXCEPTION WHEN OTHERS THEN
    -- The exception block rolls back both automation batches, so the durable
    -- run record must not report rows that were rolled back with the failure.
    v_processed_count := 0;

    UPDATE public.automation_runs
    SET status = 'failed',
        completed_at = now(),
        processed_count = v_processed_count,
        error_message = SQLERRM
    WHERE id = v_run_id;

    RAISE WARNING 'Daily automation run % failed: %', v_run_id, SQLERRM;
  END;
END;
$$;

REVOKE ALL ON FUNCTION public.run_daily_automations() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.run_daily_automations() TO service_role;

-- Dashboard aggregate RPCs return compact summaries instead of contribution rows.

CREATE INDEX IF NOT EXISTS idx_contributions_created_at
  ON public.contributions (created_at DESC);

CREATE OR REPLACE FUNCTION public.get_platform_dashboard_metrics()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_six_months_ago timestamptz := date_trunc('month', now()) - interval '5 months';
BEGIN
  IF NOT public.is_platform_super_admin(auth.uid()) THEN
    RAISE EXCEPTION 'You do not have permission to view platform dashboard metrics.';
  END IF;

  RETURN jsonb_build_object(
    'church_count', (SELECT count(*) FROM public.churches),
    'member_count', (SELECT count(*) FROM public.members),
    'contribution_total', (SELECT coalesce(sum(amount), 0) FROM public.contributions),
    'subscription_count', (SELECT count(*) FROM public.subscriptions),
    'monthly_revenue', (
      SELECT coalesce(jsonb_agg(month_row ORDER BY month_start), '[]'::jsonb)
      FROM (
        SELECT
          month_start,
          jsonb_build_object(
            'month', to_char(month_start, 'Mon'),
            'revenue', coalesce(totals.revenue, 0)
          ) AS month_row
        FROM generate_series(v_six_months_ago, date_trunc('month', now()), interval '1 month') AS months(month_start)
        LEFT JOIN (
          SELECT date_trunc('month', created_at) AS month_start, sum(amount) AS revenue
          FROM public.contributions
          WHERE created_at >= v_six_months_ago
          GROUP BY 1
        ) totals USING (month_start)
      ) monthly
    ),
    'recent_churches', (
      SELECT coalesce(jsonb_agg(row_data ORDER BY created_at DESC), '[]'::jsonb)
      FROM (
        SELECT
          created_at,
          jsonb_build_object('id', id, 'name', name, 'code', code, 'email', email, 'created_at', created_at) AS row_data
        FROM public.churches
        ORDER BY created_at DESC
        LIMIT 5
      ) recent
    ),
    'recent_activity', (
      SELECT coalesce(jsonb_agg(row_data ORDER BY created_at DESC), '[]'::jsonb)
      FROM (
        SELECT
          created_at,
          jsonb_build_object(
            'id', id,
            'action', event_type,
            'detail', coalesce(metadata ->> 'detail', metadata ->> 'entity_type', ''),
            'entity_type', metadata ->> 'entity_type',
            'created_at', created_at
          ) AS row_data
        FROM public.security_audit_events
        ORDER BY created_at DESC
        LIMIT 6
      ) recent
    )
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_platform_dashboard_metrics() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_platform_dashboard_metrics() TO authenticated;

CREATE OR REPLACE FUNCTION public.get_church_dashboard_metrics(p_church_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_month_start timestamptz := date_trunc('month', now());
  v_next_month timestamptz := date_trunc('month', now()) + interval '1 month';
  v_last_month_start timestamptz := date_trunc('month', now()) - interval '1 month';
  v_six_months_ago timestamptz := date_trunc('month', now()) - interval '5 months';
BEGIN
  IF p_church_id IS NULL OR NOT public.can_manage_church_workspace(auth.uid(), p_church_id) THEN
    RAISE EXCEPTION 'You do not have permission to view church dashboard metrics.';
  END IF;

  RETURN jsonb_build_object(
    'total_members', (SELECT count(*) FROM public.members WHERE church_id = p_church_id),
    'active_members', (SELECT count(*) FROM public.members WHERE church_id = p_church_id AND status = 'active'),
    'this_month_giving', (
      SELECT coalesce(sum(amount), 0)
      FROM public.contributions
      WHERE church_id = p_church_id AND created_at >= v_month_start AND created_at < v_next_month
    ),
    'last_month_giving', (
      SELECT coalesce(sum(amount), 0)
      FROM public.contributions
      WHERE church_id = p_church_id AND created_at >= v_last_month_start AND created_at < v_month_start
    ),
    'monthly_giving', (
      SELECT coalesce(jsonb_agg(month_row ORDER BY month_start), '[]'::jsonb)
      FROM (
        SELECT
          month_start,
          jsonb_build_object(
            'key', to_char(month_start, 'YYYY-MM'),
            'month', to_char(month_start, 'Mon'),
            'amount', coalesce(totals.amount, 0)
          ) AS month_row
        FROM generate_series(v_six_months_ago, v_month_start, interval '1 month') AS months(month_start)
        LEFT JOIN (
          SELECT date_trunc('month', created_at) AS month_start, sum(amount) AS amount
          FROM public.contributions
          WHERE church_id = p_church_id AND created_at >= v_six_months_ago
          GROUP BY 1
        ) totals USING (month_start)
      ) monthly
    ),
    'recent_contributions', (
      SELECT coalesce(jsonb_agg(row_data ORDER BY created_at DESC), '[]'::jsonb)
      FROM (
        SELECT
          created_at,
          jsonb_build_object('id', id, 'amount', amount, 'created_at', created_at, 'donor_name', donor_name) AS row_data
        FROM public.contributions
        WHERE church_id = p_church_id
        ORDER BY created_at DESC
        LIMIT 5
      ) recent
    ),
    'attendance_confirmed', (
      SELECT count(*) FROM public.event_attendances WHERE church_id = p_church_id AND response = 'yes'
    ),
    'upcoming_events', (
      SELECT coalesce(jsonb_agg(row_data ORDER BY start_date ASC), '[]'::jsonb)
      FROM (
        SELECT
          start_date,
          jsonb_build_object('id', id, 'title', title, 'start_date', start_date, 'created_at', created_at) AS row_data
        FROM public.events
        WHERE church_id = p_church_id AND start_date >= now()
        ORDER BY start_date ASC
        LIMIT 20
      ) upcoming
    )
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_church_dashboard_metrics(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_church_dashboard_metrics(uuid) TO authenticated;

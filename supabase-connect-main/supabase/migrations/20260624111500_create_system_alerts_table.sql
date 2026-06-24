CREATE TABLE IF NOT EXISTS public.system_alerts (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    alert_type text NOT NULL,
    severity text NOT NULL CHECK (
        severity IN ('info', 'warning', 'critical')
    ),
    title text NOT NULL,
    message text,
    source text,
    resolved boolean DEFAULT false,
    resolved_at timestamptz,
    created_at timestamptz DEFAULT now()
);

ALTER TABLE public.system_alerts
ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admins can view system alerts"
ON public.system_alerts
FOR SELECT
TO authenticated
USING (
    public.is_super_admin()
);

GRANT SELECT
ON public.system_alerts
TO authenticated;

CREATE INDEX IF NOT EXISTS idx_system_alerts_created_at
ON public.system_alerts(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_system_alerts_severity
ON public.system_alerts(severity);

CREATE INDEX IF NOT EXISTS idx_system_alerts_resolved
ON public.system_alerts(resolved);

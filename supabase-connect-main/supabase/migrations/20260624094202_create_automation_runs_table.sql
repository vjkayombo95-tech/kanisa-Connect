CREATE TABLE IF NOT EXISTS public.automation_runs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

    run_date date NOT NULL UNIQUE,

    status text NOT NULL CHECK (
        status IN ('running', 'completed', 'failed')
    ),

    started_at timestamptz,
    completed_at timestamptz,

    error_message text,

    processed_count integer NOT NULL DEFAULT 0,

    created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.automation_runs
ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view automation runs"
ON public.automation_runs
FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1
        FROM public.profiles p
        WHERE p.id = auth.uid()
        AND p.role = 'admin'
    )
);

CREATE INDEX IF NOT EXISTS idx_automation_runs_date
ON public.automation_runs(run_date DESC);

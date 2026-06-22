
-- Platform fees table to track 1% fees on mass intentions and prayer request offerings
CREATE TABLE public.platform_fees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  church_id uuid NOT NULL REFERENCES public.churches(id),
  source_type text NOT NULL, -- 'mass_intention' or 'prayer_request'
  source_id uuid,
  gross_amount numeric NOT NULL,
  fee_percentage numeric NOT NULL DEFAULT 1.0,
  fee_amount numeric NOT NULL,
  net_amount numeric NOT NULL,
  member_id uuid REFERENCES public.members(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.platform_fees ENABLE ROW LEVEL SECURITY;

-- Church admins and super admins can view fees
CREATE POLICY "Church admins can view platform fees"
ON public.platform_fees FOR SELECT
USING (is_church_admin(auth.uid(), church_id) OR is_super_admin(auth.uid()));

-- System inserts via authenticated users
CREATE POLICY "Authenticated users can insert platform fees"
ON public.platform_fees FOR INSERT
TO authenticated
WITH CHECK (is_church_member(auth.uid(), church_id));

-- Super admins full access
CREATE POLICY "Super admins manage platform fees"
ON public.platform_fees FOR ALL
USING (is_super_admin(auth.uid()));

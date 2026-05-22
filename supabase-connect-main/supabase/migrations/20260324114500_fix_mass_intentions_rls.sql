-- Fix mass intention RLS so members and church admins can update rows correctly.

DROP POLICY IF EXISTS "Users manage own mass intentions" ON public.mass_intentions;
DROP POLICY IF EXISTS "Members can insert own mass intentions" ON public.mass_intentions;
DROP POLICY IF EXISTS "Allow all inserts" ON public.mass_intentions;
DROP POLICY IF EXISTS "Allow select for authenticated" ON public.mass_intentions;
DROP POLICY IF EXISTS "Church members can view mass intentions" ON public.mass_intentions;
DROP POLICY IF EXISTS "Church members can create mass intentions" ON public.mass_intentions;
DROP POLICY IF EXISTS "Church admins can manage mass intentions" ON public.mass_intentions;

CREATE POLICY "Church members can view mass intentions"
ON public.mass_intentions
FOR SELECT
USING (
  church_id IN (
    SELECT ur.church_id
    FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
  )
);

CREATE POLICY "Members can create own mass intentions"
ON public.mass_intentions
FOR INSERT
WITH CHECK (
  member_id IN (
    SELECT m.id
    FROM public.members m
    WHERE m.user_id = auth.uid()
      AND m.church_id = mass_intentions.church_id
  )
);

CREATE POLICY "Members can update own mass intentions"
ON public.mass_intentions
FOR UPDATE
USING (
  member_id IN (
    SELECT m.id
    FROM public.members m
    WHERE m.user_id = auth.uid()
      AND m.church_id = mass_intentions.church_id
  )
)
WITH CHECK (
  member_id IN (
    SELECT m.id
    FROM public.members m
    WHERE m.user_id = auth.uid()
      AND m.church_id = mass_intentions.church_id
  )
);

CREATE POLICY "Church admins can manage mass intentions"
ON public.mass_intentions
FOR UPDATE
USING (
  church_id IN (
    SELECT ur.church_id
    FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
      AND ur.role IN ('church_admin', 'pastor', 'secretary', 'treasurer')
  )
)
WITH CHECK (
  church_id IN (
    SELECT ur.church_id
    FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
      AND ur.role IN ('church_admin', 'pastor', 'secretary', 'treasurer')
  )
);

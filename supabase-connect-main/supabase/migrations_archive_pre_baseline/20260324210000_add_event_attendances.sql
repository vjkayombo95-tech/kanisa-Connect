CREATE TABLE public.event_attendances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  church_id UUID NOT NULL REFERENCES public.churches(id) ON DELETE CASCADE,
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  member_id UUID NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  response TEXT NOT NULL CHECK (response IN ('yes', 'no')),
  responded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (event_id, member_id)
);

CREATE INDEX idx_event_attendances_church ON public.event_attendances(church_id);
CREATE INDEX idx_event_attendances_event ON public.event_attendances(event_id);
CREATE INDEX idx_event_attendances_member ON public.event_attendances(member_id);

CREATE TRIGGER update_event_attendances_updated_at
BEFORE UPDATE ON public.event_attendances
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.event_attendances ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Church admins can manage event attendances"
ON public.event_attendances
FOR ALL
USING (public.is_church_admin(auth.uid(), church_id))
WITH CHECK (public.is_church_admin(auth.uid(), church_id));

CREATE POLICY "Church members can view own event attendances"
ON public.event_attendances
FOR SELECT
USING (
  public.is_super_admin(auth.uid())
  OR public.is_church_admin(auth.uid(), church_id)
  OR EXISTS (
    SELECT 1
    FROM public.members m
    WHERE m.id = event_attendances.member_id
      AND m.user_id = auth.uid()
      AND m.church_id = event_attendances.church_id
  )
);

CREATE POLICY "Church members can create own event attendances"
ON public.event_attendances
FOR INSERT
WITH CHECK (
  public.is_church_member(auth.uid(), church_id)
  AND EXISTS (
    SELECT 1
    FROM public.members m
    WHERE m.id = event_attendances.member_id
      AND m.user_id = auth.uid()
      AND m.church_id = event_attendances.church_id
  )
);

CREATE POLICY "Church members can update own event attendances"
ON public.event_attendances
FOR UPDATE
USING (
  EXISTS (
    SELECT 1
    FROM public.members m
    WHERE m.id = event_attendances.member_id
      AND m.user_id = auth.uid()
      AND m.church_id = event_attendances.church_id
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.members m
    WHERE m.id = event_attendances.member_id
      AND m.user_id = auth.uid()
      AND m.church_id = event_attendances.church_id
  )
);

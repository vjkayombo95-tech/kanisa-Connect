CREATE TABLE IF NOT EXISTS public.prayer_request_prayers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prayer_request_id UUID NOT NULL REFERENCES public.prayer_requests(id) ON DELETE CASCADE,
  church_id UUID NOT NULL REFERENCES public.churches(id) ON DELETE CASCADE,
  member_id UUID NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (prayer_request_id, member_id)
);

CREATE TABLE IF NOT EXISTS public.prayer_request_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prayer_request_id UUID NOT NULL REFERENCES public.prayer_requests(id) ON DELETE CASCADE,
  church_id UUID NOT NULL REFERENCES public.churches(id) ON DELETE CASCADE,
  member_id UUID REFERENCES public.members(id) ON DELETE SET NULL,
  author_name TEXT NOT NULL,
  comment TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_prayer_request_prayers_request_id
  ON public.prayer_request_prayers(prayer_request_id);

CREATE INDEX IF NOT EXISTS idx_prayer_request_prayers_church_id
  ON public.prayer_request_prayers(church_id);

CREATE INDEX IF NOT EXISTS idx_prayer_request_comments_request_id
  ON public.prayer_request_comments(prayer_request_id);

CREATE INDEX IF NOT EXISTS idx_prayer_request_comments_church_id
  ON public.prayer_request_comments(church_id);

ALTER TABLE public.prayer_request_prayers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prayer_request_comments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Church members can view prayer request prayers" ON public.prayer_request_prayers;
CREATE POLICY "Church members can view prayer request prayers"
ON public.prayer_request_prayers
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.members m
    WHERE m.user_id = auth.uid()
      AND m.church_id = prayer_request_prayers.church_id
  )
  OR EXISTS (
    SELECT 1
    FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
      AND ur.church_id = prayer_request_prayers.church_id
  )
);

DROP POLICY IF EXISTS "Church members can create own prayer marks" ON public.prayer_request_prayers;
CREATE POLICY "Church members can create own prayer marks"
ON public.prayer_request_prayers
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.members m
    WHERE m.id = prayer_request_prayers.member_id
      AND m.user_id = auth.uid()
      AND m.church_id = prayer_request_prayers.church_id
  )
);

DROP POLICY IF EXISTS "Church members can delete own prayer marks" ON public.prayer_request_prayers;
CREATE POLICY "Church members can delete own prayer marks"
ON public.prayer_request_prayers
FOR DELETE
USING (
  EXISTS (
    SELECT 1
    FROM public.members m
    WHERE m.id = prayer_request_prayers.member_id
      AND m.user_id = auth.uid()
      AND m.church_id = prayer_request_prayers.church_id
  )
);

DROP POLICY IF EXISTS "Church members can view prayer request comments" ON public.prayer_request_comments;
CREATE POLICY "Church members can view prayer request comments"
ON public.prayer_request_comments
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.members m
    WHERE m.user_id = auth.uid()
      AND m.church_id = prayer_request_comments.church_id
  )
  OR EXISTS (
    SELECT 1
    FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
      AND ur.church_id = prayer_request_comments.church_id
  )
);

DROP POLICY IF EXISTS "Church members can create prayer request comments" ON public.prayer_request_comments;
CREATE POLICY "Church members can create prayer request comments"
ON public.prayer_request_comments
FOR INSERT
WITH CHECK (
  (
    prayer_request_comments.member_id IS NULL
    AND EXISTS (
      SELECT 1
      FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.church_id = prayer_request_comments.church_id
    )
  )
  OR EXISTS (
    SELECT 1
    FROM public.members m
    WHERE m.id = prayer_request_comments.member_id
      AND m.user_id = auth.uid()
      AND m.church_id = prayer_request_comments.church_id
  )
);

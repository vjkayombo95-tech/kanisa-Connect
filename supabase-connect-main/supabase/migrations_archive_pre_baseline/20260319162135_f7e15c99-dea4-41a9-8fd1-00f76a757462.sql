
-- 1) Add offering_amount to prayer_requests for optional donations
ALTER TABLE public.prayer_requests ADD COLUMN IF NOT EXISTS offering_amount numeric DEFAULT NULL;

-- 2) Create help_comments table for community help discussions
CREATE TABLE public.help_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  help_request_id uuid NOT NULL REFERENCES public.community_help_requests(id) ON DELETE CASCADE,
  member_id uuid REFERENCES public.members(id),
  author_name text NOT NULL,
  comment text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.help_comments ENABLE ROW LEVEL SECURITY;

-- Members can view comments on help requests they can see
CREATE POLICY "Church members can view help comments"
ON public.help_comments FOR SELECT
USING (EXISTS (
  SELECT 1 FROM community_help_requests h
  WHERE h.id = help_comments.help_request_id
  AND (is_church_member(auth.uid(), h.church_id) OR is_super_admin(auth.uid()))
));

-- Members can create comments
CREATE POLICY "Church members can create help comments"
ON public.help_comments FOR INSERT
WITH CHECK (EXISTS (
  SELECT 1 FROM community_help_requests h
  WHERE h.id = help_comments.help_request_id
  AND is_church_member(auth.uid(), h.church_id)
));

-- Admins can delete comments
CREATE POLICY "Church admins can delete help comments"
ON public.help_comments FOR DELETE
USING (EXISTS (
  SELECT 1 FROM community_help_requests h
  WHERE h.id = help_comments.help_request_id
  AND is_church_admin(auth.uid(), h.church_id)
));

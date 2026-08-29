CREATE TABLE IF NOT EXISTS public.prayer_request_comment_reactions (
  comment_id uuid NOT NULL REFERENCES public.prayer_request_comments(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  emoji text NOT NULL CHECK (char_length(emoji) BETWEEN 1 AND 16),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (comment_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_prayer_request_comment_reactions_comment_id
  ON public.prayer_request_comment_reactions(comment_id, created_at);

ALTER TABLE public.prayer_request_comment_reactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "View prayer request comment reactions"
  ON public.prayer_request_comment_reactions;

DROP POLICY IF EXISTS "Create prayer request comment reactions"
  ON public.prayer_request_comment_reactions;

DROP POLICY IF EXISTS "Update own prayer request comment reactions"
  ON public.prayer_request_comment_reactions;

DROP POLICY IF EXISTS "Delete own prayer request comment reactions"
  ON public.prayer_request_comment_reactions;

CREATE POLICY "View prayer request comment reactions"
ON public.prayer_request_comment_reactions
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.prayer_request_comments prc
    WHERE prc.id = prayer_request_comment_reactions.comment_id
      AND public.has_related_feature_permission(
        'prayer_request_comments',
        to_jsonb(prc),
        'view'
      )
  )
);

CREATE POLICY "Create prayer request comment reactions"
ON public.prayer_request_comment_reactions
FOR INSERT
TO authenticated
WITH CHECK (
  user_id = auth.uid()
  AND EXISTS (
    SELECT 1
    FROM public.prayer_request_comments prc
    WHERE prc.id = prayer_request_comment_reactions.comment_id
      AND public.has_related_feature_permission(
        'prayer_request_comments',
        to_jsonb(prc),
        'create'
      )
  )
);

CREATE POLICY "Update own prayer request comment reactions"
ON public.prayer_request_comment_reactions
FOR UPDATE
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Delete own prayer request comment reactions"
ON public.prayer_request_comment_reactions
FOR DELETE
TO authenticated
USING (user_id = auth.uid());

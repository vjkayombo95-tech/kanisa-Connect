DROP POLICY IF EXISTS "Update own prayer request comment reactions"
  ON public.prayer_request_comment_reactions;

DROP POLICY IF EXISTS "Delete own prayer request comment reactions"
  ON public.prayer_request_comment_reactions;

CREATE POLICY "Update own prayer request comment reactions"
ON public.prayer_request_comment_reactions
FOR UPDATE
TO authenticated
USING (
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
)
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

CREATE POLICY "Delete own prayer request comment reactions"
ON public.prayer_request_comment_reactions
FOR DELETE
TO authenticated
USING (
  user_id = auth.uid()
  AND EXISTS (
    SELECT 1
    FROM public.prayer_request_comments prc
    WHERE prc.id = prayer_request_comment_reactions.comment_id
      AND public.has_related_feature_permission(
        'prayer_request_comments',
        to_jsonb(prc),
        'delete'
      )
  )
);

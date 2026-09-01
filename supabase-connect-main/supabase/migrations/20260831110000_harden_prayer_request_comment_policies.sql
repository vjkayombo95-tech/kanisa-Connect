ALTER TABLE public.prayer_request_comments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Church members can create prayer request comments"
  ON public.prayer_request_comments;
DROP POLICY IF EXISTS "Church members can view prayer request comments"
  ON public.prayer_request_comments;
DROP POLICY IF EXISTS "comments same church"
  ON public.prayer_request_comments;

CREATE POLICY "Parent-visible prayer request comments are readable"
ON public.prayer_request_comments
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.prayer_requests pr
    WHERE pr.id = prayer_request_comments.prayer_request_id
      AND pr.church_id = prayer_request_comments.church_id
      AND (
        EXISTS (
          SELECT 1
          FROM public.members owner_member
          WHERE owner_member.id = pr.member_id
            AND owner_member.user_id = auth.uid()
        )
        OR (
          pr.status = 'approved'
          AND pr.privacy IN ('public_to_church', 'anonymous_public')
          AND public.is_church_member(auth.uid(), pr.church_id)
        )
        OR public.can_review_pastoral_requests(pr.church_id)
      )
  )
);

CREATE POLICY "Parent-visible prayer request comments can be created"
ON public.prayer_request_comments
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.prayer_requests pr
    WHERE pr.id = prayer_request_comments.prayer_request_id
      AND pr.church_id = prayer_request_comments.church_id
      AND (
        (
          prayer_request_comments.member_id IS NOT NULL
          AND EXISTS (
            SELECT 1
            FROM public.members commenter_member
            WHERE commenter_member.id = prayer_request_comments.member_id
              AND commenter_member.user_id = auth.uid()
              AND commenter_member.church_id = prayer_request_comments.church_id
          )
        )
        OR (
          prayer_request_comments.member_id IS NULL
          AND EXISTS (
            SELECT 1
            FROM public.user_roles commenter_role
            WHERE commenter_role.user_id = auth.uid()
              AND commenter_role.church_id = prayer_request_comments.church_id
          )
        )
      )
      AND (
        EXISTS (
          SELECT 1
          FROM public.members owner_member
          WHERE owner_member.id = pr.member_id
            AND owner_member.user_id = auth.uid()
        )
        OR (
          pr.status = 'approved'
          AND pr.privacy IN ('public_to_church', 'anonymous_public')
          AND public.is_church_member(auth.uid(), pr.church_id)
        )
        OR public.can_review_pastoral_requests(pr.church_id)
      )
  )
);


-- Add community_id to contributions for community-scoped tracking
ALTER TABLE public.contributions ADD COLUMN IF NOT EXISTS community_id uuid REFERENCES public.communities(id);

-- Create index for community contribution queries
CREATE INDEX IF NOT EXISTS idx_contributions_community_id ON public.contributions(community_id);

-- Function: check if user is a leader of a specific community
CREATE OR REPLACE FUNCTION public.is_community_leader(_user_id uuid, _community_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.communities c
    JOIN public.members m ON m.user_id = _user_id AND m.church_id = c.church_id
    WHERE c.id = _community_id
    AND (
      c.mwenyekiti_id = m.id OR
      c.makamu_mwenyekiti_id = m.id OR
      c.katibu_id = m.id OR
      c.mweka_hazina_id = m.id
    )
  );
$$;

-- Function: get all communities a user leads with role info
CREATE OR REPLACE FUNCTION public.get_user_led_communities(_user_id uuid)
RETURNS TABLE(community_id uuid, community_name text, leadership_role text, church_id uuid)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT c.id, c.name::text,
    CASE
      WHEN c.mwenyekiti_id = m.id THEN 'Mwenyekiti'
      WHEN c.makamu_mwenyekiti_id = m.id THEN 'Makamu Mwenyekiti'
      WHEN c.katibu_id = m.id THEN 'Katibu'
      WHEN c.mweka_hazina_id = m.id THEN 'Mweka Hazina'
    END::text,
    c.church_id
  FROM public.communities c
  JOIN public.members m ON m.user_id = _user_id AND m.church_id = c.church_id
  WHERE c.mwenyekiti_id = m.id
    OR c.makamu_mwenyekiti_id = m.id
    OR c.katibu_id = m.id
    OR c.mweka_hazina_id = m.id;
$$;

-- RLS: Community leaders can insert contributions for their community
CREATE POLICY "Community leaders can insert community contributions"
ON public.contributions FOR INSERT
TO authenticated
WITH CHECK (
  community_id IS NOT NULL AND
  is_community_leader(auth.uid(), community_id)
);

-- RLS: Community leaders can view contributions for their community
CREATE POLICY "Community leaders can view community contributions"
ON public.contributions FOR SELECT
USING (
  community_id IS NOT NULL AND
  is_community_leader(auth.uid(), community_id)
);

-- RLS: Community leaders can view community members in their community
CREATE POLICY "Community leaders can view own community members"
ON public.community_members FOR SELECT
USING (is_community_leader(auth.uid(), community_id));

-- RLS: Community leaders can add members to their community
CREATE POLICY "Community leaders can add community members"
ON public.community_members FOR INSERT
TO authenticated
WITH CHECK (is_community_leader(auth.uid(), community_id));

-- RLS: Community leaders can remove members from their community
CREATE POLICY "Community leaders can remove community members"
ON public.community_members FOR DELETE
USING (is_community_leader(auth.uid(), community_id));

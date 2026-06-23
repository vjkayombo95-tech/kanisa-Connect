-- Phase 4 SaaS security hardening.
-- Service-role and SECURITY DEFINER backend functions retain their normal RLS bypass.
-- No policy in this migration grants unrestricted authenticated access.

-- Existing policies are already present in the baseline; RLS was not enabled there.
ALTER TABLE public.churches ENABLE ROW LEVEL SECURITY;

-- Church administrators may maintain their own workspace, but cannot modify another church.
CREATE POLICY "Security hardening: managers update own church"
ON public.churches
FOR UPDATE
TO authenticated
USING (public.can_manage_church_workspace(auth.uid(), id))
WITH CHECK (public.can_manage_church_workspace(auth.uid(), id));

-- Tenant-scoped operational tables.
ALTER TABLE public.automations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Security hardening: church users view automations"
ON public.automations
FOR SELECT
TO authenticated
USING (public.can_view_church_workspace(auth.uid(), church_id));
CREATE POLICY "Security hardening: managers manage automations"
ON public.automations
FOR ALL
TO authenticated
USING (public.can_manage_church_workspace(auth.uid(), church_id))
WITH CHECK (public.can_manage_church_workspace(auth.uid(), church_id));

ALTER TABLE public.church_staff ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Security hardening: church users view staff"
ON public.church_staff
FOR SELECT
TO authenticated
USING (public.can_view_church_workspace(auth.uid(), church_id));
CREATE POLICY "Security hardening: managers manage staff"
ON public.church_staff
FOR ALL
TO authenticated
USING (public.can_manage_church_workspace(auth.uid(), church_id))
WITH CHECK (public.can_manage_church_workspace(auth.uid(), church_id));

ALTER TABLE public.community_leaders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Security hardening: church users view community leaders"
ON public.community_leaders
FOR SELECT
TO authenticated
USING (public.can_view_church_workspace(auth.uid(), church_id));
CREATE POLICY "Security hardening: managers manage community leaders"
ON public.community_leaders
FOR ALL
TO authenticated
USING (public.can_manage_church_workspace(auth.uid(), church_id))
WITH CHECK (public.can_manage_church_workspace(auth.uid(), church_id));

ALTER TABLE public.birthday_announcement_automations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Security hardening: managers view birthday automations"
ON public.birthday_announcement_automations
FOR SELECT
TO authenticated
USING (public.can_manage_church_workspace(auth.uid(), church_id));

ALTER TABLE public.sermons ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Security hardening: church users view sermons"
ON public.sermons
FOR SELECT
TO authenticated
USING (public.can_view_church_workspace(auth.uid(), church_id));
CREATE POLICY "Security hardening: managers manage sermons"
ON public.sermons
FOR ALL
TO authenticated
USING (public.can_manage_church_workspace(auth.uid(), church_id))
WITH CHECK (public.can_manage_church_workspace(auth.uid(), church_id));

ALTER TABLE public.bible_verses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Security hardening: users view global or church bible verses"
ON public.bible_verses
FOR SELECT
TO authenticated
USING (
  church_id IS NULL
  OR public.can_view_church_workspace(auth.uid(), church_id)
);
CREATE POLICY "Security hardening: managers manage church bible verses"
ON public.bible_verses
FOR ALL
TO authenticated
USING (
  public.is_platform_super_admin(auth.uid())
  OR (church_id IS NOT NULL AND public.can_manage_church_workspace(auth.uid(), church_id))
)
WITH CHECK (
  public.is_platform_super_admin(auth.uid())
  OR (church_id IS NOT NULL AND public.can_manage_church_workspace(auth.uid(), church_id))
);

-- Automation logs have no church_id. Their member relationship is the tenant boundary.
ALTER TABLE public.automation_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Security hardening: managers view automation logs"
ON public.automation_logs
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.members m
    WHERE m.id = automation_logs.member_id
      AND public.can_manage_church_workspace(auth.uid(), m.church_id)
  )
);

-- Per-user records may only be accessed by the authenticated owner.
ALTER TABLE public.qr_codes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Security hardening: users manage own qr codes"
ON public.qr_codes
FOR ALL
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Security hardening: users view own legacy record"
ON public.users
FOR SELECT
TO authenticated
USING (id = auth.uid());

ALTER TABLE public.super_admins ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Security hardening: super admins view own marker"
ON public.super_admins
FOR SELECT
TO authenticated
USING (id = auth.uid());

-- groups has no church or user relationship in the frozen schema. Direct client
-- access is intentionally denied; service-role/backend processes remain available.
ALTER TABLE public.groups ENABLE ROW LEVEL SECURITY;

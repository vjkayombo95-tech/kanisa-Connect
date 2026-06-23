-- Treat explicitly assigned church staff managers as workspace managers.
-- This preserves the existing user_roles, profiles, ownership, and super-admin paths.

CREATE OR REPLACE FUNCTION public.can_manage_church_workspace(_user_id uuid, _church_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT _user_id IS NOT NULL
    AND _church_id IS NOT NULL
    AND (
      EXISTS (
        SELECT 1
        FROM public.user_roles ur
        WHERE ur.user_id = _user_id
          AND ur.church_id = _church_id
          AND lower(coalesce(ur.role::text, '')) IN (
            'church_admin', 'admin', 'pastor', 'secretary', 'treasurer'
          )
      )
      OR EXISTS (
        SELECT 1
        FROM public.profiles p
        WHERE p.id = _user_id
          AND p.church_id = _church_id
          AND lower(coalesce(p.role::text, '')) IN (
            'church_admin', 'admin', 'pastor', 'secretary', 'treasurer'
          )
      )
      OR EXISTS (
        SELECT 1
        FROM public.church_staff cs
        WHERE cs.user_id = _user_id
          AND cs.church_id = _church_id
          AND lower(coalesce(cs.role::text, '')) IN (
            'church_admin', 'admin', 'pastor', 'secretary', 'treasurer'
          )
      )
      OR EXISTS (
        SELECT 1
        FROM public.churches c
        WHERE c.id = _church_id
          AND (_user_id = c.owner_id OR _user_id = c.created_by)
      )
      OR EXISTS (
        SELECT 1
        FROM public.super_admins sa
        WHERE sa.id = _user_id
      )
    );
$$;

-- Phase 4A: canonical, append-only audit logging.
-- Existing audit tables remain intact for backward compatibility.

CREATE TABLE public.audit_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  church_id uuid REFERENCES public.churches(id) ON DELETE SET NULL,
  actor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  actor_role text,
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id uuid,
  old_values jsonb,
  new_values jsonb,
  source text NOT NULL DEFAULT 'database_trigger',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_events_church_created_at
  ON public.audit_events (church_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_events_entity
  ON public.audit_events (entity_type, entity_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_events_actor_created_at
  ON public.audit_events (actor_id, created_at DESC);

ALTER TABLE public.audit_events ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.audit_events FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.audit_events TO authenticated;

CREATE POLICY "Church managers and super admins read audit events"
ON public.audit_events
FOR SELECT
TO authenticated
USING (
  public.is_platform_super_admin(auth.uid())
  OR public.can_manage_church_workspace(auth.uid(), church_id)
);

-- This writer is for service-role/backend use only. It derives the actor from
-- auth.uid() and validates the tenant boundary; it never accepts an actor id.
CREATE OR REPLACE FUNCTION public.write_audit_event(
  p_church_id uuid,
  p_action text,
  p_entity_type text,
  p_entity_id uuid DEFAULT NULL,
  p_old_values jsonb DEFAULT NULL,
  p_new_values jsonb DEFAULT NULL,
  p_source text DEFAULT 'backend',
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor_id uuid := auth.uid();
  v_actor_role text;
  v_event_id uuid;
BEGIN
  IF p_action IS NULL OR nullif(trim(p_action), '') IS NULL THEN
    RAISE EXCEPTION 'Audit action is required.';
  END IF;

  IF p_entity_type IS NULL OR nullif(trim(p_entity_type), '') IS NULL THEN
    RAISE EXCEPTION 'Audit entity type is required.';
  END IF;

  IF p_church_id IS NOT NULL
    AND coalesce(auth.role(), '') <> 'service_role'
    AND NOT public.is_platform_super_admin(v_actor_id)
    AND NOT public.can_manage_church_workspace(v_actor_id, p_church_id) THEN
    RAISE EXCEPTION 'You do not have permission to write an audit event for this church.';
  END IF;

  IF coalesce(auth.role(), '') = 'service_role' THEN
    v_actor_role := 'service_role';
  ELSIF public.is_platform_super_admin(v_actor_id) THEN
    v_actor_role := 'super_admin';
  ELSE
    SELECT lower(coalesce(ur.role::text, ''))
    INTO v_actor_role
    FROM public.user_roles ur
    WHERE ur.user_id = v_actor_id
      AND ur.church_id = p_church_id
    LIMIT 1;
  END IF;

  INSERT INTO public.audit_events (
    church_id,
    actor_id,
    actor_role,
    action,
    entity_type,
    entity_id,
    old_values,
    new_values,
    source,
    metadata
  )
  VALUES (
    p_church_id,
    v_actor_id,
    nullif(v_actor_role, ''),
    left(trim(p_action), 200),
    left(trim(p_entity_type), 100),
    p_entity_id,
    p_old_values,
    p_new_values,
    left(coalesce(nullif(trim(p_source), ''), 'backend'), 100),
    coalesce(p_metadata, '{}'::jsonb)
  )
  RETURNING id INTO v_event_id;

  RETURN v_event_id;
END;
$$;

REVOKE ALL ON FUNCTION public.write_audit_event(uuid, text, text, uuid, jsonb, jsonb, text, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.write_audit_event(uuid, text, text, uuid, jsonb, jsonb, text, jsonb) TO service_role;

-- Trigger implementation is SECURITY DEFINER so successful protected writes
-- can be recorded even though clients have no INSERT policy on audit_events.
CREATE OR REPLACE FUNCTION public.audit_sensitive_row_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor_id uuid := auth.uid();
  v_actor_role text;
  v_church_id uuid;
  v_action text;
  v_entity_type text;
  v_entity_id uuid;
  v_old_values jsonb;
  v_new_values jsonb;
BEGIN
  IF TG_TABLE_NAME = 'contributions' THEN
    v_entity_type := 'contribution';
    IF TG_OP = 'DELETE' THEN
      v_church_id := OLD.church_id;
      v_entity_id := OLD.id;
      v_action := 'contribution.deleted';
    ELSE
      v_church_id := NEW.church_id;
      v_entity_id := NEW.id;
      v_action := 'contribution.updated';
    END IF;
  ELSIF TG_TABLE_NAME = 'church_staff' THEN
    v_church_id := NEW.church_id;
    v_entity_type := 'church_staff';
    v_entity_id := NEW.id;
    v_action := 'church_staff.role_changed';
  ELSIF TG_TABLE_NAME = 'subscriptions' THEN
    v_church_id := NEW.church_id;
    v_entity_type := 'subscription';
    v_entity_id := NEW.id;
    v_action := 'subscription.status_changed';
  ELSIF TG_TABLE_NAME = 'subscription_payments' THEN
    v_church_id := NEW.church_id;
    v_entity_type := 'subscription_payment';
    v_entity_id := NEW.id;
    v_action := 'subscription_payment.status_changed';
  ELSE
    RAISE EXCEPTION 'Unsupported audit trigger table: %', TG_TABLE_NAME;
  END IF;

  IF TG_OP = 'UPDATE' AND TG_TABLE_NAME = 'church_staff'
    AND OLD.role IS NOT DISTINCT FROM NEW.role THEN
    RETURN NEW;
  END IF;

  IF coalesce(auth.role(), '') = 'service_role' THEN
    v_actor_role := 'service_role';
  ELSIF public.is_platform_super_admin(v_actor_id) THEN
    v_actor_role := 'super_admin';
  ELSE
    SELECT lower(coalesce(ur.role::text, ''))
    INTO v_actor_role
    FROM public.user_roles ur
    WHERE ur.user_id = v_actor_id
      AND ur.church_id = v_church_id
    LIMIT 1;
  END IF;

  v_old_values := CASE WHEN TG_OP IN ('UPDATE', 'DELETE') THEN to_jsonb(OLD) ELSE NULL END;
  v_new_values := CASE WHEN TG_OP = 'UPDATE' THEN to_jsonb(NEW) ELSE NULL END;

  INSERT INTO public.audit_events (
    church_id,
    actor_id,
    actor_role,
    action,
    entity_type,
    entity_id,
    old_values,
    new_values,
    source,
    metadata
  )
  VALUES (
    v_church_id,
    v_actor_id,
    nullif(v_actor_role, ''),
    v_action,
    v_entity_type,
    v_entity_id,
    v_old_values,
    v_new_values,
    'database_trigger',
    jsonb_build_object('operation', TG_OP, 'table', TG_TABLE_NAME)
  );

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.audit_sensitive_row_change() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS audit_contributions_update_delete ON public.contributions;
CREATE TRIGGER audit_contributions_update_delete
AFTER UPDATE OR DELETE ON public.contributions
FOR EACH ROW EXECUTE FUNCTION public.audit_sensitive_row_change();

DROP TRIGGER IF EXISTS audit_church_staff_role_change ON public.church_staff;
CREATE TRIGGER audit_church_staff_role_change
AFTER UPDATE OF role ON public.church_staff
FOR EACH ROW EXECUTE FUNCTION public.audit_sensitive_row_change();

DROP TRIGGER IF EXISTS audit_subscriptions_status_change ON public.subscriptions;
CREATE TRIGGER audit_subscriptions_status_change
AFTER UPDATE OF status ON public.subscriptions
FOR EACH ROW EXECUTE FUNCTION public.audit_sensitive_row_change();

DROP TRIGGER IF EXISTS audit_subscription_payments_status_change ON public.subscription_payments;
CREATE TRIGGER audit_subscription_payments_status_change
AFTER UPDATE OF status ON public.subscription_payments
FOR EACH ROW EXECUTE FUNCTION public.audit_sensitive_row_change();

-- Compatibility view for the existing super-admin activity page. It is backed
-- solely by canonical audit_events and evaluates access with the caller's RLS.
CREATE OR REPLACE VIEW public.activity_logs
WITH (security_invoker = true)
AS
SELECT
  ae.id,
  ae.action,
  coalesce(ae.metadata ->> 'detail', ae.source) AS detail,
  ae.entity_id,
  ae.entity_type,
  ae.created_at,
  p.full_name AS user_name,
  ae.actor_role AS user_role
FROM public.audit_events ae
LEFT JOIN public.profiles p ON p.id = ae.actor_id;

REVOKE ALL ON TABLE public.activity_logs FROM PUBLIC, anon;
GRANT SELECT ON TABLE public.activity_logs TO authenticated;

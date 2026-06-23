-- The audit trigger is shared by tables with different row shapes.
-- Use JSON field access for the church_staff-only role comparison so PostgreSQL
-- does not try to resolve a role column on contributions or subscription tables.

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

  IF TG_OP = 'UPDATE'
    AND TG_TABLE_NAME = 'church_staff'
    AND (to_jsonb(OLD) ->> 'role') IS NOT DISTINCT FROM (to_jsonb(NEW) ->> 'role') THEN
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

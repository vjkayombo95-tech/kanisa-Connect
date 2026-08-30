DO $$
BEGIN
  IF to_regprocedure('public.has_related_feature_permission(text,jsonb,text)') IS NULL THEN
    EXECUTE $function$
      CREATE FUNCTION public.has_related_feature_permission(
        _table text,
        _row jsonb,
        _action text
      )
      RETURNS boolean
      LANGUAGE plpgsql
      STABLE
      SECURITY DEFINER
      SET search_path = pg_catalog, public
      AS $body$
      DECLARE
        v_church_id uuid := nullif(_row->>'church_id','')::uuid;
        v_feature text;
      BEGIN
        IF auth.uid() IS NULL OR _action NOT IN ('view','create','delete') THEN
          RETURN false;
        END IF;

        v_feature := CASE _table
          WHEN 'prayer_request_comments' THEN 'prayer_requests'
          WHEN 'prayer_request_prayers' THEN 'prayer_requests'
          ELSE NULL
        END;

        IF v_feature IS NULL OR v_church_id IS NULL THEN
          RETURN false;
        END IF;

        RETURN public.has_church_feature_permission(
          auth.uid(),
          v_church_id,
          v_feature,
          _action
        );
      END;
      $body$
    $function$;

    REVOKE ALL ON FUNCTION public.has_related_feature_permission(text, jsonb, text) FROM PUBLIC;
    GRANT EXECUTE ON FUNCTION public.has_related_feature_permission(text, jsonb, text) TO authenticated;
    GRANT EXECUTE ON FUNCTION public.has_related_feature_permission(text, jsonb, text) TO service_role;
  END IF;
END;
$$;

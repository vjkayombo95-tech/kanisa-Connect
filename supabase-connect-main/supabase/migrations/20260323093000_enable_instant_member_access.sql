ALTER TABLE public.members
ADD COLUMN IF NOT EXISTS verified boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.assign_default_member_role(_user_id uuid, _church_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF _user_id IS NULL OR _church_id IS NULL THEN
    RETURN;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND church_id = _church_id
  ) THEN
    INSERT INTO public.user_roles (user_id, church_id, role)
    VALUES (_user_id, _church_id, 'member');
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.complete_public_registration(
  _church_id uuid,
  _full_name text,
  _email text,
  _phone text,
  _gender public.gender_type,
  _photo_url text,
  _community_id uuid DEFAULT NULL,
  _ministry_ids uuid[] DEFAULT ARRAY[]::uuid[]
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _member_id uuid;
  _church_name text;
  _normalized_email text;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Authentication required');
  END IF;

  _normalized_email := lower(trim(coalesce(_email, '')));

  IF _church_id IS NULL OR coalesce(trim(_full_name), '') = '' OR _normalized_email = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Missing required registration fields');
  END IF;

  SELECT name INTO _church_name
  FROM public.churches
  WHERE id = _church_id;

  IF _church_name IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Church not found');
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.members
    WHERE church_id = _church_id
      AND lower(email) = _normalized_email
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'A member with this email already exists for this church');
  END IF;

  INSERT INTO public.members (
    full_name,
    email,
    phone,
    gender,
    photo_url,
    church_id,
    user_id,
    status,
    verified
  )
  VALUES (
    trim(_full_name),
    _normalized_email,
    nullif(trim(coalesce(_phone, '')), ''),
    _gender,
    nullif(trim(coalesce(_photo_url, '')), ''),
    _church_id,
    auth.uid(),
    'active',
    false
  )
  RETURNING id INTO _member_id;

  IF _community_id IS NOT NULL THEN
    INSERT INTO public.community_members (community_id, member_id)
    VALUES (_community_id, _member_id);
  END IF;

  IF coalesce(array_length(_ministry_ids, 1), 0) > 0 THEN
    INSERT INTO public.ministry_members (member_id, ministry_id)
    SELECT _member_id, ministry_id
    FROM unnest(_ministry_ids) AS ministry_id
    ON CONFLICT DO NOTHING;
  END IF;

  PERFORM public.assign_default_member_role(auth.uid(), _church_id);

  RETURN jsonb_build_object(
    'success', true,
    'member_id', _member_id,
    'church_id', _church_id,
    'church_name', _church_name
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.accept_invitation(_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  inv RECORD;
  result jsonb;
  _member_id uuid;
  _jwt_email text;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Authentication required');
  END IF;

  SELECT * INTO inv
  FROM public.invitations
  WHERE token = _token;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid invitation token');
  END IF;

  IF inv.status = 'accepted' THEN
    RETURN jsonb_build_object('success', false, 'error', 'This invitation has already been accepted');
  END IF;

  IF inv.status = 'revoked' THEN
    RETURN jsonb_build_object('success', false, 'error', 'This invitation has been revoked');
  END IF;

  IF inv.expires_at < now() THEN
    UPDATE public.invitations SET status = 'expired' WHERE id = inv.id;
    RETURN jsonb_build_object('success', false, 'error', 'This invitation has expired');
  END IF;

  _jwt_email := lower(coalesce(auth.jwt() ->> 'email', ''));
  IF _jwt_email = '' OR _jwt_email <> lower(inv.email) THEN
    RETURN jsonb_build_object('success', false, 'error', format('Please sign in as %s to accept this invitation', inv.email));
  END IF;

  SELECT id INTO _member_id
  FROM public.members
  WHERE church_id = inv.church_id
    AND lower(email) = lower(inv.email)
  LIMIT 1;

  IF _member_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'No matching member record was found for this invitation');
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.members
    WHERE id = _member_id
      AND user_id IS NOT NULL
      AND user_id <> auth.uid()
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'This invitation has already been linked to another account');
  END IF;

  UPDATE public.members
  SET
    user_id = auth.uid(),
    church_id = inv.church_id,
    status = 'active'
  WHERE id = _member_id;

  PERFORM public.assign_default_member_role(auth.uid(), inv.church_id);

  UPDATE public.invitations
  SET status = 'accepted'
  WHERE id = inv.id;

  SELECT jsonb_build_object(
    'success', true,
    'church_id', inv.church_id,
    'role', 'member',
    'church_name', c.name,
    'member_id', _member_id
  ) INTO result
  FROM public.churches c
  WHERE c.id = inv.church_id;

  RETURN result;
END;
$$;

-- Function to accept an invitation: validates token, creates user_role, marks invitation accepted
-- Must be called by an authenticated user
CREATE OR REPLACE FUNCTION public.accept_invitation(_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  inv RECORD;
  existing_role RECORD;
  result jsonb;
BEGIN
  -- Find the invitation
  SELECT * INTO inv FROM public.invitations WHERE token = _token;
  
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
  
  -- Check if user already has a role in this church
  SELECT * INTO existing_role FROM public.user_roles 
  WHERE user_id = auth.uid() AND church_id = inv.church_id;
  
  IF FOUND THEN
    -- Update existing role
    UPDATE public.user_roles SET role = inv.role WHERE id = existing_role.id;
  ELSE
    -- Create new role
    INSERT INTO public.user_roles (user_id, church_id, role)
    VALUES (auth.uid(), inv.church_id, inv.role);
  END IF;
  
  -- Mark invitation as accepted
  UPDATE public.invitations SET status = 'accepted' WHERE id = inv.id;
  
  -- Get church name for response
  SELECT jsonb_build_object(
    'success', true,
    'church_id', inv.church_id,
    'role', inv.role,
    'church_name', c.name
  ) INTO result
  FROM public.churches c WHERE c.id = inv.church_id;
  
  RETURN result;
END;
$$;

-- Allow anyone to read invitations by token (for the acceptance page to show details)
CREATE POLICY "Anyone can read invitation by token"
ON public.invitations FOR SELECT
USING (true);
-- Preserve the function body and privileges while pinning name resolution for
-- the SECURITY DEFINER overload that accepts (uuid, text).

alter function public.assign_default_member_role(uuid, text)
  set search_path = public, pg_temp;

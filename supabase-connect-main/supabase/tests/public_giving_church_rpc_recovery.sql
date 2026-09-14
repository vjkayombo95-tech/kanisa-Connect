begin;

do $$
declare
  v_exists boolean;
  v_security_definer boolean;
  v_search_path text[];
  v_anon_execute boolean;
  v_authenticated_execute boolean;
  v_public_execute boolean;
begin
  select exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'get_public_giving_church'
      and p.oid = 'public.get_public_giving_church(text)'::regprocedure
  )
  into v_exists;

  if not v_exists then
    raise exception 'get_public_giving_church(text) is missing';
  end if;

  select p.prosecdef, p.proconfig
  into v_security_definer, v_search_path
  from pg_proc p
  where p.oid = 'public.get_public_giving_church(text)'::regprocedure;

  if not v_security_definer then
    raise exception 'get_public_giving_church(text) must be SECURITY DEFINER';
  end if;

  if v_search_path is null or not ('search_path=public' = any(v_search_path)) then
    raise exception 'get_public_giving_church(text) must set search_path=public';
  end if;

  select has_function_privilege('anon', 'public.get_public_giving_church(text)', 'EXECUTE')
  into v_anon_execute;

  select has_function_privilege('authenticated', 'public.get_public_giving_church(text)', 'EXECUTE')
  into v_authenticated_execute;

  select has_function_privilege('public', 'public.get_public_giving_church(text)', 'EXECUTE')
  into v_public_execute;

  if not v_anon_execute then
    raise exception 'anon must have EXECUTE on get_public_giving_church(text)';
  end if;

  if not v_authenticated_execute then
    raise exception 'authenticated must have EXECUTE on get_public_giving_church(text)';
  end if;

  if v_public_execute then
    raise exception 'PUBLIC must not have EXECUTE on get_public_giving_church(text)';
  end if;
end
$$;

rollback;

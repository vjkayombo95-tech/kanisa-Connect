-- RC-1.1.4 Security Remediation: neutralize legacy hard-coded Super Admin bootstrap.
--
-- This migration intentionally does not remove or alter any Super Admin except
-- the legacy release-bootstrap email below. Future environments must create
-- Super Admins through the documented manual bootstrap process instead.

do $$
declare
  v_bootstrap_email constant text := 'hauletino55@gmail.com';
  v_user_id uuid;
  v_has_super_admin_id boolean := false;
  v_has_super_admin_user_id boolean := false;
  v_has_profiles_role boolean := false;
begin
  select u.id
  into v_user_id
  from auth.users u
  where lower(u.email) = v_bootstrap_email
  limit 1;

  if v_user_id is null then
    raise notice 'Legacy Super Admin bootstrap user % not found; no neutralization needed.', v_bootstrap_email;
    return;
  end if;

  select exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'super_admins'
      and column_name = 'id'
  )
  into v_has_super_admin_id;

  select exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'super_admins'
      and column_name = 'user_id'
  )
  into v_has_super_admin_user_id;

  if v_has_super_admin_id then
    execute 'delete from public.super_admins where id = $1'
    using v_user_id;
  end if;

  if v_has_super_admin_user_id then
    execute 'delete from public.super_admins where user_id = $1'
    using v_user_id;
  end if;

  select exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'profiles'
      and column_name = 'role'
  )
  into v_has_profiles_role;

  if v_has_profiles_role then
    update public.profiles
    set role = 'member'
    where id = v_user_id
      and role = 'super_admin';
  end if;

  raise notice 'Neutralized legacy hard-coded Super Admin bootstrap for %.', v_bootstrap_email;
end $$;

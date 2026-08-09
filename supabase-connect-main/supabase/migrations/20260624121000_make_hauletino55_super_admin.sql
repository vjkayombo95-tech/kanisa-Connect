-- Promote hauletino55@gmail.com to platform super admin.

do $$
declare
  v_user_id uuid;
  v_has_super_admin_id boolean := false;
  v_has_super_admin_user_id boolean := false;
  v_has_profile_role boolean := false;
begin
  select u.id
  into v_user_id
  from auth.users u
  where lower(u.email) = 'hauletino55@gmail.com'
  limit 1;

  if v_user_id is null then
    raise exception 'Cannot promote hauletino55@gmail.com: auth user not found';
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

  if v_has_super_admin_id and v_has_super_admin_user_id then
    execute 'insert into public.super_admins (id, user_id) values ($1, $1) on conflict do nothing'
    using v_user_id;
  elsif v_has_super_admin_user_id then
    execute 'insert into public.super_admins (user_id) values ($1) on conflict do nothing'
    using v_user_id;
  elsif v_has_super_admin_id then
    execute 'insert into public.super_admins (id) values ($1) on conflict do nothing'
    using v_user_id;
  else
    raise exception 'Cannot promote hauletino55@gmail.com: public.super_admins has neither id nor user_id';
  end if;

  select exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'profiles'
      and column_name = 'role'
  )
  into v_has_profile_role;

  if v_has_profile_role then
    execute '
      insert into public.profiles (id, role)
      values ($1, ''super_admin'')
      on conflict (id) do update
      set role = excluded.role
    '
    using v_user_id;
  end if;
end $$;

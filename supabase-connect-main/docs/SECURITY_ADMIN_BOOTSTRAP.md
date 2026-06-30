# Security Admin Bootstrap

Super Admin access must be granted deliberately per environment. Do not grant platform Super Admin privileges from automatic release migrations or hard-coded email addresses.

## Approved Process

1. Create or invite the user through Supabase Auth.
2. Confirm the user email and copy the user id from `auth.users`.
3. Run the manual SQL below from the Supabase SQL editor or another approved privileged database console.
4. Record the change in the deployment/security log with the operator, environment, user email, and timestamp.

Replace `admin@example.com` with the approved Super Admin email.

```sql
do $$
declare
  v_email text := lower('admin@example.com');
  v_user_id uuid;
  v_has_super_admin_id boolean := false;
  v_has_super_admin_user_id boolean := false;
begin
  select id
  into v_user_id
  from auth.users
  where lower(email) = v_email
  limit 1;

  if v_user_id is null then
    raise exception 'Cannot bootstrap Super Admin: auth user % not found', v_email;
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
    raise exception 'Cannot bootstrap Super Admin: public.super_admins has neither id nor user_id';
  end if;

  insert into public.profiles (id, role)
  values (v_user_id, 'super_admin')
  on conflict (id) do update
  set role = excluded.role;
end $$;
```

## Controls

- Use a named, approved human account. Do not use shared accounts.
- Use this process only after confirming the target environment.
- Never place real user emails in release migrations.
- Review Super Admin membership before production launch and after every emergency access change.
- Remove temporary Super Admin access manually after the support window closes.

## Why This Exists

Super Admin creation is an access-control event, not schema state. Keeping it outside automatic migrations prevents accidental privilege grants when a migration history is applied to staging, production, or a fresh recovery environment.

-- Remove only the empty member profile created as a side effect of the obsolete
-- 20260624121000 hard-coded Super Admin bootstrap. This is intentionally a
-- forward-only cleanup because that historical migration may already be recorded
-- in non-production environments.

do $$
declare
  v_user_id uuid;
begin
  select u.id
  into v_user_id
  from auth.users u
  where lower(u.email) = 'hauletino55@gmail.com'
  limit 1;

  if v_user_id is null then
    raise notice 'Legacy bootstrap account not found; no profile cleanup needed.';
    return;
  end if;

  delete from public.profiles p
  where p.id = v_user_id
    and p.role = 'member'
    and p.full_name is null
    and p.church_id is null
    and not exists (
      select 1
      from public.super_admins s
      where s.id = v_user_id
    );

  if found then
    raise notice 'Removed the empty member profile created by the obsolete legacy bootstrap.';
  else
    raise notice 'Legacy bootstrap profile was absent or contains real profile/privilege data; left unchanged.';
  end if;
end $$;

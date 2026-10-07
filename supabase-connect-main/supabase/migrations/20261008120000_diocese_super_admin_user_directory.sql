-- Super Admin helper for selecting existing users as Diocese staff.
-- This intentionally exposes only minimal identity fields and only to callers
-- who are already platform Super Admins.

create or replace function public.search_super_admin_user_directory(
  _search text default '',
  _limit integer default 25
)
returns table (
  user_id uuid,
  full_name text,
  email text
)
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $$
declare
  v_search text := lower(trim(coalesce(_search, '')));
  v_limit integer := least(greatest(coalesce(_limit, 25), 1), 50);
begin
  if auth.uid() is null then
    raise exception 'Authentication required'
      using errcode = '42501';
  end if;

  if not (
    public.is_platform_super_admin(auth.uid())
    or public.is_super_admin(auth.uid())
  ) then
    raise exception 'Super Admin access required'
      using errcode = '42501';
  end if;

  return query
  select
    au.id as user_id,
    coalesce(
      nullif(trim(p.full_name), ''),
      nullif(trim(au.raw_user_meta_data ->> 'full_name'), '')
    ) as full_name,
    au.email::text as email
  from auth.users au
  left join public.profiles p on p.id = au.id
  where v_search = ''
    or lower(coalesce(au.email, '')) like '%' || v_search || '%'
    or lower(coalesce(p.full_name, '')) like '%' || v_search || '%'
    or lower(coalesce(au.raw_user_meta_data ->> 'full_name', '')) like '%' || v_search || '%'
  order by
    coalesce(nullif(trim(p.full_name), ''), au.email, au.id::text),
    au.id
  limit v_limit;
end;
$$;

comment on function public.search_super_admin_user_directory(text, integer) is
  'Super Admin-only minimal user lookup for Diocese staff assignment. Does not grant Diocese or church authority.';

alter function public.search_super_admin_user_directory(text, integer) owner to postgres;

revoke all on function public.search_super_admin_user_directory(text, integer)
  from public, anon, authenticated;

grant execute on function public.search_super_admin_user_directory(text, integer)
  to authenticated, service_role;

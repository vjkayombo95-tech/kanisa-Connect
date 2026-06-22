-- Repair live databases where the legacy helper is missing and portal RPCs fail with 400.
-- Some live projects store the authenticated super admin id in super_admins.id,
-- while newer schema versions store it in super_admins.user_id.

create or replace function public.is_super_admin(_user_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  _has_user_id boolean := false;
  _has_id boolean := false;
  _is_admin boolean := false;
begin
  if _user_id is null then
    return false;
  end if;

  select exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'super_admins'
      and column_name = 'user_id'
  )
  into _has_user_id;

  if _has_user_id then
    execute 'select exists (select 1 from public.super_admins where user_id = $1)'
    using _user_id
    into _is_admin;

    if _is_admin then
      return true;
    end if;
  end if;

  select exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'super_admins'
      and column_name = 'id'
  )
  into _has_id;

  if _has_id then
    execute 'select exists (select 1 from public.super_admins where id = $1)'
    using _user_id
    into _is_admin;
  end if;

  return coalesce(_is_admin, false);
end;
$$;

revoke all on function public.is_super_admin(uuid) from public;
grant execute on function public.is_super_admin(uuid) to authenticated, service_role;

create or replace function public.get_portal_announcements(
  _church_id uuid,
  _limit integer default 50
)
returns table (
  id uuid,
  church_id uuid,
  title text,
  content text,
  is_published boolean,
  published_at timestamptz,
  created_by uuid,
  created_at timestamptz,
  updated_at timestamptz,
  archived_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  _safe_limit integer := least(greatest(coalesce(_limit, 50), 1), 100);
  _user_email text;
begin
  if auth.uid() is null or _church_id is null then
    return;
  end if;

  select email
  into _user_email
  from auth.users
  where id = auth.uid();

  if not (
    public.is_super_admin(auth.uid())
    or exists (
      select 1
      from public.user_roles ur
      where ur.user_id = auth.uid()
        and ur.church_id = _church_id
    )
    or exists (
      select 1
      from public.members m
      where m.church_id = _church_id
        and (
          m.user_id = auth.uid()
          or (
            _user_email is not null
            and m.email is not null
            and lower(trim(m.email)) = lower(trim(_user_email))
          )
        )
    )
    or exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and p.church_id = _church_id
    )
  ) then
    return;
  end if;

  return query
  select
    a.id,
    a.church_id,
    a.title,
    a.content,
    a.is_published,
    a.published_at,
    a.created_by,
    a.created_at,
    a.updated_at,
    a.archived_at
  from public.announcements a
  where a.church_id = _church_id
    and a.is_published = true
    and a.archived_at is null
  order by a.created_at desc
  limit _safe_limit;
end;
$$;

revoke all on function public.get_portal_announcements(uuid, integer) from public;
grant execute on function public.get_portal_announcements(uuid, integer) to authenticated;

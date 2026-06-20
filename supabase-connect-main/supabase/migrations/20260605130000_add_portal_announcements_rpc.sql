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
  if auth.uid() is null then
    return;
  end if;

  if _church_id is null then
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

grant execute on function public.get_portal_announcements(uuid, integer) to authenticated;

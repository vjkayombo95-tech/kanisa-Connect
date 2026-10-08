-- Slice 5B: member delivery of Diocese announcements.
--
-- Diocese announcement delivery is intentionally separate from
-- the parish announcement delivery RPC so Diocese announcement ids are never
-- treated as parish announcement ids by reactions/comments tables.

create or replace function public.get_member_diocese_announcements(
  _church_id uuid,
  _limit integer default 50
)
returns table (
  id uuid,
  diocese_id uuid,
  church_id uuid,
  diocese_name text,
  title text,
  content text,
  published_at timestamptz,
  created_at timestamptz,
  updated_at timestamptz,
  target_mode text,
  source text
)
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $$
declare
  v_actor uuid := auth.uid();
  v_limit integer := least(greatest(coalesce(_limit, 50), 1), 100);
begin
  if v_actor is null or _church_id is null then
    return;
  end if;

  if not (
    exists (
      select 1
      from public.church_memberships cm
      where cm.user_id = v_actor
        and cm.church_id = _church_id
        and cm.status = 'active'
    )
    or exists (
      select 1
      from public.members m
      where m.church_id = _church_id
        and m.user_id = v_actor
        and lower(coalesce(m.status, 'active')) in ('active', 'approved')
    )
  ) then
    return;
  end if;

  return query
  select
    da.id,
    da.diocese_id,
    _church_id as church_id,
    d.name as diocese_name,
    da.title,
    da.content,
    da.published_at,
    da.created_at,
    da.updated_at,
    da.target_mode,
    'diocese'::text as source
  from public.diocese_churches dc
  join public.dioceses d
    on d.id = dc.diocese_id
   and d.status = 'active'
  join public.diocese_announcements da
    on da.diocese_id = dc.diocese_id
  where dc.church_id = _church_id
    and dc.status = 'active'
    and da.status = 'published'
    and da.published_at is not null
    and da.archived_at is null
    and (
      da.target_mode = 'all_parishes'
      or (
        da.target_mode = 'selected_parishes'
        and exists (
          select 1
          from public.diocese_announcement_parish_targets dat
          where dat.announcement_id = da.id
            and dat.diocese_id = da.diocese_id
            and dat.church_id = _church_id
        )
      )
    )
  order by da.published_at desc, da.created_at desc, da.id desc
  limit v_limit;
end;
$$;

comment on function public.get_member_diocese_announcements(uuid, integer) is
  'Caller-bound member delivery of Diocese announcements for an authorized church context. It does not inspect Diocese staff authority and returns only member-safe read fields.';

alter function public.get_member_diocese_announcements(uuid, integer)
  owner to postgres;

revoke all on function public.get_member_diocese_announcements(uuid, integer)
  from public, anon, authenticated;

grant execute on function public.get_member_diocese_announcements(uuid, integer)
  to authenticated, service_role;

-- Slice 4: multi-church authorization hardening for member portal context.
--
-- Keep the legacy no-argument Jumuiya RPC for compatibility, but add an
-- explicit church-scoped overload used by active-church-aware clients.

create or replace function public.get_my_jumuiya_assignments(_church_id uuid)
returns table (
  community_name text,
  description text
)
language plpgsql
stable
parallel unsafe
security definer
set search_path = pg_catalog, public
as $$
declare
  v_actor uuid := auth.uid();
begin
  if v_actor is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if _church_id is null then
    return;
  end if;

  if not exists (
    select 1
    from public.church_memberships cm
    where cm.user_id = v_actor
      and cm.church_id = _church_id
      and cm.status = 'active'
  )
  and not exists (
    select 1
    from public.members m
    where m.user_id = v_actor
      and m.church_id = _church_id
      and lower(coalesce(m.status, 'active')) in ('active', 'approved')
  ) then
    return;
  end if;

  return query
  select x.community_name, x.description
  from (
    select
      c.id,
      c.name as community_name,
      c.description
    from public.members m
    join public.member_communities mc on mc.member_id = m.id
    join public.communities c on c.id = mc.community_id
    where m.user_id = v_actor
      and m.church_id = _church_id
      and c.church_id = m.church_id
    group by c.id, c.name, c.description
  ) x
  order by lower(coalesce(x.community_name, '')), x.id;
end;
$$;

comment on function public.get_my_jumuiya_assignments(uuid) is
  'Caller-bound member portal read. The requested church is accepted only when auth.uid() has an active canonical membership or active/approved member row in that church.';

create or replace function public.get_my_jumuiya_assignments()
returns table (
  community_name text,
  description text
)
language plpgsql
stable
parallel unsafe
security definer
set search_path = pg_catalog, public
as $$
declare
  v_actor uuid := auth.uid();
  v_church_id uuid;
begin
  if v_actor is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  select cm.church_id
  into v_church_id
  from public.church_memberships cm
  where cm.user_id = v_actor
    and cm.status = 'active'
  group by cm.church_id
  having count(*) >= 1
  order by bool_or(cm.is_primary) desc, min(cm.joined_at), cm.church_id
  limit 1;

  if (
    select count(distinct cm.church_id)
    from public.church_memberships cm
    where cm.user_id = v_actor
      and cm.status = 'active'
  ) > 1 then
    return;
  end if;

  if v_church_id is null then
    select m.church_id
    into v_church_id
    from public.members m
    where m.user_id = v_actor
      and m.church_id is not null
      and lower(coalesce(m.status, 'active')) in ('active', 'approved')
    group by m.church_id
    order by min(m.created_at), m.church_id
    limit 1;

    if (
      select count(distinct m.church_id)
      from public.members m
      where m.user_id = v_actor
        and m.church_id is not null
        and lower(coalesce(m.status, 'active')) in ('active', 'approved')
    ) > 1 then
      return;
    end if;
  end if;

  if v_church_id is null then
    return;
  end if;

  return query
  select *
  from public.get_my_jumuiya_assignments(v_church_id);
end;
$$;

comment on function public.get_my_jumuiya_assignments() is
  'Backward-compatible member portal read. Returns data only when auth.uid() resolves to a single active church; active-church clients should call get_my_jumuiya_assignments(uuid).';

create or replace function public.is_pledge_leader_for_community(_community_id uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select exists (
    select 1
    from public.members m
    join public.communities c
      on c.id = _community_id
     and c.church_id = m.church_id
    where m.user_id = auth.uid()
      and (
        c.chairperson_id = m.id
        or c.vice_chairperson_id = m.id
        or c.treasurer_id = m.id
        or c.secretary_id = m.id
        or c.katibu_id = m.id
        or c.mwenyekiti_id = m.id
        or c.makamu_mwenyekiti_id = m.id
        or c.mweka_hazina_id = m.id
      )
  );
$$;

revoke all on function public.get_my_jumuiya_assignments(uuid)
  from public, anon, authenticated, service_role;
revoke all on function public.get_my_jumuiya_assignments()
  from public, anon, authenticated, service_role;
revoke all on function public.is_pledge_leader_for_community(uuid)
  from public, anon, authenticated, service_role;

grant execute on function public.get_my_jumuiya_assignments(uuid)
  to authenticated;
grant execute on function public.get_my_jumuiya_assignments()
  to authenticated;
grant execute on function public.is_pledge_leader_for_community(uuid)
  to authenticated;

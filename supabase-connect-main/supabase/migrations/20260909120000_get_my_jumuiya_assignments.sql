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
  v_context jsonb;
  v_church_id uuid;
begin
  if v_actor is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  v_context := public.get_current_user_context();
  v_church_id := nullif(v_context ->> 'church_id', '')::uuid;

  if v_church_id is null then
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
      and m.church_id = v_church_id
      and c.church_id = m.church_id
    group by c.id, c.name, c.description
  ) x
  order by lower(coalesce(x.community_name, '')), x.id;
end;
$$;

comment on function public.get_my_jumuiya_assignments() is
  'Caller-bound member portal read. Returns all valid same-church Jumuiya assignments for auth.uid() in the current church context; ordering is for presentation only and does not imply primary membership.';

alter function public.get_my_jumuiya_assignments() owner to postgres;

revoke all on function public.get_my_jumuiya_assignments() from public, anon, authenticated, service_role;
grant execute on function public.get_my_jumuiya_assignments() to authenticated;

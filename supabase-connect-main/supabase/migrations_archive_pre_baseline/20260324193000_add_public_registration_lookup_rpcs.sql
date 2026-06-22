create or replace function public.get_public_registration_church(
  _church_code text default null,
  _church_id uuid default null
)
returns table (
  id uuid,
  name text,
  code text,
  metadata jsonb
)
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  select c.id, c.name, c.code, coalesce(c.metadata, '{}'::jsonb) as metadata
  from public.churches c
  where (
    _church_code is not null
    and btrim(_church_code) <> ''
    and c.code = btrim(_church_code)
  )
  or (
    _church_id is not null
    and c.id = _church_id
  )
  limit 1;
end;
$$;

create or replace function public.get_public_registration_communities(_church_id uuid)
returns table (
  id uuid,
  name text
)
language sql
security definer
set search_path = public
as $$
  select c.id, c.name
  from public.communities c
  where c.church_id = _church_id
  order by c.name;
$$;

create or replace function public.get_public_registration_ministries(_church_id uuid)
returns table (
  id uuid,
  name text
)
language sql
security definer
set search_path = public
as $$
  select m.id, m.name
  from public.ministries m
  where m.church_id = _church_id
  order by m.name;
$$;

grant execute on function public.get_public_registration_church(text, uuid) to anon, authenticated;
grant execute on function public.get_public_registration_communities(uuid) to anon, authenticated;
grant execute on function public.get_public_registration_ministries(uuid) to anon, authenticated;

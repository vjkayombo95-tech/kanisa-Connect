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
declare
  normalized_code text := nullif(btrim(_church_code), '');
  legacy_suffix text := null;
begin
  if normalized_code is not null and normalized_code ~* '([a-f0-9]{6})$' then
    legacy_suffix := upper(substring(normalized_code from '([A-Fa-f0-9]{6})$'));
  end if;

  return query
  select c.id, c.name, c.code, coalesce(c.metadata, '{}'::jsonb) as metadata
  from public.churches c
  where (
    normalized_code is not null
    and upper(c.code) = upper(normalized_code)
  )
  or (
    _church_id is not null
    and c.id = _church_id
  )
  or (
    legacy_suffix is not null
    and right(replace(c.id::text, '-', ''), 6) = legacy_suffix
  )
  order by
    case
      when normalized_code is not null and upper(c.code) = upper(normalized_code) then 0
      when _church_id is not null and c.id = _church_id then 1
      else 2
    end
  limit 1;
end;
$$;

grant execute on function public.get_public_registration_church(text, uuid) to anon, authenticated;

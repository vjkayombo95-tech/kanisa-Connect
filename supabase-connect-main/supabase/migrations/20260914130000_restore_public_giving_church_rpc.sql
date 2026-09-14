create or replace function public.get_public_giving_church(p_slug_or_id text)
returns table (
  id uuid,
  name text,
  slug text,
  logo_url text,
  tagline text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_lookup text := nullif(trim(coalesce(p_slug_or_id, '')), '');
  v_lookup_uuid uuid;
begin
  if v_lookup is null then
    return;
  end if;

  if v_lookup ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    v_lookup_uuid := v_lookup::uuid;
  end if;

  return query
  select
    c.id,
    c.name,
    c.slug,
    c.logo_url,
    'Secure digital giving for your church community.'::text as tagline
  from public.churches c
  where c.status = 'active'
    and (
      lower(c.slug) = lower(v_lookup)
      or (v_lookup_uuid is not null and c.id = v_lookup_uuid)
    )
  order by case when lower(c.slug) = lower(v_lookup) then 0 else 1 end
  limit 1;
end;
$$;

revoke all on function public.get_public_giving_church(text) from public;
grant execute on function public.get_public_giving_church(text) to anon, authenticated;

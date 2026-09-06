create or replace function public.get_member_parish_schedule_masses(
  p_church_id uuid,
  p_from_date date default null
)
returns table (
  id uuid,
  occurrence_date date,
  start_time time,
  name text,
  location_name text,
  status text
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor uuid := auth.uid();
  v_from_date date := coalesce(p_from_date, (now() at time zone 'Africa/Dar_es_Salaam')::date);
begin
  if v_actor is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if p_church_id is null then
    raise exception 'Church context is required' using errcode = '22023';
  end if;

  if not (
    public.is_church_member(v_actor, p_church_id)
    or public.can_manage_church_workspace(v_actor, p_church_id)
    or public.is_super_admin()
  ) then
    raise exception 'Forbidden' using errcode = '42501';
  end if;

  return query
  select
    o.id,
    o.occurrence_date,
    o.start_time,
    o.name,
    o.location_name,
    o.status
  from public.mass_occurrences o
  where o.church_id = p_church_id
    and o.occurrence_date >= v_from_date
    and o.status in ('scheduled', 'rescheduled')
  order by o.occurrence_date asc, o.start_time asc nulls last, o.id asc;
end;
$$;

revoke all on function public.get_member_parish_schedule_masses(uuid, date) from public, anon;
grant execute on function public.get_member_parish_schedule_masses(uuid, date) to authenticated;

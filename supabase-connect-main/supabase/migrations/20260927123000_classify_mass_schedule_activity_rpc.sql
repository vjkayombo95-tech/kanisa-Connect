-- Transactional schedule activity classification for the Mass Timetable.
-- Keeps schedule and future generated occurrences in sync without replacing
-- occurrence IDs or touching historical/manual snapshot fields.

create or replace function public.classify_mass_schedule_activity(
  p_church_id uuid,
  p_schedule_id uuid,
  p_activity_type text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor uuid := auth.uid();
  v_schedule public.mass_schedules%rowtype;
  v_today date := (now() at time zone 'Africa/Dar_es_Salaam')::date;
  v_locked_count integer := 0;
  v_blocking_count integer := 0;
  v_updated_count integer := 0;
begin
  if v_actor is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if p_church_id is null or p_schedule_id is null then
    raise exception 'Church and schedule are required' using errcode = '22023';
  end if;

  if p_activity_type is null
    or p_activity_type not in ('mass', 'confession', 'adoration', 'prayer', 'other') then
    raise exception 'Choose a valid timetable activity type' using errcode = '22023';
  end if;

  if not (
    public.can_manage_church_workspace(v_actor, p_church_id)
    or public.is_super_admin()
  ) then
    raise exception 'Forbidden' using errcode = '42501';
  end if;

  select *
  into v_schedule
  from public.mass_schedules
  where id = p_schedule_id
    and church_id = p_church_id
  for update;

  if not found then
    raise exception 'Schedule not found for this church' using errcode = 'P0002';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('mass_occurrence:' || o.id::text, 0))
  from (
    select id
    from public.mass_occurrences
    where church_id = p_church_id
      and mass_schedule_id = p_schedule_id
      and occurrence_date >= v_today
      and status in ('scheduled', 'rescheduled')
    order by id
  ) o;

  with locked_occurrences as (
    select id
    from public.mass_occurrences
    where church_id = p_church_id
      and mass_schedule_id = p_schedule_id
      and occurrence_date >= v_today
      and status in ('scheduled', 'rescheduled')
    order by id
    for update
  )
  select count(*)::integer
  into v_locked_count
  from locked_occurrences;

  if p_activity_type <> 'mass' then
    select count(distinct o.id)::integer
    into v_blocking_count
    from public.mass_occurrences o
    join public.mass_intentions mi
      on mi.mass_occurrence_id = o.id
     and mi.church_id = o.church_id
    where o.church_id = p_church_id
      and o.mass_schedule_id = p_schedule_id
      and o.occurrence_date >= v_today
      and o.status in ('scheduled', 'rescheduled')
      and mi.status in ('pending', 'approved', 'scheduled', 'completed', 'archived');

    if v_blocking_count > 0 then
      raise exception 'Cannot change this schedule away from Mass because future occurrences already have Mass intentions. Resolve those intentions first.'
        using errcode = 'P0001';
    end if;
  end if;

  update public.mass_schedules
  set activity_type = p_activity_type,
      updated_at = now()
  where id = p_schedule_id
    and church_id = p_church_id;

  update public.mass_occurrences
  set activity_type = p_activity_type,
      updated_at = now()
  where church_id = p_church_id
    and mass_schedule_id = p_schedule_id
    and occurrence_date >= v_today
    and status in ('scheduled', 'rescheduled');

  get diagnostics v_updated_count = row_count;

  return jsonb_build_object(
    'success', true,
    'schedule_id', p_schedule_id,
    'activity_type', p_activity_type,
    'locked_occurrences', v_locked_count,
    'updated_occurrences', v_updated_count
  );
end;
$$;

grant execute on function public.classify_mass_schedule_activity(uuid, uuid, text) to authenticated;
revoke all on function public.classify_mass_schedule_activity(uuid, uuid, text) from public, anon;

comment on function public.classify_mass_schedule_activity(uuid, uuid, text) is
  'Classifies a schedule and its future scheduled/rescheduled occurrences transactionally while blocking changes away from Mass when future reserving Mass intentions exist.';

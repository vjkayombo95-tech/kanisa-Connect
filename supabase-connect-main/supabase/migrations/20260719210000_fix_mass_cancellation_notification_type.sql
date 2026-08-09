-- Preserve Mass cancellation atomicity by assigning the notification enum
-- explicitly instead of relying on an implicit text-to-enum conversion.

create or replace function public.sync_mass_occurrence_intentions()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if old.status not in ('completed', 'cancelled')
    and new.status in ('scheduled', 'rescheduled')
    and (old.occurrence_date, old.start_time, old.name, old.location_name)
      is distinct from
      (new.occurrence_date, new.start_time, new.name, new.location_name)
  then
    perform pg_catalog.set_config('app.mass_occurrence_snapshot_sync', 'on', true);

    update public.mass_intentions
    set mass_date = new.occurrence_date,
        mass_time = new.start_time::text,
        mass_name = new.name,
        mass_location = new.location_name
    where mass_occurrence_id = new.id
      and church_id = new.church_id;

    perform pg_catalog.set_config('app.mass_occurrence_snapshot_sync', 'off', true);
  end if;

  if old.status is distinct from new.status
    and new.status = 'cancelled'
    and pg_catalog.to_regclass('public.notifications') is not null
  then
    insert into public.notifications (church_id, user_id, title, message, type)
    select distinct
      new.church_id,
      m.user_id,
      'Misa imeghairiwa',
      new.name || ' ya ' || new.occurrence_date::text
        || ' imeghairiwa. Tafadhali wasiliana na ofisi ya parokia.',
      'warning'::public.notification_type
    from public.mass_intentions mi
    join public.members m
      on m.id = mi.member_id
     and m.church_id = new.church_id
    where mi.mass_occurrence_id = new.id
      and mi.church_id = new.church_id
      and m.user_id is not null;
  end if;

  return new;
end;
$$;

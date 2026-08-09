-- RC-12.2.6 - Relax legacy Daily Readings date requirement
-- Canonical liturgical imports store the date on public.liturgical_days.date
-- and link readings through public.daily_readings.liturgical_day_id.

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'daily_readings'
      and column_name = 'reading_date'
  ) then
    alter table public.daily_readings
      alter column reading_date drop not null;

    comment on column public.daily_readings.reading_date is
      'Legacy compatibility column. Canonical liturgical imports use liturgical_days.date via daily_readings.liturgical_day_id.';
  end if;
end $$;

-- RC-12.1 - Liturgical Database Foundation
-- Staging-only foundation for canonical liturgical calendar imports.

create table if not exists public.liturgical_days (
  id uuid primary key default gen_random_uuid(),
  date date not null unique,
  celebration text not null,
  season text not null default '',
  week text not null default '',
  liturgical_year text not null check (liturgical_year in ('A', 'B', 'C')),
  weekday_cycle text not null check (weekday_cycle in ('I', 'II')),
  liturgical_color text not null check (liturgical_color in ('green', 'purple', 'white', 'red', 'rose', 'gold')),
  rank text not null check (rank in ('weekday', 'optional_memorial', 'memorial', 'feast', 'solemnity', 'sunday', 'holy_day')),
  holy_day_of_obligation boolean not null default false,
  saint text,
  lectionary_number text not null default '',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.daily_readings (
  id uuid primary key default gen_random_uuid(),
  liturgical_day_id uuid not null references public.liturgical_days(id) on delete cascade,
  first_reading_reference text not null,
  responsorial_psalm_reference text not null,
  psalm_response text not null,
  second_reading_reference text,
  gospel_acclamation text,
  gospel_reference text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (liturgical_day_id)
);

alter table public.daily_readings
  add column if not exists liturgical_day_id uuid references public.liturgical_days(id) on delete cascade,
  add column if not exists first_reading_reference text,
  add column if not exists responsorial_psalm_reference text,
  add column if not exists psalm_response text,
  add column if not exists second_reading_reference text,
  add column if not exists gospel_acclamation text,
  add column if not exists gospel_reference text;

create unique index if not exists daily_readings_liturgical_day_id_key
  on public.daily_readings (liturgical_day_id)
  where liturgical_day_id is not null;

create index if not exists idx_liturgical_days_date
  on public.liturgical_days (date);

create index if not exists idx_liturgical_days_season
  on public.liturgical_days (season);

create index if not exists idx_liturgical_days_rank
  on public.liturgical_days (rank);

create index if not exists idx_liturgical_days_liturgical_year
  on public.liturgical_days (liturgical_year);

create index if not exists idx_daily_readings_liturgical_day_id
  on public.daily_readings (liturgical_day_id);

drop trigger if exists update_liturgical_days_updated_at on public.liturgical_days;
create trigger update_liturgical_days_updated_at
before update on public.liturgical_days
for each row
execute function public.update_updated_at_column();

drop trigger if exists update_daily_readings_updated_at on public.daily_readings;
create trigger update_daily_readings_updated_at
before update on public.daily_readings
for each row
execute function public.update_updated_at_column();

alter table public.liturgical_days enable row level security;
alter table public.daily_readings enable row level security;

drop policy if exists "Authenticated users can read liturgical days" on public.liturgical_days;
create policy "Authenticated users can read liturgical days"
on public.liturgical_days
for select
to authenticated
using (true);

drop policy if exists "Super admins can insert liturgical days" on public.liturgical_days;
create policy "Super admins can insert liturgical days"
on public.liturgical_days
for insert
to authenticated
with check (public.is_super_admin());

drop policy if exists "Super admins can update liturgical days" on public.liturgical_days;
create policy "Super admins can update liturgical days"
on public.liturgical_days
for update
to authenticated
using (public.is_super_admin())
with check (public.is_super_admin());

drop policy if exists "Super admins can delete liturgical days" on public.liturgical_days;
create policy "Super admins can delete liturgical days"
on public.liturgical_days
for delete
to authenticated
using (public.is_super_admin());

drop policy if exists "Authenticated users can read daily readings" on public.daily_readings;
create policy "Authenticated users can read daily readings"
on public.daily_readings
for select
to authenticated
using (true);

drop policy if exists "Super admins can insert daily readings" on public.daily_readings;
create policy "Super admins can insert daily readings"
on public.daily_readings
for insert
to authenticated
with check (public.is_super_admin());

drop policy if exists "Super admins can update daily readings" on public.daily_readings;
create policy "Super admins can update daily readings"
on public.daily_readings
for update
to authenticated
using (public.is_super_admin())
with check (public.is_super_admin());

drop policy if exists "Super admins can delete daily readings" on public.daily_readings;
create policy "Super admins can delete daily readings"
on public.daily_readings
for delete
to authenticated
using (public.is_super_admin());

grant select, insert, update, delete on public.liturgical_days to authenticated;
grant select, insert, update, delete on public.daily_readings to authenticated;

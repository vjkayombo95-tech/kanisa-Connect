-- Recurring and one-off Mass timetable, with capacity-safe intention booking.
-- Additive and forward-only: legacy Mass intention snapshot columns remain authoritative
-- whenever mass_occurrence_id is null.

create table if not exists public.mass_schedules (
  id uuid primary key default gen_random_uuid(),
  church_id uuid not null references public.churches(id) on delete cascade,
  name text not null,
  day_of_week integer not null,
  start_time time not null,
  end_time time,
  location_id uuid,
  location_name text,
  language text,
  default_celebrant_name text,
  intention_capacity integer,
  default_intention_fee numeric,
  accepts_intentions boolean not null default true,
  effective_from date not null default ((now() at time zone 'Africa/Dar_es_Salaam')::date),
  effective_until date,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.mass_occurrences (
  id uuid primary key default gen_random_uuid(),
  church_id uuid not null references public.churches(id) on delete cascade,
  mass_schedule_id uuid references public.mass_schedules(id) on delete restrict,
  occurrence_date date not null,
  start_time time not null,
  end_time time,
  name text not null,
  location_id uuid,
  location_name text,
  language text,
  celebrant_name text,
  intention_capacity integer,
  intention_fee numeric,
  accepts_intentions boolean not null default true,
  status text not null default 'scheduled',
  is_special_mass boolean not null default false,
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Repair-safe for an interrupted or independently-created draft of either table.
alter table public.mass_schedules
  add column if not exists id uuid default gen_random_uuid(),
  add column if not exists church_id uuid,
  add column if not exists name text,
  add column if not exists day_of_week integer,
  add column if not exists start_time time,
  add column if not exists end_time time,
  add column if not exists location_id uuid,
  add column if not exists location_name text,
  add column if not exists language text,
  add column if not exists default_celebrant_name text,
  add column if not exists intention_capacity integer,
  add column if not exists default_intention_fee numeric,
  add column if not exists accepts_intentions boolean not null default true,
  add column if not exists effective_from date,
  add column if not exists effective_until date,
  add column if not exists is_active boolean not null default true,
  add column if not exists sort_order integer not null default 0,
  add column if not exists created_by uuid,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

alter table public.mass_occurrences
  add column if not exists id uuid default gen_random_uuid(),
  add column if not exists church_id uuid,
  add column if not exists mass_schedule_id uuid,
  add column if not exists occurrence_date date,
  add column if not exists start_time time,
  add column if not exists end_time time,
  add column if not exists name text,
  add column if not exists location_id uuid,
  add column if not exists location_name text,
  add column if not exists language text,
  add column if not exists celebrant_name text,
  add column if not exists intention_capacity integer,
  add column if not exists intention_fee numeric,
  add column if not exists accepts_intentions boolean not null default true,
  add column if not exists status text not null default 'scheduled',
  add column if not exists is_special_mass boolean not null default false,
  add column if not exists notes text,
  add column if not exists created_by uuid,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

alter table public.mass_intentions
  add column if not exists mass_occurrence_id uuid,
  add column if not exists mass_location text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'mass_schedules_day_of_week_check' and conrelid = 'public.mass_schedules'::regclass) then
    alter table public.mass_schedules add constraint mass_schedules_day_of_week_check check (day_of_week between 0 and 6);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'mass_schedules_capacity_check' and conrelid = 'public.mass_schedules'::regclass) then
    alter table public.mass_schedules add constraint mass_schedules_capacity_check check (intention_capacity is null or intention_capacity >= 0);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'mass_schedules_fee_check' and conrelid = 'public.mass_schedules'::regclass) then
    alter table public.mass_schedules add constraint mass_schedules_fee_check check (default_intention_fee is null or default_intention_fee >= 0);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'mass_schedules_dates_check' and conrelid = 'public.mass_schedules'::regclass) then
    alter table public.mass_schedules add constraint mass_schedules_dates_check check (effective_until is null or effective_until >= effective_from);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'mass_schedules_times_check' and conrelid = 'public.mass_schedules'::regclass) then
    alter table public.mass_schedules add constraint mass_schedules_times_check check (end_time is null or end_time > start_time);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'mass_occurrences_capacity_check' and conrelid = 'public.mass_occurrences'::regclass) then
    alter table public.mass_occurrences add constraint mass_occurrences_capacity_check check (intention_capacity is null or intention_capacity >= 0);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'mass_occurrences_fee_check' and conrelid = 'public.mass_occurrences'::regclass) then
    alter table public.mass_occurrences add constraint mass_occurrences_fee_check check (intention_fee is null or intention_fee >= 0);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'mass_occurrences_times_check' and conrelid = 'public.mass_occurrences'::regclass) then
    alter table public.mass_occurrences add constraint mass_occurrences_times_check check (end_time is null or end_time > start_time);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'mass_occurrences_status_check' and conrelid = 'public.mass_occurrences'::regclass) then
    alter table public.mass_occurrences add constraint mass_occurrences_status_check check (status in ('scheduled', 'cancelled', 'completed', 'rescheduled'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'mass_intentions_mass_occurrence_id_fkey' and conrelid = 'public.mass_intentions'::regclass) then
    alter table public.mass_intentions add constraint mass_intentions_mass_occurrence_id_fkey
      foreign key (mass_occurrence_id) references public.mass_occurrences(id) on delete restrict;
  end if;
end $$;

create unique index if not exists mass_schedules_id_church_uidx on public.mass_schedules(id, church_id);
create unique index if not exists mass_occurrences_id_church_uidx on public.mass_occurrences(id, church_id);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'mass_occurrences_schedule_church_fkey' and conrelid = 'public.mass_occurrences'::regclass) then
    alter table public.mass_occurrences add constraint mass_occurrences_schedule_church_fkey
      foreign key (mass_schedule_id, church_id) references public.mass_schedules(id, church_id) on delete restrict;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'mass_intentions_occurrence_church_fkey' and conrelid = 'public.mass_intentions'::regclass) then
    alter table public.mass_intentions add constraint mass_intentions_occurrence_church_fkey
      foreign key (mass_occurrence_id, church_id) references public.mass_occurrences(id, church_id) on delete restrict;
  end if;
end $$;

create unique index if not exists mass_occurrences_schedule_date_uidx
  on public.mass_occurrences(mass_schedule_id, occurrence_date)
  where mass_schedule_id is not null;
create index if not exists mass_schedules_church_day_idx on public.mass_schedules(church_id, day_of_week, start_time);
create index if not exists mass_occurrences_church_date_idx on public.mass_occurrences(church_id, occurrence_date, start_time);
create index if not exists mass_occurrences_church_status_date_idx on public.mass_occurrences(church_id, status, occurrence_date, start_time);
create index if not exists mass_schedules_church_active_idx on public.mass_schedules(church_id, day_of_week, start_time) where is_active;
create index if not exists mass_intentions_occurrence_idx on public.mass_intentions(mass_occurrence_id) where mass_occurrence_id is not null;

drop trigger if exists update_mass_schedules_updated_at on public.mass_schedules;
create trigger update_mass_schedules_updated_at before update on public.mass_schedules
for each row execute function public.update_updated_at_column();
drop trigger if exists update_mass_occurrences_updated_at on public.mass_occurrences;
create trigger update_mass_occurrences_updated_at before update on public.mass_occurrences
for each row execute function public.update_updated_at_column();

alter table public.mass_schedules enable row level security;
alter table public.mass_occurrences enable row level security;

drop policy if exists "Mass schedules visible in church" on public.mass_schedules;
create policy "Mass schedules visible in church" on public.mass_schedules for select to authenticated using (
  church_id is not null and (public.can_manage_church_workspace(auth.uid(), church_id) or public.is_super_admin())
);
drop policy if exists "Workspace managers manage Mass schedules" on public.mass_schedules;
create policy "Workspace managers manage Mass schedules" on public.mass_schedules for all to authenticated
using (public.can_manage_church_workspace(auth.uid(), church_id) or public.is_super_admin())
with check (public.can_manage_church_workspace(auth.uid(), church_id) or public.is_super_admin());

drop policy if exists "Mass occurrences visible in church" on public.mass_occurrences;
create policy "Mass occurrences visible in church" on public.mass_occurrences for select to authenticated using (
  church_id is not null and (public.can_manage_church_workspace(auth.uid(), church_id) or public.is_super_admin())
);

-- Member creation is RPC-only once an occurrence is selected. This closes the
-- legacy direct-insert path that could otherwise bypass capacity and pricing.
drop policy if exists "Members create their own pending mass intentions" on public.mass_intentions;
drop policy if exists "Workspace managers manage Mass occurrences" on public.mass_occurrences;
create policy "Workspace managers manage Mass occurrences" on public.mass_occurrences for all to authenticated
using (public.can_manage_church_workspace(auth.uid(), church_id) or public.is_super_admin())
with check (public.can_manage_church_workspace(auth.uid(), church_id) or public.is_super_admin());

create or replace function public.generate_mass_occurrences(p_church_id uuid, p_start_date date, p_end_date date)
returns integer language plpgsql security definer set search_path = public, pg_temp as $$
declare v_created integer := 0;
begin
  if p_church_id is null or p_start_date is null or p_end_date is null or p_end_date < p_start_date then
    raise exception 'A valid church and date range are required' using errcode = '22023';
  end if;
  if p_end_date > p_start_date + 365 then
    raise exception 'Generation window cannot exceed 365 days' using errcode = '22023';
  end if;
  if not (public.can_manage_church_workspace(auth.uid(), p_church_id) or public.is_super_admin()) then
    raise exception 'Forbidden' using errcode = '42501';
  end if;
  insert into public.mass_occurrences (
    church_id, mass_schedule_id, occurrence_date, start_time, end_time, name,
    location_id, location_name, language, celebrant_name, intention_capacity,
    intention_fee, accepts_intentions, status, is_special_mass, created_by
  )
  select s.church_id, s.id, d::date, s.start_time, s.end_time, s.name,
    s.location_id, s.location_name, s.language, s.default_celebrant_name,
    s.intention_capacity, s.default_intention_fee, s.accepts_intentions,
    'scheduled', false, auth.uid()
  from public.mass_schedules s
  cross join generate_series(p_start_date, p_end_date, interval '1 day') d
  where s.church_id = p_church_id and s.is_active
    and d::date >= s.effective_from and (s.effective_until is null or d::date <= s.effective_until)
    and extract(dow from d)::integer = s.day_of_week
  on conflict (mass_schedule_id, occurrence_date) where mass_schedule_id is not null do nothing;
  get diagnostics v_created = row_count;
  return v_created;
end $$;

create or replace function public.get_available_mass_occurrences(p_church_id uuid, p_date date default null)
returns table (
  id uuid, occurrence_date date, start_time time, end_time time, name text,
  location_name text, language text, celebrant_name text, intention_capacity integer,
  intention_fee numeric, booked_count bigint, remaining_slots integer, is_full boolean,
  is_special_mass boolean, status text
) language plpgsql stable security definer set search_path = public, pg_temp as $$
begin
  if not (
    public.is_church_member(auth.uid(), p_church_id)
    or public.can_manage_church_workspace(auth.uid(), p_church_id)
    or public.is_super_admin()
  ) then raise exception 'Forbidden' using errcode = '42501'; end if;
  return query
  select o.id, o.occurrence_date, o.start_time, o.end_time, o.name, o.location_name,
    o.language, o.celebrant_name, o.intention_capacity, o.intention_fee,
    count(mi.id) filter (where mi.status in ('pending','approved','scheduled','completed','archived')) as booked_count,
    case when o.intention_capacity is null then null else greatest(o.intention_capacity - count(mi.id) filter (where mi.status in ('pending','approved','scheduled','completed','archived'))::integer, 0) end,
    case when o.intention_capacity is null then false else count(mi.id) filter (where mi.status in ('pending','approved','scheduled','completed','archived')) >= o.intention_capacity end,
    o.is_special_mass, o.status
  from public.mass_occurrences o
  left join public.mass_intentions mi on mi.mass_occurrence_id = o.id
  where o.church_id = p_church_id and o.accepts_intentions
    and o.status in ('scheduled','rescheduled') and o.occurrence_date >= (now() at time zone 'Africa/Dar_es_Salaam')::date
    and (p_date is null or o.occurrence_date = p_date)
  group by o.id
  order by o.occurrence_date, o.start_time;
end $$;

create or replace function public.enforce_mass_intention_occurrence_booking()
returns trigger language plpgsql security definer set search_path=public, pg_temp as $$
declare
  v_occ public.mass_occurrences%rowtype;
  v_booked integer;
  v_capacity integer;
  v_is_manager boolean;
  v_link_changed boolean;
  v_becomes_reserving boolean;
begin
  if tg_op = 'INSERT' then
    v_link_changed := true;
    v_becomes_reserving := new.status in ('pending','approved','scheduled','completed','archived');
  else
    v_link_changed := old.mass_occurrence_id is distinct from new.mass_occurrence_id;
    v_becomes_reserving := new.status in ('pending','approved','scheduled','completed','archived')
      and (old.status not in ('pending','approved','scheduled','completed','archived') or v_link_changed);
  end if;
  v_is_manager := coalesce(public.can_manage_church_workspace(auth.uid(), new.church_id), false)
    or coalesce(public.is_super_admin(), false);
  if tg_op = 'UPDATE'
    and (old.mass_occurrence_id is not null or new.mass_occurrence_id is not null)
    and coalesce(current_setting('app.mass_occurrence_snapshot_sync', true), '') <> 'on'
    and not v_is_manager
    and (
      v_link_changed
      or old.church_id is distinct from new.church_id
      or old.member_id is distinct from new.member_id
      or (old.mass_date, old.mass_time, old.mass_name, old.mass_location, old.amount, old.offering_amount)
         is distinct from
         (new.mass_date, new.mass_time, new.mass_name, new.mass_location, new.amount, new.offering_amount)
    ) then
    raise exception 'Mass occurrence and booking snapshots cannot be changed directly' using errcode='42501';
  end if;

  if new.mass_occurrence_id is null then
    return new;
  end if;

  if v_link_changed or tg_op = 'INSERT' then
    perform pg_advisory_xact_lock(hashtextextended('mass_occurrence:' || new.mass_occurrence_id::text, 0));
    select * into v_occ
    from public.mass_occurrences
    where id = new.mass_occurrence_id and church_id = new.church_id
    for update;
    if not found
      or not v_occ.accepts_intentions
      or v_occ.status not in ('scheduled','rescheduled')
      or v_occ.occurrence_date < (now() at time zone 'Africa/Dar_es_Salaam')::date then
      raise exception 'This Mass is no longer available for intentions' using errcode='P0001';
    end if;
    if v_becomes_reserving then
      select count(*) into v_booked
      from public.mass_intentions mi
      where mi.mass_occurrence_id = v_occ.id
        and mi.id is distinct from new.id
        and mi.status in ('pending','approved','scheduled','completed','archived');
      if v_occ.intention_capacity is not null and v_booked >= v_occ.intention_capacity then
        raise exception 'This Mass is fully booked' using errcode='P0001';
      end if;
    end if;
    new.church_id := v_occ.church_id;
    new.mass_date := v_occ.occurrence_date;
    new.mass_time := v_occ.start_time::text;
    new.mass_name := v_occ.name;
    new.mass_location := v_occ.location_name;
    new.amount := coalesce(v_occ.intention_fee, 0);
    new.offering_amount := coalesce(v_occ.intention_fee, 0);
  elsif tg_op = 'UPDATE' and v_becomes_reserving then
    perform pg_advisory_xact_lock(hashtextextended('mass_occurrence:' || new.mass_occurrence_id::text, 0));
    select * into v_occ
    from public.mass_occurrences
    where id = new.mass_occurrence_id and church_id = new.church_id
    for update;
    if not found
      or not v_occ.accepts_intentions
      or v_occ.status not in ('scheduled','rescheduled')
      or v_occ.occurrence_date < (now() at time zone 'Africa/Dar_es_Salaam')::date then
      raise exception 'This Mass is no longer available for intentions' using errcode='P0001';
    end if;
    v_capacity := v_occ.intention_capacity;
    select count(*) into v_booked from public.mass_intentions mi
    where mi.mass_occurrence_id = new.mass_occurrence_id
      and mi.id is distinct from new.id
      and mi.status in ('pending','approved','scheduled','completed','archived');
    if v_capacity is not null and v_booked >= v_capacity then
      raise exception 'This Mass is fully booked' using errcode='P0001';
    end if;
  end if;
  return new;
end $$;

drop trigger if exists enforce_mass_intention_occurrence_booking_trigger on public.mass_intentions;
create trigger enforce_mass_intention_occurrence_booking_trigger
before insert or update on public.mass_intentions
for each row execute function public.enforce_mass_intention_occurrence_booking();

create or replace function public.submit_portal_mass_intention_for_occurrence(
  p_church_id uuid, p_member_id uuid, p_mass_occurrence_id uuid,
  p_intention_type text, p_message text, p_offering_amount numeric,
  p_idempotency_key text
) returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_actor uuid := auth.uid(); v_occ public.mass_occurrences%rowtype; v_member_name text;
  v_existing uuid; v_id uuid; v_booked integer; v_amount numeric; v_gross numeric; v_fee numeric;
  v_key text := nullif(trim(coalesce(p_idempotency_key,'')), ''); v_message text := trim(coalesce(p_message,''));
begin
  if v_actor is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  if p_church_id is null or p_member_id is null or p_mass_occurrence_id is null then raise exception 'Church, member and Mass occurrence are required' using errcode = '22023'; end if;
  if v_key is null or v_message = '' then raise exception 'Message and submission key are required' using errcode = '22023'; end if;
  select full_name into v_member_name from public.members where id=p_member_id and church_id=p_church_id and user_id=v_actor;
  if v_member_name is null then raise exception 'Member does not belong to the authenticated user and church' using errcode='42501'; end if;
  select id into v_existing from public.mass_intentions where church_id=p_church_id and member_id=p_member_id and idempotency_key=v_key limit 1;
  if v_existing is not null then return jsonb_build_object('success',true,'id',v_existing,'created',false); end if;
  perform pg_advisory_xact_lock(hashtextextended('mass_occurrence:' || p_mass_occurrence_id::text, 0));
  select * into v_occ from public.mass_occurrences where id = p_mass_occurrence_id and church_id = p_church_id for update;
  if not found or not v_occ.accepts_intentions or v_occ.status not in ('scheduled','rescheduled') or v_occ.occurrence_date < (now() at time zone 'Africa/Dar_es_Salaam')::date then
    raise exception 'This Mass is no longer available for intentions' using errcode = 'P0001';
  end if;
  select count(*) into v_booked from public.mass_intentions where mass_occurrence_id=v_occ.id and status in ('pending','approved','scheduled','completed','archived');
  if v_occ.intention_capacity is not null and v_booked >= v_occ.intention_capacity then raise exception 'This Mass is fully booked' using errcode='P0001'; end if;
  -- p_offering_amount remains in the signature for client compatibility only.
  -- The occurrence fee is the sole authoritative amount.
  v_amount := coalesce(v_occ.intention_fee, 0);
  v_gross := case when v_amount > 0 then round(v_amount/0.99,2) else 0 end; v_fee := v_gross-v_amount;
  insert into public.mass_intentions (intention_type,intention,message,offering_amount,amount,member_id,church_id,mass_occurrence_id,mass_date,mass_time,mass_name,mass_location,requested_by_name,offered_for_name,status,idempotency_key)
  values (coalesce(nullif(trim(p_intention_type),''),'other'),v_message,'Tarehe ya Misa: '||v_occ.occurrence_date::text||E'\nMisa: '||v_occ.name||E'\n\n'||v_message,v_amount,v_amount,p_member_id,p_church_id,v_occ.id,v_occ.occurrence_date,v_occ.start_time::text,v_occ.name,v_occ.location_name,v_member_name,v_member_name,'pending',v_key)
  returning id into v_id;
  if v_amount > 0 then
    insert into public.platform_fees (church_id,source_type,source_id,gross_amount,fee_percentage,fee_amount,net_amount,member_id) values (p_church_id,'mass_intention',v_id,v_gross,1,v_fee,v_amount,p_member_id);
    insert into public.contributions (church_id,amount,donor_name,member_id,notes) values (p_church_id,v_amount,v_member_name,p_member_id,'Nia ya Misa: '||v_occ.name||' - '||v_occ.occurrence_date::text||' (TZS '||to_char(v_fee,'FM999999999990.00')||' platform fee)');
  end if;
  return jsonb_build_object('success',true,'id',v_id,'created',true);
end $$;

create or replace function public.sync_mass_occurrence_intentions()
returns trigger language plpgsql security definer set search_path=public, pg_temp as $$
begin
  if old.status not in ('completed','cancelled')
    and new.status in ('scheduled','rescheduled')
    and (old.occurrence_date, old.start_time, old.name, old.location_name) is distinct from (new.occurrence_date, new.start_time, new.name, new.location_name) then
    perform set_config('app.mass_occurrence_snapshot_sync', 'on', true);
    update public.mass_intentions set mass_date=new.occurrence_date, mass_time=new.start_time::text, mass_name=new.name, mass_location=new.location_name
    where mass_occurrence_id=new.id and church_id=new.church_id;
    perform set_config('app.mass_occurrence_snapshot_sync', 'off', true);
  end if;
  if old.status is distinct from new.status and new.status='cancelled' and to_regclass('public.notifications') is not null then
    insert into public.notifications(church_id,user_id,title,message,type)
    select distinct new.church_id,m.user_id,'Misa imeghairiwa',new.name||' ya '||new.occurrence_date::text||' imeghairiwa. Tafadhali wasiliana na ofisi ya parokia.','warning'
    from public.mass_intentions mi join public.members m on m.id=mi.member_id and m.church_id=new.church_id
    where mi.mass_occurrence_id=new.id and mi.church_id=new.church_id and m.user_id is not null;
  end if;
  return new;
end $$;
drop trigger if exists sync_mass_occurrence_intentions_trigger on public.mass_occurrences;
create trigger sync_mass_occurrence_intentions_trigger after update on public.mass_occurrences
for each row execute function public.sync_mass_occurrence_intentions();

create or replace function public.protect_mass_schedule_history()
returns trigger language plpgsql set search_path=public, pg_temp as $$
begin
  if exists(select 1 from public.mass_occurrences where mass_schedule_id=old.id) then
    raise exception 'Disable this schedule instead; it has historical Mass occurrences.' using errcode='P0001';
  end if;
  return old;
end $$;
drop trigger if exists protect_mass_schedule_history_trigger on public.mass_schedules;
create trigger protect_mass_schedule_history_trigger before delete on public.mass_schedules
for each row execute function public.protect_mass_schedule_history();

grant select, insert, update, delete on public.mass_schedules to authenticated;
grant select, insert, update, delete on public.mass_occurrences to authenticated;
grant execute on function public.generate_mass_occurrences(uuid,date,date) to authenticated;
grant execute on function public.get_available_mass_occurrences(uuid,date) to authenticated;
grant execute on function public.submit_portal_mass_intention_for_occurrence(uuid,uuid,uuid,text,text,numeric,text) to authenticated;

create or replace function public.get_mass_intentions_admin_page_v2(
  p_church_id uuid, p_search text default null, p_mass_date date default null,
  p_mass_time text default null, p_payment_status text default null,
  p_status text default null, p_mass_occurrence_id uuid default null,
  p_limit integer default 25, p_offset integer default 0
) returns jsonb language plpgsql security definer set search_path=public, pg_temp as $$
declare v_rows jsonb; v_count integer; v_summary jsonb; v_mass_times jsonb;
begin
  if not (public.can_manage_church_workspace(auth.uid(),p_church_id) or public.is_super_admin()) then raise exception 'Forbidden' using errcode='42501'; end if;
  select count(*) into v_count from public.mass_intentions mi left join public.members m on m.id=mi.member_id
  where mi.church_id=p_church_id and (p_mass_date is null or mi.mass_date=p_mass_date)
    and (p_mass_time is null or p_mass_time='all' or coalesce(mi.mass_time,mi.mass_name)=p_mass_time)
    and (p_payment_status is null or p_payment_status='all' or mi.payment_status=p_payment_status)
    and (p_status is null or p_status='all' or mi.status=p_status)
    and (p_mass_occurrence_id is null or mi.mass_occurrence_id=p_mass_occurrence_id)
    and (coalesce(trim(p_search),'')='' or lower(coalesce(mi.requested_by_name,'')||' '||coalesce(mi.offered_for_name,'')||' '||coalesce(mi.message,'')||' '||coalesce(m.full_name,'')) like '%'||lower(trim(p_search))||'%');
  select coalesce(jsonb_agg(x.obj order by x.created_at desc),'[]'::jsonb) into v_rows from (
    select mi.created_at, to_jsonb(mi) || jsonb_build_object(
      'members',case when m.id is null then null else jsonb_build_object('full_name',m.full_name,'email',m.email,'phone',m.phone) end,
      'mass_occurrence',case when o.id is null then null else jsonb_build_object('id',o.id,'name',o.name,'occurrence_date',o.occurrence_date,'start_time',o.start_time,'location_name',o.location_name,'celebrant_name',o.celebrant_name) end
    ) obj
    from public.mass_intentions mi left join public.members m on m.id=mi.member_id left join public.mass_occurrences o on o.id=mi.mass_occurrence_id
    where mi.church_id=p_church_id and (p_mass_date is null or mi.mass_date=p_mass_date)
      and (p_mass_time is null or p_mass_time='all' or coalesce(mi.mass_time,mi.mass_name)=p_mass_time)
      and (p_payment_status is null or p_payment_status='all' or mi.payment_status=p_payment_status)
      and (p_status is null or p_status='all' or mi.status=p_status)
      and (p_mass_occurrence_id is null or mi.mass_occurrence_id=p_mass_occurrence_id)
      and (coalesce(trim(p_search),'')='' or lower(coalesce(mi.requested_by_name,'')||' '||coalesce(mi.offered_for_name,'')||' '||coalesce(mi.message,'')||' '||coalesce(m.full_name,'')) like '%'||lower(trim(p_search))||'%')
    order by mi.created_at desc limit least(greatest(coalesce(p_limit,25),1),100) offset greatest(coalesce(p_offset,0),0)
  ) x;
  select jsonb_build_object('today',count(*) filter(where mass_date=(now() at time zone 'Africa/Dar_es_Salaam')::date),'pendingPayment',count(*) filter(where coalesce(payment_status,'pending')<>'paid'),'approved',count(*) filter(where status in ('approved','scheduled')),'collected',coalesce(sum(coalesce(amount,offering_amount,0)) filter(where payment_status='paid'),0)) into v_summary from public.mass_intentions where church_id=p_church_id;
  select coalesce(jsonb_agg(label order by label),'[]'::jsonb) into v_mass_times from (select distinct coalesce(mass_time,mass_name) label from public.mass_intentions where church_id=p_church_id and coalesce(mass_time,mass_name) is not null) q;
  return jsonb_build_object('rows',v_rows,'count',v_count,'summary',v_summary,'massTimeOptions',v_mass_times);
end $$;
grant execute on function public.get_mass_intentions_admin_page_v2(uuid,text,date,text,text,text,uuid,integer,integer) to authenticated;

revoke all on function public.generate_mass_occurrences(uuid,date,date) from public, anon;
revoke all on function public.get_available_mass_occurrences(uuid,date) from public, anon;
revoke all on function public.submit_portal_mass_intention_for_occurrence(uuid,uuid,uuid,text,text,numeric,text) from public, anon;
revoke all on function public.get_mass_intentions_admin_page_v2(uuid,text,date,text,text,text,uuid,integer,integer) from public, anon;
revoke all on function public.enforce_mass_intention_occurrence_booking() from public, anon, authenticated;
revoke all on function public.sync_mass_occurrence_intentions() from public, anon, authenticated;

comment on column public.mass_schedules.day_of_week is '0=Sunday, 1=Monday, ... 6=Saturday';
comment on column public.mass_intentions.mass_occurrence_id is 'Preferred Mass relationship; legacy rows may remain null and use snapshot fields.';

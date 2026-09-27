\set ON_ERROR_STOP on
begin;

create or replace function pg_temp.assert_true(_condition boolean, _label text)
returns void language plpgsql as $$
begin
  if not coalesce(_condition, false) then
    raise exception 'FAIL: %', _label;
  end if;
  raise notice 'PASS: %', _label;
end;
$$;

create or replace function pg_temp.assert_raises(_sql text, _sqlstate text, _label text)
returns void language plpgsql as $$
begin
  execute _sql;
  raise exception 'FAIL: %', _label;
exception
  when others then
    if sqlstate = _sqlstate then
      raise notice 'PASS: %', _label;
    else
      raise exception 'FAIL: % raised %, expected %', _label, sqlstate, _sqlstate;
    end if;
end;
$$;

insert into auth.users (id, email, aud, role, created_at, updated_at) values
  ('97000000-0000-4000-8000-000000000001', 'activity-admin@test.invalid', 'authenticated', 'authenticated', now(), now()),
  ('97000000-0000-4000-8000-000000000002', 'activity-member-a@test.invalid', 'authenticated', 'authenticated', now(), now()),
  ('97000000-0000-4000-8000-000000000003', 'activity-member-b@test.invalid', 'authenticated', 'authenticated', now(), now());

insert into public.churches (id, name, slug) values
  ('97000000-0000-4000-8000-000000000101', 'Activity Classification A', 'activity-classification-a'),
  ('97000000-0000-4000-8000-000000000102', 'Activity Classification B', 'activity-classification-b');

insert into public.user_roles (user_id, church_id, role) values
  ('97000000-0000-4000-8000-000000000001', '97000000-0000-4000-8000-000000000101', 'church_admin'),
  ('97000000-0000-4000-8000-000000000002', '97000000-0000-4000-8000-000000000101', 'member'),
  ('97000000-0000-4000-8000-000000000003', '97000000-0000-4000-8000-000000000102', 'member');

insert into public.members (id, church_id, user_id, full_name, status) values
  ('97000000-0000-4000-8000-000000000201', '97000000-0000-4000-8000-000000000101', '97000000-0000-4000-8000-000000000002', 'Activity Member A', 'active'),
  ('97000000-0000-4000-8000-000000000202', '97000000-0000-4000-8000-000000000102', '97000000-0000-4000-8000-000000000003', 'Activity Member B', 'active');

select pg_temp.assert_raises(
  $$insert into public.mass_schedules (
      church_id, name, day_of_week, start_time, effective_from, activity_type
    ) values (
      '97000000-0000-4000-8000-000000000101', 'Invalid activity', 0, '06:30', current_date, 'invalid'
    )$$,
  '23514',
  'mass_schedules rejects unsupported activity_type'
);

select pg_temp.assert_raises(
  $$insert into public.mass_occurrences (
      church_id, occurrence_date, start_time, name, activity_type
    ) values (
      '97000000-0000-4000-8000-000000000101', current_date, '06:30', 'Invalid occurrence', 'invalid'
    )$$,
  '23514',
  'mass_occurrences rejects unsupported activity_type'
);

insert into public.mass_schedules (
  id, church_id, name, day_of_week, start_time, effective_from, activity_type, is_active
) values (
  '97000000-0000-4000-8000-000000000301',
  '97000000-0000-4000-8000-000000000101',
  'Classified Mass',
  extract(dow from (now() at time zone 'Africa/Dar_es_Salaam')::date)::integer,
  '06:30',
  (now() at time zone 'Africa/Dar_es_Salaam')::date,
  'mass',
  true
), (
  '97000000-0000-4000-8000-000000000302',
  '97000000-0000-4000-8000-000000000101',
  'Classified Confession',
  extract(dow from (now() at time zone 'Africa/Dar_es_Salaam')::date)::integer,
  '08:30',
  (now() at time zone 'Africa/Dar_es_Salaam')::date,
  'confession',
  true
), (
  '97000000-0000-4000-8000-000000000303',
  '97000000-0000-4000-8000-000000000101',
  'Unclassified Historical Schedule',
  extract(dow from (now() at time zone 'Africa/Dar_es_Salaam')::date)::integer,
  '10:30',
  (now() at time zone 'Africa/Dar_es_Salaam')::date,
  null,
  true
), (
  '97000000-0000-4000-8000-000000000304',
  '97000000-0000-4000-8000-000000000101',
  'Reclassifiable Mass',
  extract(dow from (now() at time zone 'Africa/Dar_es_Salaam')::date)::integer,
  '12:30',
  (now() at time zone 'Africa/Dar_es_Salaam')::date,
  'mass',
  true
);

select set_config('request.jwt.claim.sub', '97000000-0000-4000-8000-000000000001', true);
select set_config('request.jwt.claim.email', 'activity-admin@test.invalid', true);
select set_config('request.jwt.claims', '{}', true);

select pg_temp.assert_true(
  public.generate_mass_occurrences(
    '97000000-0000-4000-8000-000000000101',
    (now() at time zone 'Africa/Dar_es_Salaam')::date,
    (now() at time zone 'Africa/Dar_es_Salaam')::date
  ) = 4,
  'generate_mass_occurrences creates classified and unclassified occurrences without backfill'
);

select pg_temp.assert_true(
  exists (
    select 1
    from public.mass_occurrences
    where mass_schedule_id = '97000000-0000-4000-8000-000000000301'
      and activity_type = 'mass'
  ),
  'generated Mass occurrence receives activity_type mass'
);

select pg_temp.assert_true(
  exists (
    select 1
    from public.mass_occurrences
    where mass_schedule_id = '97000000-0000-4000-8000-000000000302'
      and activity_type = 'confession'
  ),
  'generated Confession occurrence receives activity_type confession'
);

select pg_temp.assert_true(
  exists (
    select 1
    from public.mass_occurrences
    where mass_schedule_id = '97000000-0000-4000-8000-000000000303'
      and activity_type is null
  ),
  'unclassified schedule remains NULL after generation'
);

insert into public.mass_occurrences (
  id,
  church_id,
  mass_schedule_id,
  occurrence_date,
  start_time,
  name,
  location_name,
  activity_type,
  status
) values (
  '97000000-0000-4000-8000-000000000401',
  '97000000-0000-4000-8000-000000000101',
  '97000000-0000-4000-8000-000000000304',
  (now() at time zone 'Africa/Dar_es_Salaam')::date - 1,
  '12:30',
  'Past Reclassifiable Mass',
  'Historical Chapel',
  'mass',
  'scheduled'
);

update public.mass_occurrences
set name = 'Manual Override Name',
    location_name = 'Manual Chapel'
where mass_schedule_id = '97000000-0000-4000-8000-000000000304'
  and occurrence_date = (now() at time zone 'Africa/Dar_es_Salaam')::date;

select pg_temp.assert_true(
  (public.classify_mass_schedule_activity(
    '97000000-0000-4000-8000-000000000101',
    '97000000-0000-4000-8000-000000000304',
    'prayer'
  )->>'success')::boolean,
  'transactional schedule classification succeeds for authorized church admin'
);

select pg_temp.assert_true(
  exists (
    select 1
    from public.mass_schedules
    where id = '97000000-0000-4000-8000-000000000304'
      and church_id = '97000000-0000-4000-8000-000000000101'
      and activity_type = 'prayer'
  ),
  'transactional classification updates the schedule activity type'
);

select pg_temp.assert_true(
  exists (
    select 1
    from public.mass_occurrences
    where mass_schedule_id = '97000000-0000-4000-8000-000000000304'
      and occurrence_date = (now() at time zone 'Africa/Dar_es_Salaam')::date
      and activity_type = 'prayer'
      and name = 'Manual Override Name'
      and location_name = 'Manual Chapel'
  ),
  'transactional classification preserves occurrence ID and manual override fields'
);

select pg_temp.assert_true(
  exists (
    select 1
    from public.mass_occurrences
    where id = '97000000-0000-4000-8000-000000000401'
      and activity_type = 'mass'
  ),
  'transactional classification does not rewrite historical occurrences'
);

select set_config('request.jwt.claim.sub', '97000000-0000-4000-8000-000000000003', true);
select set_config('request.jwt.claim.email', 'activity-member-b@test.invalid', true);
select set_config('request.jwt.claims', '{}', true);

select pg_temp.assert_raises(
  $$select public.classify_mass_schedule_activity(
      '97000000-0000-4000-8000-000000000101',
      '97000000-0000-4000-8000-000000000304',
      'adoration'
    )$$,
  '42501',
  'transactional schedule classification rejects cross-church access'
);

select set_config('request.jwt.claim.sub', '97000000-0000-4000-8000-000000000002', true);
select set_config('request.jwt.claim.email', 'activity-member-a@test.invalid', true);
select set_config('request.jwt.claims', '{}', true);

select pg_temp.assert_true(
  exists (
    select 1
    from public.get_member_parish_schedule_masses(
      '97000000-0000-4000-8000-000000000101',
      (now() at time zone 'Africa/Dar_es_Salaam')::date
    )
    where activity_type = 'mass'
  ),
  'member-safe schedule RPC exposes same-church Mass activity type'
);

select pg_temp.assert_true(
  exists (
    select 1
    from public.get_member_parish_schedule_masses(
      '97000000-0000-4000-8000-000000000101',
      (now() at time zone 'Africa/Dar_es_Salaam')::date
    )
    where activity_type = 'confession'
  ),
  'member-safe schedule RPC exposes same-church Confession activity type'
);

select pg_temp.assert_raises(
  $$select * from public.get_member_parish_schedule_masses(
      '97000000-0000-4000-8000-000000000102',
      (now() at time zone 'Africa/Dar_es_Salaam')::date
    )$$,
  '42501',
  'member-safe schedule RPC rejects cross-church access'
);

select pg_temp.assert_true(
  (select count(*) from public.get_available_mass_occurrences('97000000-0000-4000-8000-000000000101', null)) = 1,
  'available Mass occurrence RPC only returns explicit Mass rows'
);

select pg_temp.assert_raises(
  format(
    $$select public.submit_portal_mass_intention_for_occurrence(
      '97000000-0000-4000-8000-000000000101',
      '97000000-0000-4000-8000-000000000201',
      %L::uuid,
      'thanksgiving',
      'Please pray for the family',
      0,
      'confession-blocked'
    )$$,
    (select id from public.mass_occurrences where mass_schedule_id = '97000000-0000-4000-8000-000000000302')
  ),
  'P0001',
  'portal Mass intention submission rejects Confession occurrence'
);

select pg_temp.assert_raises(
  format(
    $$select public.submit_portal_mass_intention_for_occurrence(
      '97000000-0000-4000-8000-000000000101',
      '97000000-0000-4000-8000-000000000201',
      %L::uuid,
      'thanksgiving',
      'Please pray for the family',
      0,
      'unclassified-blocked'
    )$$,
    (select id from public.mass_occurrences where mass_schedule_id = '97000000-0000-4000-8000-000000000303')
  ),
  'P0001',
  'portal Mass intention submission rejects unclassified occurrence'
);

select pg_temp.assert_true(
  (public.submit_portal_mass_intention_for_occurrence(
    '97000000-0000-4000-8000-000000000101',
    '97000000-0000-4000-8000-000000000201',
    (select id from public.mass_occurrences where mass_schedule_id = '97000000-0000-4000-8000-000000000301'),
    'thanksgiving',
    'Please pray for the family',
    0,
    'mass-allowed'
  )->>'success')::boolean,
  'portal Mass intention submission accepts explicit Mass occurrence'
);

select set_config('request.jwt.claim.sub', '97000000-0000-4000-8000-000000000001', true);
select set_config('request.jwt.claim.email', 'activity-admin@test.invalid', true);
select set_config('request.jwt.claims', '{}', true);

select pg_temp.assert_raises(
  $$select public.classify_mass_schedule_activity(
      '97000000-0000-4000-8000-000000000101',
      '97000000-0000-4000-8000-000000000301',
      'confession'
    )$$,
  'P0001',
  'transactional classification blocks changing a future booked Mass away from Mass'
);

select pg_temp.assert_true(
  exists (
    select 1
    from public.mass_schedules
    where id = '97000000-0000-4000-8000-000000000301'
      and activity_type = 'mass'
  ),
  'blocked classification leaves the schedule activity type unchanged'
);

select pg_temp.assert_true(
  exists (
    select 1
    from public.mass_occurrences
    where mass_schedule_id = '97000000-0000-4000-8000-000000000301'
      and activity_type = 'mass'
  ),
  'blocked classification leaves booked future occurrence activity type unchanged'
);

rollback;

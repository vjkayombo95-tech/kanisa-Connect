\set ON_ERROR_STOP on
begin;

select plan(14);

create or replace function pg_temp.assert_true(_condition boolean, _label text)
returns setof text language sql as $$
  select ok(coalesce(_condition, false), _label);
$$;

create or replace function pg_temp.prepared_source(
  _source_key text,
  _source_record_id text,
  _date text,
  _language text,
  _hash text,
  _gospel text default 'Luke 1:1-4',
  _celebration text default 'Execution Test Celebration'
)
returns jsonb language sql as $$
  select jsonb_build_object(
    'normalized_payload', jsonb_build_object(
      'source_key', _source_key,
      'source_record_id', _source_record_id,
      'source_version', 'fixture-v1',
      'reading_date', _date,
      'language_code', _language,
      'liturgical_year', null,
      'liturgical_season', 'Ordinary Time',
      'celebration', _celebration,
      'liturgical_color', 'Green',
      'first_reading_reference', 'Isaiah 1:1-2',
      'responsorial_psalm_reference', 'Psalm 1:1',
      'second_reading_reference', null,
      'gospel_acclamation_reference', null,
      'gospel_reference', _gospel,
      'source_attribution', 'Synthetic local execution fixture'
    ),
    'canonical_source', '{}',
    'source_hash', _hash,
    'normalization_version', 'daily-readings-v1',
    'source_url', 'https://example.invalid/readings/' || _source_record_id
  );
$$;

create or replace function pg_temp.create_batch(_name text)
returns uuid language plpgsql as $$
declare
  v_batch_id uuid;
begin
  insert into public.content_import_batches (content_type, filename, imported_by, status)
  values ('daily_reading', _name, auth.uid(), 'Ready for Import')
  returning id into v_batch_id;
  return v_batch_id;
end;
$$;

create or replace function pg_temp.ordinary_member_denied()
returns boolean language plpgsql as $$
begin
  perform public.apply_daily_readings_import(gen_random_uuid(), jsonb_build_array(pg_temp.prepared_source(
    'ordinary-denied', 'ordinary-denied-2026-09-10-sw', '2026-09-10', 'sw',
    repeat('1', 64)
  )));
  return false;
exception when insufficient_privilege then
  return true;
end;
$$;

insert into auth.users (id, email, aud, role, created_at, updated_at) values
  ('72000000-0000-4000-8000-000000000001', 'ordinary-daily-import@test.invalid', 'authenticated', 'authenticated', now(), now()),
  ('72000000-0000-4000-8000-000000000002', 'super-daily-import@test.invalid', 'authenticated', 'authenticated', now(), now());

insert into public.super_admins (id) values ('72000000-0000-4000-8000-000000000002');

set local role authenticated;
select set_config('request.jwt.claim.sub', '72000000-0000-4000-8000-000000000001', true);

select pg_temp.assert_true(
  pg_temp.ordinary_member_denied(),
  'ordinary member cannot execute Daily Readings import'
);

select set_config('request.jwt.claim.sub', '72000000-0000-4000-8000-000000000002', true);

select pg_temp.assert_true(
  (public.apply_daily_readings_import(
    pg_temp.create_batch('new-source.csv'),
    jsonb_build_array(pg_temp.prepared_source('exec-source', 'exec-new-2026-09-10-sw', '2026-09-10', 'sw', repeat('a', 64)))
  ) ->> 'imported')::integer = 1,
  'new source imports one item'
);

select pg_temp.assert_true(
  exists (
    select 1
    from public.content_daily_readings cdr
    join public.content_languages cl on cl.id = cdr.language_id
    join public.content_import_items cii on cii.id = cdr.last_import_item_id
    where cdr.source_key = 'exec-source'
      and cdr.source_record_id = 'exec-new-2026-09-10-sw'
      and cdr.status = 'draft'
      and cdr.visibility = 'member'
      and cl.code = 'sw'
      and cii.status = 'imported'
      and cii.source_hash = repeat('a', 64)
      and cii.source_payload ->> 'gospel_reference' = 'Luke 1:1-4'
  ),
  'new imported reading is draft/member and linked to imported ledger'
);

insert into public.content_import_batches (id, content_type, filename, imported_by, status)
values (
  '72000000-0000-4000-8000-000000000100',
  'daily_reading',
  'retry-source.csv',
  auth.uid(),
  'Ready for Import'
);

do $$
declare
  v_batch uuid := '72000000-0000-4000-8000-000000000100';
begin
  perform public.apply_daily_readings_import(
    v_batch,
    jsonb_build_array(pg_temp.prepared_source('exec-source', 'exec-retry-2026-09-11-sw', '2026-09-11', 'sw', repeat('b', 64)))
  );
  perform public.apply_daily_readings_import(
    v_batch,
    jsonb_build_array(pg_temp.prepared_source('exec-source', 'exec-retry-2026-09-11-sw', '2026-09-11', 'sw', repeat('b', 64)))
  );
end $$;

select pg_temp.assert_true(
  (select count(*) = 1
   from public.content_import_items
   where import_batch_id = '72000000-0000-4000-8000-000000000100'
     and source_key = 'exec-source'
     and source_record_id = 'exec-retry-2026-09-11-sw'),
  'exact same batch retry is idempotent and does not duplicate ledger items'
);

select pg_temp.assert_true(
  (public.apply_daily_readings_import(
    pg_temp.create_batch('unchanged-source.csv'),
    jsonb_build_array(pg_temp.prepared_source('exec-source', 'exec-new-2026-09-10-sw', '2026-09-10', 'sw', repeat('a', 64)))
  ) ->> 'skipped')::integer = 1,
  'same source unchanged import is skipped'
);

update public.content_daily_readings
set reflection = 'Editor reflection stays',
    prayer = 'Editor prayer stays'
where source_key = 'exec-source'
  and source_record_id = 'exec-new-2026-09-10-sw';

select pg_temp.assert_true(
  (public.apply_daily_readings_import(
    pg_temp.create_batch('changed-draft-source.csv'),
    jsonb_build_array(pg_temp.prepared_source('exec-source', 'exec-new-2026-09-10-sw', '2026-09-10', 'sw', repeat('c', 64), 'Luke 2:1-7'))
  ) ->> 'imported')::integer = 1,
  'changed draft source imports as source-only update'
);

select pg_temp.assert_true(
  exists (
    select 1
    from public.content_daily_readings
    where source_key = 'exec-source'
      and source_record_id = 'exec-new-2026-09-10-sw'
      and gospel_reference = 'Luke 2:1-7'
      and reflection = 'Editor reflection stays'
      and prayer = 'Editor prayer stays'
      and status = 'draft'
      and visibility = 'member'
  ),
  'source update preserves editorial fields and publication state'
);

update public.content_daily_readings
set status = 'published'
where source_key = 'exec-source'
  and source_record_id = 'exec-new-2026-09-10-sw';

select pg_temp.assert_true(
  (public.apply_daily_readings_import(
    pg_temp.create_batch('published-changed-source.csv'),
    jsonb_build_array(pg_temp.prepared_source('exec-source', 'exec-new-2026-09-10-sw', '2026-09-10', 'sw', repeat('d', 64), 'Luke 3:1-6'))
  ) ->> 'conflicts')::integer = 1,
  'changed published source becomes conflict'
);

select pg_temp.assert_true(
  exists (
    select 1
    from public.content_daily_readings
    where source_key = 'exec-source'
      and source_record_id = 'exec-new-2026-09-10-sw'
      and gospel_reference = 'Luke 2:1-7'
      and status = 'published'
  ),
  'published source conflict does not silently update CMS row'
);

select pg_temp.assert_true(
  exists (
    select 1
    from public.content_import_items
    where source_key = 'exec-source'
      and source_record_id = 'exec-new-2026-09-10-sw'
      and source_hash = repeat('d', 64)
      and status = 'conflict'
      and error_code = 'published_source_changed'
  ),
  'published source conflict is recorded in ledger'
);

do $$ begin
  perform public.apply_daily_readings_import(
    pg_temp.create_batch('manual-drift-base.csv'),
    jsonb_build_array(pg_temp.prepared_source('exec-source', 'exec-drift-2026-09-12-sw', '2026-09-12', 'sw', repeat('e', 64)))
  );
end $$;

update public.content_daily_readings
set gospel_reference = 'Manual Drift 9:9'
where source_key = 'exec-source'
  and source_record_id = 'exec-drift-2026-09-12-sw';

select pg_temp.assert_true(
  (public.apply_daily_readings_import(
    pg_temp.create_batch('manual-drift-changed.csv'),
    jsonb_build_array(pg_temp.prepared_source('exec-source', 'exec-drift-2026-09-12-sw', '2026-09-12', 'sw', repeat('f', 64), 'Luke 4:1-13'))
  ) ->> 'conflicts')::integer = 1,
  'manual drift becomes conflict'
);

select pg_temp.assert_true(
  exists (
    select 1
    from public.content_import_items
    where source_key = 'exec-source'
      and source_record_id = 'exec-drift-2026-09-12-sw'
      and source_hash = repeat('f', 64)
      and status = 'conflict'
      and error_code = 'manual_drift'
  ),
  'manual drift conflict is recorded in ledger'
);

do $$ begin
  perform public.apply_daily_readings_import(
    pg_temp.create_batch('collision-owner.csv'),
    jsonb_build_array(pg_temp.prepared_source('owner-source', 'owner-2026-09-13-sw', '2026-09-13', 'sw', repeat('1', 64)))
  );
end $$;

select pg_temp.assert_true(
  (public.apply_daily_readings_import(
    pg_temp.create_batch('collision-other-source.csv'),
    jsonb_build_array(pg_temp.prepared_source('other-source', 'other-2026-09-13-sw', '2026-09-13', 'sw', repeat('2', 64)))
  ) ->> 'conflicts')::integer = 1,
  'different source identity same date/language becomes conflict'
);

insert into public.content_daily_readings (
  reading_date,
  language_id,
  status,
  visibility,
  first_reading_reference,
  responsorial_psalm_reference,
  gospel_reference
)
select '2026-09-14', id, 'draft', 'member', 'Isaiah 1:1', 'Psalm 1:1', 'Luke 1:1'
from public.content_languages
where code = 'sw';

select pg_temp.assert_true(
  (public.apply_daily_readings_import(
    pg_temp.create_batch('manual-collision.csv'),
    jsonb_build_array(pg_temp.prepared_source('manual-collision-source', 'manual-collision-2026-09-14-sw', '2026-09-14', 'sw', repeat('3', 64)))
  ) ->> 'conflicts')::integer = 1,
  'manual/null-source same date/language becomes conflict'
);

select * from finish();

rollback;

-- Daily Readings CMS schema verification.
-- Read-only checks for RC-2.2.1 migration dependency hardening.

with checks as (
  select
    'content_daily_readings table exists' as check_name,
    to_regclass('public.content_daily_readings') is not null as passed,
    coalesce(to_regclass('public.content_daily_readings')::text, 'missing') as detail

  union all
  select
    'content_import_batches table exists',
    to_regclass('public.content_import_batches') is not null,
    coalesce(to_regclass('public.content_import_batches')::text, 'missing')

  union all
  select
    'content_versions table exists',
    to_regclass('public.content_versions') is not null,
    coalesce(to_regclass('public.content_versions')::text, 'missing')

  union all
  select
    'content_relationships table exists',
    to_regclass('public.content_relationships') is not null,
    coalesce(to_regclass('public.content_relationships')::text, 'missing')

  union all
  select
    'content_daily_readings.import_batch_id exists with uuid type',
    exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'content_daily_readings'
        and column_name = 'import_batch_id'
        and data_type = 'uuid'
    ),
    coalesce((
      select data_type
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'content_daily_readings'
        and column_name = 'import_batch_id'
    ), 'missing')

  union all
  select
    'import_batch_id foreign key targets content_import_batches(id) on delete set null',
    exists (
      select 1
      from pg_constraint c
      join unnest(c.conkey) with ordinality as ord(attnum, ordinality) on true
      join pg_attribute att on att.attrelid = c.conrelid and att.attnum = ord.attnum
      join unnest(c.confkey) with ordinality as ford(attnum, ordinality) on ford.ordinality = ord.ordinality
      join pg_attribute fatt on fatt.attrelid = c.confrelid and fatt.attnum = ford.attnum
      where c.conrelid = to_regclass('public.content_daily_readings')
        and c.contype = 'f'
        and c.confrelid = to_regclass('public.content_import_batches')
        and c.confdeltype = 'n'
        and att.attname = 'import_batch_id'
        and fatt.attname = 'id'
    ),
    coalesce((
      select c.conname
      from pg_constraint c
      join unnest(c.conkey) as ord(attnum) on true
      join pg_attribute att on att.attrelid = c.conrelid and att.attnum = ord.attnum
      where c.conrelid = to_regclass('public.content_daily_readings')
        and c.contype = 'f'
        and att.attname = 'import_batch_id'
      limit 1
    ), 'missing')

  union all
  select
    'idx_content_daily_readings_import_batch exists',
    to_regclass('public.idx_content_daily_readings_import_batch') is not null,
    coalesce(to_regclass('public.idx_content_daily_readings_import_batch')::text, 'missing')

  union all
  select
    'content_daily_readings RLS enabled',
    exists (
      select 1
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public'
        and c.relname = 'content_daily_readings'
        and c.relrowsecurity
    ),
    coalesce((
      select case when c.relrowsecurity then 'enabled' else 'disabled' end
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public'
        and c.relname = 'content_daily_readings'
    ), 'missing')

  union all
  select
    'content_import_batches RLS enabled',
    exists (
      select 1
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public'
        and c.relname = 'content_import_batches'
        and c.relrowsecurity
    ),
    coalesce((
      select case when c.relrowsecurity then 'enabled' else 'disabled' end
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public'
        and c.relname = 'content_import_batches'
    ), 'missing')

  union all
  select
    'daily reading updated_at trigger exists',
    exists (
      select 1
      from pg_trigger
      where tgrelid = to_regclass('public.content_daily_readings')
        and tgname = 'set_content_daily_readings_updated_at'
        and not tgisinternal
    ),
    coalesce((
      select tgname
      from pg_trigger
      where tgrelid = to_regclass('public.content_daily_readings')
        and tgname = 'set_content_daily_readings_updated_at'
        and not tgisinternal
    ), 'missing')

  union all
  select
    'daily reading version capture trigger exists',
    exists (
      select 1
      from pg_trigger
      where tgrelid = to_regclass('public.content_daily_readings')
        and tgname = 'capture_content_daily_reading_version'
        and not tgisinternal
    ),
    coalesce((
      select tgname
      from pg_trigger
      where tgrelid = to_regclass('public.content_daily_readings')
        and tgname = 'capture_content_daily_reading_version'
        and not tgisinternal
    ), 'missing')

  union all
  select
    'published daily readings select policy exists',
    exists (
      select 1
      from pg_policies
      where schemaname = 'public'
        and tablename = 'content_daily_readings'
        and policyname = 'Authenticated users can read published CMS daily readings'
    ),
    coalesce((
      select policyname
      from pg_policies
      where schemaname = 'public'
        and tablename = 'content_daily_readings'
        and policyname = 'Authenticated users can read published CMS daily readings'
    ), 'missing')

  union all
  select
    'super admin import batch policy exists',
    exists (
      select 1
      from pg_policies
      where schemaname = 'public'
        and tablename = 'content_import_batches'
        and policyname = 'Super admins manage CMS import batches'
    ),
    coalesce((
      select policyname
      from pg_policies
      where schemaname = 'public'
        and tablename = 'content_import_batches'
        and policyname = 'Super admins manage CMS import batches'
    ), 'missing')
)
select
  case when passed then 'PASS' else 'FAIL' end as status,
  check_name,
  detail
from checks
order by status, check_name;

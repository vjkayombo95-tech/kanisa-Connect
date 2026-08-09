-- Kanisa Connect RC-2.2.1: Daily Readings import batch link guarantee.
-- Forward-only repair migration for environments where the RC-2.2 import
-- batch migration ran before the Daily Readings CMS table existed.

do $$
declare
  v_column_type text;
  v_fk record;
begin
  if to_regclass('public.content_import_batches') is null then
    raise exception 'Daily Readings import batch schema is incomplete: public.content_import_batches is missing. Apply 20260704120000_daily_readings_import_batches.sql first.';
  end if;

  if to_regclass('public.content_daily_readings') is null then
    raise exception 'Daily Readings CMS schema is incomplete: public.content_daily_readings is missing. Apply 20260704110000_create_cms_daily_readings.sql before this repair migration.';
  end if;

  if to_regclass('public.content_versions') is null then
    raise exception 'Catholic CMS foundation is incomplete: public.content_versions is missing. Apply 20260704100000_create_catholic_cms_foundation.sql first.';
  end if;

  select format_type(a.atttypid, a.atttypmod)
    into v_column_type
  from pg_attribute a
  where a.attrelid = 'public.content_daily_readings'::regclass
    and a.attname = 'import_batch_id'
    and not a.attisdropped;

  if v_column_type is null then
    alter table public.content_daily_readings
      add column import_batch_id uuid;
  elsif v_column_type <> 'uuid' then
    raise exception 'Invalid schema state: public.content_daily_readings.import_batch_id must be uuid, found %.', v_column_type;
  end if;

  select
    c.conname,
    c.confrelid as target_table_oid,
    c.confdeltype,
    array_agg(att.attname::text order by ord.ordinality) as source_columns,
    array_agg(fatt.attname::text order by ford.ordinality) as target_columns
    into v_fk
  from pg_constraint c
  join unnest(c.conkey) with ordinality as ord(attnum, ordinality) on true
  join pg_attribute att on att.attrelid = c.conrelid and att.attnum = ord.attnum
  join unnest(c.confkey) with ordinality as ford(attnum, ordinality) on ford.ordinality = ord.ordinality
  join pg_attribute fatt on fatt.attrelid = c.confrelid and fatt.attnum = ford.attnum
  where c.conrelid = 'public.content_daily_readings'::regclass
    and c.contype = 'f'
    and att.attname = 'import_batch_id'
  group by c.conname, c.confrelid, c.confdeltype
  limit 1;

  if v_fk.conname is null then
    alter table public.content_daily_readings
      add constraint content_daily_readings_import_batch_id_fkey
      foreign key (import_batch_id)
      references public.content_import_batches(id)
      on delete set null;
  elsif v_fk.target_table_oid <> 'public.content_import_batches'::regclass
    or v_fk.target_columns <> array['id']::text[]
    or v_fk.source_columns <> array['import_batch_id']::text[]
    or v_fk.confdeltype <> 'n' then
    raise exception 'Invalid schema state: public.content_daily_readings.import_batch_id has incompatible foreign key %. Expected content_import_batches(id) on delete set null.', v_fk.conname;
  end if;
end;
$$;

create index if not exists idx_content_daily_readings_import_batch
  on public.content_daily_readings(import_batch_id);

comment on column public.content_daily_readings.import_batch_id is
  'Links a Daily Readings CMS row to the provenance/import batch that created or last revised it.';

comment on table public.content_import_batches is
  'Tracks Catholic CMS import provenance, validation summaries, and row counts for batch imports.';

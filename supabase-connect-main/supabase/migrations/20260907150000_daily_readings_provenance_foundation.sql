-- Daily Readings provenance and idempotency foundation.
-- Stores current source identity on CMS rows and per-attempt outcomes in an
-- import item ledger. Hash calculation/import execution is intentionally out
-- of scope for this migration.

alter table public.content_daily_readings
  add column if not exists source_key text,
  add column if not exists source_record_id text,
  add column if not exists source_version text,
  add column if not exists source_url text,
  add column if not exists last_imported_source_hash text,
  add column if not exists last_imported_at timestamptz,
  add column if not exists last_import_item_id uuid;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'content_daily_readings_source_identity_pair_check'
      and conrelid = 'public.content_daily_readings'::regclass
  ) then
    alter table public.content_daily_readings
      add constraint content_daily_readings_source_identity_pair_check
      check (
        (source_key is null and source_record_id is null)
        or (source_key is not null and source_record_id is not null)
      );
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'content_daily_readings_imported_language_check'
      and conrelid = 'public.content_daily_readings'::regclass
  ) then
    alter table public.content_daily_readings
      add constraint content_daily_readings_imported_language_check
      check (
        source_key is null
        or source_record_id is null
        or language_id is not null
      );
  end if;
end;
$$;

create unique index if not exists content_daily_readings_source_identity_unique
  on public.content_daily_readings(source_key, source_record_id)
  where source_key is not null
    and source_record_id is not null;

create table if not exists public.content_import_items (
  id uuid primary key default gen_random_uuid(),
  import_batch_id uuid not null references public.content_import_batches(id) on delete cascade,
  content_type text not null,
  source_key text not null,
  source_record_id text not null,
  source_version text,
  source_url text,
  source_hash text not null,
  target_table text,
  target_record_id uuid,
  reading_date date,
  language_id uuid references public.content_languages(id) on delete set null,
  status text not null
    check (status in ('imported', 'skipped', 'conflict', 'failed')),
  error_message text,
  source_payload jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (import_batch_id, content_type, source_key, source_record_id)
);

create index if not exists idx_content_import_items_batch_status
  on public.content_import_items(import_batch_id, status);

create index if not exists idx_content_import_items_source_identity
  on public.content_import_items(content_type, source_key, source_record_id);

create index if not exists idx_content_import_items_target
  on public.content_import_items(target_table, target_record_id);

create index if not exists idx_content_import_items_reading_language
  on public.content_import_items(reading_date, language_id);

create index if not exists idx_content_import_items_source_hash
  on public.content_import_items(source_hash);

drop trigger if exists set_content_import_items_updated_at on public.content_import_items;
create trigger set_content_import_items_updated_at
before update on public.content_import_items
for each row execute function public.set_updated_at();

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'content_daily_readings_last_import_item_id_fkey'
      and conrelid = 'public.content_daily_readings'::regclass
  ) then
    alter table public.content_daily_readings
      add constraint content_daily_readings_last_import_item_id_fkey
      foreign key (last_import_item_id)
      references public.content_import_items(id)
      on delete set null;
  end if;
end;
$$;

alter table public.content_import_items enable row level security;

drop policy if exists "Super admins manage CMS import items" on public.content_import_items;
create policy "Super admins manage CMS import items"
on public.content_import_items for all to authenticated
using (public.is_platform_super_admin(auth.uid()) or public.is_super_admin(auth.uid()))
with check (public.is_platform_super_admin(auth.uid()) or public.is_super_admin(auth.uid()));

revoke all on table public.content_import_items from public, anon, authenticated;
grant select, insert, update, delete on public.content_import_items to authenticated;

comment on column public.content_daily_readings.source_key is
  'Stable identifier for the external Daily Readings source system. Must be paired with source_record_id when present.';
comment on column public.content_daily_readings.source_record_id is
  'Stable record identifier from the external Daily Readings source. Must be paired with source_key when present.';
comment on column public.content_daily_readings.last_imported_source_hash is
  'Deterministic hash of the last accepted normalized source-controlled payload. It is not recalculated by manual CMS edits.';
comment on column public.content_daily_readings.last_import_item_id is
  'Latest import ledger outcome linked to this CMS Daily Reading row; set null if the ledger item is removed.';
comment on table public.content_import_items is
  'Per-source-row Daily Readings import outcome ledger for traceability, deterministic retries, conflict reporting, and target CMS linkage.';
comment on column public.content_import_items.source_hash is
  'Deterministic hash of normalized source-controlled payload. Excludes status, visibility, editorial notes, database UUIDs, timestamps, and import batch identity.';
comment on column public.content_import_items.source_payload is
  'Optional normalized source-controlled payload snapshot used for review and future manual-edit conflict detection.';

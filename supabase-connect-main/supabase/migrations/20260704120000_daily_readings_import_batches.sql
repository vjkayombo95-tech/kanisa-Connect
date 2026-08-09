-- Kanisa Connect RC-2.2.0: Daily Readings import batches and provenance.
-- Keeps source metadata at batch level so individual reading rows do not repeat
-- publication provenance unnecessarily.

create table if not exists public.content_import_batches (
  id uuid primary key default gen_random_uuid(),
  content_type text not null,
  filename text not null,
  source_organization text,
  source_publication text,
  source_year integer,
  source_edition text,
  date_obtained date,
  language_id uuid references public.content_languages(id) on delete set null,
  notes text,
  imported_by uuid references auth.users(id) on delete set null,
  imported_at timestamptz,
  total_rows integer not null default 0,
  valid_rows integer not null default 0,
  warning_rows integer not null default 0,
  invalid_rows integer not null default 0,
  information_rows integer not null default 0,
  imported_rows integer not null default 0,
  skipped_rows integer not null default 0,
  updated_rows integer not null default 0,
  status text not null default 'Uploaded'
    check (status in ('Uploaded', 'Validating', 'Validation Failed', 'Ready for Import', 'Imported', 'Partially Imported', 'Cancelled')),
  validation_summary jsonb,
  conflict_strategy text not null default 'create_draft_revision'
    check (conflict_strategy in ('skip_existing', 'create_draft_revision', 'update_existing')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_content_import_batches_type_status
  on public.content_import_batches(content_type, status, created_at desc);

do $$
begin
  if to_regclass('public.content_daily_readings') is not null then
    alter table public.content_daily_readings
      add column if not exists import_batch_id uuid references public.content_import_batches(id) on delete set null;

    create index if not exists idx_content_daily_readings_import_batch
      on public.content_daily_readings(import_batch_id);
  else
    raise notice 'Skipping content_daily_readings import_batch_id link because public.content_daily_readings does not exist yet. Run 20260704110000_create_cms_daily_readings.sql and 20260704121000_ensure_daily_readings_import_batch_link.sql before importing Daily Readings data.';
  end if;
end;
$$;

drop trigger if exists set_content_import_batches_updated_at on public.content_import_batches;
create trigger set_content_import_batches_updated_at
before update on public.content_import_batches
for each row execute function public.set_updated_at();

alter table public.content_import_batches enable row level security;

drop policy if exists "Super admins manage CMS import batches" on public.content_import_batches;
create policy "Super admins manage CMS import batches"
on public.content_import_batches for all to authenticated
using (public.is_platform_super_admin(auth.uid()) or public.is_super_admin(auth.uid()))
with check (public.is_platform_super_admin(auth.uid()) or public.is_super_admin(auth.uid()));

grant select, insert, update, delete on public.content_import_batches to authenticated;

-- Daily Readings import metadata support.
-- Adds machine-readable row diagnostics and normalization contract tracking
-- without changing importer execution, member reads, or ledger access policy.

alter table public.content_import_items
  add column if not exists error_code text,
  add column if not exists normalization_version text;

comment on column public.content_import_items.error_code is
  'Stable machine-readable classification for failed or conflicted Daily Readings import outcomes. Human-readable diagnostics remain in error_message.';

comment on column public.content_import_items.normalization_version is
  'Identifier for the normalization contract used before calculating source_hash and source_payload. Importer execution supplies this explicitly.';

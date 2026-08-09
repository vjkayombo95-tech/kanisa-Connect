-- Evaluation-only golden reference storage for AI speech benchmarking.
-- These tables are intentionally separate from production Bible, audio,
-- indexing, synchronization, and QA tables.

create table if not exists public.evaluation_golden_references (
  id uuid primary key default gen_random_uuid(),
  chapter_id text not null unique,
  book text not null,
  chapter integer not null,
  translation_code text not null default 'sw-biblica',
  source_name text,
  source_hash text,
  reference_payload jsonb not null,
  imported_at timestamptz not null default now(),
  imported_by text,
  metadata jsonb not null default '{}'::jsonb,
  constraint evaluation_golden_references_chapter_positive check (chapter > 0),
  constraint evaluation_golden_references_payload_chapter check (reference_payload ? 'chapter_id')
);

create index if not exists evaluation_golden_references_translation_idx
  on public.evaluation_golden_references (translation_code, book, chapter);

create table if not exists public.evaluation_model_outputs (
  id uuid primary key default gen_random_uuid(),
  run_id text not null,
  model_id text not null,
  provider text not null,
  chapter_id text not null,
  output_payload jsonb not null,
  created_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  constraint evaluation_model_outputs_payload_chapter check (output_payload ? 'chapter_id')
);

create index if not exists evaluation_model_outputs_run_idx
  on public.evaluation_model_outputs (run_id, model_id, chapter_id);

create table if not exists public.evaluation_benchmark_reports (
  id uuid primary key default gen_random_uuid(),
  run_id text not null,
  report_type text not null,
  report_payload jsonb not null,
  created_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists evaluation_benchmark_reports_run_idx
  on public.evaluation_benchmark_reports (run_id, report_type);

alter table public.evaluation_golden_references enable row level security;
alter table public.evaluation_model_outputs enable row level security;
alter table public.evaluation_benchmark_reports enable row level security;

comment on table public.evaluation_golden_references is
  'Evaluation-only manually corrected golden transcripts for speech benchmark chapters.';
comment on table public.evaluation_model_outputs is
  'Evaluation-only captured model outputs used for offline benchmark comparison.';
comment on table public.evaluation_benchmark_reports is
  'Evaluation-only generated benchmark report payloads.';

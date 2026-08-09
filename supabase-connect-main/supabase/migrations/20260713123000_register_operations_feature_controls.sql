-- Register Operations and Audio Processing as independently managed feature controls.
-- These surfaces were previously always visible or tied to Catholic Content, which
-- prevented Super Admins from hiding them per church without affecting unrelated CMS features.

insert into public.platform_features (key, name, description, globally_enabled, globally_locked)
values
  (
    'operations',
    'Operations',
    'Parish operations health, queue telemetry, worker signals, and production events.',
    true,
    false
  ),
  (
    'audio_processing',
    'Audio Processing',
    'Audio upload, processing jobs, review workflow, and audio publishing operations.',
    true,
    false
  )
on conflict (key) do update
set
  name = excluded.name,
  description = excluded.description,
  updated_at = now();

# Migration archive plan

## Why archive the old chain

The current history is a production-repair timeline with overlapping schemas, policies, and compatibility paths. It is valuable audit history but unsuitable as the sole bootstrap path for a brand-new project.

## Preserve history safely

1. Do not delete or rename active migration files while production still uses this repository history.
2. Record the final production migration list and commit SHA.
3. Create a dedicated baseline-cutover branch and retain a read-only `supabase/migrations-archive/` copy only after the cutover is approved.
4. Keep the archive out of the active `supabase/migrations/` path so the CLI does not attempt to replay it.

## Continue after baseline

The reviewed baseline becomes the first active migration in the new bootstrap lineage. Add all future timestamped migrations after it, and validate each against an empty disposable staging project.

## Avoid breaking production

Never point the baseline-apply script at production. Do not modify production migration history, reset production, or replay the baseline there. Production remains on its existing migration chain until a separately approved migration-history cutover is planned and tested.

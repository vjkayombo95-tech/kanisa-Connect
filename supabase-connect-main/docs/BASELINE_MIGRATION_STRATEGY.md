# Baseline migration strategy

## Recommendation

Use Option B for new staging projects. The migration history contains 94 files, 238 policy declarations, 157 `ALTER TABLE` statements, 120 index declarations, 109 function declarations, 91 inserts, and 63 direct updates. It is an accumulated production-repair history, not a reliable bootstrap artifact. Hardening every historical branch indefinitely is both risky and difficult to validate without a real fresh-database run after every change.

## Cutover status

The cutover has been prepared in this repository. All 94 former active migration files now live in `supabase/migrations_archive_pre_baseline/`. The active migration directory starts with exactly one approved schema baseline:

```text
supabase/migrations/20260622000000_production_baseline.sql
```

The baseline SQL is copied verbatim from `supabase/baseline/production_schema_baseline.sql`. Future active migrations must use timestamps after `20260622000000` and must be validated against an empty staging project using this baseline lineage. The archive is historical reference only and must not be moved back into `supabase/migrations/`.

## Option A — continue hardening the historical chain

Use only when preserving the exact current migration sequence is mandatory.

1. Keep every existing migration filename and order immutable.
2. Continue using a fresh disposable staging project for each `supabase db push --linked` validation.
3. Fix the first error, then restart from an empty project; never infer success from a partially migrated database.
4. Maintain guards for optional legacy tables, renamed columns, policy names, indexes, constraints, triggers, and enum-to-text role comparisons.

This is suitable for repair work but remains high effort and cannot offer a static guarantee.

## Option B — clean baseline for future fresh environments

This is recommended for Kanisa Connect staging/bootstrap work.

1. **Create a schema-only backup from production.** An authorized operator must run a PostgreSQL/Supabase schema export using production credentials. Do not include data, storage objects, Auth users, service keys, or secrets. Store the export in a protected location for review; do not commit it blindly.
2. **Review and sanitize the export.** Confirm it contains `public` schema objects, extensions, enums, functions, triggers, RLS settings, policies, indexes, and Storage policies/buckets required by the app. Remove environment-specific grants, secrets, and production-only data.
3. **Create one baseline migration.** After review, create a timestamped migration such as `supabase/migrations/<timestamp>_baseline_schema.sql` containing the ordered, clean schema definition. Make every object creation idempotent where practical.
4. **Archive, do not delete, historical migrations.** Preserve the old files outside the active migration directory (for example in `supabase/migrations-archive/`) and document their final production migration history. Do this only as a coordinated migration-history change; do not move files in a repository that still deploys them to production.
5. **Use an isolated bootstrap branch/project.** Start an empty staging project, apply only the baseline and migrations created after the baseline cutover, then verify schema, RLS, RPCs, and Storage before using it.
6. **Continue normally.** All future changes should be small, timestamped migrations that assume the baseline schema and are validated on a fresh disposable staging project in CI.

## Safety constraints

- Do not run a schema dump, change migration history, or move old migrations without production-owner approval.
- Never apply a baseline to the existing production project.
- The active project must have a documented cutover point so Supabase migration history is not split accidentally.

## Operator commands and verification

Run these commands only after approval, in PowerShell from the repository root. The scripts enforce the known production ref `cbaxiiqlzrwvmuplhusm` and staging ref `nunfrjcuimaytydnaqtt`.

```powershell
# Link production temporarily, then export schema only after typing the exact production acknowledgement.
supabase link --project-ref cbaxiiqlzrwvmuplhusm
.\scripts\create-production-schema-baseline.ps1

# Review the generated SQL manually. Then link staging and apply only after typing the exact staging acknowledgement.
supabase link --project-ref nunfrjcuimaytydnaqtt
.\scripts\prepare-staging-from-baseline.ps1
```

### Docker-free export alternative

Install the PostgreSQL client tools so `pg_dump` is available on `PATH`. In a private PowerShell session, set a **direct production database connection URL** obtained from the Supabase Dashboard’s database connection settings; use SSL as provided by Supabase. Do not commit the URL or place it in an `.env` file.

```powershell
$env:SUPABASE_PRODUCTION_DB_URL = 'postgresql://postgres:<database-password>@db.cbaxiiqlzrwvmuplhusm.supabase.co:5432/postgres?sslmode=require'
supabase link --project-ref cbaxiiqlzrwvmuplhusm
.\scripts\create-production-schema-baseline-no-docker.ps1
Remove-Item Env:SUPABASE_PRODUCTION_DB_URL
```

The Docker-free script runs `pg_dump --schema-only --schema=public --schema=storage --no-owner --no-privileges`. It exports no rows, therefore excludes Auth users and Storage objects; it does not automatically reproduce Storage bucket metadata rows.

After applying, use the Supabase SQL editor on **staging** to verify the baseline:

```sql
-- Tables
select tablename from pg_tables where schemaname = 'public' order by tablename;

-- RPCs/functions
select routine_name from information_schema.routines
where routine_schema = 'public' order by routine_name;

-- RLS policies
select tablename, policyname, cmd from pg_policies
where schemaname = 'public' order by tablename, policyname;

-- Storage buckets (bucket metadata, not Storage objects)
select id, name, public from storage.buckets order by id;
```

The schema export intentionally excludes data. Storage bucket metadata may need a separately reviewed, staging-only configuration step because buckets are metadata rows rather than schema definitions; never copy production Storage objects or user data into staging.

### Manual staging-link fallback

If `supabase link --project-ref nunfrjcuimaytydnaqtt` fails solely because the CLI API call times out, use the local fallback:

```powershell
.\scripts\manual-link-staging.ps1
```

It writes only `supabase/.temp/project-ref` with `nunfrjcuimaytydnaqtt` and `supabase/.temp/profile` with `supabase`, then prints the project-ref file for verification. It bypasses Supabase API validation, so use it only after independently confirming the staging ref. It does not run migrations, apply a baseline, or contact production.

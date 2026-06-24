# Staging setup

Staging must be a separate Supabase project and a separate Netlify deploy context. It must never share a database, Storage bucket, service-role key, or production auth users.

## 1. Create and link the project

1. Create a new Supabase project named `kanisa-connect-staging` in the same region as production.
2. In this repository, authenticate the Supabase CLI, then link it to the **staging** project: `supabase link --project-ref <staging-project-ref>`.
3. Confirm before every database action: `supabase status` and `supabase projects list`. The project ref must be the staging ref.
4. Do not edit `supabase/config.toml` with a staging ref; it currently identifies the existing project. The CLI link is local state and avoids committing an accidental target switch.

## 2. Apply and verify schema

1. Start from an empty staging database and run `supabase db push`.
2. Verify migration history with `supabase migration list`.
3. Run these checks in the Supabase SQL editor:

```sql
select tablename from pg_tables where schemaname = 'public' order by tablename;
select routine_name from information_schema.routines where routine_schema = 'public' order by routine_name;
select tablename, policyname, cmd from pg_policies where schemaname = 'public' order by tablename, policyname;
select id, name, public from storage.buckets order by id;
```

4. Validate key RPCs as an appropriate authenticated test user: `create_church_workspace`, `get_portal_announcements`, `get_public_giving_church`, `submit_public_contribution`, `generate_church_analytics_snapshot`, `accept_invitation`, and `get_public_invitation`.
5. Verify RLS with at least two churches and two members: each user must only read their own church; an admin should manage only their church. Verify storage policies by upload/read attempts for `church-assets`, `avatars`, `billing-receipts`, and `record-preservation-proofs` if present.

## 3. Configure Netlify

Create a Netlify deploy context such as a `staging` branch deploy. Set these variables in that context only:

```text
VITE_APP_ENV=staging
VITE_SUPABASE_URL=https://<staging-project-ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<staging-anon-key>
VITE_EXPECTED_SUPABASE_PROJECT_REF=<staging-project-ref>
```

Production should use the same variable names with `VITE_APP_ENV=production` and its production URL, key, and expected project ref. Do not copy or change the existing production values as part of staging setup.

The app rejects missing or mismatched deployment values, logs its environment and project ref in the browser console, and displays a red `STAGING — TEST DATA ONLY` banner on staging.

## 4. Seed only after validation

The staged load dataset lives at `supabase/seed/staging_load_test_data.sql`. It is not a migration and is not executed by any package script. After confirming the project ref is staging, run it manually in the staging SQL editor or through the linked staging CLI. It creates synthetic records only; see its header and `STAGING_CHECKLIST.md` first.

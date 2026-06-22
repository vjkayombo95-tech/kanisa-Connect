# Fresh-database migration compatibility audit

Scope: static review of the committed migration history. No migration was executed. The authoritative final check remains a fresh, staging-only `supabase db push`.

## Root cause fixed

The base schema defines `community_members` and `ministry_members`. Later migrations and the frontend also require the legacy-compatible names `member_communities` and `member_ministries`. On an empty project, `20260323133000_fix_member_ministries_fk.sql` therefore addressed a relation that had never been created.

`20260323121500_backfill_core_relations_and_categories.sql` now creates both compatibility relation tables using `CREATE TABLE IF NOT EXISTS`, including their foreign keys and uniqueness constraints. `20260323133000_fix_member_ministries_fk.sql` now checks `to_regclass` for both tables, checks `pg_constraint` before adding the FK, and creates indexes only inside that guarded path.

## Modified migrations

| Migration | Fresh-project guard/fix |
| --- | --- |
| `20260323121500_backfill_core_relations_and_categories.sql` | Creates missing `member_communities` and `member_ministries` compatibility tables. |
| `20260323133000_fix_member_ministries_fk.sql` | Safely no-ops when prerequisite tables are absent; drops/re-adds the FK only when appropriate; guards indexes. |
| `20260523000000_create_church_workspace_rpc.sql` | Creates compatibility columns used by later workspace/RLS helpers: `churches.owner_id`, `profiles.church_id`, and `profiles.role`. |
| `20260619120000_add_pagination_performance_indexes.sql` | Guards legacy `member_communities` indexes with `to_regclass`. |

## Migrations safe on a fresh database by ordered dependency

The base schema migration creates the core public tables, enums, helper function, indexes, triggers, and initial RLS policies. The timestamped migrations after it either create new objects with `IF NOT EXISTS`/`OR REPLACE`, or alter objects created by earlier migrations in the committed order. Key families are: core extensions and storage policies (20260319); membership, content, chat, pledge, registration, and billing additions (20260320–20260605); analytics, rate limiting, error logging, record preservation, messaging, and security hardening (20260618–20260621).

## Assumption inventory requiring guards or ordered prerequisites

- `ALTER TABLE`, `ENABLE ROW LEVEL SECURITY`, policy drops, and `CREATE POLICY` throughout the history assume their base table exists. On a fresh project this is satisfied by the base migration; the compatibility tables above were the missing exception.
- Foreign keys in `CREATE TABLE` statements correctly rely on previously created base tables. The repaired `member_ministries_member_id_fkey` now explicitly verifies both source and referenced tables plus the constraint name.
- Workspace-content and join-link migrations reference the legacy relation names. They are now created before those migrations execute.
- Workspace RLS helpers reference `churches.owner_id`, `profiles.church_id`, and `profiles.role`; those columns are now introduced before the helpers.
- Index migrations relying on `IF NOT EXISTS` still fail if a referenced table is absent. The only identified legacy-table index path is now guarded.

## Remaining fresh-project validation risks

1. `create_app_error_logs.sql` is not timestamp-prefixed. Depending on the Supabase CLI version, it may be ignored or rejected as a migration filename. It should be renamed only with a migration-history plan, because production may already record it differently.
2. Multiple migration families replace policies/functions (`rate_limits`, app-error logs, message templates). Their use of `CREATE OR REPLACE` and `DROP ... IF EXISTS` is generally safe, but policy creation must be validated against the effective final schema.
3. Run the following only against the empty staging project after reviewing this change: `supabase migration list`, then `supabase db push`. If a further error appears, capture the migration filename and exact PostgreSQL message before changing production history.

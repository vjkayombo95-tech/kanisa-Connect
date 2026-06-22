# Full migration rescue report

## Phase 1: static failure audit

Scope: all 94 files in `supabase/migrations`. No migration, dump, seed, or production operation was executed.

| Statement class | Count |
| --- | ---: |
| `CREATE POLICY` | 238 |
| `ALTER TABLE` | 157 |
| `CREATE INDEX` | 120 |
| `CREATE FUNCTION` | 109 |
| `INSERT INTO public.*` | 91 |
| direct `UPDATE public.*` | 63 |

The history contains overlapping feature implementations and production-repair migrations for member relations, audit logs, RLS, chat, help interactions, message templates, billing, analytics, and security hardening. Static analysis confirmed the previous failures were genuine schema-drift risks: missing legacy tables/columns, policy duplication, enum `app_role` comparisons against `admin`, and compatibility inserts/backfills targeting older schemas.

## Phase 2: repairs prepared

32 migration files have been modified in this workspace. The repairs use `to_regclass`, `information_schema.columns`, `pg_policies`, `pg_constraint`, idempotent indexes, guarded RLS enablement, compatibility columns, and `ur.role::text` comparisons.

Key repaired contracts:

- `member_communities` / `member_ministries`, including their FK and indexes.
- optional `audit_logs` policies.
- member ownership policies for prayer requests, mass intentions, community help, donations, and comments.
- chat leadership-column aliases and enum-safe role checks.
- workspace helper PL/pgSQL functions and workspace RLS policies.
- compatibility backfills for `bible_verses.verse_text` and `message_templates.occasion`.
- message template compatibility columns: `title`, `body`, `content`, `type`, `category`, `language`, `tone`, `occasion`.
- analytics snapshot policies/RPCs and all direct `ur.role IN (...)` comparisons converted to `ur.role::text IN (...)`.

Modified migration files are listed by `git diff --name-only -- supabase/migrations`; this includes the 32 files above and is the canonical current-worktree list.

## Remaining blockers and risk

This history exceeds the requested 20-file rescue threshold. A static scan cannot prove that every SQL function body, policy expression, trigger, constraint, or historical repair branch is valid against every possible fresh Supabase version. The unversioned `create_app_error_logs.sql` filename is a further CLI compatibility risk.

## Decision

**Baseline migration is recommended.** See [BASELINE_MIGRATION_STRATEGY.md](BASELINE_MIGRATION_STRATEGY.md). Continue hardening only to unblock the current staging investigation; use a reviewed schema-only baseline for future empty projects and keep new migrations small and fresh-project tested.

## Required validation, not performed

An authorized operator must run `supabase db push --linked` only against an empty disposable staging project after choosing Option A or Option B. Capture the exact first error with the prepared debug scripts. Do not point this validation at production.

# Migration-wide fresh database repair

This repository has 70+ SQL migration files and over 200 policy declarations. The initial schema migration intentionally creates its tables, triggers, indexes, and 73 baseline policies in one ordered transaction; those baseline objects are not optional and should not be individually converted into no-ops because that can silently leave a partial schema unsecured.

## Guarded compatibility/optional policy migrations

| File | Guarded policies / dependencies |
| --- | --- |
| `20260323144500_allow_audit_logs_insert.sql` | `audit_logs` table and insert policy. |
| `20260323150000_fix_audit_logs_schema_and_policies.sql` | `audit_logs` RLS and read/insert policies. |
| `20260324113000_fix_prayer_requests_rls.sql` | All four ownership/admin policies; request, member, and role relations/columns. |
| `20260324114500_fix_mass_intentions_rls.sql` | All four ownership/admin policies; intention, member, and role relations/columns. |
| `20260324120000_fix_community_help_requests_schema_and_rls.sql` | All four ownership/admin policies; help-request, member, and role relations/columns. |
| `20260324123000_fix_help_interactions_tables.sql` | Donation and comment RLS policies; help, request, role, and member relations/columns. |
| `20260324153000_add_chat_channels.sql` | Adds leadership-column aliases before chat functions/policies reference them. |
| `20260323133000_fix_member_ministries_fk.sql` | Legacy relation tables, referenced table, foreign-key constraint, and indexes. |
| `20260619120000_add_pagination_performance_indexes.sql` | Legacy `member_communities` indexes. |

## Tables/columns checked

The guarded feature migrations use `to_regclass`, `information_schema.columns`, `pg_policies`, and `pg_constraint` for the following optional or historically divergent contracts: `audit_logs`; `member_communities`; `member_ministries`; `prayer_requests`; `mass_intentions`; `community_help_requests`; `help_donations`; `help_comments`; `members`; `user_roles`; and chat leadership aliases on `communities`.

## Remaining risks

1. `create_app_error_logs.sql` is not timestamp-prefixed. Confirm how the installed Supabase CLI treats it before changing its filename, since production migration history may differ.
2. There are overlapping policy/function families for rate limits, message templates, app errors, and billing. They contain replacement migrations; validate their final effective state on a fresh staging database.
3. No static audit can prove a complete migration run. The required final validation is `supabase db push --linked` against an empty staging project and recording the first exact PostgreSQL error if one remains.

No production data is touched by these source-only changes.

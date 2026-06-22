# Migration audit

Audit scope: `supabase/migrations` as committed on 2026-06-22. This is a static review; final truth comes from `supabase db push` and the target project's migration history.

## Inventory

The base schema migration creates the core tenant, people, content, contribution, care, invitation, audit, billing, and feature tables. Later migrations add chat, announcements/reactions, pledges, payment/billing records, community interaction tables, analytics snapshots, rate limits, member-record subscriptions, app-error logs, message templates/messages, security audit events, and compatibility columns. Indexes cover common tenant IDs, dates, member links, pagination, analytics snapshots, portal announcements, app-error-rate dimensions, and payment uniqueness. Most mutable base tables have the shared `update_updated_at_column` trigger; later migrations add birthday-announcement automation.

Static extraction found these created tables: `activity_logs`, `addons`, `analytics_snapshots`, announcement comment/reaction tables, `announcements`, `app_error_logs`, `bible_verses`, `birthday_announcement_automations`, chat tables, church/subscription/feature tables, `communities`, community-help/target tables, contribution tables, event tables, family tables, invitation tables, `mass_intentions`, member-record tables, `members`, message tables, ministry tables, notifications, pledge tables, prayer-request interaction tables, `profiles`, `rate_limits`, `security_audit_events`, `sermons`, `subscriptions`, `super_admins`, `trial_extensions`, and `user_roles`.

Created trigger names include the base `update_*_updated_at` family plus `on_auth_user_created`, `create_default_subscription_for_church`, `set_church_join_slug_before_write`, subscription/addon write triggers, and `update_message_templates_updated_at`/`update_messages_updated_at`. Indexes are declared in the base schema and the pagination, analytics, app-error, message, payment, portal-feed, report, and security-hardening migrations. RLS policies are defined both on public tables and on `storage.objects`; their effective final state must be checked on staging because later migrations intentionally drop/replace some of them.

The repository defines many public RPCs, including workspace creation, public registration/giving, invitation acceptance, portal contribution/announcement access, rate limiting, analytics snapshot generation, payment submission/review, app-error maintenance, record preservation, community leadership, and reports. RLS and Storage policies are defined throughout the base migration and subsequent hardening migrations; Storage is used for church assets, avatars, billing receipts, record-preservation proofs, and AI announcement assets where deployed.

The full function inventory includes `accept_invitation`, `can_manage_church_workspace`, `can_review_pastoral_requests`, chat-access helpers, `create_church_workspace`, pledge helpers, `enforce_rate_limit`, `generate_church_analytics_snapshot`, portal/public registration and giving RPCs, `get_contributions_by_member`, `get_portal_announcements`, role helpers, app-error maintenance, record-preservation/payment review RPCs, `save_church_announcement`, `submit_public_contribution`, `submit_subscription_payment`, and `update_community_leadership`.

## Conflicts and likely migration failures

1. `create_app_error_logs.sql` is unversioned. Supabase CLI normally requires timestamp-prefixed migration names, so it may be skipped or rejected depending on CLI version. Rename only through an approved migration-history strategy; do not rename a migration already applied elsewhere.
2. `20260619140000_add_generate_church_analytics_snapshot_rpc.sql` and `20260619150000_add_production_rate_limits.sql` both define `rate_limits`, `idx_rate_limits_action_scope_time`, and `enforce_rate_limit`. `if not exists` protects the table/index, while `create or replace` makes the latter function authoritative. Compare their function bodies before deploying.
3. `create_app_error_logs.sql`, `20260619160000_add_app_error_log_maintenance.sql`, `20260619170000_harden_app_error_logging.sql`, and `20260620120000_restrict_app_error_logs_to_super_admin.sql` overlap in indexes, policies, and RPCs. Final policy/RPC ownership depends on order; validate the effective policies after migration.
4. The message-template family (`20260603203000`, `20260620170000`, `20260620190000`, `20260620200000`) re-creates tables/indexes/policies. Some files use `create policy` without a preceding drop; a fresh database may fail if an earlier migration already installed the same named policy.
5. Several migrations reference compatibility tables/columns such as `member_communities`, `member_ministries`, `subscriptions`, and payment tables. These must exist in the preceding migration chain; validate with a fresh staging `db push`, not only against production drift.
6. The displayed initial schema has `super_admins.user_id`, while a later helper queries `super_admins.id`; review that helper against the final table definition before applying to a fresh project.

## Required post-push checks

Run `supabase migration list`; then inspect `pg_tables`, `pg_indexes`, `information_schema.routines`, `pg_trigger`, `pg_policies`, and `storage.buckets`. Exercise each high-risk SECURITY DEFINER RPC with anonymous, member, admin, and cross-church accounts. Record every error before seeding.

# Multi-role authorization production release checklist

## Release status

- [x] Architecture and implementation approved for staging.
- [x] Multi-role migration applied to the linked staging project.
- [x] Frontend authorization tests, full Vitest suite, production build, and ESLint completed successfully.
- [ ] Production rollout approved.

This branch must remain in UAT status until every production gate below is completed, reviewed, and recorded. Do not deploy the multi-role authorization changes to production before that approval.

## 1. SQL integration suites

- [x] Run `supabase/tests/multi_role_permissions.sql` against staging or a disposable database with the complete migration chain. Final result: 40/40 internal assertions, TAP `1..1`, explicit rollback.
- [x] Run `supabase/tests/mandatory_feature_trigger.sql` against the same migrated database. Passed 5/5 internal assertions and TAP `1..1`.
- [x] Run `supabase/tests/mutation_permission_alignment.sql` against staging or a disposable database with the complete migration chain. Final result: 30/30 internal assertions, TAP `1..1`, explicit rollback.
- [x] Record the database/project, migration version, execution date, operator, and complete pass/fail output.
- [x] Investigate every failure; no RLS, subscription, mandatory-feature, grant, or tenant-isolation control was weakened.

Privileged direct-connection retry on 2026-07-22: repository preflight passed on branch `staging` with linked ref `nunfrjcuimaytydnaqtt`, the exact requested host, absent production database credential variables, and a passing `git diff --check`. `pg_prove` was unavailable, so PostgreSQL 18 `psql` was selected. The direct host published only IPv6 `2a05:d018:d40:d202:f978:dce6:5fc7:1cb2`; the execution environment had no IPv6 route, and TLS `verify-full` connection failed before authentication with `Network is unreachable (0x00002743/10051)`. No database session or transaction began, all suites executed 0 assertions, no TAP plan was reached, no SQLSTATE was returned, and no cleanup was required because no database changes occurred. Fresh canonical persona and Church Admin anchor counts could not be recorded. The pooler was not substituted, and the SQL gate remains open.

Privileged staging pooler execution on 2026-07-22: the preferred session pooler at `aws-0-eu-west-1.pooler.supabase.com:5432` resolved to three IPv4 addresses but rejected authentication. The transaction pooler on the same verified regional host at port 6543 authenticated with the project-qualified staging username and returned the exact staging direct-host IPv6 address as its backend. PostgreSQL 18 `psql` executed each unchanged suite in a separate session. `mandatory_feature_trigger.sql` passed 5/5 internal assertions and TAP `1..1`; `multi_role_permissions.sql` passed 29 of 30 executed internal assertions, then failed with `P0001` because Church Admin + Pastor lost the Pastoral Care view grant; `mutation_permission_alignment.sql` passed 20 structural assertions, then fixture setup failed with `23514` because it attempted to weaken a mandatory recovery feature. Failed-session transactions rolled back automatically, the passing suite emitted explicit `ROLLBACK`, all suite artifacts and `UAT-MUTATION%`/branding markers were zero, all 12 canonical personas were freshly valid, and Church Admin anchors remained primary 3, expired 1, other 1. The SQL gate remains open.

Final SQL remediation on 2026-07-22: the multi-role fixture now makes the optional, globally disabled Prayer Requests feature available only inside its rollback transaction; the mutation fixture preserves mandatory-feature locking. Forward migration `20260722210000_enforce_authenticated_trigger_context.sql` was applied atomically to staging and recorded exactly once. It preserves direct privileged maintenance without an authenticated subject and the explicit service-role bypass, while making an emulated authenticated context honor all mutation triggers. Final results were `multi_role_permissions.sql` 40/40, `mutation_permission_alignment.sql` 30/30, and `mandatory_feature_trigger.sql` 5/5. All emitted TAP `1..1` / `ok 1` and explicit `ROLLBACK`. Cleanup found zero suite artifacts, `UAT-MUTATION%` rows, or branding objects; personas remained 12/12 and anchors 3/1/1. Focused authorization Vitest passed 45/45, full Vitest passed 455/455, build passed, focused ESLint passed, and `git diff --check` passed. The SQL integration gate is closed; production remains staging/UAT only.

## 2. Authenticated browser UAT

Use separate, clearly identified staging fixtures and record the user, church, expected permissions, observed navigation, direct-route behavior, and relevant database result for every scenario.

- [x] User with only Church Admin.
- [x] User with Church Admin and Pastor.
- [x] User with Secretary and Treasurer.
- [x] Remove one role while another remains; confirm only the removed role's permissions disappear.
- [x] Validate a user with no staff role has no staff workspace or protected staff data access. The separate final Church Admin invariant preflight remains open.
- [x] Attempt a duplicate assignment; confirm rejection and no duplicate UI or database row.
- [x] Use an expired subscription; confirm subscribed features remain unavailable regardless of role grants.
- [x] Disable a church feature; confirm navigation, pages, RPCs, and mutations deny it.
- [x] Assign a user to another church; confirm cross-church reads and mutations remain blocked.
- [x] Open a protected URL directly without permission; confirm server-backed denial, not only hidden navigation.
- [x] Change roles while the user has an active session; confirm permissions and navigation update without logout.

### Church Admin + Pastor targeted retest — 2026-07-22

- Environment: local Vite client in staging mode at `http://127.0.0.1:8080`, connected to the guarded linked staging Supabase fixtures.
- Operator: Codex automated Chromium UAT using a fresh browser context for every persona; no stored site session or legacy authorization cache was reused.
- Result: **PASS — 22/22 checks**.
- [x] `uat.admin-pastor@kanisaconnect.test` opened in Church Operations and displayed exactly one Pastoral Care section.
- [x] Admin + Pastor navigation contained 35 unique route targets with no duplicate route entries.
- [x] Mass Intentions, Mass Schedule, and Sacraments loaded through direct Pastoral routes; Church Admin Members remained available.
- [x] `prayer_requests` and `community_help` remained hidden and direct-route denied because those platform features are globally disabled in staging. Their church flags and role grants were not allowed to bypass platform availability.
- [x] `uat.admin@kanisaconnect.test` had no Pastoral Care section and was redirected from the Pastor-only direct route to Church Operations.
- [x] `uat.pastor@kanisaconnect.test` retained its Pastoral Workspace and loaded Mass Intentions, Mass Schedule, and Sacraments.
- [x] Removing Pastor from the Admin + Pastor fixture removed Pastoral Care after a page refresh, denied the direct Pastoral route, and retained Church Admin access.
- [x] The removed Pastor tuple was restored after the test so the reserved multi-role fixture remains reusable.
- [x] Historical observation reconciled: this pre-Broadcast retest required refresh, but the later private-Broadcast two-session UAT superseded it and proved live grant/revoke behavior without refresh.

This targeted retest does not complete the remaining browser scenarios below, the SQL integration suites, or production approval.

### Expanded multi-role staging matrix — 2026-07-22

- Environment: local staging-mode client at `http://127.0.0.1:8080`, linked only to the staging Supabase project.
- Operator: Codex automated authenticated Chromium and staging anon-client API probes, with a fresh browser context for each persona.
- Result: **PASS — 171/171 checks; 0 failures**.
- Evidence: local ignored report `.tmp/expanded-multi-role-uat-report.json`. No failure screenshots remain relevant because the final run had no failures.

| Persona | Result | Checks | Verified behavior |
| --- | --- | ---: | --- |
| Pastor + Treasurer | PASS | 27/27 | Pastoral and finance navigation unioned; Mass Intentions, Mass Schedule, Sacraments, Contributions, and Finance Reports loaded; role/settings administration denied. |
| Secretary + Treasurer | PASS | 30/30 | Secretary operations and finance unioned; members/events/contributions/reports loaded; Pastoral and role/settings administration denied. |
| Church Admin + Pastor + Treasurer | PASS | 27/27 | Admin, Pastoral, and Finance access unioned; Members, Contributions, Finance, Roles, Settings, Reports, Mass Schedule, and Sacraments loaded; one Pastoral Care section and no duplicate routes. |
| Expired Church Admin | PASS | 24/24 | Login and correct workspace succeeded; subscription-gated and platform-disabled navigation/routes stayed unavailable; no redirect loop or blank state. |
| No staff role | PASS | 28/28 | Member workspace only; all sampled Church Admin, Finance, and Pastoral URLs redirected; staff permission RPC returned false and protected `user_roles` returned no rows. |
| Other-church Admin | PASS | 35/35 | Only UAT Other Parish was shown; route/query/local-storage church-ID overrides did not change tenant context; primary-parish permission RPC returned false and sampled member, role, finance, prayer, Mass-intention, and sacrament reads returned no rows. |

Across the final matrix, every displayed permission-tagged navigation link was independently checked with `has_church_feature_permission()`. All personas had zero duplicate item IDs, zero duplicate routes, zero uncaught browser exceptions, zero console errors, and zero failed HTTP responses. Refresh preserved the authenticated authorization state. Representative direct routes covered members, contributions, reports, settings, roles and permissions, Pastoral Care/Mass Intentions, Mass Schedule, and Sacraments.

Local fixes required during this matrix:

- Navigation now honors direct-route permission metadata even when a registry item has no `featureFlag`; role and settings routes require `feature_permissions_admin:manage`.
- Duplicate `/pastoral` and `/portal/mass-intentions` navigation targets were removed.
- Staging-incompatible PostgREST aggregate projections and stale church/event/Mass-intention column projections were replaced with compatible tenant-filtered reads.
- Portal announcements use the existing RLS-protected table query directly because the staging RPC currently has an incompatible timestamp return type.

The expanded browser matrix validates browser reads and sampled cross-tenant API reads. At the time of that run, realtime visual updates and SQL integration were still open; the later SQL and reconciled realtime sections below close those gates. Production preflight remains open.

### Mutation-security staging UAT — 2026-07-22

- Detailed report: [`docs/multi-role-mutation-uat-report.md`](multi-role-mutation-uat-report.md)
- Historical result: **115/124 passed; 9 failed; cleanup passed**.
- Post-remediation result: **169/169 passed** across the final 121-check broad suite and 48-check focused suite; both cleanups passed.
- [x] Authorized user-scoped mutations succeeded for Members, Contributions, Events, Announcements, Mass Intentions, sacramental records, roles, permissions, settings, and feature controls.
- [x] Expired Admin, no-role, unauthorized-role, platform-disabled-feature, church-disabled-feature, and cross-tenant mutation probes were denied or affected zero rows.
- [x] Duplicate role assignment returned `23505` and left one tuple.
- [x] Removing the final Church Admin returned `23514` and left the row intact.
- [x] Removing Treasurer invalidated a Pastor + Treasurer session's finance mutation immediately without refresh; the role was restored afterward.
- [x] All `UAT-MUTATION-...` rows were deleted and modified feature, permission, role, and church-setting fixtures were restored.
- [x] Secretary Church settings, message-template, and branding mutations require `feature_permissions_admin:manage` in staging.
- [x] Event RLS honors `events:create/edit/delete`, preserves actor/tenant immutability, and requires ownership or `events:manage` for edits.
- [x] Announcement direct policies and security-definer RPCs honor `create/edit/publish/delete`, including combined-action enforcement.
- [x] Restore the Pastor Mass Intentions `Add Manual` UI action from effective permissions; focused authenticated Chromium retest passed.

Staging ledger verification records `20260722180000`, `20260722190000`, `20260722191000`, and `20260722210000` exactly once. Final SQL execution and local verification pass as recorded above. The SQL integration gate is closed.

Production approval remains blocked by production preflight, hardcoded authorization audit, audit-role review, unresolved staging database-linter findings, security review, final rollout approval, and the separately tracked role-expiry and membership-transfer/revoke product decisions.

## 3. Production preflight

- [ ] Prove every applicable church has at least one `church_admin` assignment before migration.
- [ ] Confirm the final Church Admin protection trigger is present and concurrency-safe.
- [ ] Review every row in `public.user_role_duplicate_archive` after rehearsal.
- [ ] Confirm archived rows retain original ID, user ID, church ID, original role, normalized role, and original assignment timestamp.
- [ ] Confirm archival affected only canonical duplicate `(user_id, church_id, normalized_role)` assignments and preserved distinct roles.
- [ ] Confirm `UNIQUE (user_id, church_id, role)` exists after normalization and deduplication.
- [ ] Verify `assign_church_member_role()`, `has_church_feature_permission()`, and `get_current_user_context()` definitions match the reviewed migration.
- [x] Verify authorization Broadcast coverage and transport coexistence. `user_roles` retains its pre-existing publication entry, while the private Broadcast trigger is the authorization invalidation path; obsolete publication additions were removed so the mechanisms do not duplicate authorization handling.
- [ ] Rehearse the forward-only migration on a production-like restored database and record duration, locks, archived duplicates, and invariant checks.
- [ ] Prepare a forward-only remediation plan; do not rely on destructive rollback of production authorization data.

## 4. Permission-driven RLS and helper audit

- [ ] Inventory active RLS policies, storage policies, RPCs, triggers, and helper functions containing hardcoded church role names.
- [ ] Classify each occurrence as authorization, record ownership, workflow duty, presentation, audit metadata, or historical migration only.
- [ ] Replace authorization role-name lists with feature/action permission checks where this preserves or strengthens row-level constraints.
- [ ] Retain explicit tenant/church predicates and record ownership conditions alongside permission checks.
- [ ] Test at least one configured custom role through navigation, direct URLs, RPCs, storage, and table RLS.
- [ ] Confirm roles can be defined and granted permissions without adding frontend authorization branches.
- [ ] Security-review every policy change; never replace a scoped policy with a broad “any staff role” rule.

## 5. Multi-role audit representation

- [ ] Inventory audit writers that store one scalar `actor_role` or select one role with `LIMIT 1`.
- [ ] Choose and document a consistent interim deterministic scalar rule if the existing schema must remain.
- [ ] Design a future `actor_roles text[]` or equivalent immutable role snapshot for multi-role audit events.
- [ ] Confirm authorization decisions never depend on the audit display role.
- [ ] Add regression coverage for stable audit output from multi-role actors.

## 6. Existing staging database linter findings

- [ ] Re-run `supabase db lint --linked` and attach the complete result.
- [ ] Resolve each unrelated error, or document its owner, impact, accepted risk, and planned remediation date.
- [ ] Review warnings separately from errors and identify any function that can affect authentication, registration, tenant resolution, contributions, announcements, subscriptions, or Super Admin checks.
- [ ] Re-run database lint after remediation and record the final disposition.

## Final approval record

- [x] SQL integration suites passed.
- [x] Authenticated browser UAT passed for every representable authorization synchronization scenario; role expiry and membership transfer/revoke remain explicit product decisions below.
- [ ] Production preflight passed.
- [ ] Hardcoded authorization audit completed and custom-role gaps resolved or explicitly excluded from the release.
- [ ] Audit logging behavior approved.
- [ ] Database linter findings resolved or formally accepted.
- [ ] Security reviewer approved tenant isolation, RLS, feature availability, subscription enforcement, and the final Church Admin invariant.
- [ ] Production rollout decision recorded with approver and date.

Until every required box is complete, the release status remains **staging/UAT only — not production-ready**.
## Realtime authorization synchronization gate — reconciled 2026-07-27

- [x] Centralize authorization synchronization in `AuthProvider`; remove the overlapping workspace-scoped invalidation channel.
- [x] Map roles, memberships, profiles, role grants, church features, subscriptions, and platform features to targeted React Query invalidations.
- [x] Refetch `get_current_user_context` authoritatively after user/church assignment changes; do not trust offline privileged context on synchronization failure.
- [x] Preserve additive multi-role aggregation, tenant checks, feature/subscription checks, RLS, and mutation triggers.
- [x] Avoid `window.location.reload()`, aggressive polling, row-payload authorization, and duplicate per-page channels.
- [x] Add clean logout/user/church channel teardown and source allow-listing.
- [x] Add focused cache, navigation, route-guard, Broadcast, duplicate-subscription, mutation-alignment, and feature-control tests; final focused result **46/46 passed**.
- [x] Changed-file ESLint: 0 errors (7 existing-style warnings in `AuthContext.tsx`).
- [x] Production build after final client correction: passed; 4,340 modules transformed.
- [x] Apply `20260722230000_broadcast_authorization_changes.sql` exactly once to verified staging and verify its private topic policies, triggers, ledger entry, and non-duplicating publication cleanup.
- [x] Run fresh focused tests after the final Broadcast correction: **46/46 passed**.
- [x] Run fresh full Vitest after the final Broadcast correction: **463/463 passed**.
- [x] Execute two-session browser UAT without refresh. Scenarios A, B, C, D, E, F, G, and J passed, including final-role revoke, optional feature off/on, protected-page revoke, mutation-control removal, and HTTP 403 / SQLSTATE `42501` stale-mutation denial.
- [x] Approve the channel criterion as **exactly one non-duplicated active authorization channel per authorization scope**. The expected scopes are user, active church, and platform; “exactly one channel total” is rejected as the wrong security and routing model.
- [x] Record grant/revoke propagation timing and prove no duplicates after navigation/remount. Final observed range: **651–1,704 ms**; three unique joins, zero duplicate joins, zero unexpected leaves, and the same three active scope topics before and after.
- [x] Verify teardown. `AuthProvider` owns one channel factory and one channel collection; cleanup marks handlers inactive and calls `removeChannel` for every topic when user or church dependencies change or logout clears the user. The post-`setAuth()` active check prevents late subscriptions for an obsolete scope.
- [x] Restore every modified fixture and verify zero `UAT-REALTIME`/temporary objects, 12/12 personas, and Church Admin anchors primary 3 / expired 1 / other 1.
- [x] Run final `git diff --check` after report updates.

### Separate product decisions — not hidden realtime failures

- [ ] **Role expiry:** decide and implement or explicitly exclude time-bounded active roles. `user_roles` has no expiry/status field, so scenario H is unsupported and invitation/subscription expiry is not a substitute.
- [ ] **Safe membership transfer/revoke:** define an atomic product flow that reconciles `members` and independent `user_roles` tenant assignments before claiming transfer/revoke support. Scenario I was not run because a membership-only change would not prove removal of old-church authorization.

Decision: the SQL integration and realtime-without-refresh gates are **CLOSED**. Production remains **NOT READY** because the separate production preflight, audit, linter, security-review, product-decision, and rollout-approval gates remain open. No production access, deployment, commit, or push occurred.

## Authorization migration record — verified staging state on 2026-07-27

The following release migrations are present in the repository and were verified as applied exactly once to staging project `nunfrjcuimaytydnaqtt`. This record does not assert that any migration has been applied to production; production was not accessed during this work.

| Migration | Staging | Production |
| --- | --- | --- |
| `20260721140000_fix_mandatory_feature_trigger_row_shapes.sql` | Applied and verified | Not verified or applied by this work |
| `20260722100000_multi_role_effective_permissions.sql` | Applied and verified | Not verified or applied by this work |
| `20260722180000_fix_mutation_permission_alignment.sql` | Applied and verified | Not verified or applied by this work |
| `20260722190000_enforce_event_mutation_scope.sql` | Applied and verified | Not verified or applied by this work |
| `20260722191000_fix_branding_storage_permission_policy.sql` | Applied and verified | Not verified or applied by this work |
| `20260722210000_enforce_authenticated_trigger_context.sql` | Applied and verified | Not verified or applied by this work |
| `20260722220000_authorization_realtime_publication.sql` | Applied and verified | Not verified or applied by this work |
| `20260722230000_broadcast_authorization_changes.sql` | Applied and verified | Not verified or applied by this work |
| `20260727120000_enforce_role_permission_constraints.sql` | Applied and verified | Not verified or applied by this work |
| `20260727130000_remediate_legacy_role_permission_conflicts.sql` | Applied and verified | Not verified or applied by this work |
| `20260727140000_revoke_service_role_permission_editor_rpc.sql` | Applied and verified | Not verified or applied by this work |

## Role-permission constraint hardening gate — 2026-07-27

- [x] Define `CONFIGURABLE`, `RESTRICTED`, and `SYSTEM_PROTECTED` as typed UI states backed by a canonical PostgreSQL rule.
- [x] Derive feature/action applicability and role maximums from implemented workflows without adding roles, actions, or frontend-only ownership semantics.
- [x] Make missing constraint data fail secure and add accessible locks, reasons, a legend, warning, explanation, and sticky feature column.
- [x] Make the existing recommended-default reset skip locked cells and report the skipped count.
- [x] Harden `save_church_role_permissions` with actor, tenant, applicability, restricted, system-protected, mandatory-recovery, and atomic batch validation.
- [x] Keep authenticated direct DML revoked; preserve explicit `search_path` and narrow function grants.
- [x] Make future provisioning intersect recommended defaults with the canonical constraint rule without rewriting existing grants.
- [x] Add a read-only preflight query for existing out-of-bound assignments.
- [x] Preserve user/church/platform Broadcast scopes and invalidate `church-permission-constraints` through the existing church channel.
- [x] Focused local authorization tests: **53/53 passed** across seven files.
- [x] Changed-file ESLint after implementation: **0 errors and 0 warnings**.
- [x] Applied `20260727120000_enforce_role_permission_constraints.sql` exactly once to verified staging project `nunfrjcuimaytydnaqtt`.
- [x] Ran `scripts/sql/preflight-role-permission-constraints.sql` read-only against staging and reviewed all 6,167 evaluated permission cells.
- [x] Ran `supabase/tests/permission_constraints.sql` and every identified SQL authorization regression suite after remediation; all suites passed with rollback and cleanup verified.
- [x] Full Vitest passed: **473/473** across 63 files.
- [x] Production build passed: 4,342 modules transformed.
- [x] Final changed-file ESLint passed with **0 errors and 0 warnings**; `git diff --check` and explicit new-file whitespace/conflict checks passed.
- [x] Reviewed system-protected and restricted grants, preserved the 14 intentional recovery grants, and applied the separately approved, tenant-explicit legacy remediation to staging.

Decision: the staging role-permission constraint gate is **CLOSED**. Production remains **NOT READY** until the separate production preflight, security review, linter disposition, product decisions, and rollout approval are complete.

# Multi-role mutation-security staging UAT

## Status

- Date: 2026-07-22
- Environment: local staging-mode app at `http://127.0.0.1:8080`, linked staging Supabase project only
- Post-remediation result: **169/169 passed** across the final broad and focused mutation suites
- Historical pre-remediation result: **115/124 passed; 9 failed**
- Cleanup: **PASS**
- Production status: **NOT READY**

The staging database now includes the reviewed remediation plus two focused follow-ups discovered during expanded UAT:

- `20260722180000_fix_mutation_permission_alignment.sql`
- `20260722190000_enforce_event_mutation_scope.sql`
- `20260722191000_fix_branding_storage_permission_policy.sql`

The remote ledger records each exactly once. No frontend or production deployment occurred.

## Local remediation status

- Church settings: restrictive `churches` UPDATE RLS plus a trigger require `feature_permissions_admin:manage`; message-template writes and branding asset paths use the same authoritative check. Client mutations are also guarded, but UI state is not treated as the security boundary.
- Events: action-aligned `events:create`, `events:edit`, and `events:delete` policies retain tenant and actor immutability. Cross-owner edit additionally requires `events:manage`, preventing active-member permissions from changing another actor's Event.
- Announcements: lifecycle policies, direct mutations, and security-definer RPCs use create/edit/publish/delete permissions. A combined content edit and publication transition requires both edit and publish.
- Pastor UI: page action candidates now come from the authoritative route permission matrix rather than the scalar pastoral workspace defaults.
- Focused authorization regression: **PASS, 30/30**.
- Pastor-only authenticated Chromium retest: **PASS**; `/pastoral/mass-intentions` displayed `Add Manual` with no uncaught page exceptions.
- Full Vitest: **PASS, 455/455**. Production build: **PASS**. ESLint: **PASS with 0 errors and 415 existing warnings**. `git diff --check`: **PASS**.
- Broad authenticated mutation/Chromium suite: **PASS, 121/121; cleanup PASS**.
- Focused settings/storage/Event/Announcement/RPC suite: **PASS, 48/48; cleanup PASS**.
- Combined final staging execution: **PASS, 169/169**.
- SQL integration execution is **PASS — 3/3 suites passed** after the staging remediation recorded below. Every suite executed non-zero internal assertions, emitted TAP `ok 1`, completed explicit `ROLLBACK`, and left zero test artifacts. The SQL integration gate is closed; production remains not ready because non-SQL release gates remain open.

### Privileged direct-connection retry — 2026-07-22

- Preflight passed for branch `staging`, linked project ref `nunfrjcuimaytydnaqtt`, requested host `db.nunfrjcuimaytydnaqtt.supabase.co`, absent production database credential variables, and `git diff --check`.
- `pg_prove` was unavailable; PostgreSQL 18 `psql` was selected as the approved fallback. The three suites retain their own `BEGIN`/`ROLLBACK` boundaries and TAP plans of `1..1`.
- Public and system DNS returned no IPv4 record for the direct host and returned only IPv6 `2a05:d018:d40:d202:f978:dce6:5fc7:1cb2`. A TLS `verify-full` connection using the exact hostname and resolved address failed before authentication with `Network is unreachable (0x00002743/10051)`.
- Database identity and the privileged role therefore could not be verified from a live session. Per the staging-only stop condition, no suite was started and the pooler was not substituted.
- Assertions executed: `multi_role_permissions.sql` **0**, `mutation_permission_alignment.sql` **0**, `mandatory_feature_trigger.sql` **0**. Passed: **0**. Failed: **0**. TAP output: **none**; declared plans were not reached.
- SQLSTATE: **not available** because the failure occurred before a PostgreSQL session. Exact libpq diagnostic: `connection to server at "2a05:d018:d40:d202:f978:dce6:5fc7:1cb2", port 5432 failed: Network is unreachable (0x00002743/10051)`.
- Rollback result: **not applicable; no transaction began**. Cleanup result: **no database changes were made**, so no run-created rows or branding objects existed to remove.
- Canonical fixture and Church Admin anchor counts could not be freshly recorded or post-verified because no database session was established. The last completed cleanup verification remains 12 valid personas and Church Admin anchors primary 3, expired 1, other 1; it is historical evidence, not a result of this retry.
- SQL integration gate: **OPEN**. Production status: **NOT READY**.

### Privileged staging pooler execution — 2026-07-22

- Preflight passed for branch `staging`, linked project ref `nunfrjcuimaytydnaqtt`, absent production database credential variables, and `git diff --check`.
- Local Supabase metadata identified the regional session pooler `aws-0-eu-west-1.pooler.supabase.com`, port 5432, with project-qualified username `postgres.nunfrjcuimaytydnaqtt`. DNS returned three IPv4 addresses: `34.241.16.247`, `52.209.89.87`, and `108.128.216.176`.
- The preferred session pooler reached Supabase but rejected the database password. The verified transaction pooler on the same regional host, port 6543, authenticated successfully. Its backend address was `2a05:d018:d40:d202:f978:dce6:5fc7:1cb2`, exactly matching the verified AAAA record for the staging direct host. No production endpoint was accessed.
- `pg_prove` was unavailable, so PostgreSQL 18 `psql` ran each unchanged suite in its own database session with `ON_ERROR_STOP=1`. Every suite declared TAP plan `1..1`.

| Suite | Internal assertions | Passed | Failed | TAP result | SQLSTATE / diagnostic | Rollback |
| --- | ---: | ---: | ---: | --- | --- | --- |
| `multi_role_permissions.sql` | 30 | 29 | 1 | Plan `1..1` reached; aggregate `ok` not emitted | `P0001` at line 182: `ASSERTION FAILED: Church Admin + Pastor lost the Pastoral Care view grant`; context: `PL/pgSQL function pg_temp_14.assert_true(boolean,text) line 4 at RAISE` | Automatic on session termination; fixed-artifact verification returned zero |
| `mutation_permission_alignment.sql` | 20 | 20 | 0 assertion failures; suite failed during fixture setup | Plan `1..1` reached; aggregate `ok` not emitted | `23514` at line 129: `Mandatory church recovery feature cannot be weakened or removed`; context: `PL/pgSQL function protect_mandatory_feature() line 67 at RAISE` | Automatic on session termination; fixed-artifact verification returned zero |
| `mandatory_feature_trigger.sql` | 5 | 5 | 0 | `ok 1 - mandatory feature trigger assertions passed` | None | Explicit `ROLLBACK` completed |

- Fresh cleanup verification: all fixed suite artifact counts were zero across Auth users, churches, members, roles, contributions, prayer requests, Events, Announcements, and the temporary platform feature. Dynamic `UAT-MUTATION%` row count was zero, and matching storage branding-object count was zero.
- Fresh canonical verification: **12/12** Auth users, profiles, active memberships, exact role sets, and overall personas were valid.
- Fresh Church Admin anchors: primary **3**, expired **1**, other **1**.
- SQL integration gate: **OPEN**. Production status: **NOT READY**. Both failed suites must be corrected and rerun unchanged with passing TAP output before this gate can close.

### SQL integration remediation and final gate — 2026-07-22

Root causes:

- `multi_role_permissions.sql` correctly found both Pastor and Church Admin Prayer Requests grants, but `has_church_feature_permission()` first applies platform availability. Staging intentionally had optional `prayer_requests.globally_enabled=false`; the rollback-scoped fixture enabled only the church row. The fixture now temporarily enables that optional platform feature inside its transaction so it tests additive role aggregation without changing staging's persistent platform state.
- `mutation_permission_alignment.sql` forced `locked=false` for Events, Announcements, and mandatory `feature_permissions_admin` in one statement. The passing mandatory-feature trigger correctly rejected that setup. The fixture now derives `locked` from `pf.is_mandatory`, preserving the recovery feature as enabled and locked.
- After that setup correction, privileged SQL execution exposed a trigger-emulation gap: `session_user='postgres'` bypassed mutation triggers even after `SET ROLE authenticated` and an authenticated JWT subject were set. Migration `20260722210000_enforce_authenticated_trigger_context.sql` preserves privileged maintenance when `auth.uid()` is null and preserves the explicit service-role bypass, while requiring an explicitly authenticated context to honor settings, Event, Announcement, and tenant/actor trigger boundaries.

Final staging transaction-pooler results:

| Suite | Internal assertions | Passed | Failed | TAP | Rollback |
| --- | ---: | ---: | ---: | --- | --- |
| `multi_role_permissions.sql` | 40 | 40 | 0 | `1..1`; `ok 1` | Explicit `ROLLBACK` |
| `mutation_permission_alignment.sql` | 30 | 30 | 0 | `1..1`; `ok 1` | Explicit `ROLLBACK` |
| `mandatory_feature_trigger.sql` | 5 | 5 | 0 | `1..1`; `ok 1` | Explicit `ROLLBACK` |

- Migration ledger: `20260722210000` recorded exactly once; all four deployed trigger definitions contain the authenticated-context guard.
- Cleanup: zero fixed suite artifacts, zero dynamic `UAT-MUTATION%` rows, and zero matching branding objects.
- Canonical personas: **12/12 valid**. Church Admin anchors: primary **3**, expired **1**, other **1**.
- Local verification: focused authorization Vitest **45/45**, full Vitest **455/455**, production build **PASS**, focused changed-file ESLint **PASS**, and `git diff --check` **PASS**.
- SQL integration gate: **CLOSED**. Production status: **NOT READY**.

## Post-remediation module result

| Broad-suite module | Passed | Failed |
| --- | ---: | ---: |
| Authentication | 8 | 0 |
| Members | 16 | 0 |
| Contributions | 16 | 0 |
| Events | 13 | 0 |
| Announcements | 18 | 0 |
| Mass Intentions | 15 | 0 |
| Sacramental records | 6 | 0 |
| Roles | 9 | 0 |
| Permissions | 3 | 0 |
| Church settings | 7 | 0 |
| Platform-disabled feature | 2 | 0 |
| Church feature controls | 3 | 0 |
| Browser UI | 5 | 0 |

The additional 48 focused checks covered settings, message templates, logo/banner storage, Event ownership, tenant and actor tampering, Announcement direct/RPC parity, combined edit+publish, disabled-feature behavior, expired subscriptions, and cross-tenant denial.

## Post-remediation persona result

| Broad-suite persona | Passed | Failed |
| --- | ---: | ---: |
| Church Admin | 19 | 0 |
| Pastor | 12 | 0 |
| Secretary | 29 | 0 |
| Treasurer | 14 | 0 |
| Pastor + Treasurer | 2 | 0 |
| Expired Admin | 14 | 0 |
| No-role | 13 | 0 |
| Other-church Admin | 18 | 0 |

All authorization assertions used an authenticated persona's anon-key session. The service-role client was used only to read fixture state, verify outcomes, restore original configuration, and remove records created by this run.

## Coverage summary

| Module | Passed | Failed | Total |
| --- | ---: | ---: | ---: |
| Authentication | 8 | 0 | 8 |
| Members | 16 | 0 | 16 |
| Contributions | 16 | 0 | 16 |
| Events | 12 | 3 | 15 |
| Announcements | 16 | 3 | 19 |
| Mass Intentions | 15 | 0 | 15 |
| Sacramental records | 6 | 0 | 6 |
| Roles | 9 | 0 | 9 |
| Permissions | 3 | 0 | 3 |
| Church settings | 5 | 2 | 7 |
| Platform-disabled feature | 2 | 0 | 2 |
| Church feature controls | 3 | 0 | 3 |
| Browser UI | 4 | 1 | 5 |

## Persona summary

| Persona | Passed | Failed | Total |
| --- | ---: | ---: | ---: |
| Church Admin | 22 | 0 | 22 |
| Pastor | 11 | 1 | 12 |
| Secretary | 21 | 8 | 29 |
| Treasurer | 14 | 0 | 14 |
| Pastor + Treasurer | 2 | 0 | 2 |
| Expired Admin | 14 | 0 | 14 |
| No-role | 13 | 0 | 13 |
| Other-church Admin | 18 | 0 | 18 |

## Security controls that passed

### Tenant, subscription, and role boundaries

- Pastor and Treasurer could not mutate Members without the relevant action permission (`42501`).
- Pastor and Secretary could not update Contributions (`42501`).
- Treasurer could not change a Mass Intention approval status (`42501`). Secretary also could not perform the approval transition.
- Treasurer and no-role users could not create or update sacramental records (`42501`).
- Expired Admin mutations against Members, Contributions, Events, Announcements, Mass Intentions, and sacramental records were rejected or affected zero rows.
- Other Parish Admin attempts against primary-parish Members, Contributions, Events, Announcements, Mass Intentions, roles, and sacramental records were rejected or affected zero rows. Service-role verification confirmed the primary rows were unchanged.
- No-role attempts to update protected staff records affected zero rows. A forged Member insert using the Admin's `user_id` was rejected with `42501`.

### Tampering

- Cross-tenant `church_id`, record-ID, and RPC-argument substitution did not modify primary-parish records.
- Treasurer contribution insertion with a forged Admin `created_by` was rejected (`42501`).
- Secretary Event insertion with a forged Admin `created_by` was rejected (`42501`).
- Secretary could not grant itself `feature_permissions_admin:manage` (`42501`).
- An unknown role in a permission payload was rejected (`22023`).
- Unauthorized Mass Intention status/approval transitions were rejected (`42501`).

### Roles and active sessions

- Duplicate Pastor assignment returned SQLSTATE `23505`; verification found exactly one tuple.
- Secretary and Other Parish Admin role-assignment attempts returned `42501`.
- Removing Treasurer from the Pastor + Treasurer account preserved Pastor.
- Without refresh or re-login, the removed user's existing session immediately received `42501` for a finance mutation.
- Treasurer was restored after the test.
- Removing the only Church Admin from UAT Other Parish returned `23514`; the Admin row remained.

### Feature availability

- Admin could not insert a Prayer Request while that platform feature was globally disabled (`42501`), and the permission RPC returned `false`.
- Announcements were temporarily disabled for the primary UAT parish. Navigation disappeared, the direct URL showed `Access unavailable`, permission RPC returned `false`, and create/update/delete attempts were denied.
- Secretary could not change a church feature without administrative manage permission (`42501`).
- The Announcement feature was restored to its original state.

### Authorized mutation baselines

- Secretary successfully created, edited, deactivated, and reactivated a Member; Admin deleted it.
- Treasurer successfully created and updated a Contribution; Admin deleted/reversed it.
- Admin successfully created, updated, and deleted an Event.
- Secretary successfully created an Announcement; Admin successfully updated, published, and deleted it.
- Pastor successfully created, approved, marked paid, and edited a Mass Intention; Admin deleted it.
- Pastor successfully created and updated a sacramental record.
- Admin successfully changed and restored a role permission, church feature, church setting, and role assignment.

## Authorization gaps

### SEC-1 — Secretary can update Church settings

Severity: **High**

An authenticated Secretary updated the primary church's `phone` column through a direct Supabase request despite lacking `feature_permissions_admin:manage`. The request returned HTTP 200 with one row and service-role verification confirmed the change. The value was immediately restored and final cleanup restored the original `NULL` value.

Resolved in staging. Secretary direct settings and message-template mutations are denied; branding writes are denied while Church Admin branding writes succeed.

### SEC-2 — Secretary Event grants conflict with legacy RLS

Severity: **Functional authorization mismatch**

The permission matrix grants Secretary `events:create`, `edit`, and `delete`, but:

- Create returned `42501` from Event RLS.
- Update affected zero rows.
- Delete affected zero rows.

Resolved in staging. Secretary Event CRUD follows configured permissions; cross-owner active-member edits, tenant tampering, actor tampering, and cross-church mutations are denied.

### SEC-3 — Secretary Announcement grants conflict with legacy RLS

Severity: **Functional authorization mismatch**

Resolved in staging. Secretary direct and RPC create/edit/publish/delete operations pass; unauthorized, disabled-feature, combined-action, actor-tampering, and cross-tenant cases are denied.

### UI-1 — Pastor Mass Intention mutation control missing

Severity: **Presentation/authorization mismatch**

Pastor direct API create, edit, approve, mark-paid, and manage operations succeeded, but the original run did not display `Add Manual`. The local presentation fix now consumes route-level effective permissions, and a focused authenticated Chromium retest passed.

## Cleanup verification

- All rows prefixed with the run's `UAT-MUTATION-...` marker were removed from Members, Contributions, Events, Announcements, Mass Intentions, and sacramental records.
- Announcement feature state restored.
- Pastor + Treasurer role tuple restored.
- Treasurer Reports permission row restored.
- Primary church phone restored to its original `NULL` value.
- UAT Other Parish retained its final Church Admin.
- Cleanup errors: **none**.

## Evidence and limitations

The ignored machine-readable broad-run output is `.tmp/mutation-security-uat-report.json`. No production project or data was accessed. No frontend deployment, commit, or Git push was performed.

Final cleanup found zero `UAT-MUTATION%` rows in Members, Contributions, Events, Announcements, Mass Intentions, sacramental records, or message templates, and zero matching logo/banner objects. All 12 canonical personas remain valid; Church Admin anchors are primary 3, expired 1, and other 1.

This run closed the SQL integration gate. The later realtime section records the separate Broadcast migration, two-session UAT, and channel-criterion decision that subsequently closed the realtime visual-update gate. Production preflight, hardcoded RLS/helper audit, audit-role representation, staging database-linter findings, security review, and final rollout approval remain open. Production authorization grants and schemas were not weakened for the test runner.
## Realtime-without-refresh authorization synchronization — 2026-07-22

Status: **CLOSED — private Broadcast synchronization and two-session staging UAT passed under the approved per-scope channel criterion.** Production remains **NOT READY** for the separate release blockers recorded below.

### Architecture and root cause

The prior client had two overlapping Postgres Changes channels: `AuthProvider` watched only the current user's `user_roles`, while each mounted workspace watched `user_roles`, `church_role_permissions`, and `church_features`. It did not observe `members`, `profiles`, `subscriptions`, or `platform_features`; feature caches could therefore remain valid for 5–10 minutes. The page-scoped channel also disappeared outside a workspace, and an authoritative refresh failure could retain offline privileged context. Finally, Supabase Postgres Changes cannot filter DELETE events, and RLS limits `old` DELETE rows to primary keys, so the initial filtered implementation could not securely identify a deleted role's user/church.

The local implementation now uses private database Broadcast signals. `AuthProvider` owns one channel factory and creates at most one user topic, one active-church topic, and one platform topic. Database triggers emit only `{source, operation}`—never row data. A scoped `realtime.messages` SELECT policy permits a user topic only to that user, a church topic only to a current active member/role holder, and the platform topic to authenticated sessions. The client treats every message as an invalidation signal, refetches authoritative RPC/table state, rejects unexpected sources, closes the fetch/subscription race on subscribe, removes channels on logout/user/church changes, and removes privileged caches plus role/church context if Realtime authentication or authoritative refresh fails.

### Dependency map

| Source | Realtime signal | Cache keys invalidated | Provider/hooks | UI surfaces |
|---|---|---|---|---|
| `user_roles` | private `authorization:user:<user_id>` Broadcast; INSERT/UPDATE/DELETE | `church-permission`, `church-feature-permission-matrix`, `church-role-permissions`, `portal-church-features`, `feature-subscription-plan` | authoritative `get_current_user_context`, `useAuth`, `useChurchPermission`, `useFeatureAccess` | workspace selection, merged multi-role navigation, role route guards, page permissions, mutation controls |
| `members` | private user Broadcast; INSERT/UPDATE/DELETE | same user-context families | authoritative user context and active membership resolution | member workspace, church access, route guards |
| `profiles` | private user Broadcast; INSERT/UPDATE/DELETE | same user-context families | authoritative user/church context | active church/workspace and all dependent UI |
| `church_role_permissions` | private `authorization:church:<church_id>` Broadcast; INSERT/UPDATE/DELETE | `church-permission`, permission matrix, `church-role-permissions` | `useChurchPermission`, `useFeatureAccess`, workspace queries | sidebar/menu, route access, page-level and mutation actions |
| `church_features` | private church Broadcast; INSERT/UPDATE/DELETE | `church-permission`, permission matrix, `portal-church-features` | feature and permission hooks | navigation, route content, locked/disabled controls |
| `subscriptions` | private church Broadcast; INSERT/UPDATE/DELETE | `church-permission`, permission matrix, `feature-subscription-plan` | feature availability and permission RPC | subscription-gated navigation/routes/actions |
| `platform_features` | private `authorization:platform` Broadcast; INSERT/UPDATE/DELETE | `church-permission`, permission matrix, `portal-platform-features` | feature and permission hooks | all feature-gated navigation/routes/actions, including mandatory features |

Server-side RLS, permission RPCs, and mutation triggers remain the final enforcement layer. No `window.location.reload()` path was added.

### Files and migrations

- Client: `src/contexts/AuthContext.tsx`, `src/lib/authorization-realtime.ts`, `src/hooks/use-church-permission.ts`, and `src/routes/WorkspaceRouteLayout.tsx`.
- Tests: `src/test/authorization-realtime.test.ts`, `src/test/authorization-realtime-ui.test.tsx`, plus architecture assertions updated in the existing multi-role and tenant-feature tests.
- `20260722220000_authorization_realtime_publication.sql` was applied only to verified staging and recorded once. It enabled the seven-table Postgres Changes prototype.
- `20260722230000_broadcast_authorization_changes.sql` supersedes that prototype with secure private Broadcast, restores default replica identity, and removes only the four newly added publication entries. It is forward-only and idempotent and is applied exactly once to the verified staging project.

### Verification evidence

- Preflight before staging access: branch `staging`; ref `nunfrjcuimaytydnaqtt`; production database variable count `0`; `git diff --check` passed; pooler returned three IPv4 addresses.
- Database identity before the applied migration: transaction pooler backend `2a05:d018:d40:d202:f978:dce6:5fc7:1cb2`, matching the previously verified staging direct host; no production endpoint accessed.
- Focused authorization/realtime Vitest after the Broadcast correction: **46/46 passed** across seven files. It covered scoped invalidation, fail-closed removal, INSERT/UPDATE/DELETE identity routing, mounted navigation revoke, mounted role-guard grant/revoke, mutation alignment, and feature controls.
- Changed-file ESLint after the Broadcast correction: **0 errors**, 7 pre-existing-style warnings in `AuthContext.tsx` (`any` and fast-refresh warnings).
- Production build after the Broadcast correction: **passed**, 4,340 modules transformed.
- Fresh full Vitest after the Broadcast correction: **463/463 passed**. Production build: **passed**.
- Two-session staging Chromium UAT kept the target-user session open without refresh, logout, a new tab, or storage clearing. Scenarios A, B, C, D, E, F, G, and J passed. Grant/revoke propagation was 651–1,704 ms; revocation on an already open protected page re-evaluated access; stale sacramental mutations returned HTTP 403 / SQLSTATE `42501`; and no unauthorized row was created.
- Cleanup restored the target to Member-only, restored Pastor/Sacraments permissions and Events availability exactly, and found zero `UAT-REALTIME` artifacts or temporary database objects. Fresh verification remained **12/12** valid personas and Church Admin anchors primary **3**, expired **1**, other **1**.

### Channel acceptance criterion decision — 2026-07-27

The approved criterion is **exactly one non-duplicated active authorization channel per authorization scope**, not exactly one authorization channel total. For an authenticated church user, the expected steady state is therefore three private logical topics:

| Scope | Topic | Sources covered | Why it is a distinct boundary |
|---|---|---|---|
| User | `authorization:user:<user_id>` | `user_roles`, `members`, `profiles` | The changed row identifies one affected user. Only that user's session may subscribe, and these events can replace role, church, workspace, and profile context. |
| Active church | `authorization:church:<church_id>` | `church_role_permissions`, `church_features`, `subscriptions` | The changed row identifies a tenant, not every affected user. Current role holders or active members of that church may subscribe; other churches may not. |
| Platform | `authorization:platform` | `platform_features` | Platform availability has no user or church identifier and can affect every authenticated tenant. The payload remains a minimal invalidation signal and exposes no row data. |

Consolidating these scopes into one total channel would not improve enforcement. A single global topic would widen the audience and force unrelated sessions to refetch on every tenant change. A per-user aggregate topic would require database-side fan-out of every church and platform change to every affected user, increasing trigger complexity, write amplification, membership-race risk, and cleanup burden. A per-session random topic would require a server-maintained session routing registry. The current topics preserve least-privilege routing and source allow-lists, while Supabase multiplexes the logical channels through the Realtime client rather than requiring three independent application authorization implementations. With a fixed maximum of three topics per authenticated church session, consolidation offers no material performance benefit and would reduce security clarity and maintainability.

Duplicate-subscription evidence is affirmative:

- Live Session B recorded exactly three unique joins—one user, one church, and one platform topic—with zero duplicate joins and zero unexpected leaves before and after the UAT navigation and authorization remount activity.
- `AuthProvider` contains one centralized `.channel(...)` factory. No page or workspace creates an overlapping authorization channel.
- The focused architecture test asserts one channel factory, registration in one `channels` collection, and cleanup through `supabase.removeChannel(channel)`; the focused suite passed **46/46**.

Lifecycle behavior is also bounded by scope. The effect is keyed by authenticated user and active church. Its cleanup first makes handlers inactive and removes every channel in the collection. A user change therefore removes the prior user's topics before the new user's topics become effective; logout removes the authenticated topics and resets authorization state; and a church change removes the old church-scoped set before subscribing with the new church identity. The asynchronous `setAuth()` continuation checks the same active flag, so it cannot create late channels after cleanup. Event handlers accept only their topic's source allow-list and refetch authoritative state instead of applying payload data.

Two unresolved product decisions are explicitly outside this synchronization gate:

- **Role expiry:** unsupported because `user_roles` has no expiry or status field. Invitation or subscription expiry must not be treated as role expiry implicitly.
- **Safe membership transfer/revoke:** unresolved because membership and `user_roles` are independent tenant assignments; a product transaction must define how both are reconciled before claiming an atomic transfer/revoke flow.

### Gate decision

The realtime-without-refresh gate **is closed** under the approved per-scope criterion. All representable grant and revoke scenarios passed without refresh, server enforcement denied stale writes, the three expected scope topics had no duplicates, cleanup passed, and focused/full regression evidence is green. Closing this gate does not resolve role expiry, membership transfer/revoke semantics, production preflight, hardcoded authorization audit, audit-role review, database-linter findings, security review, or final rollout approval. Production was not accessed, deployed, committed, or pushed.

## Role-permission constraint hardening — local implementation 2026-07-27

The permissions matrix previously rendered all seven action columns as configurable for nearly every enabled feature. Its only UI exception was the Church Admin recovery checkbox, while `save_church_role_permissions` validated actor/church, feature availability, and the mandatory recovery path but did not enforce feature/action applicability or a target role's maximum authority. An authorised Church Admin could therefore craft grants that were meaningless or dangerously broad even though downstream RLS and triggers still constrained many concrete mutations.

The local forward-only migration `20260727120000_enforce_role_permission_constraints.sql` introduces one canonical rule used by the actor-aware read RPC, atomic save RPC, and future default provisioning. The UI renders configurable, platform-restricted, and system-protected states with accessible help and fails closed if the constraint RPC is unavailable. The existing reset-to-recommended action skips locked cells. Permission changes continue through the existing church Broadcast scope and now invalidate the constraint cache without adding channels.

No current database was queried or modified during this local step. Consequently, the number of existing restricted, system-protected, and non-applicable assignments is **not yet known**. `scripts/sql/preflight-role-permission-constraints.sql` is read-only and must be run in a verified non-production environment after the migration is applied. The migration deliberately does not delete or rewrite existing grants.

Local evidence so far:

- Focused authorization/realtime Vitest: **53/53 passed** across seven files.
- New permission-constraint component/contract coverage: **10/10 passed**.
- Changed-file ESLint: **0 errors and 0 warnings**.
- Full Vitest: **473/473 passed** across 63 files.
- Production build: **passed**, 4,342 modules transformed.
- Final `git diff --check` plus explicit new-file whitespace/conflict checks: **passed**.
- SQL suite added: `supabase/tests/permission_constraints.sql`; not run because the migration was not applied to a database in this local-only step.
- Production access, deployment, commit, and push: **none**.

The role-permission hardening gate remains **OPEN** pending verified non-production migration application, preflight results, the new and established SQL suites, full Vitest, build, final lint, and whitespace verification. This does not reopen the previously closed SQL integration or realtime gates for their already verified architecture; it is a new change-specific release gate.

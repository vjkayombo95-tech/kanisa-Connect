# Kanisa Connect Authorization Architecture Decisions

## Purpose

This document records the architectural decisions behind Kanisa Connect authorization. It explains why the system is structured as it is, identifies the security boundaries that must remain authoritative, and defines invariants that future contributors must preserve.

This is a decision record, not an API reference. Implementation details may evolve, but changes must continue to satisfy the principles and invariants documented here.

## Core Principles

- PostgreSQL is the source of truth for authorization.
- Tenant isolation is mandatory and must be enforced at the database boundary.
- Client-side authorization improves user experience; it is never the final security boundary.
- Every mutation must be authorized by Row Level Security (RLS), a database trigger, an authorized RPC, or an appropriate combination of those controls.
- Multiple roles combine additively unless an explicit, reviewed restriction applies.
- Feature availability and permission grants are independent requirements. Both must permit an action.
- Authorization changes must reach an active session without requiring a browser refresh, logout, new tab, or local-storage reset.
- Realtime messages are invalidation signals, not trusted authorization data.
- Revocation must fail securely. A stale interface must not allow a stale mutation to succeed.
- Tenant, subscription, mandatory-feature, ownership, and actor-integrity restrictions must not be weakened to simplify client behavior or testing.

## Database-first Authorization

Kanisa Connect uses database-first authorization because a browser cannot be trusted to enforce access. A user can alter client code, invoke HTTP requests manually, replay stale requests, or call Supabase endpoints without using the visible interface.

The database therefore makes the authoritative decision using authenticated identity, church context, feature availability, permission grants, record ownership, and operation-specific rules. The client may hide navigation, deny a route, or disable a button, but those behaviors exist only to provide prompt and understandable feedback.

The practical consequence is intentional defense in depth:

1. The client computes the expected experience from authoritative queries and RPCs.
2. Route and page guards prevent ordinary navigation into unavailable functionality.
3. Mutation controls reflect the current effective permission.
4. RLS, triggers, and authorized RPCs independently enforce the same boundary at the server.

If client and server state temporarily disagree, the server decision prevails.

## Additive Multi-Role Model

A user may hold more than one role in the same church. Effective permissions are the union of the grants from all active role assignments in that church.

For example, a user with Pastor and Treasurer roles receives the permitted Pastor capabilities plus the permitted Treasurer capabilities. Removing Treasurer must remove only Treasurer-derived access; it must not remove capabilities still granted by Pastor.

The model is additive subject to non-negotiable constraints:

- The user must belong to the relevant tenant context.
- The platform feature must be globally available.
- The feature must be available to the church and its subscription.
- The requested action must be granted by at least one applicable role or supported member permission.
- Ownership, actor identity, lifecycle, mandatory-feature, and other database restrictions still apply.

A role union must never bypass tenant isolation, subscription enforcement, disabled features, mandatory recovery controls, or record-level restrictions. An explicit deny or override may be introduced only through a documented security decision with corresponding database and regression coverage.

## Feature Flags vs Permissions

Feature flags and permissions answer different questions:

- **Feature availability:** Is this capability available on the platform and enabled for this church and subscription?
- **Permission:** May this user perform this action within the available capability?

Access requires both answers to be affirmative. A role permission cannot enable a globally disabled feature, bypass a church-level disablement, or override subscription availability. Conversely, enabling a feature does not grant every user access to it.

This separation allows platform operators to control rollout and subscription availability while church administrators configure role capabilities within the permitted product boundary.

Mandatory features are a special case. Database protections preserve required administrative recovery paths and prevent a church from weakening or removing them.

## Bounded Role-Permission Delegation

Church administrators may configure permissions only within a reviewed maximum for the target role. The canonical PostgreSQL rule classifies every known role/feature/action combination as `CONFIGURABLE`, `RESTRICTED`, or `SYSTEM_PROTECTED` and records the applicable server-enforced scope. The permission matrix consumes an actor-aware RPC projection of that rule; the atomic save RPC evaluates the same rule again.

This constraint layer exists because additive authorization describes how valid grants combine, not which grants an administrator is allowed to create. It prevents meaningless actions, unsafe role escalation, cross-domain authority, destructive posted-finance permissions, and assignment of the mandatory recovery capability to ordinary roles. Unknown custom roles default to configurable viewing only; broader mutation authority requires an explicit workflow, server enforcement, and architecture review.

Locked controls are explanatory UI, not security. Authenticated clients have no direct mutation grant on the role-permission table, crafted RPC payloads are validated atomically, and internal rule helpers revoke `PUBLIC` execution. Existing grants are not silently removed by the hardening migration; a read-only preflight identifies them for separate review. “Own records” is shown only where RLS or server logic actually enforces ownership because the current permission-row schema has no general ownership-scope field.

The concise implementation reference and role boundaries are maintained in [Authorization Architecture](architecture/AUTHORIZATION_ARCHITECTURE.md).

## Realtime Authorization Architecture

Authorization synchronization uses private Supabase Broadcast topics. Database triggers emit minimal messages containing the source and operation, such as `{ source, operation }`. They do not broadcast role rows, permission values, tenant data, or other authorization decisions.

The client treats each Broadcast as a signal that authoritative state may have changed. It invalidates the affected cache families and refetches from the database. User-context changes also cause an authoritative refresh of the current user context.

This design avoids applying potentially stale or incorrectly scoped row payloads in the browser. It also supports INSERT, UPDATE, and DELETE events without relying on DELETE payload visibility from Postgres Changes.

Realtime is an availability and synchronization mechanism, not a substitute for server enforcement. If Broadcast is delayed or unavailable, RLS and triggers continue to deny unauthorized operations.

## Why Three Authorization Scopes Exist

Kanisa Connect has exactly three authorization scopes because authorization changes originate at three different identity boundaries. Each scope has one private logical topic and a source allow-list.

### User Scope

Topic pattern: `authorization:user:<user_id>`

The user scope covers changes that identify one affected user directly:

- `user_roles`
- `members`
- `profiles`

These changes can alter assigned roles, active membership, selected church context, workspace selection, profile context, route access, and effective permissions. Only the matching authenticated user may subscribe to that user's topic.

### Church Scope

Topic pattern: `authorization:church:<church_id>`

The church scope covers tenant configuration that can affect multiple current users of one church:

- `church_role_permissions`
- `church_features`
- `subscriptions`

The changed row identifies a church, not every affected user. Subscription is restricted to authenticated users who currently hold a role or active membership in that church. A user from another church must not be able to subscribe to the topic.

### Platform Scope

Topic: `authorization:platform`

The platform scope covers `platform_features`. Platform availability changes may affect authenticated users across many churches and do not carry a natural user or church identifier.

The topic remains safe because the Broadcast payload is only an invalidation signal. Authoritative queries still apply tenant, subscription, feature, and permission constraints before returning a decision.

## Accepted Realtime Invariant

The accepted invariant is:

> Exactly one non-duplicated authorization channel per authorization scope.

For an authenticated user with an active church, the expected steady state is one user channel, one church channel, and one platform channel. Three scoped channels are correct. More than one active channel for the same scope is a duplicate-subscription defect.

Authorization subscriptions are centralized in the authentication provider. Pages and workspaces must not create overlapping authorization channels.

## Why One Global Channel Was Rejected

A single global authorization channel was intentionally rejected because it would provide poorer routing clarity, unnecessary event fan-out, and broader cache invalidation without a measurable performance benefit.

In particular:

- A global topic would deliver unrelated church changes to users who cannot be affected by them.
- Every tenant event would require more clients to wake, validate the event, invalidate caches, and refetch.
- The authorization boundary would be less explicit than separate user, church, and platform policies.
- A per-user replacement would require database triggers to fan out church and platform changes to every affected user, increasing write amplification and membership-race complexity.
- A per-session replacement would require a server-maintained routing registry and additional lifecycle cleanup.
- Supabase logical channels are multiplexed through the Realtime client, so reducing three well-bounded topics to one does not provide a meaningful application-level performance gain.

The three-scope model is easier to audit, maintains least-privilege routing, and maps directly to the identity available to each database trigger.

## Cache Invalidation Strategy

Realtime handlers invalidate targeted React Query cache families rather than reloading the application or clearing all cached data.

The principal mappings are:

| Source | Invalidated cache families | Additional behavior |
|---|---|---|
| `user_roles`, `members`, `profiles` | `church-permission`, `church-feature-permission-matrix`, `church-role-permissions`, `portal-church-features`, `feature-subscription-plan` | Authoritatively refetch the current user context because roles, membership, church, or workspace may have changed. |
| `church_role_permissions` | `church-permission`, `church-feature-permission-matrix`, `church-role-permissions` | Recompute feature and action permissions for the active church. |
| `church_features` | `church-permission`, `church-feature-permission-matrix`, `portal-church-features` | Recompute feature availability, navigation, routes, and actions. |
| `subscriptions` | `church-permission`, `church-feature-permission-matrix`, `feature-subscription-plan` | Recompute subscription-gated access. |
| `platform_features` | `church-permission`, `church-feature-permission-matrix`, `portal-platform-features` | Recompute platform-wide feature availability. |

Handlers do not copy Broadcast payload values into the cache. They refetch authoritative RPC or table results. Events with an unexpected source are ignored.

If Realtime authentication or an authoritative authorization refresh fails, privileged authorization caches and context are removed so the client fails closed instead of continuing to rely on offline privileged state.

## Browser Behaviour Requirements

An active authenticated session must react to authorization changes without requiring:

- a manual page refresh;
- logout and login;
- a new browser tab;
- local-storage or browser-cache clearing; or
- aggressive polling.

Expected behavior includes:

- Newly granted navigation and routes become available promptly.
- Removed navigation disappears promptly.
- Route guards and page-level permission checks re-evaluate.
- A protected page that loses access redirects or presents an access-denied state.
- Mutation controls appear, disappear, or become disabled as permissions change.
- Removing one role preserves access granted by remaining roles.
- Revoking the final privileged role removes privileged access.
- Disabling or re-enabling an optional feature updates navigation and page access.
- A stale or manually invoked protected mutation is still denied by the server after revocation.
- Cross-church data never appears during a user or church-context transition.

`window.location.reload()` is not an authorization synchronization strategy.

## Server Enforcement (RLS, Triggers, RPC)

All protected mutations are enforced through PostgreSQL controls:

- **RLS policies** enforce authenticated identity, tenant predicates, feature/action permissions, and record-level constraints.
- **Triggers** enforce invariants that must apply regardless of mutation entry point, including mandatory-feature protection, actor integrity, lifecycle actions, and final-administrator safeguards.
- **Authorized RPCs** provide reviewed, operation-specific entry points for privileged workflows such as role assignment and permission administration.

Security-definer functions explicitly set `search_path` to prevent callers from influencing object resolution through a writable or unexpected schema. Function bodies should schema-qualify security-sensitive objects where practical.

PostgreSQL grants `EXECUTE` on functions to `PUBLIC` by default. Kanisa Connect revokes `PUBLIC` execution where a function is internal, trigger-only, service-only, or otherwise not a public authenticated API. Execution is then granted only to the roles that require the entry point. This prevents internal security-definer helpers from becoming unintended RPC surfaces.

RLS, triggers, and authorized RPCs are complementary. A security-definer function must not become a general bypass around tenant, feature, subscription, ownership, or actor checks.

## Cleanup Rules

Authorization channel cleanup is mandatory:

- **Logout:** mark existing handlers inactive, remove all authorization channels, and clear authenticated authorization context.
- **User switch:** remove the previous user's channels before allowing the new user's scoped handlers to become effective.
- **Church switch:** remove the previous church-scoped channel set and subscribe using the new authoritative church identity.
- **Provider teardown or remount:** remove every channel held by the centralized channel collection.

The asynchronous Realtime authentication continuation checks whether the effect is still active before creating channels. This prevents a late promise resolution from subscribing for an obsolete user or church.

Handlers must not apply an event for the wrong user or church. Channel policies, topic naming, source allow-lists, effect cleanup, and authoritative refetching all contribute to this guarantee.

Test and UAT fixture cleanup must restore original roles, memberships, permissions, and feature settings exactly. Temporary rows, storage objects, and database objects must be removed and verified absent.

## Security Decisions

- Tenant isolation is a core architectural principle, not a feature option.
- The authenticated user's database identity determines access; caller-supplied user identifiers are not trusted as authority.
- Private Broadcast topic policies restrict user and church subscriptions at the database boundary.
- Broadcast payloads contain no authorization row data and are never applied directly.
- Feature availability, subscription state, permission grants, ownership, and actor identity remain separate checks.
- Mandatory administrative recovery features cannot be weakened or removed by ordinary configuration.
- The final Church Admin invariant must remain protected.
- Additive role aggregation must not broaden tenant scope.
- Offline or stale client state must fail closed when an authoritative refresh cannot complete.
- Server controls must deny stale requests even if a user manually invokes a hidden control or replays an old request.
- Security-definer functions must use a controlled `search_path` and the narrowest practical execution grants.

## Product Decisions

### Role Expiry (currently unsupported)

Active `user_roles` assignments currently have no expiry or status field. Invitation expiry and subscription expiry do not expire a role assignment and must not be treated as equivalent behavior.

Supporting time-bounded roles requires an explicit product and schema design covering effective-time semantics, database queries, indexes, scheduled or event-driven expiry, Realtime signaling, audit history, user experience, and compatibility with the final Church Admin invariant. Until that design is approved, role-expiry scenarios are unsupported rather than silently approximated.

### Membership Transfer/Revoke (future design decision)

Membership and `user_roles` are independent tenant assignments. Changing a membership alone does not necessarily remove a role assignment, so a membership-only update cannot prove that old-church authorization has ended.

A future transfer or revoke design must define an atomic, auditable workflow that reconciles membership, roles, active church context, final-administrator protection, Realtime signals, cache invalidation, and failure recovery. Cross-tenant access must remain denied throughout the transition.

## Verification History

The authorization architecture has completed the following staging verification:

- SQL integration suites passed with non-zero assertions and explicit rollback behavior.
- Mandatory-feature and authorization trigger enforcement passed.
- Mutation authorization tests passed.
- Focused authorization and Realtime tests passed.
- Full Vitest regression passed.
- Production build passed.
- Private Broadcast migration and topic-policy verification passed.
- Two-session browser Realtime UAT passed for all representable grant and revoke scenarios.
- Revocation while the user was already viewing a protected page passed without refresh.
- Duplicate-subscription verification passed: exactly three unique scope joins, zero duplicate joins, and zero unexpected leaves.
- RLS and trigger enforcement were verified after client-side revocation.
- Unauthorized mutations were rejected with HTTP 403 and SQLSTATE `42501`.
- No unauthorized database mutation succeeded or created a row.
- Fixture restoration and artifact cleanup passed.
- Canonical personas remained 12/12 valid.
- Church Admin anchors remained primary 3, expired 1, and other 1.

These results close the SQL integration and Realtime-without-refresh authorization gates. They do not constitute production rollout approval or close unrelated production preflight, audit, database-linter, security-review, product-decision, or release-approval work.

## Architecture Invariants

Future contributors must not violate the following rules:

1. PostgreSQL remains the source of truth for authorization.
2. Client-side visibility or route guards must never be treated as sufficient enforcement.
3. Every protected mutation must remain enforced by RLS, triggers, an authorized RPC, or an appropriate combination.
4. Every tenant-scoped authorization decision must include an explicit church boundary.
5. Effective permissions remain additive across multiple roles unless an explicit deny model is separately designed, documented, and enforced at the database layer.
6. Feature availability and permission grants remain independent; both are required.
7. Disabled platform, church, subscription-gated, or mandatory-feature restrictions cannot be bypassed by a role grant.
8. Realtime uses private Broadcast invalidation signals and never trusts Broadcast row data as authorization state.
9. There is exactly one non-duplicated authorization channel per scope: user, active church, and platform.
10. Pages and workspaces must not create overlapping authorization subscriptions.
11. Realtime handlers invalidate targeted caches and refetch authoritative state; they do not reload the browser.
12. Logout, user changes, church changes, and provider teardown remove obsolete channels and handlers.
13. A synchronization failure must remove stale privileged client decisions and fail closed.
14. RLS and triggers must continue to reject stale or manually invoked unauthorized requests.
15. Security-definer functions must set a controlled `search_path` and expose only deliberately granted execution entry points.
16. `PUBLIC` execution must be revoked for internal, trigger-only, service-only, and non-public security helpers.
17. The final Church Admin and mandatory recovery invariants must remain protected.
18. Role expiry and membership transfer/revoke must not be inferred from unrelated fields or implemented as partial client-only behavior.
19. Authorization tests must preserve transaction rollback and restore all modified fixtures.
20. A change to any invariant requires an explicit architecture and security review with database, client, Realtime, and regression-test evidence.

## Future Architectural Rules

When extending authorization:

- Start with the database rule and identify the tenant, actor, feature, action, ownership, and lifecycle predicates.
- Add or update an authorized RPC when a privileged workflow needs a stable operation boundary.
- Use triggers for invariants that must apply across all mutation paths.
- Update the effective-permission and feature-availability model without introducing client-only role-name shortcuts.
- Map every new authorization source to exactly one existing scope or document why a new scope is unavoidable.
- Add the source to an explicit Broadcast allow-list and define its targeted cache invalidations.
- Do not add page-level authorization channels.
- Verify INSERT, UPDATE, and DELETE behavior, including deletion of role, membership, permission, and feature rows.
- Test both grant and revoke while the affected session remains open.
- Test revocation on an already open protected page and attempt a stale server mutation afterward.
- Verify cross-tenant subscription and data access remain denied.
- Verify channel teardown and absence of duplicate subscriptions after navigation and remounting.
- Preserve controlled `search_path`, narrow execution grants, tenant predicates, and fail-closed behavior.
- Record the architectural reason, verification evidence, cleanup result, and remaining product decisions in long-term documentation.

# Authorization Architecture

## Table of Contents

- [Purpose](#purpose)
- [Scope](#scope)
- [Database-First Authorization](#database-first-authorization)
- [Enforcement Layers](#enforcement-layers)
- [Additive Multi-Role Model](#additive-multi-role-model)
- [Feature Flags and Permissions](#feature-flags-and-permissions)
- [Permission Constraint Model](#permission-constraint-model)
- [Realtime Permission Propagation](#realtime-permission-propagation)
- [Browser and Cleanup Rules](#browser-and-cleanup-rules)
- [Design Decisions](#design-decisions)
- [Architecture Invariants](#architecture-invariants)
- [Verification History](#verification-history)
- [Future Considerations](#future-considerations)
- [Related Documents](#related-documents)

## Purpose

Define Kanisa Connect's authorization trust model and the reasons behind role, feature, Realtime, cache, and enforcement decisions.

## Scope

This is a concise architecture view. The canonical detailed decision record is [`AUTHORIZATION_ARCHITECTURE_DECISIONS.md`](../AUTHORIZATION_ARCHITECTURE_DECISIONS.md).

## Database-First Authorization

PostgreSQL is the source of truth. Client-side route guards, navigation filtering, and disabled controls exist for user experience only. A caller can bypass browser code, so every protected mutation is independently enforced on the server.

Tenant isolation is fundamental: an effective permission never broadens the church boundary.

## Enforcement Layers

- **RLS** restricts reads and writes by authenticated user, church, feature/action permission, and ownership.
- **Triggers** protect cross-entry-point invariants such as mandatory features, actor identity, lifecycle actions, and the final Church Admin.
- **Authorized RPCs** provide transactional, reviewed entry points for role, permission, finance, invitation, and workflow operations.
- **Storage policies** enforce bucket and path ownership.

`SECURITY DEFINER` functions set a controlled `search_path`. Internal and trigger-only functions revoke default `PUBLIC` execute access and grant only deliberate entry points.

## Additive Multi-Role Model

Effective permissions are the union of grants from all applicable roles in the active church. Removing one role removes only grants no longer supplied by another role.

The union remains subordinate to tenant membership, platform and church feature availability, subscription state, ownership, actor integrity, and mandatory security restrictions. There is no implicit deny model.

## Feature Flags and Permissions

Feature availability and user permission are independent. Access requires:

1. global platform availability;
2. church and subscription availability; and
3. an effective grant for the requested action.

A role grant cannot reactivate a disabled feature. Enabling a feature does not grant users actions automatically.

## Permission Constraint Model

Role-permission administration uses three server-owned cell classifications:

| Classification | Meaning |
|---|---|
| `CONFIGURABLE` | An authorised actor may grant or revoke the applicable church-scoped permission. |
| `RESTRICTED` | The permission exists but is outside church-level administration. The UI displays a lock; the save RPC permits changes only to an explicitly authorised Platform Administrator. |
| `SYSTEM_PROTECTED` | The feature/action is meaningless, unsupported, or exceeds the target role's safe maximum authority. New assignments and changes are rejected by PostgreSQL. |

The canonical rule is `church_permission_constraint_rule(role, feature, action)`. The actor-aware `get_church_permission_constraints` RPC supplies classifications, reasons, and enforced record scopes to the matrix. `save_church_role_permissions` reuses the same rule and validates the actor and target church atomically. A modified payload, stale client, direct RPC call, or alternate client therefore cannot bypass a locked cell. Authenticated clients retain no direct `INSERT`, `UPDATE`, or `DELETE` grant on `church_role_permissions`.

Rules are conservative and follow implemented workflows:

- **Member:** viewing and only proven self-service create/edit/delete paths may be configurable. Approve, publish, manage, broad administration, reporting administration, and unrelated staff authority are protected.
- **Pastor:** church viewing plus implemented pastoral, content, and approval workflows may be configurable; role administration and unrelated finance/system mutations are protected.
- **Secretary:** church viewing plus implemented operational workflows may be configurable; role administration and unrelated financial/system mutations are protected.
- **Treasurer:** church viewing plus implemented contribution, pledge, report, and finance-intelligence workflows may be configurable; unrelated pastoral, role, and system mutations are protected.
- **Church Admin:** applicable church-level actions may be configurable, but meaningless actions, destructive posted-finance actions, cross-tenant/platform capability, and the mandatory recovery permission remain protected or restricted.
- **Platform Super Admin:** existing platform authority is preserved, while tenant isolation and mandatory recovery enforcement still apply.
- **Data-discovered custom roles:** viewing is the maximum configurable authority until a server-enforced workflow and explicit rule are designed. The system does not infer ministry ownership from a role name.

Feature/action applicability is part of the same rule. For example, reports do not acquire a fictional `create` action, notifications do not acquire approval/deletion merely because those matrix columns exist, and posted financial deletion remains unavailable where the product uses correction or reversal rather than destructive deletion.

An “own records” label appears only for workflows already constrained by RLS or server logic. The schema has no general permission-scope column, so a church-wide action is never presented as “own” based on frontend intent alone. Future provisioning intersects recommended defaults with the constraint rule. Existing assignments are not silently rewritten; the read-only [`preflight-role-permission-constraints.sql`](../../scripts/sql/preflight-role-permission-constraints.sql) reports affected churches, roles, feature/actions, and assigned-user counts before remediation.

## Realtime Permission Propagation

Authorization uses private Broadcast invalidation signals across exactly three scopes:

| Scope | Topic | Sources |
|---|---|---|
| User | `authorization:user:<user_id>` | roles, membership, profile |
| Church | `authorization:church:<church_id>` | role permissions, church features, subscription |
| Platform | `authorization:platform` | platform features |

The approved invariant is:

> Exactly one non-duplicated authorization channel per authorization scope.

A single global channel was rejected because it reduces routing clarity, increases fan-out and cache invalidation, weakens least-privilege topic boundaries, and offers no measured performance benefit. See [Realtime Architecture](REALTIME_ARCHITECTURE.md).

Broadcast messages contain only source and operation. The client invalidates targeted caches and refetches authoritative state; it never applies payload data as a permission decision.

## Browser and Cleanup Rules

Grants and revocations update an open session without refresh, logout, a new tab, or storage clearing. Navigation, guards, page access, and mutation controls re-evaluate.

The centralized provider removes channels on logout, user change, church change, and provider teardown. An active flag prevents late asynchronous subscription for an obsolete identity. Refresh failure removes stale privileged context and fails closed.

## Design Decisions

- Database-first, defense-in-depth authorization.
- Additive multi-role aggregation.
- Independent feature availability and action permissions.
- Minimal private Broadcast messages with authoritative refetch.
- One centralized channel factory; no page-level authorization channels.
- One canonical database constraint rule for permission-matrix display, safe defaults, and atomic writes.

## Architecture Invariants

- Browser visibility never replaces RLS or trigger enforcement.
- Every tenant decision includes the active church.
- Additive roles cannot bypass feature, subscription, ownership, or mandatory controls.
- Exactly one channel exists per user, church, and platform scope.
- Revoked stale mutations remain denied by PostgreSQL.
- Internal security functions use controlled search paths and narrow grants.
- Locked permission cells are a user-experience projection of server rules, never the enforcement boundary.
- Unknown features, unsupported actions, and unclassified custom-role mutations fail secure.

## Verification History

Staging verification completed SQL integration, trigger enforcement, mutation authorization, private Broadcast policy checks, focused and full tests, build, and two-session browser UAT. Grant and revoke paths passed without refresh. Unauthorized stale mutations returned HTTP 403 / SQLSTATE `42501`; no unauthorized row was created. Duplicate verification recorded three unique scope joins and zero duplicates.

## Future Considerations

**Future Enhancement:** time-bounded roles require a designed expiry/status model. Safe membership transfer or revoke requires an atomic workflow reconciling membership and independent role assignments. Neither behavior is currently inferred from unrelated fields.

## Related Documents

- [Security Architecture](SECURITY_ARCHITECTURE.md)
- [Database Architecture](DATABASE_ARCHITECTURE.md)
- [Realtime Architecture](REALTIME_ARCHITECTURE.md)
- [Multi-Tenant Architecture](MULTI_TENANT_ARCHITECTURE.md)

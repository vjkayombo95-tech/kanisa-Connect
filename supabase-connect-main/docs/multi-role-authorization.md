# Multi-role church authorization

## Decision

Kanisa Connect assigns zero or more church-scoped roles to one authenticated user. A role is a named collection of feature/action grants; it is not a separate identity. A pastor who also handles finance therefore signs in once and receives both sets of permissions.

## Existing architecture review

- `user_roles` already had a surrogate primary key and could store several physical rows for one user and church, but it lacked tuple uniqueness.
- `assign_church_member_role` defeated that capability by updating the first existing row.
- `has_church_feature_permission` selected one arbitrary role with `LIMIT 1`.
- `church_role_permissions` already modeled role-to-feature/action grants and its fixed role constraint had already been removed.
- RLS and mutation triggers call the permission helper after applying church row ownership/isolation rules. Platform availability, subscription eligibility, and the church feature toggle are evaluated before role grants.
- Navigation and direct-route protection already called the server helper, but the feature-access hook and top-level workspace guards used one role.
- The staff screen showed one assignment per table row and offered a single-role assignment dialog.

## Effective permission calculation

For user `U`, church `C`, feature `F`, and action `A`:

1. Authenticate the actor and prevent callers from inspecting another user's access (except authenticated platform administrators).
2. Require `F` to exist, be globally available, be included in the church's active/trial subscription, and be enabled for `C`.
3. Find every role assigned to `U` in `C` (plus the virtual `member` role for an active linked member).
4. Return true when any assigned role has the applicable `church_role_permissions` action grant.
5. Keep record-level RLS predicates and lifecycle mutation triggers authoritative.

In set notation: `EffectivePermissions(U,C) = UNION(RolePermissions(R,C))` for every assigned role `R`, intersected with platform, subscription, church-feature, and row-level constraints.

No deny grant is introduced: absent rows and false grants deny by default. Removing one assignment removes only that role's contribution to the union. Removing every assignment leaves no staff access; an active member retains only explicitly configured member/self-service access.

## Database and compatibility

Migration `20260722100000_multi_role_effective_permissions.sql`:

- normalizes legacy role keys;
- archives exact duplicate rows before deduplicating them;
- adds `UNIQUE (user_id, church_id, role)` and a lookup index;
- changes role assignment from update-or-insert to insert-only with explicit duplicate rejection;
- aggregates all role grants in `has_church_feature_permission`;
- returns a new `roles` array from `get_current_user_context` while retaining the legacy scalar `role`;
- publishes `user_roles` changes so active sessions refresh permission caches.

The scalar `role` remains a deterministic compatibility/workspace hint. It is not used by the authorization engine. Existing clients continue to work; updated clients use `roles` for workspace routing and the permission RPC for access decisions.

Role keys are data. Permission evaluation and staff role options are derived from `church_role_permissions`, so roles such as Catechist, Sacristan, Choir Leader, Youth Leader, Finance Officer, Communications Officer, IT Officer, and Parish Accountant need no authorization-code branch. Their permission rows define their behavior.

## Frontend and administration

- `AuthContext` exposes both `userRole` (compatibility) and `userRoles`.
- top-level route guards accept a match against any assigned role;
- `useFeatureAccess` unions `can_view` grants across all assigned roles;
- navigation and page gates continue using `has_church_feature_permission`;
- realtime role changes refresh startup context and permission queries;
- Church Administration groups assignments by user, supports name search and role checkboxes, prevents duplicates server-side, removes roles individually, and displays inherited effective feature access.

## Scaling model

A small parish can use only Church Admin and Pastor. A larger parish can split duties across many offices without creating extra logins. A diocese can use the same model church by church because assignments, permission rows, feature settings, subscriptions, and RLS all remain scoped by `church_id`. Adding organizational roles increases data rows, not authorization branches.

## Rollout

The authoritative production gates are tracked in `docs/multi-role-production-release-checklist.md`. The implementation is approved for staging/UAT only until that checklist is completed and signed off.

1. Apply the migration in a disposable/staging Supabase environment and run SQL plus Vitest regression suites.
2. Review archived duplicates and verify every church retains a Church Admin.
3. Deploy the frontend after the migration so the `roles` context field and insert-only RPC are available.
4. Smoke-test one single-role account, one multi-role account, role removal, a disabled feature, an out-of-plan feature, and cross-church access.
5. Monitor authorization errors and role-change audit logs before production-wide rollout.

## Breaking changes

There are no intended API breaks. Duplicate assignment attempts now fail with SQLSTATE `23505` instead of silently replacing or reusing a role. Code that assumed one row per user/church must stop using `.single()` and consume all assignments or the compatibility `role` field.

# Workspace Unification

## Architecture Before

Authenticated workspaces were split across several role-specific shells:

- `ChurchAdminLayout`
- `PortalLayout`
- `SuperAdminLayout`
- partial `WorkspaceRouteLayout` usage for pastoral and finance pages

Those shells each owned their own sidebar, header area, and route frame. Moving between dashboard and child pages could remount the shell or swap the sidebar even when the user remained in the same workspace.

## Architecture After

Every migrated authenticated workspace route now flows through one shared shell:

```text
WorkspaceRouteLayout
  -> WorkspaceProvider
  -> WorkspaceLayout
  -> WorkspaceNavigation
  -> Outlet page component
```

Dashboard pages that still use `WorkspaceResolver` are guarded by `WorkspaceRenderer`: when a workspace context already exists, the dashboard renders only its page content and does not create another `WorkspaceLayout`.

## Active Workspace Ownership

- Member: `/portal/*`
- Pastoral: `/pastoral/*`
- Church Admin: `/church-admin/*`
- Finance: `/finance/*`
- Super Admin: `/super-admin/*`

Each workspace gets its navigation, quick actions, dashboard configuration, assistant context, and page shell from `src/components/workspace/registry.ts`.

## Removed From Active Routing

The following legacy layouts are no longer used by the primary workspace route trees:

- `src/components/church-admin/ChurchAdminLayout.tsx`
- `src/components/portal/PortalLayout.tsx`
- `src/components/super-admin/SuperAdminLayout.tsx`

Their page components were not duplicated. The route layer now reuses the same pages inside `WorkspaceLayout`.

## Shared Layout Flow

`WorkspaceLayout` owns:

- desktop and mobile workspace navigation
- shared top bar
- shared page header
- breadcrumbs
- workspace badge
- dev-only workspace mount diagnostics
- main content region

The diagnostics display in development only:

- current workspace
- current layout
- current sidebar
- mounted workspace ID

## Migration Notes

- `AdminRoutes`, `MemberRoutes`, `PastoralRoutes`, `FinanceRoutes`, and `SuperAdminRoutes` now place dashboard and child routes under `WorkspaceRouteLayout`.
- `WorkspaceRouteLayout` provides route-aware context to the page tree.
- `WorkspaceRenderer` avoids nested shells when dashboard components render inside an existing workspace context.
- Registry links were tightened so member and super-admin navigation stays inside valid workspace-owned routes.

## Future Extension Guidance

- Add new authenticated pages under the owning workspace route tree.
- Register navigation and quick actions in `workspaceRegistry`.
- Reuse existing page components and hooks; do not create a role-specific layout.
- If a page needs workspace state, read it from `useWorkspaceContext`.
- Keep assistant and command center integrations mounted at the workspace shell level.

## Remaining Legacy Debt

`CommunityLeaderLayout` and its sidebar still exist for the community-leader staff route. It is outside the five unified workspace ownership groups in this migration and should either receive a workspace registry entry or be retired in a dedicated follow-up.

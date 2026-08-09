# Kanisa Connect v1.0.1 Navigation Experience

## Philosophy

Workspace navigation is owned by the Workspace Framework. Each authenticated workspace keeps one shell, one sidebar component, one mobile navigation surface, and one shared registry. Pages may be reused across workspaces, but the route and surrounding navigation stay workspace-local.

The navigation should answer three questions quickly:

- Where am I?
- What category does this page belong to?
- What related pages can I reach without changing workspace?

## Registry Architecture

Navigation is registered in `src/components/workspace/registry.ts`.

Each workspace provides grouped navigation items with:

- `id`
- `label`
- `to`
- `icon`
- optional `keywords`
- optional `permission`
- optional `featureFlag`

The same registry feeds:

- desktop sidebar
- mobile navigation
- page header active state
- workspace quick actions
- Command Center page suggestions

This avoids duplicated navigation maps and keeps future route additions discoverable.

## Grouping Strategy

Navigation is grouped around parish work patterns:

- Home
- People
- Pastoral Care
- Liturgy
- Community
- Operations
- Finance
- Catholic Content
- Tenants
- Administration

Desktop groups are collapsible and remember their expanded state in local storage. This keeps enterprise workspaces compact while preserving access to less frequent operational pages such as audit logs, imports, billing, jobs, and system health.

## Mobile Strategy

Mobile does not render the full desktop sidebar as one long list. The workspace drawer first shows categories. Selecting a category drills into its items, with a natural Back control to return to categories.

The mobile surface uses the same workspace registry as desktop navigation, so mobile and desktop cannot drift apart.

## Account Menu

Every authenticated workspace renders the same account section from the Workspace Framework sidebar. It is pinned below the navigation groups and remains visible even when navigation categories are collapsed.

The account menu includes:

- Profile
- Account Settings
- Help placeholder
- Sign Out

Desktop exposes the menu from the sidebar footer. Mobile exposes the same menu from the workspace drawer footer. Sign Out reuses the existing authentication logout flow and returns the user to the sign-in experience.

## Role-Aware Navigation

Workspace selection still comes from the existing role and Workspace Framework ownership rules:

- Member: parish life, Bible, readings, prayer, giving, events.
- Pastoral: ministry, prayer requests, Mass intentions, liturgy, calendar.
- Church Admin: people, operations, finance, Catholic content, administration.
- Finance: giving, receipts, pledges, finance reports, read-only parish context.
- Super Admin: tenants, platform operations, Catholic content, jobs, health, logs.

Items should be hidden only when the existing permission or feature flag system says they are unavailable. Do not create separate sidebars per role.

## Preview Mode

Church administrators can open **Preview Member Experience** from the Church Admin Administration group. This route starts a local preview mode and navigates to the existing Member Portal.

Preview mode does not impersonate another user, does not change authentication, and does not grant new permissions. It only allows an administrator to view the member workspace shell and pages through the existing portal route.

While preview mode is active, the Member Portal displays a persistent banner:

`You are previewing the Member Portal as a Church Administrator.`

The banner provides:

- Exit Preview
- Return to Church Admin

Both actions clear preview mode and return the administrator to the Church Admin workspace.

## Administrative Navigation

Administrative entries should remain registered in the workspace registry rather than added as ad hoc sidebar links. Church Admin administration includes audit logs, imports, billing, settings, and Preview Member Experience. Invitations remain available through Invitations & Roles. Super Admin owns platform user activity and platform audit surfaces.

## Restored Pages

Legitimate routed pages restored to navigation include:

- Church Admin: invitations and roles, families, community help, event requests, sermons, finance dashboard, QR payments, notifications, channels, imports, audit logs, billing, Preview Member Experience.
- Finance: audit logs and settings.
- Super Admin: billing verification, record preservation, logs, system logs, job history, Catholic content subpages.
- Member: pledges, Mass intentions, community help, communities, liturgical calendar.
- Pastoral: Mass schedule and finance summary.

## Command Center Integration

Command Center page suggestions are generated from the workspace navigation registry. Searching for terms such as `audit`, `member`, `finance`, `imports`, `jobs`, or `health` now surfaces the matching registered page with its category context.

AI intent routing remains provider-free and unchanged.

## Accessibility

Navigation improvements include:

- `aria-expanded` on collapsible groups.
- `aria-controls` links between group buttons and item panels.
- ArrowLeft and ArrowRight support for collapsing and expanding groups.
- Focus-visible rings on navigation controls and links.
- Mobile category buttons with clear item counts.
- Active pages continue to expose `aria-current="page"`.

## Future Extension Guidance

When adding a page:

1. Add or confirm the route in the workspace route file.
2. Register it in `workspaceRegistry` under the correct workspace group.
3. Add keywords if users might search for it by another name.
4. Reuse existing permissions and feature flags.
5. Do not add a new sidebar, layout, or command map.

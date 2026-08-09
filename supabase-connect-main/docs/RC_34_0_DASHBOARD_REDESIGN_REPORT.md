# RC-34.0 Dashboard Experience Redesign

Date: July 3, 2026
Branch: staging

## Summary

Dashboard composition was redesigned around action, attention, and daily workflow while reusing existing queries, widgets, assistant models, Event Intelligence, automation history, and workspace routing.

No database, Supabase, payments, Bible, workflow, importer, or AI provider changes were made.

## Files Modified

- `src/components/workspace/framework.tsx`
- `src/components/portal/dashboard/DashboardExperience.tsx`
- `src/components/portal/dashboard/index.ts`
- `src/components/portal/MemberDashboard.tsx`
- `src/pages/church-admin/ChurchDashboard.tsx`
- `src/pages/church-admin/PriestDashboard.tsx`
- `src/pages/church-admin/FinanceDashboard.tsx`
- `src/pages/super-admin/PlatformDashboard.tsx`

## New Dashboard Components

- `DashboardExperience`
  - Shared six-section dashboard shell for workspace dashboards.
- `DashboardPriorityCards`
  - Renders critical, high, and medium Event Intelligence items, maximum five.
- `DashboardActivityTimeline`
  - Keyboard-accessible chronological timeline component for assistant, automation, and dashboard-context activity.

## Dashboard Flow

Workspace dashboards now follow:

1. Assistant Greeting
2. Today's Priorities
3. Assistant Daily Briefing
4. Operational Snapshot
5. Today's Activity Timeline
6. Quick Actions

The shared renderer applies this to:

- Member
- Pastoral
- Church Admin
- Finance

The Super Admin dashboard was updated in place because it is a direct page, not a workspace-rendered dashboard.

## Reused Queries And Logic

- Existing `WorkspaceResolver` and workspace configs
- Existing dashboard widget maps
- Existing Personal Parish Assistant model
- Existing Event Intelligence events
- Existing Automation Engine history
- Existing quick action registries
- Existing dashboard React Query hooks and Supabase calls
- Existing finance, pastoral, member, admin, and platform dashboard data

No duplicate dashboard queries were introduced.

## UX Improvements

- Dashboards prioritize attention items before statistics.
- Statistics are grouped under Operational Snapshot instead of scattered through the page.
- Assistant briefing is presented as a daily workflow section.
- Timelines combine existing assistant events, automation history, and recent dashboard context.
- Quick actions are grouped at the bottom as next-step actions.
- Dashboard width now uses available desktop space with `max-w-7xl`.
- Mobile layout stacks naturally through CSS grid and section flow.

## Accessibility Notes

- Priority cards use links with descriptive `aria-label` text.
- Timeline is rendered as an ordered list with `time` elements.
- Sections use labelled headings.
- Quick actions use explicit accessible labels.
- The workspace skip link and navigation behavior remain unchanged.

## Remaining UX Debt

- Some lower-level widgets still have their original internal spacing and card heights.
- The Super Admin dashboard can later be migrated fully into `WorkspaceResolver`.
- Activity timeline can become richer as more dashboard pages expose recent records through context.
- Some cards still use role-specific copy that could be made more conversational.

## Verification

- Build passes with existing Browserslist and chunk-size warnings only.

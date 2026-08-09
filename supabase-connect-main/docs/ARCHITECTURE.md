# Architecture

Kanisa Connect is a React, Vite, Supabase application for parish operations, member engagement, Catholic content, giving, and workflow management.

## High-Level System Diagram

```text
Browser App
  |
  | Vite React app
  v
Workspace Framework
  |
  +-- Navigation
  +-- Workspace Context
  +-- Dashboard Renderer
        |
        +-- Dashboard Sections
              |
              +-- Widgets
  |
  +-- Domain Pages
        |
        +-- Workflow UI
        +-- Calendar Domain
        +-- Giving/Receipts
        +-- Bible/Catholic Content
  |
  v
Supabase Client
  |
  +-- Auth
  +-- Postgres with RLS
  +-- RPCs
  +-- Storage
  +-- Edge Functions
```

## Workspace Framework

The Workspace Framework sits above dashboards and provides:

- Workspace configuration.
- Role-specific navigation.
- Workspace layout.
- Workspace context.
- Quick actions.
- Dashboard rendering.

Supported workspace configurations:

- Member.
- Pastoral.
- Church Administration.
- Finance.
- Super Admin.

Adding a future workspace should require registering a workspace configuration and mapping an existing role to it.

## Dashboard Framework

The Dashboard Framework renders dashboards from configuration.

Hierarchy:

```text
Dashboard
  -> Sections
    -> Widgets
```

The framework supports:

- Section titles.
- Optional descriptions and icons.
- Widget ordering.
- Widget visibility.
- Layout classes.
- Role-specific dashboard configs.

Widgets should not know which section owns them.

## Workflow Framework

The Workflow Foundation provides reusable UI for parish processes:

- `WorkflowCard`
- `WorkflowTimeline`
- `WorkflowStatusBadge`
- `WorkflowActionBar`
- `WorkflowSummary`

Supported states include pending, submitted, under review, approved, rejected, scheduled, completed, and cancelled.

Workflows are configuration-driven. Actions are not hardcoded into the shared workflow UI.

## Calendar Domain

The Unified Parish Calendar is the scheduling hub for:

- Masses.
- Confessions.
- Prayer meetings.
- Youth meetings.
- Choir practice.
- Catechism.
- Baptisms.
- Weddings.
- Funerals.
- Pastoral visits.
- Community help visits.
- Council meetings.
- Retreats.
- Training.
- Public events.

Calendar views include month, week, day, agenda, and today. The calendar can render workflow-backed scheduled items without owning workflow logic.

## Business Domains

Core domains:

- Authentication and role resolution.
- Workspaces and dashboards.
- Member portal.
- Contributions and receipts.
- Quick Give.
- Pledges.
- Community Help.
- Prayer Requests.
- Mass Intentions.
- Events and attendance.
- Parish Calendar.
- Announcements.
- Bible.
- Daily Readings.
- Saints.
- Prayer and Reflection.
- Catholic Library.
- Finance reports.
- Super Admin CMS and platform operations.
- Notifications integration points.

## Data and Authorization

The browser uses the Supabase client with public anon/publishable credentials. Server-side enforcement lives in:

- Supabase Auth.
- RLS policies.
- SECURITY DEFINER RPC authorization checks.
- Storage policies.

Frontend route protection improves user experience but is not a security boundary.

## Performance Architecture

The app uses:

- Route-level lazy loading.
- Manual vendor chunking.
- React Query caching.
- Progressive dashboard loading.
- Skeleton loading states.
- Isolated heavy chunks for PDF, xlsx, scanner, charts, and analytics.

See `docs/PERFORMANCE_REPORT.md`.

## Operational Boundaries

Do not couple new business logic directly into shared layout/framework files. Prefer:

- Configuration for navigation/dashboard changes.
- Shared hooks for repeated queries.
- RPCs for atomic server-side financial writes.
- Reusable workflow components for process UI.

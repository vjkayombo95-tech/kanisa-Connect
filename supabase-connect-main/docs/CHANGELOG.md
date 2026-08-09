# Changelog

This changelog summarizes major milestones achieved through RC-24.

## RC-24 Production Readiness

- Centralized production configuration validation and startup diagnostics.
- Documented required and optional environment variables.
- Standardized logging and user-facing error handling patterns.
- Isolated heavy performance chunks for PDF, xlsx, scanner, charts, and analytics.
- Added production performance report.
- Improved accessibility foundations:
  - Visible focus states.
  - Workspace skip link.
  - `aria-current` navigation.
  - Decorative skeletons.
  - Accessible toast close control.
  - Dashboard section semantics.
- Added accessibility report.
- Added operations documentation set:
  - Deployment.
  - Backup and recovery.
  - Operations.
  - Security.
  - Architecture.
  - Product vision.

## RC-23 Platform Integration and UAT Readiness

- Created UAT checklist across member, pastoral, church admin, finance, and super admin workflows.
- Reviewed cross-domain integration paths:
  - Contributions to receipts and reports.
  - Mass intentions to workflow/calendar/dashboard.
  - Prayer requests to pastoral workflows.
  - Events to calendar, attendance, dashboards, and announcements.
- Confirmed pilot readiness criteria and outstanding risks.

## RC-22 Unified Parish Calendar

- Added calendar domain with month, week, day, agenda, and today views.
- Added role-aware filtering concepts.
- Prepared workflow-backed event rendering.
- Added dashboard schedule integration points.

## RC-21 Parish Workflow Foundation

- Added reusable workflow UI foundation.
- Added workflow cards, status badges, summaries, timelines, and action bars.
- Prepared future modules such as baptisms, weddings, funerals, certificates, volunteer requests, and calendar integrations.

## RC-20 Workspaces

- Built Church Administration Workspace.
- Built Finance Workspace.
- Added section-based dashboard configurations and presentation widgets.
- Reused Workspace, Dashboard, and Section frameworks.

## RC-19 Workspace Framework

- Introduced Workspace Framework above dashboards.
- Added workspace config, renderer, layout, navigation, context, and registry.
- Integrated workspace resolution into authenticated dashboard entry points.
- Prepared role-based workspace routing.

## RC-18 Dashboard Framework

- Introduced reusable Dashboard Framework.
- Added role-based dashboard configuration.
- Added section-based dashboard rendering.
- Built Priest Dashboard through the framework.
- Preserved member dashboard behavior while enabling future dashboards.

## RC-17 Production and Security Hardening

- Completed production readiness audit.
- Reviewed architecture, performance, security, UX, accessibility, offline/low-bandwidth readiness, and launch checklist.
- Hardened high-priority security items including contribution authorization and community help transaction handling.
- Documented security findings and remaining risks.

## RC-16 Performance and Low-Bandwidth Optimization

- Increased cache durations for mostly static Catholic content.
- Lazy-loaded portal pages.
- Improved progressive dashboard loading.
- Replaced loading spinners with skeletons where appropriate.
- Reviewed bundle size and duplicate query patterns.

## RC-15 Beta Readiness and Dashboard Refactoring

- Polished member experience and dashboard UI consistency.
- Improved loading, empty, error, and responsive states.
- Extracted member dashboard into reusable components.
- Added shared member lookup hook.

## RC-14 Giving Experience

- Added My Giving dashboard overview.
- Added contribution history page with filters and receipt action.
- Added Quick Give flow.
- Added Give Again behavior using contribution history.
- Preserved existing payment backend behavior.

## Earlier Milestones

- Established member portal foundations.
- Added parish administration workflows.
- Added contributions, pledges, receipts, and finance reporting.
- Added Catholic content domains including Bible, readings, saints, prayer, reflection, and library.
- Added staging/bootstrap and migration readiness documentation.

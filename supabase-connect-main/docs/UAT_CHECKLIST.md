# Kanisa Connect UAT Checklist

Use this checklist during parish pilot testing. Mark each item as Pass, Fail, or Risk, then add notes with device, browser, user role, and exact route where useful.

## Member Workspace

| Area | Test | Pass | Fail | Risk | Notes |
| --- | --- | --- | --- | --- | --- |
| Authentication | Member can sign in and land on the member workspace/dashboard. |  |  |  |  |
| Dashboard | My Giving, Today's Schedule, Upcoming Mass, faith content, announcements, and quick actions load independently. |  |  |  |  |
| Giving | Member can open Give Now, select purpose, amount, payment method, confirm, and reach receipt after success. |  |  |  |  |
| Contributions | Contribution History lists newest first, filters work, and receipt action is available. |  |  |  |  |
| Receipts | Receipt page shows amount, purpose, church, payment method, date, receipt number, print, Give Again, and dashboard return. |  |  |  |  |
| Calendar | `/portal/calendar` loads Month, Week, Day, Agenda, and Today views with event filters. |  |  |  |  |
| Bible | Bible home, book, and chapter pages load after first visit with usable navigation. |  |  |  |  |
| Daily Content | Daily Readings, Saints, Prayer, Reflection, and Liturgical Calendar show loading, empty/error, and responsive states. |  |  |  |  |
| Prayer Requests | Member can submit, view, pray/respond where allowed, and see privacy labels correctly. |  |  |  |  |
| Mass Intentions | Member can submit a Mass intention and see request status without payment logic regressions. |  |  |  |  |
| Community Help | Member can request help and donate through the secured transaction flow. |  |  |  |  |
| Events | Member can view events and RSVP where enabled. |  |  |  |  |

## Pastoral Workspace

| Area | Test | Pass | Fail | Risk | Notes |
| --- | --- | --- | --- | --- | --- |
| Workspace Resolution | Priest/pastor role lands in the pastoral workspace and sees pastoral navigation. |  |  |  |  |
| Dashboard | Greeting, Today's Schedule, liturgy, saint, prayer, Mass Intentions, Prayer Requests, Community Help, finance summary, events, and announcements render through the workspace/dashboard framework. |  |  |  |  |
| Mass Intentions Workflow | Pending, approved, rejected, scheduled, completed, and exported Mass intentions remain intact. |  |  |  |  |
| Calendar Integration | Pastoral calendar shows Masses and scheduled workflow-backed items when modules provide them. |  |  |  |  |
| Prayer Requests | Pastoral review actions update request state and invalidate portal/dashboard caches. |  |  |  |  |
| Community Help | Approved/pending queues appear and donation completion does not partially write records. |  |  |  |  |
| Notification Hooks | Dashboard/calendar data exposes enough schedule state for future reminders. |  |  |  |  |

## Church Admin Workspace

| Area | Test | Pass | Fail | Risk | Notes |
| --- | --- | --- | --- | --- | --- |
| Workspace Resolution | Church admin/secretary role lands in Church Admin Workspace. |  |  |  |  |
| Dashboard | Operations, Members, Finance, Communication, and Administration sections load progressively. |  |  |  |  |
| Navigation | Workspace navigation and legacy admin sidebar both expose Calendar, Events, Attendance, Members, Finance, Reports, Announcements, and Settings. |  |  |  |  |
| Calendar | `/church-admin/calendar` is role-gated and loads all operational schedule items allowed by RLS. |  |  |  |  |
| Events | Creating/editing/archiving events updates portal events, calendar, and dashboard schedule widgets. |  |  |  |  |
| Attendance | Mass schedule and RSVP counts remain visible on dashboards. |  |  |  |  |
| Announcements | Announcements can be posted and are visible in member/pastoral dashboard cards. |  |  |  |  |
| Members | Member approval, invitations, registration counts, and birthday summaries load. |  |  |  |  |

## Finance Workspace

| Area | Test | Pass | Fail | Risk | Notes |
| --- | --- | --- | --- | --- | --- |
| Workspace Resolution | Finance/treasurer role lands in Finance Workspace. |  |  |  |  |
| Dashboard | Financial Overview, Collections, Reports, and Administration sections render through WorkspaceRenderer. |  |  |  |  |
| Contributions Flow | Recorded contributions update Finance Dashboard, Member Dashboard, Contribution History, Receipts, and Reports. |  |  |  |  |
| Receipts | Receipt links and print actions work without exposing another member's records. |  |  |  |  |
| Calendar | Finance calendar route loads fundraisers, collection dates, and financial deadlines when represented as events. |  |  |  |  |
| Platform Fees | Ordinary clients cannot insert platform fees directly; admin read access still works. |  |  |  |  |
| Reports/Exports | Report snapshots, contribution trends, top categories, and export shortcuts load without blocking dashboard render. |  |  |  |  |

## Super Admin Workspace

| Area | Test | Pass | Fail | Risk | Notes |
| --- | --- | --- | --- | --- | --- |
| Workspace Resolution | Super admin role lands in Super Admin Workspace and never depends on church membership. |  |  |  |  |
| Security | Super admin routes require super admin authorization and do not rely on client-only checks. |  |  |  |  |
| CMS | Daily Readings, Saints, Liturgical Calendar, Prayer Library, and import center remain accessible. |  |  |  |  |
| Platform Monitoring | System health, logs, jobs, analytics, security, and platform settings load. |  |  |  |  |
| Billing | Billing verification receipt access remains scoped to storage policies and signed URLs. |  |  |  |  |

## Cross-Domain Workflows

| Workflow | Expected Integration | Pass | Fail | Risk | Notes |
| --- | --- | --- | --- | --- | --- |
| Contribution -> Receipt -> Finance -> Member -> History -> Reports | A contribution creates one receipt-ready record, updates finance/member summaries, appears in history, and contributes to reports. |  |  |  |  |
| Quick Give -> Payment -> Receipt | Quick Give preserves existing payment backend behavior and navigates to receipt after success. |  |  |  |  |
| Mass Intention -> Workflow -> Calendar -> Dashboard -> Notification Hook | Scheduled intentions can be represented as workflow-backed calendar items and dashboard schedule rows without calendar-owned workflow logic. |  |  |  |  |
| Prayer Request -> Workflow -> Pastoral Dashboard -> Notification Hook | Prayer request status updates are reflected in pastoral queues and leave a future notification integration point. |  |  |  |  |
| Event -> Calendar -> Attendance -> Dashboard -> Announcement | Events appear in calendar, member RSVP works, attendance summaries update dashboards, and announcements can reference event details. |  |  |  |  |
| Community Help -> RPC Transaction -> Contribution -> Dashboard | Community Help donation workflow completes atomically and updates contribution-related caches. |  |  |  |  |

## Non-Functional Checks

| Area | Test | Pass | Fail | Risk | Notes |
| --- | --- | --- | --- | --- | --- |
| Performance | Initial authenticated routes are lazy-loaded and dashboards load progressively. |  |  |  |  |
| Caching | React Query caches are reused for member, liturgy, saint, prayer, reflection, calendar, contribution, and dashboard data. |  |  |  |  |
| Loading States | Skeletons or lightweight loading states appear on portal and dashboard surfaces. |  |  |  |  |
| Empty States | Empty events, contributions, prayers, help requests, and schedules explain next steps. |  |  |  |  |
| Error States | Query failures show recoverable messages without blocking unrelated cards. |  |  |  |  |
| Accessibility | Keyboard navigation, focus indicators, labels, headings, and ARIA labels work on all critical flows. |  |  |  |  |
| Responsive Layout | Member, pastoral, admin, finance, and super admin experiences are usable on low-end Android widths. |  |  |  |  |
| Security | Protected routes, role resolution, RLS assumptions, and storage access remain enforced server-side. |  |  |  |  |

## Pilot Exit Criteria

| Criterion | Pass | Fail | Risk | Notes |
| --- | --- | --- | --- | --- |
| Build passes from a clean checkout with configured environment. |  |  |  |  |
| No P0/P1 security findings remain open. |  |  |  |  |
| Member giving, receipts, events, prayer requests, Mass intentions, and dashboards complete core UAT. |  |  |  |  |
| Admin and finance teams can operate daily workflows without manual database intervention. |  |  |  |  |
| Known risks are documented with owner and mitigation. |  |  |  |  |

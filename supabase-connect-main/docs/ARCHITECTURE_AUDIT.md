# Architecture Audit

Date: July 2, 2026  
Sprint: RC-30.0 Enterprise Readiness & Scale Verification  
Scope: Static code review, route review, query-pattern review, migration/policy inventory, build output review, and documentation review.

No schema, migration, route, or feature changes were made for this audit.

## Executive Summary

Kanisa Connect has moved into a modular platform shape with clear investments in workspaces, dashboards, workflows, calendar, tenant architecture, observability, offline support, and production documentation. The main readiness risk is not missing architecture. It is accumulated feature velocity inside large page components and duplicated Supabase access patterns that should be consolidated before enterprise-scale onboarding.

The application is viable for pilot and early production use when backed by Supabase RLS and role testing, but it needs focused hardening before thousands of churches are onboarded.

## Architecture Strengths

- Portal, admin, staff, and super-admin areas are route split with `React.lazy`.
- Workspace, dashboard, section, workflow, calendar, tenant, and monitoring foundations now exist.
- Core routes are protected by `ProtectedRoute`.
- Environment validation rejects missing Supabase config and obvious service-role exposure.
- Recent migrations contain substantial RLS, storage, index, and `SECURITY DEFINER` hardening.
- Global error boundary exists and now emits structured diagnostics.
- Offline cache and sync queue modules exist for low-bandwidth support.

## Large Files

Files over roughly 500 lines should be reviewed for extraction. Current top offenders:

| File | Lines | Risk |
| --- | ---: | --- |
| `src/pages/super-admin/CatholicSaintsPage.tsx` | 2008 | Very high UI, CMS, validation, storage, and import logic density |
| `src/pages/portal/PortalDashboard.tsx` | 1806 | Legacy member portal surface with duplicated dashboard responsibilities |
| `src/lib/analytics-assistant.ts` | 1578 | Large service with hard-to-test query and analysis flow |
| `src/pages/Index.tsx` | 1283 | Landing/onboarding surface is too broad |
| `src/pages/church-admin/AnnouncementsPage.tsx` | 1188 | Mixed templates, AI generation, publish logic, and fallback behavior |
| `src/pages/auth/RegisterPage.tsx` | 937 | Complex auth and registration flow |
| `src/components/channels/ChannelWorkspace.tsx` | 883 | Messaging UI and data logic are tightly coupled |
| `src/pages/church-admin/AnalyticsAssistantPage.tsx` | 871 | Large report/export and assistant page |
| `src/pages/church-admin/MembersPage.tsx` | 815 | Multiple member relationship queries and table workflows |
| `src/pages/church-admin/MassIntentionsPage.tsx` | 754 | Admin workflow and table behavior should be decomposed |
| `src/pages/portal/PortalPrayerRequests.tsx` | 752 | Member workflow and discussion behavior in one component |
| `src/components/portal/PortalLayout.tsx` | 746 | Navigation shell should remain leaner |
| `src/components/MemberForm.tsx` | 744 | Complex form and relational write behavior |
| `src/pages/church-admin/ContributionsPage.tsx` | 729 | Finance table, mutation, audit, and form concerns are mixed |
| `src/components/portal/MemberDashboard.tsx` | 726 | Improved, but still large for a composition component |

Recommendation: split these by feature service hooks, page sections, form dialogs, table components, and pure presentation widgets.

## Duplicate Logic

Observed duplicated patterns:

- Member and church context lookup occurs in several pages despite `AuthContext`, `useMember`, and workspace context foundations.
- Finance summaries repeat `contributions` count/sum queries across church dashboard, finance dashboard, priest dashboard, member dashboard, and reports.
- Members, ministries, communities, and families pages each fetch active member lists directly.
- Announcements uses RPC-first behavior with direct Supabase fallback inside the page component.
- Several pages implement local error logging through direct `console.*` instead of centralized logger utilities.
- Portal dashboard legacy code overlaps newer `PortalHome`, dashboard widget, workspace, and parish-home components.

Recommendation: create shared read services for finance summary, member directory options, active ministries, active communities, and announcement commands.

## Dead Code And Unused Surfaces

Static review findings:

- `src/examples/DashboardWithBibleVersePopup.tsx` appears to be an example-only artifact. Keep only if docs reference it.
- `src/pages/auth/AcceptInvitePage.tsx` exists but was not visible in the inspected top-level route map. Verify whether it is intentionally unreachable.
- `src/pages/church-admin/BibleVersesPage.tsx` still exists alongside the newer Bible foundation and super-admin content controls. Confirm ownership.
- `src/pages/super-admin/UserActivity.tsx` uses `mockActivityTrend`; replace with real data or label as placeholder before production.
- `src/lib/super-admin/import-history-service.ts` returns placeholder history. This should not be presented as production audit history.
- Local mock announcement templates in `AnnouncementsPage` are useful fallbacks, but should be operationally documented as fallback content.

Recommendation: run a full dependency-aware unused export audit before freezing Version 1.0.

## Circular Imports

No automated circular dependency tool was run during this sprint. Static import review did not reveal an obvious cycle in the newly introduced frameworks. Risk remains in broad barrel exports such as:

- `src/components/workspace/index.ts`
- `src/components/portal/dashboard/index.ts`
- `src/components/workflow/index.ts`
- `src/lib/monitoring/index.ts`
- `src/lib/tenant/index.ts`

Recommendation: add a CI check using a dependency graph tool before enterprise rollout.

## Routing Audit

Strengths:

- Main app routes are lazy-loaded.
- Portal, admin, staff, and super-admin route groups are split.
- Protected route checks are applied at the shell boundary.

Risks:

- Admin index dashboards render outside `ChurchAdminLayout`, while most admin pages render inside it. This appears intentional for workspace dashboards, but should be documented.
- Some legacy and newer pages coexist: `MemberDashboard`, `PortalDashboard`, and `PortalHome`.
- `AcceptInvitePage` should be verified against route definitions.
- Route protection must remain a UX guard only; RLS and RPC checks must remain the source of truth.

## Query And Data Access Audit

Observed Supabase usage:

- Client-side direct `from`, `rpc`, `storage`, and `auth` calls are distributed across pages, hooks, and libs.
- There are many direct UI-page queries in large components.
- Some workflows already use RPCs for transactional behavior.
- New monitoring health checks are factory-based and do not run automatically.

Potential repeated query hotspots:

- `ChurchDashboard`, `FinanceDashboard`, and `PriestDashboard` repeat contribution, member, community-help, and pledge summary queries.
- `MembersPage`, `FamiliesPage`, `CommunitiesPage`, `RolesPage`, and ministry pages fetch active members independently.
- `PortalDashboard` still contains multiple direct church/member/community/event queries.
- `AnnouncementsPage` contains RPC and direct fallback logic in the page.
- `PortalAnnouncements` fetches profile names for commenters after announcement/comment retrieval.

Recommendation: create shared query hooks with stable query keys and colocated stale-time policy.

## Database Architecture Review

Static migration inventory:

- `SECURITY DEFINER` occurrences: 89
- RLS policy creation occurrences: 207
- Index creation occurrences: 159

Strengths:

- RLS is broadly present.
- Many church-scoped indexes already exist.
- Bible, daily readings, liturgy, saints, contributions, audit logs, mass intentions, and portal submission paths have purpose-built indexes and RPCs.
- RC-17.2 hardening addresses contribution authorization, community-help transaction safety, platform fee restriction, receipt storage, and member photo upload scope.

Risks:

- Static review cannot prove that every `SECURITY DEFINER` function has current `auth.uid()`, church, role, and ownership checks.
- Many dashboard queries use aggregate counts and sums from the client; at scale, materialized or RPC-backed summaries may be needed.
- Some direct writes remain in pages for admin workflows and should be checked against RLS and audit requirements.
- Tenant architecture is application-layer only at this point; database tenant isolation is not yet persisted.

Recommended live checks:

- Run role-based RLS tests for member, pastoral, church admin, finance, and super admin.
- Run query plans for dashboard, contributions, Bible search, calendar, mass intentions, and announcements.
- Validate storage policies with real bucket paths and non-owner users.
- Verify `record_contribution_with_key` and `submit_community_help_donation` behavior in staging.

## Security Architecture Review

Strengths:

- Environment validation checks required variables, project ref mismatch, placeholder keys, and service-role JWT exposure.
- Protected routes guard major workspaces.
- RLS and storage policy hardening exists across migrations.
- Transactional portal RPCs reduce partial-write risk for sensitive submissions.
- Observability and error logging avoid blocking user flows.

Risks:

- Client route role checks must not be considered authorization.
- Tenant isolation is not database-backed yet.
- Service-role exposure can only be fully verified in deployment configuration.
- Storage policies require live path testing.
- Console logging remains in several production pages and should be moved behind centralized logger utilities.

## Performance Architecture Review

Build output confirms route splitting, but large vendor chunks remain:

- `pdf-vendor`: about 1,547.83 kB minified, 516.19 kB gzip
- `xlsx-vendor`: about 429.35 kB minified, 143.18 kB gzip
- `charts-vendor`: about 422.46 kB minified, 112.39 kB gzip
- `jspdf-vendor`: about 417.05 kB minified, 136.95 kB gzip
- `scanner-vendor`: about 356.34 kB minified, 93.70 kB gzip
- `html2canvas-vendor`: about 201.42 kB minified, 48.03 kB gzip

Public asset risks:

- `public/church-video.mp4`: about 4.0 MB
- `public/church.png`: about 2.3 MB
- `public/pwa-icon-512.png`: about 352 KB
- `public/church-hero-poster.jpg`: about 222 KB

Recommendation: keep heavy imports behind action-level dynamic imports and optimize public landing assets.

## Accessibility Architecture Review

Strengths:

- Shared UI primitives provide consistent focus styling in many places.
- Recent skeleton and empty-state work improved perceived loading.
- Scripture links and app links include accessibility-oriented behavior.

Risks:

- Several compact forms still rely heavily on placeholders.
- Dialog focus behavior should be tested on mobile and desktop.
- Large table pages need keyboard and screen-reader verification.
- Color contrast must be checked with actual church theme overrides.
- Admin route fallback still uses a spinner rather than skeleton.

## Mobile Architecture Review

High-risk pages at narrow widths:

- `PortalDashboard` and `MemberDashboard` due legacy density and card grids.
- `MemberBibleHomePage` due search/autocomplete and chapter navigation.
- `ParishCalendarPage` due grid/list complexity.
- `ContributionsPage`, `MembersPage`, and `MassIntentionsPage` due tables and filters.
- `PortalCommunityHelp`, `PortalPrayerRequests`, and `PortalMassIntentions` due workflow forms.
- `FinanceDashboard` due metric grids and report sections.

Recommendation: add Playwright mobile viewport smoke tests at 320, 375, 414, 768, and 1024px.

## Offline Architecture Review

Strengths:

- Offline cache helpers exist.
- Offline sync queue exists.
- Network status hook exists.
- Daily Catholic content and Bible features have cache-oriented architecture.

Risks:

- Offline queue coverage appears contribution-oriented and should be expanded carefully.
- Bible cache behavior needs real repeat-load testing.
- Calendar and daily readings cache behavior should be measured with airplane-mode tests.
- Conflict handling and retry UX need production UAT.

## Maintainability Recommendations

1. Extract large page components into services, hooks, and section components.
2. Standardize query hooks and query keys per business domain.
3. Replace remaining direct `console.*` calls with centralized logging.
4. Add CI checks for circular imports and unused exports.
5. Add role-based RLS test fixtures.
6. Add mobile viewport smoke tests for critical portal/admin flows.
7. Document legacy pages that remain intentionally active.
8. Move production placeholder/mock surfaces behind explicit feature or fallback labels.

## Conclusion

The platform has the right architecture foundations for enterprise readiness, but the implementation still contains several large, fast-moving components that concentrate UI, data access, and workflow logic. The next phase should prioritize consolidation and verification over new module development.

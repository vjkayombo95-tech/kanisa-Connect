# Performance and Scalability Report

Generated: 2026-06-19

## What Has Been Optimized

- Route-level code splitting separates member, staff, admin, and super-admin bundles.
- Heavy admin pages such as analytics, reports, members, attendance/events, groups, exports, and settings are lazy-loaded.
- Normal member routes do not load admin route bundles.
- Dashboard startup now prioritizes profile, church context, latest announcements, and summary stats.
- Large list pages use paginated Supabase range queries with a default page size of 25.
- Member, contribution, attendance/event, community, payment, pledge, mass intention, and prayer request pages avoid full-table startup loads.
- Analytics PDF generation is isolated behind action-based dynamic imports.
- Analytics charts are lazy-loaded.
- AI analytics logic is loaded only when the assistant dashboard/query/export actions run.
- Member dropdowns for contributions and pledges use remote search with a 2-character minimum and 10-result limit.
- Pledge realtime subscriptions are disabled by default unless `VITE_ENABLE_PLEDGE_REALTIME=true`.
- Critical dashboard, auth profile/context, portal announcements, recent contributions, and analytics snapshots use local cache paths.
- Network images now include lazy/async loading hints where practical.

## Server-Side Analytics

- Added `public.analytics_snapshots` for precomputed analytics JSON payloads.
- Added `public.generate_church_analytics_snapshot(p_church_id uuid)`.
- The RPC computes:
  - current-month contribution totals
  - all-time contribution totals
  - monthly trends
  - active members
  - new members
  - pledge totals
  - top categories
  - category comparison
  - recent 30-day trends
  - Jumuiya/member counts
- `AnalyticsPage` now calls the RPC instead of calculating large analytics in the browser.
- `ReportsPage` reads snapshots first and only loads raw contribution rows for the paginated detail drilldown.

## Current Bundle Sizes

Largest JavaScript chunks after Phase 5 build:

| Chunk | Size | Gzip |
| --- | ---: | ---: |
| `AnalyticsReportPdf-DaMw80co.js` | 1,558.89 kB | 518.88 kB |
| `generateCategoricalChart-D1feH7Kc.js` | 367.71 kB | 101.67 kB |
| `scanner-vendor-7-OUrUH4.js` | 356.21 kB | 93.63 kB |
| `supabase-vendor-DTxyEtBp.js` | 176.83 kB | 46.52 kB |
| `react-vendor-DTpTEtJT.js` | 163.89 kB | 53.36 kB |
| `ui-vendor-ns1wMgU1.js` | 134.18 kB | 43.69 kB |
| `motion-vendor-BFLPjklX.js` | 131.57 kB | 43.60 kB |
| `PortalDashboard-D77jAlsN.js` | 41.17 kB | 10.19 kB |
| `analytics-assistant-Dbgn50Um.js` | 38.63 kB | 11.44 kB |
| `MembersPage-O5-82t5V.js` | 33.91 kB | 8.88 kB |

The PDF chunk remains large but is isolated from normal route load and only loads when PDF export is requested.

## Current Known Bottlenecks

- `AnalyticsReportPdf` remains large because `@react-pdf/renderer` is inherently heavy.
- Recharts still creates large chart-related vendor chunks on chart-heavy routes.
- QR/scanner libraries remain large and should stay isolated to scanner/payment routes.
- Reports have snapshot-backed summaries, but member/family rollups still need dedicated server-side summary RPCs for full analytical depth at scale.
- Some feature pages outside the primary Phase 3/4/5 scope still use direct aggregate queries and should be audited before very high traffic.

## Recommended Supabase Plan Considerations

- Use a paid Supabase tier before serving thousands of active users.
- Enable point-in-time recovery for production.
- Monitor database CPU, RAM, connection count, and slow query logs.
- Consider PgBouncer/connection pooling for bursty client traffic.
- Move analytics snapshot generation to scheduled jobs or Edge Functions for large churches.
- Add read replicas if dashboards and reports become read-heavy.
- Set up database indexes for every filter/order pattern introduced by new reports.

## Remaining Work Before 10,000+ Concurrent Users

- Move analytics snapshot generation to a scheduled server-side job so users rarely trigger it manually.
- Add dedicated RPCs for member, family, and contribution report summaries.
- Add rate limits to expensive admin actions such as analytics generation and bulk import.
- Add observability around RPC duration, query plans, and client cache hit rates.
- Consider CDN-backed image transformations/thumbnails for member photos, logos, banners, event posters, and announcement media.
- Add load testing for dashboard login, portal dashboard, contributions, reports, and analytics generation.
- Review RLS policy performance using `explain analyze` with realistic data volume.

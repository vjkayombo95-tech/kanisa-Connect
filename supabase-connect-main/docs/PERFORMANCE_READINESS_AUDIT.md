# Performance readiness audit

## Findings and recommendations

| Risk | Evidence | Recommended fix |
| --- | --- | --- |
| Full table payload on platform dashboard | `PlatformDashboard.tsx` selects all contribution amounts and six months of contribution rows. | Replace with a tenant-safe aggregate RPC or materialized/snapshot query; return grouped totals only. |
| Unbounded administration lists | `ChurchManagement.tsx`, feature/church selectors, families, categories, and several portal pages select ordered tables without `range`/`limit`. | Add server-side pagination and search; never select `*` from tenant-wide tables at scale. |
| Exact counts can become expensive | Dashboard/user-activity pages use `count: 'exact'` on members/contributions. | Use approximate/statistical counts for global dashboards or cached analytics snapshots. |
| N+1-like fanout | Portal announcements, prayer requests, channels, and community views fetch reactions/comments/profiles after the main list. | Add batched RPCs/views returning aggregated counts and paginated comments; avoid one request per row. |
| Missing composite indexes to validate | List pages filter/order by church/status/date. Existing coverage is good for members, contributions, prayer requests, mass intentions, and announcements, but verify `events(church_id,start_date)`, `sermons(church_id,date)`, `notifications(user_id,is_read,created_at)`, `families(church_id,name)`, `invitations(church_id,status,created_at)`, and interaction/comment foreign keys. | Use `EXPLAIN (ANALYZE, BUFFERS)` on staging after seeds; add indexes only for observed plans. |
| Large scans through RLS | RLS policies frequently use nested `exists` over members/user_roles. | Ensure policy join columns remain indexed (`members(user_id,church_id)`, `user_roles(user_id,church_id)`); benchmark with real JWT roles. |
| API/auth pressure | Dashboard batches and client-side aggregation can cause high REST request counts; login tests can hit Auth throttles. | Cache with React Query, use snapshot/RPC endpoints, set k6 arrival rates gradually, and monitor Supabase Auth/API limits. |

`20260619120000_add_pagination_performance_indexes.sql` and later migrations already add useful indexes. Test plans against the seeded staging volume before adding more; redundant indexes slow the 50,000-row contribution write workload.

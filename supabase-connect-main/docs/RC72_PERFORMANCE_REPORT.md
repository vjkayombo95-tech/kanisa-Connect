# RC-7.2 Performance Report

RC-7.2 optimized the Audio CMS and Member Audio Experience without changing RC-7.1 security, roles, worker boundaries, processing pipeline, or lifecycle model.

## Before

- Audio jobs were fetched as a full church history and paginated in the browser.
- Dashboard metrics were derived by filtering all fetched jobs in React.
- Member playback performed a broader published-version lookup and filtered book matches outside the indexed path.
- Review pages downloaded QA reports, manifests, and verse index JSON during initial render.
- Audio job refresh used realtime and polling at the same time.
- Dense job and verse tables rendered all rows in the current client dataset.

## After

- `list_audio_jobs_page` returns one bounded page with `total_count`.
- `get_audio_dashboard_summary` returns dashboard counts and recent jobs from SQL aggregates.
- `get_published_audio_lookup` uses an indexed church/content/chapter/normalized-book lookup for member playback.
- QA reports, manifests, and verse index JSON are loaded only after an explicit admin action.
- Realtime is the primary refresh path; polling activates only when the realtime channel disconnects or times out.
- Jobs and verse review rows use lightweight row windowing.
- Admin audio pages remain route-level lazy-loaded through `AdminRoutes`.

## Database Optimizations

Added read-path indexes:

- `idx_audio_jobs_church_created_id`
- `idx_audio_jobs_church_status_created_id`
- `idx_audio_jobs_member_lookup`
- `idx_audio_versions_published_lookup`
- `idx_audio_version_verses_version_verse`

Added read-only RPCs:

- `list_audio_jobs_page`
- `get_audio_dashboard_summary`
- `get_published_audio_lookup`

## Expected Scalability

Audio jobs:

- Before: browser payload grew linearly with total church job history.
- After: browser payload is bounded by page size, currently 50 rows.

Dashboard:

- Before: dashboard cost depended on all loaded jobs.
- After: dashboard fetch is one aggregate query plus six recent rows.

Member playback:

- Before: lookup could scan by chapter and then filter book names.
- After: lookup targets church, content type, chapter, normalized book, and published version indexes.

Review workspace:

- Before: large JSON artifacts could block initial page rendering.
- After: initial render loads operational metadata first; large artifacts load on demand.

Refresh pressure:

- Before: realtime and a 15-second poll both refreshed job data.
- After: realtime invalidates queries; 15-second polling is a fallback only after disconnect.

## Verification

Expected verification commands:

- `cmd /c npm run build`
- `cmd /c npx vitest run src/test/rc71-audio-security-boundary.test.ts src/test/rc72-audio-performance.test.ts`

## Remaining Performance Work

- Add server-side summarized QA tables if reports become very large.
- Consider a dedicated virtualization package if admin tables grow beyond the current lightweight row-windowing needs.
- Add production telemetry for query timings, realtime disconnect rate, and artifact download sizes.

# RC7 Production Readiness Audit

Kanisa Connect now includes Church Management, Catholic Library, the Python Audio Processing Engine, Audio CMS, Audio Review Workflow, and the Member Audio Experience. This audit reviewed the React application, Supabase database and storage policies, Edge Function surface, audio review/member playback code paths, and Python audio engine structure.

No code changes were made as part of this audit.

## Executive Summary

The audio product is feature-complete at a foundation level, but it is not yet production-ready for broad release. The highest-risk gaps are authorization boundaries around approved member audio, reviewer/publisher/admin role separation, and the absence of a trusted server-side processing worker. The current implementation also has scalability risks from client-side filtering, unbounded query results, large JSON rendering, and mixed responsibilities in large UI components.

The Python Audio Processing Engine has a stronger test and architecture posture than the web integration layer. The web layer needs targeted hardening before release, especially around Supabase RLS, storage access, review approval transactions, and end-to-end coverage.

## Scope Reviewed

- React admin audio pages, member Bible audio integration, reusable audio player, hooks, and audio libraries.
- Supabase migrations for Audio CMS, queue integration, and review workflow.
- Supabase Storage bucket policies for audio assets, reports, indexes, transcripts, and alignments.
- `audio-cms` Edge Function.
- Python Audio Processing Engine scripts and test inventory.
- Existing test suites under `src/test` and `supabase/audio/tests`.

## Critical Findings

### C1. Approved Member Audio Is Not Safely Exposed To Members

**Problem:** The member audio experience reads from `audio_jobs`, `audio_versions`, and `audio_version_verses`, then creates signed URLs from the private `audio` bucket in the browser. The database and storage policies currently use church workspace permissions such as `can_view_church_workspace` instead of a member-safe policy scoped only to approved active audio.

**Impact:** Ordinary members may be unable to access approved audio at all. If the workspace view policy is broadened to include members, members may gain access to unpublished jobs, reports, manifests, or other admin-only artifacts.

**Recommendation:** Add a dedicated member playback access path. Prefer a Supabase RPC or Edge Function that verifies the member's church access and returns only the active approved version, verse timings, and short-lived signed audio URL. Keep admin job, review, report, and manifest objects behind admin/reviewer policies.

**Estimated effort:** High, 2-4 days.

### C2. Approval Is Not Restricted To Reviewers

**Problem:** Review and approval tables use broad workspace management checks. Approval, rejection, verse edits, audit writes, and version snapshot creation are not gated by a reviewer-specific permission.

**Impact:** Any user with broad church workspace management access may approve, reject, or alter review data even if they are not an assigned reviewer. This does not meet the requirement that only reviewers can approve.

**Recommendation:** Introduce explicit role checks for audio reviewers. Enforce them in RLS, Edge Functions or RPCs, and client-side affordances. Client-side UI hiding is not sufficient.

**Estimated effort:** Medium, 1-2 days.

### C3. Publishing Boundary Is Missing

**Problem:** Approval currently creates an active audio version that is consumed by the member Bible reader. There is no separate publisher role, publish action, or published visibility state.

**Impact:** Approval effectively becomes publishing. This conflicts with the security requirement that only publishers can publish and creates ambiguity around when approved content becomes visible to members.

**Recommendation:** Add a distinct publish lifecycle before production launch. Use states such as `approved`, `published`, `archived`, and ensure member playback only reads `published` versions. Restrict publish operations to publishers.

**Estimated effort:** High, 2-4 days.

### C4. Processing Queue Is Client-Driven Instead Of Trusted Worker-Driven

**Problem:** The upload flow creates a queued job and invokes the queue processor abstraction from the browser. Progress updates can be requested through client-accessible helpers and the `audio-cms` Edge Function.

**Impact:** Processing state can be spoofed or advanced by a browser session. The system has no trusted backend worker boundary for authoritative job execution.

**Recommendation:** Move job advancement to a trusted server worker or secured Edge Function using service credentials with strict internal authorization. The browser should create jobs and observe state, not execute state transitions.

**Estimated effort:** High, 3-5 days.

## High Findings

### H1. Edge Function Allows Broad Progress Mutation

**Problem:** The `audio-cms` Edge Function accepts job status, stage, progress, URL fields, errors, and metadata from authenticated requests. It relies heavily on table RLS and does not validate stage transitions or job ownership beyond the update target.

**Impact:** A permitted user may move jobs through invalid states, overwrite report URLs, or create inconsistent job records.

**Recommendation:** Validate allowed state transitions server-side. Only the trusted processor should update execution fields. Keep admin actions limited to create, retry, cancel, and read.

**Estimated effort:** Medium, 1-2 days.

### H2. Signed Upload URL Creation Does Not Verify Job And Church Consistency

**Problem:** Signed upload URL creation accepts `churchId`, `jobId`, `bucket`, and `fileName` input, then builds a storage path. It does not first verify that the job belongs to that church.

**Impact:** A manager with access to one church could create paths that do not correspond to a valid job or could pollute storage with orphaned objects.

**Recommendation:** Before issuing a signed upload URL, load the job by `jobId` and verify `church_id`, expected stage, and allowed bucket/object type.

**Estimated effort:** Medium, 1 day.

### H3. Review Approval Is Not Transactional

**Problem:** Approval updates the review, creates an audio version, inserts verse snapshots, and sends notifications as separate client-side operations.

**Impact:** Partial failure can leave an approved review without a version, a version without verse rows, or notifications that do not match durable state.

**Recommendation:** Move approval into a single database function or Edge Function transaction. Insert audit records and version rows atomically.

**Estimated effort:** Medium, 1-2 days.

### H4. Upload Flow Queues Jobs Before Assets Are Safely Registered

**Problem:** The upload wizard creates a queued job before all assets are uploaded and registered.

**Impact:** Storage upload failures can leave jobs permanently queued with missing audio or text assets.

**Recommendation:** Use a `DRAFT` or `UPLOADING` state until required assets are present and validated. Transition to `QUEUED` only after asset registration succeeds.

**Estimated effort:** Medium, 1-2 days.

### H5. Job Lists And Dashboards Fetch All Rows Client-Side

**Problem:** The audio job hook loads all jobs for a church and applies search, filtering, dashboard aggregation, and pagination in the browser.

**Impact:** This will degrade with large churches or long-running audio processing histories. It also increases realtime and polling traffic.

**Recommendation:** Add server-side pagination, filtering, sorting, and dashboard aggregate queries. Keep browser payloads bounded.

**Estimated effort:** Medium, 2-3 days.

### H6. Member Audio Lookup Is Not Properly Tenant Scoped

**Problem:** Member playback queries jobs by content type and chapter, then filters book names client-side. It does not explicitly scope the lookup to the member's selected church.

**Impact:** Future RLS changes could surface audio from the wrong church or force expensive scans.

**Recommendation:** Include church scope in the approved audio lookup. Normalize book/content identifiers and index them for direct lookup.

**Estimated effort:** Medium, 1-2 days.

### H7. Large JSON Artifacts Are Loaded And Rendered Directly

**Problem:** Review pages load manifests, QA reports, indexes, and version verse data directly into the browser and render some artifacts as raw JSON.

**Impact:** Large chapters or detailed alignment reports can cause slow rendering, memory pressure, and poor mobile performance.

**Recommendation:** Store summarized report fields in tables. Lazy-load large artifacts on demand. Add size limits and download links for full JSON.

**Estimated effort:** Medium, 2-3 days.

### H8. Audio Review Page Is Too Large And Mixed Responsibility

**Problem:** The review page combines data fetching, review creation, approval, rejection, verse editing, comparison, notifications, and rendering in one large component.

**Impact:** This raises regression risk and makes security-sensitive review behavior harder to test.

**Recommendation:** Split review data access, approval actions, verse table, comparison, audit trail, and report panels into focused modules with unit tests around state transitions.

**Estimated effort:** Medium, 2-4 days.

### H9. Realtime And Polling Are Both Active

**Problem:** Audio job data refreshes through Supabase Realtime and a polling interval.

**Impact:** This doubles refresh pressure and may create unnecessary renders during high processing volume.

**Recommendation:** Choose a primary refresh model. If both are retained, use polling only as a fallback after realtime disconnects.

**Estimated effort:** Low, 0.5-1 day.

### H10. Private Storage URLs Are Stored As Public URLs

**Problem:** Asset registration stores values from `getPublicUrl` even though the buckets are private.

**Impact:** Stored URLs may be unusable or misleading. Developers may accidentally treat private objects as public.

**Recommendation:** Store bucket and object path as canonical asset references. Generate signed URLs only when needed.

**Estimated effort:** Low, 0.5-1 day.

## Medium Findings

### M1. Status Model Is Inconsistent

**Problem:** Migrations and TypeScript unions include a mix of lowercase lifecycle states and uppercase queue states. Dashboard metrics also reference published states even though publishing is not implemented.

**Impact:** Inconsistent states increase query bugs, incorrect dashboard counts, and authorization ambiguity.

**Recommendation:** Define a single status state machine for jobs, reviews, versions, and future publishing. Document transitions and enforce them in the database.

**Estimated effort:** Medium, 1-2 days.

### M2. Duplicate Audio Player Concepts Exist

**Problem:** The codebase contains the older generated Bible audio player and the newer synchronized approved audio player.

**Impact:** The duplicated concepts can confuse future work and lead to inconsistent playback behavior.

**Recommendation:** Mark the older player as legacy or consolidate around a shared lower-level playback control component.

**Estimated effort:** Low, 0.5-1 day.

### M3. Duplicate Admin Routes Point To The Same Review Surface

**Problem:** Job detail and review routes both target the review experience.

**Impact:** The URL model is confusing and may make authorization and breadcrumbs harder to reason about.

**Recommendation:** Keep one canonical route and use redirects or explicit route aliases with documented intent.

**Estimated effort:** Low, 0.5 day.

### M4. Review Creation Has Side Effects On Page Load

**Problem:** The review page creates or assigns an audio review when it is loaded.

**Impact:** Merely viewing a job can create review records or notifications.

**Recommendation:** Separate "view details" from "assign review". Require an explicit assignment action or server-side idempotent assignment rule.

**Estimated effort:** Medium, 1-2 days.

### M5. Notifications Are Too Narrow

**Problem:** Several notifications target only the job creator.

**Impact:** Other reviewers, admins, or publishers may miss important state changes.

**Recommendation:** Introduce recipient rules by event type and role: assigned reviewers for review events, admins for failures, publishers for approved content.

**Estimated effort:** Medium, 1-2 days.

### M6. Cancel And Reprocess Actions Need Stronger Confirmation

**Problem:** Some destructive or expensive actions are available with limited confirmation.

**Impact:** Admins may cancel processing or trigger reprocessing accidentally.

**Recommendation:** Add confirmation dialogs with job identity, current state, and expected result. Require a reason for rejection and reprocessing.

**Estimated effort:** Low, 0.5-1 day.

### M7. Member Auto-Scroll Can Fight User Navigation

**Problem:** The synchronized player scrolls the active verse into view as playback progresses.

**Impact:** If a member manually scrolls while listening, the player can pull the viewport away.

**Recommendation:** Pause auto-scroll after manual scroll interaction and provide a "follow audio" toggle.

**Estimated effort:** Low, 0.5-1 day.

### M8. Signed Playback URLs Are Not Refreshed

**Problem:** Playback uses short-lived signed URLs but does not refresh them when they expire.

**Impact:** Long sessions or resumed browser tabs may fail playback unexpectedly.

**Recommendation:** Refresh signed URLs before expiry or on audio load failure.

**Estimated effort:** Low, 0.5-1 day.

### M9. Mobile Tables Risk Horizontal Overflow

**Problem:** Several admin audio pages use dense tables with many columns. Some are wrapped, but the job list and review workspace still risk poor mobile ergonomics.

**Impact:** Church admins on phones may struggle to review jobs, edit verse timing, or use action menus.

**Recommendation:** Provide mobile card layouts for job and verse rows, with table layouts reserved for larger screens.

**Estimated effort:** Medium, 2-3 days.

### M10. Edge Function Error Responses May Leak Raw Details

**Problem:** The Edge Function returns raw error messages in several branches.

**Impact:** Internal table, policy, or storage details may be exposed to authenticated clients.

**Recommendation:** Log detailed errors server-side and return stable public error codes/messages to clients.

**Estimated effort:** Low, 0.5-1 day.

### M11. CORS Policy Is Broad

**Problem:** The Edge Function uses broad CORS headers.

**Impact:** Browser calls from unexpected origins are easier to attempt. Authentication still protects data, but the surface is wider than necessary.

**Recommendation:** Restrict allowed origins to production and staging domains.

**Estimated effort:** Low, 0.5 day.

### M12. Queue Failure Recovery Is Split Across Systems

**Problem:** The Python engine has retry/resume support, while the web queue has retry/cancel controls and status transitions. The boundary between these recovery systems is not yet authoritative.

**Impact:** A failure may be marked differently in the CMS than in the engine manifest or QA reports.

**Recommendation:** Define the worker integration contract: stage mapping, final status mapping, failure reason format, retry ownership, and manifest synchronization.

**Estimated effort:** Medium, 1-2 days.

## Low Findings

### L1. Some User-Facing Text Appears Encoding-Corrupted

**Problem:** At least one Bible page contains visibly corrupted bullet characters.

**Impact:** Minor visual polish issue, but it reduces trust in content quality.

**Recommendation:** Normalize affected strings to UTF-8 and add a lint or content check for mojibake patterns.

**Estimated effort:** Low, 0.5 day.

### L2. Audio UI Text Is Not Internationalized

**Problem:** New audio UI labels are hardcoded in English.

**Impact:** This may limit future localization.

**Recommendation:** Move user-facing strings into the existing localization pattern if the application supports multiple languages.

**Estimated effort:** Medium, 1-2 days.

### L3. Empty States Need More Actionable Guidance

**Problem:** Empty states exist, but some do not tell admins what to do next.

**Impact:** New church admins may not know whether to upload, wait, retry, or contact support.

**Recommendation:** Add next-step actions to empty states, especially on dashboard, jobs, review, and settings pages.

**Estimated effort:** Low, 0.5-1 day.

### L4. Audio Settings Are Foundation-Level

**Problem:** The settings page appears to be a foundation surface rather than a fully wired operational control center.

**Impact:** Admins may expect settings to affect processing behavior immediately.

**Recommendation:** Clearly separate read-only status/settings from editable controls until server-backed settings are implemented.

**Estimated effort:** Low, 0.5-1 day.

### L5. Python And CMS Stage Names Need A Formal Mapping

**Problem:** Python stage names and CMS queue stage names are similar but not identical.

**Impact:** Integration can produce confusing status labels or incorrect progress updates.

**Recommendation:** Add a documented stage mapping contract between the Python engine and CMS worker.

**Estimated effort:** Low, 0.5 day.

## Architecture Audit Notes

- No circular dependency was obvious from the reviewed import paths, but no automated circular dependency tool was run.
- The strongest architecture issue is not dead code, but mixed responsibility in large React surfaces and an incomplete trust boundary between browser, Edge Function, database, storage, and processor.
- The Python engine follows a cleaner staged architecture with dataclasses, manifests, retry/resume support, QA reports, dashboard artifacts, and focused tests.
- The web audio layer should move security-sensitive workflow actions from browser helpers into database functions or Edge Functions with strict role checks.

## Security Audit Notes

- RLS is enabled on audio tables, and storage buckets are private. This is a good baseline.
- Current policies are too coarse for the requested product roles. Audio admin, reviewer, publisher, and member playback access should be separate.
- Members must only read published or explicitly member-visible approved audio. They should not read job records, review records, manifests, processing reports, or internal storage paths.
- Service role usage was not found in the client path reviewed, which is positive. Future worker integration must keep service credentials server-side only.
- The approval and publishing boundary should be enforced at the database or Edge Function layer, not only by React route access.

## Performance Audit Notes

- Add bounded server-side pagination and filtering for audio jobs.
- Avoid loading full report, manifest, alignment, and index JSON into review screens by default.
- Use aggregate queries for dashboard counts instead of deriving everything from full job lists.
- Review realtime plus polling behavior before release.
- Add indexes for expected member playback lookups once the final approved/published data model is settled.
- Avoid repeated active-verse scroll operations when the user is manually navigating.

## Mobile And Accessibility Audit Notes

- The reusable player includes the required controls and has accessible labels for core actions.
- Dense admin review and job tables need a better small-screen layout.
- Verse edit controls should preserve large touch targets and usable numeric input behavior on mobile.
- Landscape phone layout should be tested manually for the player, review table, upload wizard, and job dashboard.
- Keyboard support exists for native controls, but full review-table keyboard workflows should be tested.

## UX Audit Notes

- Upload wizard flow is understandable, but should not queue jobs until required assets are safely uploaded and registered.
- Review workspace includes the right information, but it is dense. Important actions should stay visible without requiring excessive scrolling.
- Approval confirmation exists, but cancellation, rejection, and reprocessing flows need stronger confirmation and reason capture.
- Member audio player has the expected controls. Auto-scroll behavior needs a user override for comfort.
- Dashboard metrics should distinguish queued, processing, failed, approved, and published once publishing is implemented.

## Error Recovery Audit Notes

- Storage upload failure can leave queued jobs without assets.
- Processing failures need one authoritative owner for retry and status updates.
- Signed URL expiry should be handled during playback.
- Supabase failures are generally surfaced through toasts, but multi-step workflows need rollback or resumable recovery.
- Python retry/resume behavior is strong, but the CMS integration contract must preserve those semantics.

## Test Coverage Audit

### Current Coverage Observed

- Python audio engine has focused pytest coverage for configuration, discovery, manifests, pipeline context, resume logic, retry helper, QA reports, run summaries, validation, verification, and a Genesis integration path.
- React test coverage exists for many non-audio application areas.
- Existing Bible audio tests cover older/generated narration behavior.

### Missing Highest-Priority Tests

1. RLS tests proving members cannot read unpublished or admin-only audio artifacts.
2. RLS tests proving only reviewers can approve and only publishers can publish.
3. Edge Function tests for signed upload URL authorization, progress transition validation, and invalid payload rejection.
4. Integration test for upload job creation where asset upload fails.
5. Transactional approval test covering review update, version creation, verse snapshots, and audit records.
6. Member playback integration test that returns only the active approved or published version for the correct church.
7. Review workflow E2E test covering verse edit, audit trail, approval, rejection, and reprocess request.
8. Audio job dashboard test with pagination, filtering, realtime/polling refresh, and failure states.
9. Mobile viewport E2E tests for upload wizard, job list, review page, and member audio player.
10. Performance regression test or fixture for large chapter indexes and QA reports.

## Release Recommendation

Do not release RC7 broadly until the Critical findings are resolved. A limited internal pilot is reasonable only if audio CMS access is restricted to trusted admins and member playback is disabled or served through a verified approved-audio-only access path.

Recommended release gate:

1. Implement member-safe approved/published audio access.
2. Enforce reviewer and publisher roles in RLS or trusted server functions.
3. Move queue state mutation to a trusted worker boundary.
4. Make approval/version creation transactional.
5. Add RLS and workflow integration tests for the above paths.

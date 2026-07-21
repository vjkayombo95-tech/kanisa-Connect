# RC-7.1 Security Model

RC-7.1 hardens the Audio CMS trust boundary without changing the existing routes, Python Audio Processing Engine, or completed product architecture.

## Role Matrix

| Capability | Member | Audio Reviewer | Audio Publisher | Church Admin/Pastor | Trusted Worker |
| --- | --- | --- | --- | --- | --- |
| Create audio job draft | No | No | No | Yes | No |
| Upload/register required assets | No | No | No | Yes | No |
| Queue after validated assets | No | No | No | Yes | No |
| Advance processing status/stage/progress | No | No | No | No | Yes |
| Edit verse timing | No | Yes | No | Yes, if assigned reviewer role policy allows | No |
| Approve/reject/request reprocessing | No | Yes | No | Yes, if assigned reviewer role policy allows | No |
| Publish/unpublish/archive versions | No | No | Yes | Yes, if assigned publisher role policy allows | No |
| Play chapter audio | Published only | Admin views only | Admin views only | Admin views only | No |

Dedicated role helpers:

- `has_audio_reviewer_role(user_id, church_id)`
- `has_audio_publisher_role(user_id, church_id)`
- `is_active_church_member(user_id, church_id)`

## Worker Trust Boundary

Browsers must never update `audio_jobs.status`, `processing_stage`, `progress`, `completed_at`, `report_url`, `manifest_url`, or `index_url`.

The database trigger `protect_audio_job_execution_fields` rejects direct browser mutation of worker-owned execution fields. Only trusted contexts created by approved RPCs or service-role worker calls can update them.

The worker API is `supabase/functions/audio-worker`. It requires:

- `SUPABASE_SERVICE_ROLE_KEY`
- `AUDIO_WORKER_SECRET`
- `x-worker-secret` header

The browser does not receive either credential.

## Playback API

Member playback uses `supabase/functions/member-audio`.

Input:

- `churchId`
- `book`
- `abbreviation`
- `chapter`

Output:

- one published version only
- verse timing snapshot
- short-lived signed URL
- minimal metadata

Members do not query `audio_jobs`, `audio_reviews`, `audio_reports`, `audio_manifests`, `audio_versions`, or `audio_version_verses` directly for playback.

## Publishing Flow

Audio lifecycle:

`DRAFT -> UPLOADING -> VALIDATING -> QUEUED -> processing stages -> REVIEW_REQUIRED -> approved -> published -> archived`

Approval creates an `approved` version only. It does not publish member playback.

Publishing is handled by:

- `publish_audio_version(version_id)`
- `unpublish_audio_version(version_id)`
- `archive_audio_version(version_id)`

Only publisher-authorized users can execute these RPCs.

## Approval Flow

Approval is transactional in `approve_audio_review(review_id, reason)`.

The transaction updates:

- review decision
- approved audio version
- verse timing snapshot
- audit trail
- notification
- job state

If any insert or update fails, the transaction rolls back.

## Queue Ownership

Browser-allowed job actions are limited to:

- `create_audio_job_draft`
- `register_audio_asset`
- `enqueue_audio_job`
- `retry_audio_job`
- `cancel_audio_job`
- read/list operations

Queueing requires registered audio and text assets. Upload paths must match the job church and job id.

## RLS Strategy

Admin read policies remain workspace-scoped for operational views. Sensitive writes move to role-specific policies and RPCs:

- reviewer policies for review rows, verse edits, and audit writes
- publisher policies for version publication state
- member select policies for published versions and published verse snapshots only
- worker-owned job execution fields protected by trigger and service-role RPC

## Threat Model

Mitigated risks:

- browser spoofing queue progress or completion
- member access to unpublished audio or internal artifacts
- approval automatically publishing content
- non-reviewers approving or editing timings
- non-publishers publishing member-visible audio
- upload URL creation for invalid job/church combinations
- partial approval leaving orphaned versions or verse rows

Residual operational risks:

- production must configure worker secrets correctly
- reviewer and publisher assignments must be managed deliberately
- large JSON reports still need separate performance hardening

## Deployment Notes

Required environment variables:

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `AUDIO_WORKER_SECRET`

Deploy Edge Functions:

- `audio-cms`
- `audio-worker`
- `member-audio`

Apply migration:

- `20260708133000_rc71_audio_security_trust_boundary.sql`

After deployment, run security tests for RLS, worker rejection, upload ownership, approval rollback, and published-only playback.

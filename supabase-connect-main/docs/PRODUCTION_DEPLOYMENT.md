# Production Deployment

This guide covers the operational deployment checks for Kanisa Connect production candidates.

## Supabase Secrets

Configure these secrets in the production Supabase project:

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `AUDIO_WORKER_SECRET`
- Any provider credentials required by the Python audio worker runtime
- Frontend environment variables for the production Supabase URL and anon key

Keep service-role credentials server-side only.

## Edge Functions

Deploy and verify:

- `audio-cms`
- `audio-worker`
- `member-audio`
- `operations-health`
- `operations-metrics`

After deploy, invoke `operations-health` with an admin token and a production church ID.

## Python Worker Deployment

Deploy the Python audio worker with:

- Production Supabase URL
- Service-role key or worker-scoped secret path
- `AUDIO_WORKER_SECRET`
- Writable temporary processing directory
- Access to audio source, transcript, index, report, manifest, and alignment buckets

The worker must post heartbeat events through the operations heartbeat RPC or the worker endpoint payload.

## Storage Buckets

Confirm these private buckets exist:

- `audio`
- `audio-reports`
- `audio-indexes`
- `audio-transcripts`
- `audio-alignments`

Verify bucket policies after migration and confirm signed upload and signed playback URLs work.

## Cron Jobs

Register production schedules for:

- Audio worker heartbeat checks
- Queue depth alert checks
- Backup export checks
- Storage backup checks
- Post-deploy smoke test execution when appropriate

## Environment Variables

Frontend:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

Worker and scripts:

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `AUDIO_WORKER_SECRET`
- `SMOKE_ACCESS_TOKEN`
- `SMOKE_CHURCH_ID`
- `SMOKE_UPLOAD_JOB_ID` for signed upload verification
- `SMOKE_REVIEW_ID` for seeded review verification
- `SMOKE_VERSION_ID` for seeded publish verification
- `SMOKE_MEMBER_ACCESS_TOKEN` when member playback should use a separate member account

## Verification Checklist

- Database migrations applied.
- Edge Functions deployed.
- Storage buckets and policies verified.
- Operations page loads for church admins.
- `operations-health` reports database, storage, queue, worker, Python worker, and Edge Function status.
- `operations-metrics` reports queue depth, processing time, error rate, QA confidence, published audio, and pending reviews.
- Post-deployment smoke script passes or explicitly reports skipped optional checks.
- Monitoring alerts are routed to the operations owner.

## Rollback Procedure

1. Freeze deploys and assign an incident owner.
2. Roll back frontend artifact to the last known-good release.
3. Roll back Edge Functions to the last known-good deploy.
4. If a migration rollback is needed, restore from the latest validated backup rather than manually editing production state.
5. Re-run health checks and smoke tests.
6. Document impact, recovery time, and follow-up actions.

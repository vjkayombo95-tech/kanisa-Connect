# Operations Runbook

## Worker Stuck

Signals:

- Worker heartbeat is stale or missing.
- Queue depth is increasing while processing jobs stay flat.
- Jobs remain in processing stages longer than expected.

Recovery:

1. Check `/church-admin/operations`.
2. Confirm Python worker process health and logs.
3. Confirm `AUDIO_WORKER_SECRET` and Supabase service credentials.
4. Restart the worker.
5. Verify heartbeat returns within five minutes.
6. Retry failed or stale jobs through existing admin controls.

## Queue Growing

Signals:

- Queue length rises over the operating threshold.
- Average processing time increases.
- Worker status is online but throughput is low.

Recovery:

1. Confirm workers are online.
2. Inspect recent operational events for worker failures.
3. Check storage and database connectivity.
4. Scale worker capacity or pause new batch uploads.
5. Review failed jobs before retrying.

## Playback Failures

Signals:

- `playback_failure` operational events appear.
- Member playback returns no audio for expected published chapters.
- Signed URL creation fails.

Recovery:

1. Confirm the audio version is published.
2. Verify `audio_url` points to an object in the private `audio` bucket.
3. Confirm storage policies and signed URL generation.
4. Re-run member playback smoke test.
5. Restore missing audio object from storage backup if needed.

## Failed Uploads

Signals:

- Upload wizard reports a failed upload.
- Jobs remain in draft/uploading/validating.
- Required `audio_assets` rows are missing.

Recovery:

1. Confirm bucket reachability from Operations health.
2. Verify the signed upload URL path includes church ID and job ID.
3. Ask the admin to retry upload for the missing file.
4. Queue the job only after required assets are registered.

## Expired Signed URLs

Signals:

- Playback fails after long idle browser sessions.
- Storage logs show expired signed URLs.

Recovery:

1. Refresh the member playback page.
2. Confirm the `member-audio` Edge Function can create a fresh signed URL.
3. Inspect `playback_failure` events if refresh does not recover.
4. Verify service-role storage access and bucket object path.

## Recovery Procedures

- Use `docs/BACKUP_AND_RECOVERY.md` for database and storage recovery.
- Use `docs/PRODUCTION_DEPLOYMENT.md` for redeploying Edge Functions and worker runtime.
- Run `npm run smoke:postdeploy` after any recovery affecting audio, storage, workers, or publishing.

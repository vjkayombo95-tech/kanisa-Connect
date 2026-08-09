# RC-7.3 Release Checklist

## Security

- RC-7.1 security migrations applied.
- Reviewer and publisher boundaries verified.
- Member playback uses the approved production access path.

## Performance

- RC-7.2 pagination, aggregate metrics, lazy artifacts, and route-level splitting verified.
- Large review/job tables remain usable with production-sized fixtures.

## Mobile

- Upload wizard, job list, review page, Operations page, and member playback checked on phone and tablet viewports.

## Accessibility

- Keyboard navigation works for admin operations and audio review workflows.
- Buttons and status indicators have accessible labels or clear text.

## Database

- Production migrations applied in order.
- Operations tables, metrics RPCs, heartbeat RPC, and event logging trigger verified.
- RLS policies confirmed for operations visibility.

## Storage

- Audio buckets exist and are private.
- Signed upload and signed playback paths verified.
- Storage backup procedure tested.

## Worker

- Edge worker endpoint deployed.
- Python worker deployed.
- Worker heartbeat and Python worker heartbeat visible in Operations.
- Failed job retry path verified.

## Monitoring

- `operations-health` returns database, storage, Edge Functions, queue, worker, and Python worker checks.
- `operations-metrics` returns queue depth, average processing time, error rate, average QA confidence, published audio, and pending reviews.
- Operational events record job created, worker started, worker finished, approval, publishing, playback failures, and worker failures.

## Backup

- Database backup configured.
- Storage backup configured for audio and non-audio buckets.
- Audio index/report/manifest/alignment backup verified.

## Recovery

- `docs/RUNBOOK.md` reviewed by operations owner.
- Restore drill scheduled or completed.
- Rollback procedure tested in staging.

## Release Gate

- Production build compiles.
- Post-deployment smoke script passes in staging.
- Open RC-7 critical security and performance gates are closed or explicitly accepted.

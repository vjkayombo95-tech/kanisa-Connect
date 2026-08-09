# Backup and Recovery

This runbook describes operational backup and recovery expectations for Kanisa Connect.

## Backup Scope

Backups must cover:

- Supabase Postgres database.
- Supabase Storage buckets.
- Edge Function source and configuration.
- Hosting environment variables.
- Release artifacts or deployable commits.
- Operational documentation.

## Database Backups

Recommended production policy:

- Enable automated Supabase backups for the production project.
- Keep point-in-time recovery enabled where the plan supports it.
- Take a manual backup before major migrations or security hardening releases.
- Export schema and data snapshots before destructive maintenance.
- Store backup metadata outside the application database.

Minimum backup metadata:

- Timestamp.
- Environment.
- Supabase project ref.
- Migration/version deployed.
- Operator.
- Backup location.
- Restore test status.

## Storage Backups

Storage buckets contain user-visible and audit-relevant files. Back up:

- `avatars`
- `church-assets`
- `billing-receipts`
- `catholic-content`
- `record-preservation-proofs`
- `audio`
- `audio-reports`
- `audio-indexes`
- `audio-transcripts`
- `audio-alignments`

Recommended approach:

- Use Supabase storage export tooling or provider-level object replication.
- Preserve bucket names and object paths.
- Preserve private/public policy intent separately from file objects.
- Test signed URL behavior after restore for private buckets.

## Restore Procedure

Database restore:

1. Declare an incident and freeze deploys.
2. Identify recovery point objective and target restore time.
3. Export current logs and incident evidence.
4. Restore the database to a staging/recovery project first where possible.
5. Verify migrations, functions, RLS policies, and core data.
6. Restore storage objects matching the database recovery point.
7. Run smoke tests with member, church admin, finance, pastoral, and super admin accounts.
8. Promote restored environment or apply the validated restore to production.

Storage restore:

1. Restore bucket objects.
2. Confirm bucket policies.
3. Confirm public assets render.
4. Confirm private receipts/proofs are accessible only through intended paths.
5. Validate audio playback signed URLs for restored `audio` objects.
6. Validate upload paths for member photos, church assets, receipts, audio source files, transcripts, indexes, reports, manifests, and alignments.

Audio index restore:

1. Restore `audio-indexes`, `audio-reports`, `audio-transcripts`, and `audio-alignments` to the exact bucket/object paths stored in `audio_assets`, `audio_jobs`, and `audio_versions`.
2. Restore the corresponding database snapshot before exposing restored indexes to reviewers.
3. Confirm review pages lazy-load restored QA reports, alignment JSON, and manifests on demand.
4. Confirm published member playback works from the restored `audio` bucket.
5. Run the post-deployment smoke script against the recovery environment.

## Disaster Recovery Checklist

| Area | Check |
| --- | --- |
| Incident control | Incident owner assigned and deploys frozen. |
| Data safety | Latest backup identified and copied before restore. |
| Database | Tables, policies, functions, triggers, and grants restored. |
| Storage | Buckets, objects, and policies restored. |
| Auth | Users, redirect URLs, and providers verified. |
| Edge Functions | Functions redeployed with secrets and JWT settings. |
| Frontend | Correct build artifact deployed. |
| Security | Cross-tenant and receipt access tests pass. |
| Finance | Contributions, receipts, pledges, and platform fees reconcile. |
| Audio | Published playback, review artifacts, worker heartbeat, and queue metrics verified. |
| Communications | Stakeholders informed of status and expected recovery time. |

## Recovery Testing Recommendations

- Run a restore drill before parish pilot testing.
- Test restore into a non-production Supabase project.
- Verify at least one private storage object and one public storage object.
- Verify a contribution-to-receipt workflow after restore.
- Verify workspace routing for every role.
- Document actual recovery time and gaps.

## Recovery Objectives

Pilot targets:

| Objective | Target | Notes |
| --- | --- | --- |
| RPO | 24 hours or better | Align with Supabase backup plan and storage export schedule. |
| RTO | 4 hours for frontend rollback; 24 hours for full database/storage recovery | Full recovery depends on Supabase plan and operator availability. |

Production targets should be tightened after pilot traffic and support capacity are understood.

## Recovery Test Plan

Quarterly during pilot expansion, or before any major release:

1. Restore database backup into a recovery Supabase project.
2. Restore representative storage objects.
3. Deploy the latest frontend artifact against the recovery project.
4. Validate login, workspace routing, member records, contributions, receipts, prayer requests, Mass intentions, Bible, and daily readings.
5. Record actual recovery time, missing dependencies, and operator steps.

## Recovery Priorities

1. Authentication and route protection.
2. Member/church tenant data.
3. Contributions, receipts, pledges, and platform fees.
4. Storage receipts and proof files.
5. Dashboards and reports.
6. Catholic content and calendar data.
7. Analytics snapshots and generated artifacts.

## Outstanding Risks

- Live backup configuration must be verified in the Supabase dashboard.
- Storage export/replication process needs an operator-owned procedure.
- Recovery time objective and recovery point objective must be agreed with pilot parishes.

# Monitoring

## Current Logging Surface

Application:

- Environment validation logs startup status.
- Error boundary captures user-facing render failures.
- Client error logger records frontend errors in development and structured paths.
- Diagnostics overlays are development-only.

Platform:

- Supabase logs for Auth, Postgres, Storage, and Edge Functions.
- System jobs and job history pages.
- Audit logs for platform and church operations where implemented.
- Automation run history where available.

## Monitor These Signals

- Application errors.
- Authentication failures.
- Permission denials.
- Failed jobs.
- Failed imports.
- Slow queries.
- Automation failures.
- Storage upload failures.
- Invitation delivery failures.

## Health Checks

Recommended:

- Frontend route loads over HTTPS.
- Supabase REST endpoint responds.
- Auth sign-in test account works.
- Storage public asset renders.
- Private storage signed URL works.
- Edge Function invocation succeeds.
- Daily automations job status is healthy.

## Error Tracking

Recommended production setup:

- Add an external error tracking service after pilot approval.
- Capture route, workspace, role, environment, release tag, and correlation ID where possible.
- Do not capture secrets, tokens, payment references, or private pastoral notes.

## Performance Metrics

Track:

- Frontend load time.
- Dashboard query latency.
- Supabase error rate.
- Edge Function duration and failure count.
- Storage upload duration.
- Export/report duration.

## Audit Logging

Retain audit events for:

- Role changes.
- Church approval.
- Billing verification.
- Platform settings changes.
- Import execution.
- Super admin actions.

## Alerting Recommendations

Alert on:

- Production frontend unavailable.
- Supabase API unavailable.
- Auth failures spike.
- Edge Function failures.
- Daily automation failure.
- Storage upload failures.
- Critical platform health warning.

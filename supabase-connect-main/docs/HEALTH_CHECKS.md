# Health Checks

## Database

- Supabase SQL connection available.
- Core tables readable by expected roles.
- Migrations applied.
- RLS enabled.
- Recent backup available.

## Supabase API

- REST endpoint responds.
- Realtime status reviewed if enabled.
- Project ref matches environment.
- No production/staging project mismatch.

## Storage

- Public asset read works.
- Private signed URL read works.
- Upload works for expected bucket/path.
- Bucket policies match intended access.

## Authentication

- Login works.
- Logout works.
- Password reset email works.
- Invitation acceptance works.
- Role-based redirect works.

## Email

- Invitation email delivered.
- Password reset email delivered.
- Sender and reply-to are correct.
- Delivery failures are visible to operators.

## Automation

- Daily automations Edge Function is deployed.
- System job status is visible.
- Last run status is not failed.
- Failure logs are reviewed.

## AI

- Command Center opens.
- Non-AI intents route locally.
- AI-required actions show provider-required message.
- No AI provider key is required for v1.0 Pilot.

## Catholic Content

- Bible opens.
- Bible search parses whitespace variants.
- Daily readings load.
- Saints load.
- Liturgical calendar loads.

## Pilot Health Check Cadence

Daily during first week:

- Auth.
- Dashboards.
- Bible/daily readings.
- Prayer requests.
- Mass intentions.
- Contributions.
- Jobs/automation.
- Logs.

Weekly after stabilization:

- Full cross-role smoke test.
- Storage check.
- Backup verification.
- Performance review.

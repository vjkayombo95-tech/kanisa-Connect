# Staging Bootstrap

`scripts/bootstrap-staging.ts` creates and maintains the self-contained staging dataset used for UAT.

It is a server-side developer/QA tool. It must never run in the browser and it must never use frontend-exposed service credentials.

## Safety Guarantees

- Aborts unless `APP_ENV=staging`.
- Requires `SUPABASE_URL`.
- Requires `SUPABASE_SERVICE_ROLE_KEY`.
- Refuses to run if `VITE_SUPABASE_SERVICE_ROLE_KEY` is present.
- Does not write service-role keys to files, browser code, reports, or console output.
- Reset mode deletes only known bootstrap-owned records.
- Production is not modified unless someone deliberately points staging env variables at production, which is explicitly forbidden.

## Required Environment

Set these in a server-side shell session:

```bash
APP_ENV=staging
SUPABASE_URL=https://<staging-project-ref>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<staging-service-role-key>
STAGING_APP_URL=https://<staging-app-url>
```

`STAGING_APP_URL` is optional and defaults to `http://localhost:4173`.

## Normal Run

```bash
npm run bootstrap:staging
```

The script creates or updates:

- Super Admin test account
- Church Admin test account
- Member test account
- Demo Catholic Parish
- Profiles and user roles
- Member records
- Catholic saints from all Excel workbooks in `supabase/seed/saints/published`
- Placeholder daily readings if a `daily_readings` table exists
- Contributions
- Mass RSVP records
- Event attendance records
- Announcements
- Notifications
- One pending invitation

## Dry Run

```bash
npm run bootstrap:staging -- --dry-run
```

Dry-run mode validates the environment, reads staging state, loads seed workbooks, and reports what would be created or updated. It does not write to Supabase.

## Reset Mode

```bash
npm run bootstrap:staging -- --reset
```

Reset mode deletes only bootstrap-owned staging records:

- UAT auth users
- Demo Catholic Parish records
- Demo members, roles, contributions, announcements, notifications, invitations
- Seeded event attendance and Mass RSVP data
- Saint records imported from the published Excel packs

It does not delete unrelated staging data.

## Expected Output

Console output is structured JSON lines with:

- current step
- elapsed time
- action
- warnings/errors
- final summary

After a seed run, it also prints UAT credentials and the invitation link.

## Report

Every run writes:

```text
reports/bootstrap/bootstrap-report.json
```

The report includes:

- timestamp
- environment
- mode
- created/updated/skipped/failed counts
- duration
- warnings
- errors
- users
- church
- saint count
- contribution count
- attendance count
- notification count
- import summary
- health checks

## Health Checks

Seed mode verifies:

- Super Admin exists
- Church Admin exists
- Member exists
- Church exists
- Saints imported
- Saint of the Day query runs
- Catholic Library query returns active saints
- Liturgical Calendar query can query current-month saints
- Dashboard contribution totals are available
- Invitation token exists

Each check is recorded as `PASS`, `FAIL`, or `SKIP`.

## Troubleshooting

### APP_ENV error

Set:

```bash
APP_ENV=staging
```

The script will not run with `APP_ENV=production`.

### Missing service-role key

Set `SUPABASE_SERVICE_ROLE_KEY` only in your shell or CI secret store. Do not add it to `.env` files used by Vite.

### Daily readings skipped

The current app may use static Daily Readings placeholders. If staging does not have a `daily_readings` table, the bootstrap logs a warning and continues.

### Rerun creates duplicates

The script is designed to be idempotent. It matches records by stable identifiers such as email, church code, saint slug, payment reference, event title, Mass title/date/time, notification title, and invitation token.

### Reset did not remove something

Reset only removes records owned by the bootstrap identifiers listed above. Manually created staging test data is intentionally left untouched.

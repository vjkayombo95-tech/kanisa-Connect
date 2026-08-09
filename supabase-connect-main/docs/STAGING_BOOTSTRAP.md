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
- Targeted event UAT member accounts for Choir, Youth Ministry, General Member, and Multi-Group Member
- Demo Catholic Parish
- Profiles and user roles
- Member records
- Catholic saints from all Excel workbooks in `supabase/seed/saints/published`
- Placeholder daily readings if a `daily_readings` table exists
- One published CMS Prayer Library prayer
- Three published CMS Daily Readings rows for yesterday, today, and tomorrow
- One community and one ministry for the UAT member
- Choir and Youth Ministry fixtures for targeted event authorization UAT
- One member pledge with a partial payment state
- One member-visible channel and starter message
- One approved prayer request and comment
- One pending member Mass intention
- Contributions
- Mass RSVP records
- Event attendance records
- Five targeted event UAT parent events covering Choir-only, Youth-only, combined group, all-member, and public visibility
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
- CMS prayer and CMS Daily Readings rows owned by the UAT identifiers
- UAT community, ministry, pledge, channel, prayer request, and Mass intention records
- UAT Choir and Youth Ministry records, targeted event memberships, event targets, and targeted event parent rows
- Seeded event attendance and Mass RSVP data owned by known bootstrap event titles
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
- CMS prayer count
- CMS daily reading count
- contribution count
- attendance count
- pledge count
- ministry count
- channel count
- prayer request count
- Mass intention count
- notification count
- targeted event count
- import summary
- health checks

## Health Checks

Seed mode verifies:

- Super Admin exists
- Church Admin exists
- Member exists
- Choir Member exists
- Youth Member exists
- General Member exists
- Multi-Group Member exists
- Church exists
- Saints imported
- Saint of the Day query runs
- Catholic Library query returns active saints
- Liturgical Calendar query can query current-month saints
- Dashboard contribution totals are available
- Member UAT CMS prayer exists
- Member UAT CMS Daily Readings exist
- Member UAT pledge exists
- Member UAT channel exists
- Member UAT prayer request exists
- Member UAT Mass intention exists
- Choir and Youth Ministry fixtures exist
- Targeted event member-to-ministry assignments match the UAT matrix
- Targeted event audience modes and target rows match the UAT matrix
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

The script still seeds the legacy `daily_readings` table when it exists. It also seeds `content_daily_readings` when the CMS table exists. If either table is absent, the bootstrap logs a warning or skipped check and continues.

### Rerun creates duplicates

The script is designed to be idempotent. It matches records by stable identifiers such as email, church code, saint slug, CMS prayer slug, CMS reading celebration/date, community name, ministry name, channel name, prayer request text, Mass intention message, payment reference, event title, event audience target `(event_id, ministry_id/community_id)`, Mass title/date/time, notification title, and invitation token.

### Reset did not remove something

Reset only removes records owned by the bootstrap identifiers listed above. Manually created staging test data is intentionally left untouched.

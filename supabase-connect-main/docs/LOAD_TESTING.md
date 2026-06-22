# Load testing

The `/load-tests` directory contains k6 scripts only; no tests have been executed.

Prerequisites: a deployed staging URL, staging Supabase URL/anon key, and dedicated staging test users. Create test users manually and obtain short-lived access tokens through a normal staging login. Never put production credentials or tokens in a shell history, git file, or CI log.

Set environment values in a secure terminal session, then choose one script:

```text
BASE_URL=https://staging.example.com
SUPABASE_URL=https://<staging-ref>.supabase.co
SUPABASE_ANON_KEY=<staging-anon-key>
TEST_ACCESS_TOKEN=<staging-user-jwt>
TEST_CHURCH_ID=<seeded-church-id>
TEST_MEMBER_ID=<seeded-member-id>
k6 run load-tests/announcements.js
```

Scripts: `public-portal.js`, `member-login.js`, `contribution-history.js`, `announcements.js`, `analytics.js`, and `church-admin-dashboard.js`. The login script additionally requires `TEST_USER_EMAIL` and `TEST_USER_PASSWORD`.

Start at 5–10 virtual users and increase only after watching Supabase database CPU, API latency/error rates, Auth limits, egress, and Netlify bandwidth. The scripts deliberately reject targets whose `BASE_URL` contains `production`; confirm the staging project ref manually too. Record p50/p95/p99 latency, error rate, database CPU, and rate-limit responses after each run.

# Deployment Guide

## Prerequisites

- Approved `staging` commit or release tag.
- Node.js and npm compatible with the project.
- Access to hosting provider.
- Access to target Supabase project.
- Access to Supabase Auth, Storage, Edge Functions, and logs.
- Completed `docs/RELEASE_CHECKLIST.md`.

## Hosting Requirements

- Static hosting for Vite output in `dist/`.
- HTTPS with valid TLS.
- SPA fallback to `index.html`.
- Environment variable management.
- Rollback to previous deployment artifact.
- Log or deployment event history.

## Supabase Setup

- Apply all migrations.
- Verify RLS policies.
- Verify security-definer RPC grants.
- Verify Auth redirect URLs.
- Verify Edge Functions.
- Verify storage buckets and policies.

## Environment Variables

See `docs/ENVIRONMENT_SETUP.md`.

Minimum production frontend variables:

```env
VITE_APP_ENV=production
VITE_SUPABASE_URL=https://<production-project-ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<production-public-client-key>
VITE_EXPECTED_SUPABASE_PROJECT_REF=<production-project-ref>
VITE_ENABLE_PLEDGE_REALTIME=false
```

## Storage Buckets

Verify:

- `avatars`
- `church-assets`
- `billing-receipts`
- `catholic-content`
- `record-preservation-proofs`

Confirm public/private policy intent before deploying.

## Authentication

- Confirm production site URL.
- Confirm redirect URLs.
- Confirm password reset email flow.
- Confirm invitation email flow.
- Confirm role-based routing after login.

## Email Configuration

- Confirm sender domain.
- Confirm invitation delivery.
- Confirm password reset delivery.
- Confirm spam/junk behavior with pilot users.
- Confirm support contact for undelivered mail.

## Edge Functions

Deploy and verify:

- `send-invitation`
- `daily-automations`

Confirm function secrets are stored in Supabase, not frontend env vars.

## Deployment Steps

1. Confirm release commit.
2. Run `npm run test`.
3. Run `npm run build`.
4. Confirm production env vars.
5. Deploy `dist/`.
6. Confirm app boot.
7. Run post-deployment verification.
8. Monitor logs for the first pilot window.

## Post-Deployment Verification

- Login.
- Forgot password.
- Member dashboard.
- Pastoral dashboard.
- Church Admin dashboard.
- Finance dashboard.
- Super Admin dashboard.
- Bible search.
- Daily readings.
- Prayer requests.
- Mass intentions.
- Contributions.
- Announcements.
- Calendar.
- Storage upload/read paths.

## Rollback Procedure

Frontend rollback:

1. Freeze deploys.
2. Identify last known good artifact.
3. Redeploy the artifact with unchanged production env vars.
4. Smoke test login and dashboard routes.
5. Preserve logs and document the incident.

Database rollback:

- Prefer forward-fix migrations.
- Take a fresh backup before any emergency SQL.
- Restore in a recovery project first when possible.
- Validate RLS, functions, storage, and cross-role access before promoting.

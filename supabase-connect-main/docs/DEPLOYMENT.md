# Deployment

This guide describes how to deploy Kanisa Connect to staging or production without changing application behavior.

## Prerequisites

- Node.js compatible with the checked-in Vite/React toolchain.
- npm installed.
- Access to the target hosting provider.
- Access to the target Supabase project.
- A reviewed environment configuration. See `docs/PRODUCTION_CONFIGURATION.md`.
- A passing UAT run for the release candidate being promoted. See `docs/UAT_CHECKLIST.md`.

## Environment Variables

Required frontend variables:

- `VITE_APP_ENV`
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY` or `VITE_SUPABASE_PUBLISHABLE_KEY`
- `VITE_EXPECTED_SUPABASE_PROJECT_REF`

Optional frontend variables:

- `VITE_ENABLE_PLEDGE_REALTIME`

Rules:

- Never expose a Supabase service-role key in any `VITE_*` variable.
- Production must use `VITE_APP_ENV=production`.
- `VITE_EXPECTED_SUPABASE_PROJECT_REF` must match the project ref in `VITE_SUPABASE_URL`.
- Staging and production should use separate Supabase projects.

## Supabase Setup

Before deploying the frontend:

1. Confirm all required migrations have been applied to the target Supabase project.
2. Confirm RLS is enabled on tenant-scoped tables.
3. Confirm security-definer RPCs have expected grants and final definitions.
4. Confirm Auth redirect URLs include the deployment domain.
5. Confirm Edge Functions are deployed where used:
   - `daily-automations`
   - `send-invitation`
6. Confirm `send-invitation` requires JWT verification in `supabase/config.toml`.

Production promotion should be done from a reviewed migration state, not by editing the live database manually.

## Storage Buckets

Verify these buckets exist and have production policies:

| Bucket | Purpose | Access expectation |
| --- | --- | --- |
| `avatars` | Public/member avatar uploads. | Public URL usage with upload constraints. |
| `church-assets` | Church branding and content images. | Scoped uploads; public reads where required. |
| `billing-receipts` | Billing receipt documents. | Private/scoped access. |
| `catholic-content` | Saints and Catholic content images. | Public read where required. |
| `record-preservation-proofs` | Member record proof uploads. | Private/scoped access. |

Do not broaden storage policies to fix a frontend access issue. Verify the intended folder/path expression first.

## Building

Install dependencies:

```bash
npm install
```

Run the production build:

```bash
npm run build
```

Expected result:

- Build exits successfully.
- Known warnings may include stale Browserslist data and large chunks for PDF/export/scanner/chart features.

## Deploying

1. Create a release branch or tag from the approved staging commit.
2. Confirm environment variables are configured in the hosting provider.
3. Run `npm run build`.
4. Deploy the generated `dist/` output.
5. Confirm the deployed app boots without the configuration error screen.
6. Smoke test:
   - Login.
   - Member dashboard.
   - Quick Give.
   - Contribution History.
   - Receipt.
   - Church Admin dashboard.
   - Finance dashboard.
   - Calendar.
   - Super Admin access.
7. Review application logs and Supabase logs immediately after deploy.

## Rollback Procedure

Frontend-only rollback:

1. Identify the last known good deployment artifact or commit.
2. Redeploy that artifact with the same production environment variables.
3. Confirm login and dashboard routes load.
4. Review logs for repeated startup/configuration errors.

Database rollback:

- Prefer forward-fix migrations.
- Do not manually drop policies/functions in production unless an incident commander approves the SQL.
- If a migration must be reverted, first take a fresh database backup and export affected storage paths.

Emergency rollback checklist:

- Freeze new deploys.
- Disable risky feature flags where possible.
- Preserve logs.
- Restore the previous frontend artifact.
- Confirm Supabase project ref still matches production.
- Run the smoke test.
- Document cause, impact, and follow-up action.

## Post-Deployment Checklist

- `npm run build` passed for the deployed commit.
- Production environment variables match `docs/PRODUCTION_CONFIGURATION.md`.
- Supabase Auth redirect URLs include production domain.
- Storage policies verified.
- UAT checklist executed for critical flows.
- Error logs checked.
- No cross-tenant access findings.
- Rollback artifact identified.

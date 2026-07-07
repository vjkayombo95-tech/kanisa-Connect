# Production Configuration

This document defines the client-side configuration required to deploy Kanisa Connect safely to staging and production.

## Required Environment Variables

| Variable | Required In | Purpose | Example |
| --- | --- | --- | --- |
| `VITE_APP_ENV` | All environments | Declares runtime environment. Must be `development`, `staging`, `production`, or `test`. | `production` |
| `VITE_SUPABASE_URL` | All environments | Supabase project API URL. Must be an HTTPS `<project-ref>.supabase.co` URL. | `https://exampleproject.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | All environments unless publishable key is used | Supabase public anon client key. Never use a service-role key. | `eyJ...` |
| `VITE_EXPECTED_SUPABASE_PROJECT_REF` | Staging and production | Deployment guard that must match the project ref in `VITE_SUPABASE_URL`. | `exampleproject` |

`VITE_SUPABASE_PUBLISHABLE_KEY` can be used instead of `VITE_SUPABASE_ANON_KEY` for new Supabase projects. If both are set, the publishable key is used and a startup warning is emitted in development.

## Optional Environment Variables

| Variable | Purpose | Default |
| --- | --- | --- |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Preferred public Supabase browser key when available. | unset |
| `VITE_ENABLE_PLEDGE_REALTIME` | Enables pledge realtime subscription behavior. | `false` |

## Startup Diagnostics

Startup validation is centralized in `src/lib/environment.ts`.

The app validates:

- `VITE_APP_ENV` is one of the supported values.
- Supabase URL and client key exist.
- Supabase URL is a valid HTTPS Supabase project URL.
- Staging/production deployments include `VITE_EXPECTED_SUPABASE_PROJECT_REF`.
- The expected project ref matches the configured Supabase URL.
- Placeholder keys are rejected.
- Service-role-like client keys are rejected.

When configuration is invalid, the app shows a setup screen before initializing authenticated application routes. This prevents silent failures and avoids partially booting against an unintended Supabase project.

## Deployment Examples

### Local Development

```env
VITE_APP_ENV=development
VITE_SUPABASE_URL=https://your-dev-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-dev-anon-key
VITE_EXPECTED_SUPABASE_PROJECT_REF=your-dev-project
VITE_ENABLE_PLEDGE_REALTIME=false
```

### Staging

```env
VITE_APP_ENV=staging
VITE_SUPABASE_URL=https://your-staging-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-staging-anon-key
VITE_EXPECTED_SUPABASE_PROJECT_REF=your-staging-project
VITE_ENABLE_PLEDGE_REALTIME=false
```

### Production

```env
VITE_APP_ENV=production
VITE_SUPABASE_URL=https://your-production-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-production-anon-key
VITE_EXPECTED_SUPABASE_PROJECT_REF=your-production-project
VITE_ENABLE_PLEDGE_REALTIME=false
```

## Supabase Configuration Checklist

| Area | Production Requirement | Status |
| --- | --- | --- |
| Auth | Email/phone auth settings match deployed domains and redirect URLs. | Review before pilot |
| RLS | Client writes depend on RLS/RPC authorization, not route protection alone. | Required |
| RPCs | SECURITY DEFINER functions include explicit auth and church/member ownership checks. | Required |
| Public keys | Only anon or publishable keys are exposed to the browser. | Required |
| Service-role key | Never set in any `VITE_*` variable. | Required |
| Project ref guard | `VITE_EXPECTED_SUPABASE_PROJECT_REF` matches production Supabase URL. | Required |

## Storage Configuration Checklist

The application references these buckets:

| Bucket | Usage | Public |
| --- | --- | --- |
| `avatars` | Public registration member avatar uploads. | Public URL usage |
| `church-assets` | Church branding, logos, and entity images. | Public URL usage |
| `billing-receipts` | Subscription/billing receipt uploads and signed reads. | Private |
| `catholic-content` | Saint/Catholic content image assets. | Public URL usage |
| `record-preservation-proofs` | Member record preservation payment proof files. | Private/scoped |

Before production, verify bucket existence, RLS/storage policies, max file size, allowed MIME types, and signed URL behavior for private buckets.

## Feature Flag Configuration

| Flag | Expected Values | Notes |
| --- | --- | --- |
| `VITE_ENABLE_PLEDGE_REALTIME` | `true` or `false` | Keep disabled unless realtime policy and load behavior have been tested. |

Feature access for app modules is primarily controlled through the existing feature access system and role/workspace routing, not environment variables.

## Build Configuration

The Vite build currently uses manual vendor chunking for React, Supabase, TanStack Query, Radix UI, framer-motion, icons, dates, scanner libraries, and utility packages.

Production build command:

```bash
npm run build
```

Known build warnings:

- Browserslist data may be stale unless dependency metadata is updated.
- PDF/export/analytics chunks may exceed 500 kB after minification.

## Production Checklist

| Check | Required Before Pilot |
| --- | --- |
| `.env.production` or host environment contains all required variables. | Yes |
| `VITE_APP_ENV=production`. | Yes |
| `VITE_EXPECTED_SUPABASE_PROJECT_REF` matches the production Supabase URL. | Yes |
| No service-role key appears in any frontend build variable. | Yes |
| Supabase Auth redirect URLs include production domain. | Yes |
| Storage buckets and policies are deployed. | Yes |
| `npm run build` passes. | Yes |
| UAT checklist in `docs/UAT_CHECKLIST.md` has been executed. | Yes |

## Outstanding Risks

- Some existing pages still log development/debug errors directly with `console.error` or `console.warn`; these should continue moving toward the shared error logger.
- The production build still reports large chunk warnings for analytics, PDF, export, and scanner dependencies.
- Environment validation can detect obvious service-role JWT claims and placeholder values, but final secret hygiene still depends on deployment platform variable review.

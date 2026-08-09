# Environment Setup

## Overview

Kanisa Connect uses Vite client environment variables for browser-safe configuration and separate server/script variables for privileged operations.

Startup validation is centralized in `src/lib/environment.ts`. The app rejects missing Supabase configuration, project-ref mismatches, placeholder keys, and service-role-like keys exposed through Vite variables.

## Frontend Variables

Required:

| Variable | Development | Staging | Production | Notes |
| --- | --- | --- | --- | --- |
| `VITE_APP_ENV` | `development` | `staging` | `production` | Must be one of `development`, `staging`, `production`, or `test`. |
| `VITE_SUPABASE_URL` | Required | Required | Required | Must be an HTTPS `<project-ref>.supabase.co` URL. |
| `VITE_SUPABASE_ANON_KEY` | Required unless publishable key is used | Required unless publishable key is used | Required unless publishable key is used | Browser-safe public client key only. |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Optional | Optional | Optional | Preferred for new Supabase projects when available. Takes precedence over anon key. |
| `VITE_EXPECTED_SUPABASE_PROJECT_REF` | Recommended | Required | Required | Must match the project ref in `VITE_SUPABASE_URL`. |

Optional:

| Variable | Default | Notes |
| --- | --- | --- |
| `VITE_ENABLE_PLEDGE_REALTIME` | `false` | Keep disabled unless realtime policy and load behavior have been tested. |

## Server And Script Variables

Use these only in local secure shells, CI secret stores, or trusted server environments:

| Variable | Used By | Notes |
| --- | --- | --- |
| `SUPABASE_URL` | Import/bootstrap scripts, analytics server | May mirror `VITE_SUPABASE_URL` in trusted environments. |
| `SUPABASE_ANON_KEY` | Analytics server | Public client key for server proxy use. |
| `SUPABASE_SERVICE_ROLE_KEY` | Bootstrap/import scripts | Never expose through any `VITE_*` variable. |
| `SUPABASE_DB_URL` | Staging migration repair scripts | Temporary shell value only. |
| `SUPABASE_PRODUCTION_DB_URL` | Production promotion/baseline scripts | Temporary shell value only. |
| `PORT` | Analytics assistant server | Defaults to `8787`. |

## Local Edge Function Secrets

Local Edge Function provider secrets live in `supabase/functions/.env.local`.
This file is for the Supabase function runtime only and must not be loaded by Vite.

Bible Audio local function variables:

| Variable | Used By | Notes |
| --- | --- | --- |
| `ELEVENLABS_API_KEY` | `generate-bible-audio` Edge Function | Required for local provider calls. Never expose through `VITE_*`. |
| `ELEVENLABS_VOICE_ID` | `generate-bible-audio` Edge Function | Required voice configuration. Never accept this from the browser. |
| `ELEVENLABS_MODEL_ID` | `generate-bible-audio` Edge Function | Optional. Defaults to `eleven_multilingual_v2`. |
| `BIBLE_AUDIO_VERSION` | `generate-bible-audio` Edge Function | Optional. Defaults to the function's built-in Bible Audio version. |

Use this command when serving the function locally:

```powershell
supabase functions serve generate-bible-audio --env-file supabase/functions/.env.local
```

Rotate local ElevenLabs credentials by replacing the local value, restarting the local function process, and revoking the old key in ElevenLabs. Do not commit local secret files or paste provider values into documentation, reports, logs, or browser-visible environment variables.

## Safety Rules

- Never set `VITE_SUPABASE_SERVICE_ROLE_KEY`.
- Never expose provider secrets through any `VITE_*` variable.
- Never commit live `.env` values.
- Keep staging and production Supabase projects separate.
- Keep production secrets in the hosting provider or CI secret store.
- Do not use placeholder values in staging or production.

## Development Checklist

- [ ] Copy `.env.example` to `.env.local`.
- [ ] Set `VITE_APP_ENV=development`.
- [ ] Set a development Supabase URL and public key.
- [ ] Run `npm run test`.
- [ ] Run `npm run build` before opening a release PR.

## Staging Checklist

- [ ] Use `.env.staging.example` as a template.
- [ ] Set `VITE_APP_ENV=staging`.
- [ ] Confirm `VITE_EXPECTED_SUPABASE_PROJECT_REF` matches staging.
- [ ] Confirm the staging banner appears.
- [ ] Confirm no production project ref appears in the browser console.

## Production Checklist

- [ ] Set `VITE_APP_ENV=production`.
- [ ] Set production `VITE_SUPABASE_URL`.
- [ ] Set public Supabase anon or publishable key.
- [ ] Set `VITE_EXPECTED_SUPABASE_PROJECT_REF`.
- [ ] Confirm the app does not render the configuration rejection screen.
- [ ] Confirm no service-role key exists in frontend environment variables.

## Failure Behavior

If configuration is invalid, the app reports clear validation errors and disables the Supabase client rather than connecting to an unintended project.

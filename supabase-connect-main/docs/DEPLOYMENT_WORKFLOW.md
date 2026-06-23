# Kanisa Connect Deployment Workflow

## Overview

Kanisa Connect uses separated staging and production environments to prevent accidental production changes.

Development changes must be tested in staging before production release.

---

# Environments

## Staging

Supabase Project:

nunfrjcuimaytydnaqtt

Purpose:

- Development testing
- Migration validation
- Feature verification
- Pre-production checks


## Production

Supabase Project:

cbaxiiqlzrwvmuplhusm

Purpose:

- Live users
- Stable releases only

---

# Database Deployment

The generic SUPABASE_DB_URL environment variable must NOT be stored permanently.

Always choose the target environment manually.

---

## Deploy migrations to staging

```powershell
$env:SUPABASE_DB_URL=$env:SUPABASE_STAGING_DB_URL

supabase db push
```

---

## Deploy migrations to production

Production deployment happens only after:

1. Testing completed on staging
2. Pull Request merged into main
3. Release approved


```powershell
$env:SUPABASE_DB_URL=$env:SUPABASE_PRODUCTION_DB_URL

supabase db push
```

---

# Git Workflow

Development flow:

```
local development

        ↓

staging branch

        ↓

Pull Request

        ↓

main branch

        ↓

production deployment
```

Never push directly to main.

---

# Daily Automation Architecture

Automation execution:

```
Supabase Cron

        ↓

daily-automations Edge Function

        ↓

SERVICE_ROLE authentication

        ↓

run_daily_automations()

        ↓

Announcements
Automation logs
Run history
```

Schedule:

```
06:00 Tanzania Time (EAT)
03:00 UTC
```

---

# Safety Rules

- Never expose service_role keys in frontend code
- Never keep production as the default database target
- Always verify migrations in staging first
- Production changes require intentional selection

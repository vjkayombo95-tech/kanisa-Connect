# Security Review

## Summary

The v1.0 Pilot Edition security posture is acceptable for controlled pilot deployment after live environment verification.

## Authentication

- Supabase Auth is the authentication provider.
- Production redirect URLs must be verified before launch.
- Password reset and invitation flows must be smoke tested.

## Role Permissions

- Workspace role assignment uses church-scoped role data.
- Church admins can manage church-scoped roles through RPCs rather than direct table writes.
- Super admin access must follow `docs/SECURITY_ADMIN_BOOTSTRAP.md`.

## Workspace Permissions

- Primary workspace routing is centralized through the Workspace Framework.
- Member, Pastoral, Church Admin, Finance, and Super Admin route groups are separated.
- Community Leader routes remain a documented legacy exception.

## Route Guards

- Authenticated routes should remain behind protected route logic.
- Deep links must be tested for every role before pilot launch.
- Browser refresh must not bypass workspace resolution.

## API Exposure

- Browser code uses public Supabase client keys only.
- Service-role keys are restricted to trusted scripts, CI, Supabase functions, or secure operator shells.
- No service-role key may be stored in a `VITE_*` variable.

## Storage Access

Buckets requiring verification:

- `avatars`
- `church-assets`
- `billing-receipts`
- `catholic-content`
- `record-preservation-proofs`

Private receipts and proof files must not be publicly readable.

## Secrets

- Keep production secrets in hosting/Supabase secret stores.
- Do not commit `.env.local`, production env files, database URLs, or service-role keys.
- Rotate keys if they are exposed during pilot setup.

## RLS Usage

- RLS must be enabled for tenant-scoped tables.
- Live RLS policies must be verified against member, church admin, finance, pastoral, and super admin accounts.
- Do not weaken RLS to fix UI issues.

## Findings

| Severity | Finding | Status |
| --- | --- | --- |
| High | Live Supabase/storage/Auth policy state must be verified before pilot. | Open operational task |
| Medium | Community Leader routes remain outside primary Workspace Framework. | Documented debt |
| Medium | Browser smoke tests for cross-role access should be automated. | Recommended |
| Low | Some older pages still need final accessibility/table polish. | Recommended |

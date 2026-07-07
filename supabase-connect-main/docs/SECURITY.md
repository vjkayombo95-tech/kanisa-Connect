# Security

This document summarizes the production security model for Kanisa Connect.

## Authentication

Kanisa Connect uses Supabase Auth. Production must verify:

- Redirect URLs match deployed domains.
- Email/phone provider settings are correct.
- Password and session policies are appropriate for pilot use.
- CAPTCHA/rate limits are enabled where available.
- No authentication secrets are exposed to the browser.

## Authorization

Authorization must be enforced by the database and RPCs, not by route protection alone.

Role families:

- Member.
- Pastoral/priest.
- Church admin.
- Finance/treasurer.
- Super admin.

Frontend role resolution controls navigation and workspace selection. It is not the final authorization boundary.

## Row Level Security

RLS expectations:

- Tenant-scoped tables filter by `church_id`.
- Member-owned tables verify `members.user_id = auth.uid()` where ordinary members write or read private rows.
- Privileged church roles are limited to their church.
- Super admin access is explicit and audited.
- Public flows expose only minimal data through intentionally designed RPCs or policies.

Production checks:

- Inventory enabled RLS tables.
- Verify no permissive `USING (true)` policies exist on sensitive tables.
- Test cross-church read/write failures with real accounts.
- Test receipt and contribution ownership.

## RPC Security

Security-definer RPCs must:

- Set a safe `search_path`.
- Check `auth.uid()`.
- Check church membership.
- Check row ownership or privileged role.
- Validate amount/status/state transitions.
- Preserve idempotency for payment-like operations.
- Avoid returning raw internal errors to users.

High-risk RPCs include contribution recording, community help transactions, pledge review, invitation flows, public lookups, and analytics/reporting functions.

## Secrets Management

Rules:

- Never commit secrets.
- Never expose service-role keys in `VITE_*` variables.
- Keep Supabase service-role keys only in trusted server/Edge Function environments.
- Rotate secrets after suspected exposure.
- Review hosting provider environment variables before production deploy.

Frontend-safe variables are documented in `docs/PRODUCTION_CONFIGURATION.md`.

## Storage Policies

Storage policies must match bucket sensitivity:

- Public content buckets may allow public read where intended.
- Private receipt/proof buckets must require authenticated ownership or privileged role.
- Upload paths should include church/member ownership where possible.
- Folder path expressions must use the correct `storage.objects` path references.

Never broaden storage access to work around a frontend bug.

## Security Best Practices

- Treat route guards as UX only.
- Prefer validated RPCs for multi-write financial workflows.
- Keep payment verification separate from user-submitted references.
- Log security-relevant failures without exposing raw internals to users.
- Review role assignments regularly.
- Run cross-tenant tests before every production promotion.
- Keep imports and migrations out of ad hoc production SQL sessions.

## Related Security Documents

- `docs/security-audit-report.md`
- `docs/payment-permission-audit.md`
- `docs/error-log-security.md`
- `docs/ERROR_HANDLING.md`
- `docs/PRODUCTION_CONFIGURATION.md`

## Open Risks

- Live Supabase project settings must be verified outside the repository.
- Storage policies require live bucket verification.
- Payment-provider verification remains a separate operational/product concern where manual payment references are accepted.

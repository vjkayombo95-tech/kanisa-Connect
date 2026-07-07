# Operations

This guide describes routine production operations for Kanisa Connect.

## Routine Maintenance

Daily:

- Review application error logs.
- Review Supabase Auth and API errors.
- Check payment/contribution anomalies.
- Confirm scheduled automations have run.
- Check storage upload failures.

Weekly:

- Review pending invitations and inactive users.
- Review failed imports and content sync issues.
- Check bundle/build warnings for new releases.
- Review security audit events and unusual access patterns.
- Confirm backups completed.

Monthly:

- Run restore drill or backup verification.
- Review role assignments.
- Review storage usage and large files.
- Review performance reports and slow routes.
- Re-run UAT checklist against staging.

## User Management

User and role operations should follow least privilege:

- Ordinary members use member workspace only.
- Pastoral users receive pastoral roles only where needed.
- Finance users receive finance/treasurer capabilities only where needed.
- Church admins manage parish operations.
- Super admin is reserved for platform operators.

Operational rules:

- Do not assign super admin from parish-level workflows.
- Remove access promptly when staff leave.
- Review stale invitations.
- Use route protection for UX only; database authorization must remain authoritative.

## Church Onboarding

Checklist:

1. Create or verify church record.
2. Configure church name, code, slug, contact details, and branding.
3. Confirm admin owner/member linkage.
4. Configure feature access for the parish.
5. Confirm storage folders and upload behavior.
6. Invite church admins, finance users, and pastoral users.
7. Test member registration or invitations.
8. Run dashboard smoke tests.
9. Confirm giving, receipts, announcements, events, and calendar.
10. Record onboarding notes and risks.

## Content Imports

Supported import/content areas include:

- Bible extraction/import scripts.
- Liturgy import.
- Daily readings.
- Saints/Catholic content.
- Parish data imports.

Operational rules:

- Run imports first in staging.
- Validate row counts and error reports.
- Keep source files for auditability.
- Do not bypass importer validation with direct production SQL.
- For large imports, verify performance and rollback plan.

Relevant scripts:

```bash
npm run bible:validate
npm run bible:import
npm run import:liturgy
```

## Log Review

Review:

- App error logs.
- Supabase logs.
- Edge Function logs.
- Auth logs.
- Security audit events.
- Payment/contribution anomalies.
- Import logs.

Use the shared logging policy in `docs/ERROR_HANDLING.md`.

Escalate immediately if logs show:

- Cross-tenant access attempts.
- Receipt access failures involving another member's receipt.
- Repeated RPC authorization errors.
- Repeated failed uploads to private buckets.
- Service-role key exposure.
- Payment/contribution write failures.

## Monitoring

Recommended monitors:

- Frontend availability.
- Login success rate.
- Supabase API error rate.
- Edge Function error rate.
- Contribution creation failures.
- Receipt page failures.
- Storage upload failures.
- Slow dashboard route loads.
- Scheduled automation failures.

During pilot testing, collect device/browser notes for low-end Android and 3G conditions.

## Release Process

1. Merge approved changes into staging.
2. Run `npm run build`.
3. Run targeted smoke tests.
4. Execute UAT checklist for affected domains.
5. Review security/configuration/performance docs for release-specific risks.
6. Tag or identify release commit.
7. Deploy to production.
8. Run production smoke tests.
9. Monitor logs for at least one operating window.
10. Record release notes in `docs/CHANGELOG.md`.

## Incident Response

1. Assign incident owner.
2. Preserve logs and screenshots.
3. Identify affected roles/churches.
4. Freeze deployments if data/security risk exists.
5. Disable feature flags where possible.
6. Restore or roll forward using documented procedure.
7. Communicate status to stakeholders.
8. Document root cause and follow-up.

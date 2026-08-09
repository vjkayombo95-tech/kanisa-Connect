# Known Limitations

This document lists Version 1.0 RC1 limitations that are accepted for pilot readiness or postponed to Version 1.1.

## Large Vendor Chunks

Known large chunks:

- `pdf-vendor` for analytics PDF generation.
- `xlsx-vendor` for spreadsheet workflows.
- `scanner-vendor` for QR scanning.
- `charts-vendor` for chart-heavy reports.
- `jspdf-vendor` and `html2canvas-vendor` for PDF/image export workflows.

Status:

- These libraries are isolated behind route or feature boundaries.
- Normal dashboard startup does not need to execute every heavy library.
- Build warnings remain expected.

Version 1.1 options:

- Move expensive PDF generation server-side.
- Split report tabs more aggressively.
- Add route-level prefetch only after measuring pilot behavior.
- Replace heavy client export libraries where practical.

## Remaining Accessibility Debt

Known remaining items:

- Some legacy icon-only buttons still need explicit `aria-label` review.
- Many data tables need captions or `aria-describedby`.
- Blank action table headers should use visually hidden text.
- Some older forms need consistent `id` and `htmlFor` associations.
- Muted text contrast should be manually checked in dense tables/cards.
- Full screen reader testing is still required on real devices.

Version 1.1 options:

- Add automated axe checks to CI.
- Create shared table caption/action-header helpers.
- Add form-field wrappers for older admin forms.
- Complete TalkBack/VoiceOver testing for pilot-critical flows.

## Production Configuration Items Requiring Live Verification

Repository checks cannot prove live configuration. Verify:

- Supabase Auth redirect URLs.
- Supabase Auth CAPTCHA/rate limits/password policy.
- Live RLS policy state.
- SECURITY DEFINER function owners, grants, and final definitions.
- Storage bucket existence and policies.
- Edge Function deployment and secrets.
- Database backups and point-in-time recovery.
- Storage backup/export process.
- Hosting environment variables.
- Production domain/TLS.

## Security Assumptions

Known assumptions:

- Route protection is not treated as a security boundary.
- RLS/RPC/storage policies must enforce authorization.
- Feature gates control UX/navigation only.
- Manual payment references are operational declarations unless provider verification is configured.

Version 1.1 options:

- Add deeper automated cross-tenant tests.
- Add live security verification scripts.
- Expand payment-provider webhook verification.
- Add richer audit dashboards for high-risk financial and role actions.

## Offline and Low-Bandwidth Limitations

Current state:

- The app uses lazy loading, React Query caches, offline cache helpers, and skeletons.
- Some workflows still require live connectivity.
- Offline messaging is not uniform across every domain.

Version 1.1 options:

- Add explicit offline banners for all workspaces.
- Expand safe offline read caches.
- Add retry affordances on more failed query states.
- Gather real pilot telemetry on low-end Android devices.

## Future Enhancements Postponed to Version 1.1

- Notification delivery workflows.
- Calendar reminders.
- Volunteer scheduling.
- Sacramental workflows for baptisms, weddings, funerals, and certificates.
- More advanced finance reconciliation.
- Server-side analytics/PDF generation.
- Diocesan/multi-parish views.
- More complete monitoring dashboards.
- Automated accessibility and cross-tenant regression tests.

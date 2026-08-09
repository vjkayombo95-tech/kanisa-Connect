# Parish Invite Hub

## Architecture

The Parish Invite Hub lives at the existing Church Admin invitation route:

`/church-admin/roles`

It reuses the Workspace Framework and the existing `RolesPage` route. No new layout, sidebar, authentication architecture, payment layer, Bible layer, liturgical layer, AI provider, or automation engine was introduced.

The hub centralizes onboarding into tabs:

- Individual Invitations
- Public Invite
- QR Code
- Statistics
- Settings
- Roles

## Invitation Flow

Individual invitations reuse the existing `public.invitations` table and `accept_invitation` RPC.

Church admins can:

- invite by email
- capture a phone number for future SMS support
- set an invited role
- track pending, accepted, expired, and revoked invitations
- resend invitations
- revoke invitations
- copy invite links

Email delivery continues through the existing `send-invitation` Edge Function. If email delivery fails, the invitation record still exists and the admin can copy the link manually.

## Public Invite Flow

Public parish invite links reuse the existing public registration route:

`/join/:slug`

The registration page already resolves the parish, shows church context, hides parish selection, and registers the member into that parish through existing public registration RPCs.

Public registration is controlled through church metadata:

- `public_registration_enabled`
- `public_registration_approval_required`
- `allow_guest_registration`
- `require_email_verification`
- `invitation_expiry_days`
- `maximum_public_registrations`

Only `public_registration_enabled` is enforced by the current server-side public registration RPC. The remaining settings are stored for policy display and future server enforcement.

## QR Flow

The QR tab generates a registration QR code from the active public invite URL.

Admins can:

- copy the registration link
- use native sharing where supported
- download PNG
- download SVG
- refresh/regenerate the QR by rotating the church slug
- print an A4-style parish invite poster

QR images include accessible titles and the surrounding actions are keyboard-accessible buttons.

## Registration Flow

When a visitor scans the QR code:

1. The browser opens `/join/:slug`.
2. The existing public church lookup resolves the parish.
3. The registration page displays church name/logo/context.
4. Parish selection is skipped.
5. The visitor registers directly into that parish.

## Security

The hub does not expose service-role credentials or bypass RLS.

Current security behavior:

- Individual invitations use unique invitation tokens.
- Invitations can be revoked.
- Invitations expire.
- Public registration can be disabled.
- Public invite regeneration rotates the church slug, invalidating the previous public URL.
- Registration is resolved server-side by existing RPCs.

Known limitation:

The current public invite URL is based on the church `slug` because `/join/:slug` is the existing supported public route. A future hardened version should introduce a dedicated public invite token table with scan analytics, max-use enforcement, and revocation independent of the church slug.

## Statistics

The hub currently derives statistics from existing data:

- invitation counts by status
- completed member registrations
- pending approvals where member status is available
- conversion estimate based on existing invitation and member counts
- recent registrations

QR scan counts require a future server-side tracking endpoint and are not persisted in this release.

## Future Enhancements

- Dedicated public invite token table.
- Server-enforced maximum registration count.
- Server-enforced approval-required flow.
- QR scan analytics endpoint.
- SMS/WhatsApp provider integration.
- Invite template customization.
- Kanisa Insights integration for conversion funnels.


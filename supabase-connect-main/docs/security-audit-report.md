# Kanisani Connect security audit

Audit date: 2026-06-21. Scope: React client, Edge Function, and the complete checked-in Supabase migration history. This is a static repository audit; production database settings, deployed migration state, Auth CAPTCHA/rate limits, secrets, and storage policies still require the live checks listed below.

## Critical issues

### SEC-01: Any caller could read and alter every contribution

`20260323134500_allow_contributions_select.sql` created `Allow contributions select` with `USING (true)`. `20260323143000_allow_contributions_update.sql` likewise granted unrestricted update with `USING (true) WITH CHECK (true)`. Since these are permissive RLS policies, they overrode the intended tenant/member policies. An anonymous or authenticated client could enumerate contributions, including donor phone numbers and payment references, and alter records from any church.

Fixed in `20260621110000_security_audit_hardening.sql`: both policies are removed and the remaining update policy has explicit `USING` and `WITH CHECK` tenant/role constraints. Deploy this migration before relying on the fix.

### SEC-02: Invitation email function was a public mail relay

`send-invitation` was configured with `verify_jwt = false`; its handler accepted an arbitrary email and token and sent mail using the platform Resend credential. This enabled spam/phishing from the platform’s sending domain and generated mail cost.

Fixed by setting `verify_jwt = true` in `supabase/config.toml`. Redeploy the Edge Function for the setting to take effect. The function should subsequently be upgraded to validate that the caller is the invitation’s workspace manager before sending or resending mail.

## High issues

### SEC-03: All church members could read financial analytics snapshots

The `analytics_snapshots` SELECT policy allowed any member of a church to read totals, category analysis, pledge data, and community member counts. This violates least privilege for financial reports.

Fixed in `20260621110000_security_audit_hardening.sql`: read access is restricted to church administrators, church owners, and super admins.

### SEC-04: Sensitive data persisted after logout

Church contribution lists, members, reports, prayer requests, drafts, and queued writes are cached in `localStorage`. Prior to this audit, logout/session expiry only cleared React state, allowing the next person using the browser profile to recover cached data.

Fixed in `src/lib/offline-cache.ts` and `src/contexts/AuthContext.tsx`: sensitive offline caches, drafts, and the sync queue are cleared whenever session state is reset.

### SEC-05: Prayer requests and mass intentions are church-wide readable

Final RLS policies permit every member in a church to read all prayer requests and mass intentions. These records include sensitive pastoral content, names, requested dates, and offerings. `is_anonymous` does not prevent the row’s requester name from being returned at the database layer.

No automatic change was applied because church-wide sharing may be intentional. Split public-safe fields from private requests, or expose them through a sanitized RPC/view; restrict raw rows to the requester and authorized pastoral staff.

### SEC-06: Manual pledge payments can be fabricated

`make_pledge_payment` permits the pledge owner, a community leader, or an admin to directly create a payment with any positive amount and free-text method. There is no transaction/provider reference, uniqueness constraint, payment-status workflow, or webhook verification. It updates balances and platform fees immediately.

Treat these as declarations, not payments, until a verified payment-provider workflow exists. Add immutable provider transaction IDs, a unique index, pending/verified/rejected status, trusted webhook verification, and restrict balance updates to verification logic.

## Medium issues

### SEC-07: Public contribution endpoint has no server-side throttle or maximum amount

`submit_public_contribution` is anonymous and writes a contribution for every valid request. It checks only that the amount is greater than zero and does not invoke `enforce_rate_limit`. This allows database spam, fraudulent pending entries, and arbitrarily large values that contaminate analytics.

Add an IP/device-aware Edge Function or gateway rate limit, CAPTCHA/bot protection, idempotency keys, a realistic maximum amount, and a pending/verified status that is excluded from financial reports.

### SEC-08: Phone/password login relies on client-side member lookup

The phone login helper queries `members` to resolve an email address. With correct member RLS this is unavailable before authentication; if a permissive policy is added to make it work, it becomes an account/phone enumeration route. The client-only rate limit is trivial to bypass.

Replace it with Supabase phone OTP or a rate-limited server endpoint that returns a generic response and never exposes the linked email. Enable Supabase Auth CAPTCHA and server-side rate limits.

### SEC-09: Role model is overly broad for high-impact admin pages

`is_church_admin` treats `church_admin`, `pastor`, `secretary`, and `treasurer` as equivalent, so all can access many management and financial operations. The frontend also derives route access from cached role data; it is not an authorization boundary.

Define a capability matrix (members, content, contributions, billing, roles, reports), enforce it in RLS/RPCs, and use the UI only for navigation. In particular, role assignment must not allow a church manager to create a `super_admin` assignment; keep platform role management service/super-admin only.

### SEC-10: Public lookup and invitation RPCs disclose more than needed

Public invitation lookup returns the invitee email, inviter UUID, church UUID, role, timestamps, and token. Public giving lookup accepts raw UUIDs and returns the church UUID. UUIDs are not secrets, but this expands enumeration and metadata exposure.

Return only the fields the public page needs (for invitations, a masked email, church display name, and expiry status) and prefer opaque slugs/tokens over raw identifiers in public links.

## Low issues

### SEC-11: Error-provider details are returned to users

The invitation function returns raw email-provider error messages. These can expose provider configuration or internal delivery details. Return a generic user-safe error and keep the detailed response only in structured server logs.

### SEC-12: Security-definer functions need deployment-time permission review

Most security-definer functions correctly set `search_path = public` and perform authentication/role checks. However, the migration history is long and overrides functions repeatedly. A live database review must verify final `prosecdef`, owner, `EXECUTE` grants, RLS enabled state, and policy composition for every table/function; migration text alone cannot prove the deployed state.

## Database/RLS observations

The core tenant-scoped tables (`members`, `contributions`, `pledges`, `prayer_requests`, `mass_intentions`, and `message_templates`) have RLS migrations and generally scope data by `church_id` or membership. The former permissive contribution policies were the material exception and are now revoked by the new migration. `analytics_snapshots` is now manager-only. Prayer and mass-intention policies remain intentionally broad within a church and need a product/privacy decision.

RLS is not a substitute for payment verification: security-definer RPCs bypass table RLS by design and therefore must remain the only write path for payment state and must validate the authenticated caller, church ownership, related-record tenancy, amount, and idempotency.

## Fixes applied

- Added `20260621110000_security_audit_hardening.sql` to revoke universal contribution read/update policies, restore scoped updates, and restrict analytics snapshots.
- Required JWT verification for `send-invitation`.
- Purged sensitive local offline data on logout, invalid refresh token, or absent session.

## Phase 2 follow-up (2026-06-21)

- Prayer requests now have explicit sharing modes (`public_to_church`, `private_to_pastor_admin`, and `anonymous_public`). Pending requests are owner/reviewer-only; only approved shared requests are visible to church members.
- Mass intentions are now visible only to their member owner and pastoral reviewers.
- New pledge payment claims require a transaction ID or proof, receive a `pending` verification status, and do not update pledge totals or fees until `review_pledge_payment` approves them. Duplicate transaction IDs are rejected when historical data permits the unique index.
- Public contribution submission is throttled by church plus phone/reference, has a maximum amount, records rejected/rate-limited attempts in `security_audit_events`, and treats duplicate references idempotently.
- Phone login now shows one generic client error for lookup and password failures; the existing local lockout remains in place.

## Required production checks

1. Apply all migrations, including the new hardening migration, to the production project.
2. Redeploy `send-invitation` after the JWT configuration change.
3. In Supabase SQL Editor, inventory `pg_tables`/`pg_policies` for tables without RLS and `pg_proc` for `SECURITY DEFINER` functions/grants; compare the result to the intended final migration state.
4. Test with four real accounts (member, church manager, another church manager, super admin) and assert cross-tenant SELECT/INSERT/UPDATE/DELETE failures for every scoped table and RPC.
5. Enable Supabase Auth CAPTCHA and configure Auth provider rate limits, password policy, session lifetime, refresh-token rotation, redirect allow-list, and email confirmation in the live project.
6. Audit Storage bucket policies for receipts, payment proofs, chat attachments, and generated announcement assets; those policies are not represented comprehensively in this repository.
7. Add payment-provider webhook verification before treating any user-submitted transaction identifier as paid.

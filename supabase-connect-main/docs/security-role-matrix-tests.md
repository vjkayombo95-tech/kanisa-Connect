# Security role-matrix tests

Run these tests in a non-production project after all migrations, using two churches (A and B), one member in each, a Church A admin, a Church A pastor, a platform super admin, and a logged-out browser. Use the browser UI and direct Supabase REST/RPC requests with each account’s JWT. A UI redirect is not a pass unless the database request is also denied.

| Area | Member | Church admin | Pastor | Super admin | Logged-out visitor |
| --- | --- | --- | --- | --- | --- |
| Members | Read only Church A records permitted by product policy; no Church B rows or edits | Manage Church A only | No Church B rows; confirm intended member permissions | Platform access only | No rows |
| Contributions | Only own contributions; no writes/updates to another member or church | Read/manage Church A only | Verify intended financial capability | Platform access only | No rows/writes |
| Prayer requests | Own pending requests plus approved shared requests; no private rows | Read/review Church A; private requests visible | Read/review Church A; private requests visible | All intended records | No rows/writes |
| Mass intentions | Only own rows; no Church A peers or Church B rows | Read/review Church A | Read/review Church A | All intended records | No rows/writes |
| Pledges | Submit a pending payment only for own pledge; duplicate transaction must fail; totals unchanged | Submit/review Church A payments only | Submit/review Church A payments only | Review permitted records | No rows/writes |
| Analytics snapshots | Denied | Church A only | Church A only | All intended records | Denied |
| Admin pages | `/church-admin/*` redirects; direct data calls denied | Church A only | Church A only | `/super-admin/*` only | Login redirect |
| Public QR pages | Same public form behavior as visitor | Same public form behavior | Same public form behavior | Same public form behavior | Church display data only; no member/admin data |

## Detailed acceptance tests

1. **Cross-tenant isolation:** With every non-super-admin account, change an ID/church ID in each REST request to Church B. SELECT, INSERT, UPDATE, DELETE, and every RPC must fail or return no rows.
2. **Prayer privacy:** Create one request for each privacy value. Before approval, only its member and Church A admin/pastor can read it. After approval, `public_to_church` is visible to Church A members, `anonymous_public` is visible without the requester identity, and `private_to_pastor_admin` remains reviewer-only. A member can edit/delete only their own pending row; verify denial after approval/rejection.
3. **Mass privacy:** Create a Mass intention as Member A. Confirm Member A can read it; another Church A member and every Church B account cannot. Confirm Church A admin/pastor can read and update it.
4. **Pledge verification:** Submit with neither transaction ID nor proof (must fail). Submit with a valid transaction ID (must be `pending` and must not change `pledges.amount_paid`, targets, or fees). Re-submit the ID (must fail). Reject it (totals remain unchanged). Submit another payment and approve it as admin/pastor (only then totals/fee update). A member/community leader must be denied approval.
5. **Public giving abuse:** Submit the same reference twice; the second response must be idempotent and create no second contribution. Send more than three matching phone/reference requests in 15 minutes; expect a safe rate-limit message and a `security_audit_events` record. Invalid values must return generic safe errors.
6. **Phone/PIN enumeration:** Attempt phone login for a known phone, unknown phone, a phone without linked email, incorrect PIN, and an invalid/locked account. The UI text must be identical: `Invalid phone number or PIN. Please try again.` Verify detailed errors appear only in protected logs and the client lockout triggers after five attempts in ten minutes.
7. **Session/cache cleanup:** Load a member/contribution page, sign out, then inspect local storage. Keys starting `offline-cache:`, `offline-draft:`, and `offline-sync-queue` must be absent. Sign in as a different user and verify no stale records render.
8. **RLS/function inventory:** In the Supabase SQL editor, verify RLS is enabled on `prayer_requests`, `mass_intentions`, `pledge_payments`, `analytics_snapshots`, `contributions`, and `security_audit_events`. Review `pg_proc` EXECUTE grants for all `SECURITY DEFINER` functions and confirm only the documented roles can call them.

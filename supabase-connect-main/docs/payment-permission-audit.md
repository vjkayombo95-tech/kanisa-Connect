# Payment and Permission Audit

This checklist covers the trust-sensitive areas in Kanisani Connect: payments, subscriptions, preservation access, role permissions, RLS assumptions, and QR giving.

## Payment Flows

### Church Subscription Payment
- Church admin submits through `submit_subscription_payment`.
- Payment is created as `pending`.
- `church_id`, `requested_by`, `plan`, amount, reference, and optional receipt path are validated.
- Super Admin reviews through `review_subscription_payment`.
- Approval activates a new subscription and expires the previous active/trial subscription.
- Rejection stores `rejected` status and does not unlock the plan.
- Duplicate transaction references are checked in the RPC and guarded by a unique index when existing data allows it.
- Failures are logged from the church billing page and Super Admin billing verification page.

### Member Digital Record Preservation
- Member submits through `submit_member_record_subscription`.
- Direct member table inserts are blocked by RLS; submissions must use the RPC.
- Payment is created as `pending`.
- `church_id`, `member_id`, plan interval, amount, transaction ID, and optional proof path are validated.
- Super Admin reviews through `review_member_record_subscription`.
- Approval only unlocks historical archive visibility by extending `end_date`.
- Rejection does not unlock archive access.
- Expiry only changes subscription status. Historical records are never deleted.
- Duplicate transaction IDs are checked in the RPC and guarded by a unique index when existing data allows it.

### QR Contribution Payment
- QR codes now point to `/give/:churchSlugOrId`.
- Public giving uses `submit_public_contribution`.
- The RPC resolves church by slug first and falls back to UUID.
- Amount must be greater than zero.
- Phone number and transaction ID formats are validated.
- `church_id` is always attached by the server.
- Submission is marked in contribution notes as pending confirmation.
- Duplicate transaction IDs are checked per church and guarded by a unique index when existing data allows it.
- Public users do not read private member records.

### Mass Intention Payment
- Member must have a linked member record and church context.
- Amount must meet the Mass intention minimum.
- Creates a pending `mass_intentions` record plus related platform fee/contribution rows.
- Current risk: contribution recording is immediate after member submission; there is no separate transaction ID or admin payment-confirmation state for the monetary side.

### Prayer Request Payment
- Member must have a linked member record and church context.
- Optional offering cannot be negative.
- Creates a pending `prayer_requests` record plus related platform fee/contribution rows when an offering is supplied.
- Current risk: contribution recording is immediate after member submission; there is no separate transaction ID or admin payment-confirmation state for the monetary side.

### Pledge Payment
- Pledge payments use `make_pledge_payment`.
- RPC checks authentication, amount > 0, pledge ownership/admin/community-leader permission, and prevents payment above remaining balance.
- `member_id` is taken from the pledge by the server.
- Current risk: pledge payment has no transaction ID/proof/status workflow, so duplicate mobile-money verification cannot be enforced.

## Role Access Tests

### Member
- Log in as a normal member.
- Confirm `/portal` loads.
- Confirm `/church-admin` redirects or blocks.
- Confirm `/super-admin` redirects or blocks.
- Confirm member cannot see another member's contribution, prayer, Mass intention, pledge, or preservation records.
- Submit a prayer request.
- Submit a Mass intention.
- Submit Digital Record Preservation payment.
- Confirm expired preservation still keeps current month visible and locks only historical archive visibility.

### Church Admin
- Log in as church admin.
- Confirm `/church-admin` loads.
- Confirm `/super-admin` redirects or blocks.
- Confirm church admin can submit church subscription payment.
- Confirm church admin cannot approve church subscription payments.
- Confirm church admin cannot approve Digital Record Preservation payments.
- Confirm church admin cannot read `app_error_logs`.
- Confirm church admin can see only their own church members, contributions, requests, pledges, reports, and billing status.

### Super Admin
- Log in as Super Admin.
- Confirm `/super-admin` loads.
- Confirm Billing Verification is visible.
- Confirm Record Preservation payment review is visible.
- Confirm System Logs are visible.
- Approve and reject a church subscription payment.
- Approve and reject a preservation payment.
- Confirm rejected payments do not unlock access.

## RLS Verification

Check these tables in Supabase with real member/admin/super-admin sessions:
- `members`: church-scoped; members only read own profile unless admin.
- `contributions`: church-scoped; members only read own records; public writes should be via `submit_public_contribution`.
- `subscription_payments`: church admins submit/view own church payments; Super Admin manages global queue.
- `member_record_subscriptions`: members view own records; Super Admin manages; direct member inserts blocked.
- `app_error_logs`: Super Admin read only; frontend writes through `log_app_error`.
- `analytics_snapshots`: church-scoped admin access; member access should be blocked.
- `prayer_requests`: church-scoped; member personal history scoped by `member_id`.
- `mass_intentions`: church-scoped; member personal history scoped by `member_id`.
- `pledges`: owner/admin/community-leader scoped through pledge RPC helpers.

## Manual Trust Tests

1. Log in as member.
2. Try `/church-admin` and `/super-admin`.
3. Submit QR contribution from `/give/:churchSlugOrId`.
4. Submit duplicate QR transaction ID for the same church.
5. Submit prayer request with no offering.
6. Submit prayer request with negative offering and confirm it is blocked.
7. Submit Mass intention with amount below minimum and confirm it is blocked.
8. Submit Digital Record Preservation monthly payment.
9. Submit duplicate preservation transaction ID and confirm it is blocked.
10. Expire preservation subscription and confirm historical archive is hidden, not deleted.
11. Renew preservation subscription and confirm all historical records reappear.
12. Log in as church admin.
13. Submit church subscription payment.
14. Try to approve subscription or preservation payment and confirm it is blocked.
15. Log in as Super Admin.
16. Approve and reject subscription payments.
17. Approve and reject preservation payments.
18. Open System Logs and confirm payment/RPC failures appear.

## Remaining Risks

- Mass intention and prayer request payments still record contribution/platform fee rows immediately after submission. A stronger model would add a dedicated pending payment request table with transaction ID/proof and an approval step.
- Pledge payments do not yet collect transaction IDs or proof uploads. Add these before relying on pledge payment records as verified financial receipts.
- QR contribution records use contribution notes to indicate pending confirmation. A dedicated `status` column or `public_contribution_requests` table would be stronger.
- Unique indexes are skipped if live duplicate transaction references already exist. Clean duplicates, then rerun/create the skipped indexes.
- RLS must be tested against the live Supabase project because older migrations created broad compatibility policies in some environments.

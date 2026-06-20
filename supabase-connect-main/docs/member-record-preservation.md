# Member Digital Record Preservation

Member Digital Record Preservation is a premium digital archive service for long-term church record storage and retrieval. It does not charge members to use the church app, access church services, view announcements, participate in community features, submit prayer requests, or submit mass intentions.

## Free Member Access

Members can continue to:

- Log in and view their profile.
- View announcements and church events.
- Submit prayer requests and mass intentions.
- Use community features and receive notifications.
- View current month activity.

## Preservation Plan

The Digital Record Preservation plan costs TSh 3,000 per month or TSh 30,000 per year. When active, it preserves and unlocks the member's Secure Church Record Archive:

- Historical contribution archive.
- Historical payment archive.
- Contribution statements and downloadable PDF records.
- Mass intention history.
- Prayer request history.
- Yearly contribution summaries.
- Long-term cloud preservation of personal church records.

## Member Flow

Members submit a payment transaction ID and optional payment proof from the member portal. The request is stored as `pending` until reviewed by the platform team.

## Platform Review

Super Admin users can review requests at Super Admin -> Record Preservation. Pending requests can be approved or rejected. Proof files are stored in the private `record-preservation-proofs` storage bucket and are viewed through short-lived signed URLs.

Digital Record Preservation is platform revenue, not church revenue. Church admins do not approve these payments and do not see the platform preservation payment queue.

When approved:

- If the member already has an active preservation subscription, the archive end date is extended by one month for a monthly plan or one year for a yearly plan.
- If there is no active subscription, the archive starts immediately and ends after the selected plan period.
- The request status becomes `active`.

## Data Model

The `member_record_subscriptions` table stores preservation requests and active archive periods. Row level security allows members to see and create their own requests, while platform Super Admin users manage approvals globally.

Contribution records, payment records, prayer requests, and mass intentions remain in their original tables. Digital Record Preservation never deletes or moves those records.

## Visibility Rules

Without active preservation, current month activity remains visible and historical archive rows are hidden or locked in the member portal. The historical records remain safely stored in the database.

When a member renews preservation, the app restores access to the existing historical archive immediately. The member continues from the original records; the archive does not restart from zero.

Expired preservation only changes frontend access and visibility. It must not delete, archive-delete, truncate, anonymize, or remove member contribution, payment, prayer, or mass intention records.

## Scheduled Expiry

Run `public.expire_member_record_subscriptions()` daily so expired preservation periods are marked as `expired`. This RPC only updates preservation subscription rows. It does not delete member historical records.

Example Supabase scheduled job SQL:

```sql
select cron.schedule(
  'expire-member-record-subscriptions-daily',
  '5 0 * * *',
  $$select public.expire_member_record_subscriptions();$$
);
```

If `pg_cron` is not enabled in the project, enable it from Supabase Database Extensions or run the RPC from a scheduled Edge Function using the service role key.

## Archive Pagination

The member portal loads contribution history, prayer history, and mass intention history in 25-record pages. Active preservation members can move through historical pages; members without active preservation only load current month records.

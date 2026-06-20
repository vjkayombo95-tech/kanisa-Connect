# Production Launch Checklist

## Database And Security

- Apply all Supabase migrations in order.
- Confirm `analytics_snapshots`, `rate_limits`, and all performance indexes exist.
- Test RLS for member, staff, admin, and super admin accounts.
- Test RPC permissions for `generate_church_analytics_snapshot`, `submit_subscription_payment`, and announcement management.
- Confirm only church admins can generate analytics snapshots.
- Configure Supabase Auth login protection: email/password rate limits, captcha where available, and secure redirect URLs.

## Scale Testing

- Seed and test with at least 10,000 fake members in one church.
- Test member, contribution, attendance, groups, payments, pledges, prayer requests, and mass intentions pagination.
- Verify large lists load only the first page by default.
- Test slow network and offline/online transitions.
- Check Supabase connection usage during dashboard login and admin navigation.
- Confirm analytics uses snapshots first and does not run large client-side calculations on page load.

## Payments And Submissions

- Test payment submission limits and duplicate pending-payment handling.
- Test announcement posting limits.
- Test prayer request submission limits.
- Test mass intention submission limits.
- Test admin payment review and notification flow.
- Test storage access for private billing receipts.

## Media And Storage

- Check storage image sizes and compression before launch.
- Confirm list views use thumbnails or bounded image dimensions.
- Confirm full-size event/poster images are only loaded on detail views where possible.
- Verify images use lazy loading in long lists.

## Analytics Scheduling

- Add a scheduled Edge Function or locked service-role SQL job for analytics snapshots.
- Run snapshots daily for normal workspaces.
- Run snapshots hourly for high-volume workspaces.
- Monitor failed snapshot jobs and retry per church.
- Keep the manual admin button for emergency refreshes.

## Frontend Performance

- Run `npm run build` and review largest chunks.
- Confirm analytics, reports, PDF generation, and AI assistant are lazy loaded.
- Confirm normal members never load admin route bundles.
- Test member portal speed on a slow network profile.
- Test admin reports with drilldown pagination.

## Remaining Pre-Launch Checks

- Confirm production Supabase plan has enough database, bandwidth, auth, storage, and Edge Function capacity.
- Confirm backups and point-in-time recovery settings.
- Confirm payment flow with real mobile-money references.
- Confirm admin reports are accurate against seeded data.
- Confirm monitoring for API errors, slow queries, storage failures, and rejected payments.

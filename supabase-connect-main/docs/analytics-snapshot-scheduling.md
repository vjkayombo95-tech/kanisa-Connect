# Analytics Snapshot Scheduling

Use the manual **Generate analytics** button for ad-hoc refreshes, but production should also refresh snapshots on a schedule.

## Recommended Production Path

Create a Supabase Edge Function that runs with the service role key on a daily or hourly schedule.

Suggested cadence:

- Daily at 02:00 local time for normal churches.
- Hourly for churches with high payment/contribution volume.
- On-demand from the admin Analytics page for manual refreshes.

The Edge Function should:

1. Read active church IDs in batches.
2. For each church, call a server-side snapshot generator.
3. Log failures per church without stopping the whole batch.
4. Keep a short timeout per church so one large workspace does not block the schedule.

## SQL Scheduling Notes

If `pg_cron` is enabled, schedule a service-only wrapper instead of the admin RPC directly. The public admin RPC uses `auth.uid()` and should stay admin-only for browser calls.

Example schedule shape:

```sql
-- Example only. Create the service wrapper in a locked migration before enabling this.
select cron.schedule(
  'generate-hourly-church-analytics',
  '0 * * * *',
  $$select public.generate_all_church_analytics_snapshots();$$
);
```

## Security Notes

- Keep `generate_church_analytics_snapshot(p_church_id uuid)` admin-only for browser calls.
- Do not expose a public "generate all churches" RPC to `authenticated`.
- If a service wrapper is added, grant it only to the service role.
- Continue storing generated summaries in `analytics_snapshots`; reports should read snapshots first.

## Current Manual RPC

The current RPC:

```sql
public.generate_church_analytics_snapshot(p_church_id uuid)
```

It is protected by:

- Authenticated user requirement.
- Church admin role check.
- Server-side rate limit of 3 generations per church per hour.

# Error Log Maintenance

Kanisani Connect stores application diagnostics in `public.app_error_logs`.

## Retention

Use:

```sql
select public.delete_old_app_error_logs();
```

Retention rules:

- `info` logs older than 14 days are deleted.
- `warning` logs older than 30 days are deleted.
- resolved `error` logs older than 90 days are deleted.
- unresolved errors are kept until an admin resolves them.

Only super admins can run cleanup.

## Resolving Logs

Admins can resolve a log from:

```text
Church Admin -> System Logs
```

Resolving a log sets:

- `resolved = true`
- `resolved_at = now()`
- `resolved_by = auth.uid()`

## Alert Badge

The Church Admin sidebar checks for recent unresolved errors.

If 5 or more unresolved errors occur within 10 minutes, the **System Logs** menu item shows a warning count badge.

## Scheduling Cleanup

For production, schedule cleanup daily with a Supabase scheduled Edge Function or a locked SQL job.

Example job shape:

```sql
select public.delete_old_app_error_logs();
```

Run it with a super admin/service context. Do not expose cleanup to normal members.

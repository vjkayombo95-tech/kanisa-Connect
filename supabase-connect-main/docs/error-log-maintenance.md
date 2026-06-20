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
- unresolved errors are kept until a platform Super Admin resolves them.

Only platform Super Admin users or service-role scheduled jobs can run cleanup.

## Resolving Logs

Platform Super Admin users can resolve a log from:

```text
Super Admin -> Platform Monitoring -> System Logs
```

Resolving a log sets:

- `resolved = true`
- `resolved_at = now()`
- `resolved_by = auth.uid()`

## Platform Monitoring

System Logs are platform-owner tools and are not exposed in Church Admin. Church admins, pastors, staff, and members cannot read `public.app_error_logs`.

## Scheduling Cleanup

For production, schedule cleanup daily with a Supabase scheduled Edge Function or a locked SQL job.

Example job shape:

```sql
select public.delete_old_app_error_logs();
```

Run it with a super admin/service context. Do not expose cleanup to normal members.

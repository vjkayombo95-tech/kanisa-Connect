# Error Log Security

Application logs are written through:

```sql
public.log_app_error(...)
```

Direct browser inserts into `public.app_error_logs` are blocked. The old permissive insert policy is dropped by the hardening migration.

## Rate Limits

The logging RPC applies server-side throttles:

- Max 30 logs per user per hour.
- Max 100 logs per church per hour.
- Max 20 anonymous logs per browser session per hour when a logger session id is available.

When a limit is exceeded, the RPC returns `null` instead of raising a user-visible error.

## Payload Limits

The frontend and database both limit payload sizes:

- Message is capped.
- Stack trace is capped.
- Metadata is capped and replaced with a truncated preview if too large.
- Browser info and route/component fields are capped on the server.

## Client Behavior

`src/lib/error-logger.ts` only calls `log_app_error`.

It does not insert directly into `app_error_logs`.

If logging fails, the logger catches the failure and user actions continue normally.

## Operational Notes

- Watch for churches hitting the 100 logs/hour limit; that usually means a real production issue or a noisy loop.
- Anonymous logging depends on the browser session id stored in `sessionStorage`.
- IP-based anonymous throttling is not available from the browser RPC path unless added through an Edge Function or proxy that can safely pass request IP metadata.

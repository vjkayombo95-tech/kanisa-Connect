# Daily automations Edge Function

This function invokes `public.run_daily_automations()` using only the server-side
`SUPABASE_SERVICE_ROLE_KEY`. It intentionally does not forward the HTTP caller's
`Authorization` header to Supabase.

## Scheduling after deployment

Keep JWT verification enabled for this function. Configure a trusted scheduler to
send one `POST` request daily to:

```text
https://<project-ref>.supabase.co/functions/v1/daily-automations
```

Store the scheduler's authorization credential in the scheduler's secret store.
Do not put `SUPABASE_SERVICE_ROLE_KEY` in a browser, source-controlled URL, or
client environment variable. The service-role key belongs only in Supabase Edge
Function secrets and is read by the function at runtime.

The function responds with `success`, `timestamp`, `execution_time_ms`, and
`error`, which a scheduler can use for health monitoring and retries.

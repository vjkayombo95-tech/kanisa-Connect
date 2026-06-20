# Error Monitoring

Kanisani Connect records production diagnostics in Supabase so platform owners can investigate crashes, failed RPC calls, auth problems, payment issues, and unexpected application errors.

## Log Storage

Logs are stored in:

```text
public.app_error_logs
```

Each record includes:

- `level`: `error`, `warning`, or `info`
- `message`
- `stack`
- `page`
- `route`
- `component`
- `function_name`
- `church_id`
- `user_id`
- `metadata`
- `browser_info`
- `occurrence_count`
- `created_at`

Repeated logs with the same `message`, `component`, and `route` within five minutes are deduplicated. The existing row is updated and `occurrence_count` is incremented.

## Logger API

Use:

```ts
import { captureException, logError, logInfo, logWarning } from "@/lib/error-logger";
```

Available functions:

- `logError(error, context?)`
- `logWarning(message, context?)`
- `logInfo(message, context?)`
- `captureException(error, context?)`

Context can include:

- `component`
- `page`
- `route`
- `function`
- `church_id`
- `user_id`
- `metadata`

## Platform Owner Access

System Logs are platform-owner tools. Only Super Admin users can open:

```text
Super Admin -> Platform Monitoring -> System Logs
```

The page supports:

- Recent errors, warnings, and info logs
- Level filter
- Message/page/component search
- Stack trace viewer
- Metadata JSON viewer
- Occurrence count
- Timestamp review

Members, church admins, pastors, staff, and church workspace managers cannot read `app_error_logs`. RLS allows only platform Super Admin users to read application error logs. Frontend logging inserts must go through the `log_app_error` RPC; direct table inserts are blocked.

## Debugging Workflow

1. Open **Super Admin -> Platform Monitoring -> System Logs**.
2. Filter by `Error`.
3. Search for the affected page, component, member, or payment action.
4. Open the log details.
5. Check the stack trace and metadata JSON.
6. Match `church_id`, `user_id`, and timestamp with the support report.
7. If an RPC failed, check the `rpc` or `operation` metadata field.

Church Admin billing screens are limited to each church's own subscription status and payment submission. Platform payment verification and SaaS subscription approvals live under **Super Admin -> Billing Verification**.

## Development Logging

In development, logs are also printed to the browser console in this format:

```text
[ERROR]
Page:
Component:
Function:
Message:
Stack:
```

## Sentry Preparation

`src/lib/sentry.ts` is an abstraction layer for future Sentry integration. Sentry is not installed yet. When it is added, wire the Sentry SDK through `configureSentry()` without changing application call sites.

## Safety Notes

- Logging is fire-and-forget and never blocks user actions.
- Logger failures are caught internally.
- Avoid storing passwords, full payment secrets, or sensitive private messages in `metadata`.

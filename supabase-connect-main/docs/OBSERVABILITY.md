# Observability

Kanisa Connect now has a lightweight observability foundation under `src/lib/monitoring`.
It is intentionally vendor-neutral so production monitoring can be connected later without changing application code again.

## Logging

Use `logger` from `@/lib/monitoring` for new operational logging.

Supported levels:

- `debug`
- `info`
- `warn`
- `error`
- `fatal`

Every structured log entry includes:

- timestamp
- environment
- tenantId, when supplied
- churchId, when supplied
- userId, when supplied
- workspace, when supplied
- route
- action or component context

Production behavior:

- `debug`, `info`, and routine `warn` logs are not printed to the console.
- `error` and `fatal` logs are still printed so deployment platforms can capture failures.
- No external logging network requests are sent by the new monitoring layer.

The legacy `src/lib/error-logger.ts` remains in place for existing Supabase-backed application error logs. The new logger is safe to use for diagnostics that should not depend on backend availability.

## Metrics

Metrics are buffered in memory through `src/lib/monitoring/metrics.ts`.

Standard metric names include:

- login success and failure
- API failures
- RPC failures
- contribution submissions
- prayer request submissions
- mass intention submissions
- calendar loads
- Bible searches
- dashboard load duration

The buffer is intentionally small and local. Future integrations can periodically forward these entries to a monitoring backend, but the current implementation creates no additional network traffic.

## Performance

`src/lib/monitoring/performance.ts` supports:

- page load timing
- route navigation timing
- React Query request duration
- slow query warnings above 500ms
- large render warnings
- bundle load timing inspection
- generic async operation timing

The app shell currently enables:

- initial page load timing
- route navigation timing
- React Query request duration tracking

These measurements are in-memory and low overhead.

## Health Checks

`src/lib/monitoring/health.ts` provides reusable health-check factories for:

- Supabase connectivity
- authentication session availability
- storage bucket access
- Bible table availability
- Daily Readings table availability
- calendar table availability
- notification readiness
- tenant configuration readiness

Health checks are not run automatically at startup. They are designed for future admin diagnostics, deployment smoke tests, and production support tooling.

## Tracing

`src/lib/monitoring/trace.ts` provides:

- `startTrace`
- `finishTrace`
- `traceAsync`

Trace entries are local structured logs. They can be wrapped around expensive workflows later without changing business logic.

## Error Boundaries

The global application error boundary now:

- shows a user-friendly fallback
- keeps reload and return-home recovery actions
- logs a structured fatal diagnostic
- preserves the existing application error capture path

## Developer Diagnostics

In development only, the app shows a diagnostics overlay with:

- environment
- current route
- church
- user
- role
- React Query cache size
- buffered metrics count
- feature flags
- recent bundle load timings

The overlay is disabled in production builds.

## Future Monitoring Integrations

Recommended production integrations:

- Sentry for frontend exceptions and release tracking
- Supabase log drains for database and Edge Function logs
- OpenTelemetry-compatible collector for traces and metrics
- Uptime checks for public routes and authenticated smoke tests
- Synthetic checks for login, dashboard load, Bible search, and contribution receipt generation

## Production Checklist

- Confirm production source maps policy before enabling external error tracking.
- Add release version metadata to structured logs.
- Add tenant and church context providers once tenant data is persisted.
- Add a protected admin diagnostics page that invokes health checks on demand.
- Keep monitoring calls non-blocking and failure-tolerant.

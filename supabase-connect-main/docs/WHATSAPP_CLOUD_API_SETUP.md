# WhatsApp Cloud API setup (Phase 1)

## Meta and test setup

Create a Meta developer app, add the WhatsApp product, and use its test number and allowed test recipients first. In WhatsApp > Configuration, set the callback URL to `https://<project-ref>.supabase.co/functions/v1/whatsapp-webhook`, choose a long random verify token, and subscribe to the `messages` field. The GET challenge validates the verify token; POST requests require Meta's `X-Hub-Signature-256` HMAC.

Set these only as Supabase Edge Function secrets: `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_BUSINESS_ACCOUNT_ID`, `WHATSAPP_WEBHOOK_VERIFY_TOKEN`, `WHATSAPP_APP_SECRET`, `WHATSAPP_GRAPH_API_VERSION`, a random `WHATSAPP_INTERNAL_SEND_SECRET`, and a different random `WHATSAPP_DISPATCH_SECRET`. Never use a `VITE_` prefix. Temporary tokens are for short tests; production requires an appropriately scoped system-user token and completed phone-number onboarding.

Create a `whatsapp_accounts` row that maps Meta's phone-number ID to one church, but leave its status `test` or `disabled` until staging validation. Enable the feature only by setting both `churches.whatsapp_enabled` and `churches.whatsapp_mass_intentions_enabled`. Configure that church's fee, currency, capacity, manual-review behavior, and 24-hour service window; there is intentionally no universal fee.

## Local and staging diagnostics

Run local tests with `npm run test -- --run src/test/whatsapp-core.test.ts`. Serve functions locally with Supabase using a non-production env file. Invoke `whatsapp-send` with the internal-secret header and `"dryRun": true`; dry-run persists a `dry_run` record and never contacts Meta. The webhook itself only queues replies, so it does not send billable messages.

Safe staging dry run (replace placeholders and use a staging URL/secret):

```powershell
$headers = @{ 'Content-Type'='application/json'; 'x-whatsapp-dispatch-secret'='<staging-dispatch-secret>' }; $body = '{"dryRun":true,"batchSize":1,"workerId":"manual-staging-dry-run"}'; Invoke-RestMethod -Method Post -Uri 'https://<staging-project-ref>.supabase.co/functions/v1/whatsapp-dispatch' -Headers $headers -Body $body
```

## Trusted dispatcher

`whatsapp-dispatch` is the only queue consumer. It is intentionally configured without public JWT authorization because schedulers may not have user JWTs; instead it requires the server-only `x-whatsapp-dispatch-secret`. Never put this secret in frontend code. The function atomically claims at most 25 eligible rows using a service-role-only RPC, validates tenant relationships, church/account enablement, daily limits, and the service window, then uses the shared sender module. Ordinary users cannot execute the claim or completion RPCs.

Claims stale for ten minutes are recovered automatically. Retryable timeouts, rate limits, and server failures use exponential backoff from 30 seconds to one hour, with five attempts. Invalid payloads/recipients, rejected templates, disabled churches, tenant mismatches, and provider authorization errors are permanent. A free-form reply after the service window becomes `requires_template`; it is never silently converted. Inspect manager-visible queue rows by filtering `whatsapp_messages.direction = 'outbound'` and reviewing `dispatch_status`, `attempt_count`, `next_attempt_at`, and redacted failure fields.

For staging, schedule a small dry-run dispatch every minute first. After explicit review, production scheduling should use a trusted scheduler secret and a bounded batch. Failed or stale rows should normally be recovered by the next claim; investigate `permanent_failed` and `max_attempts` before creating a reviewed forward repair. Do not manually reset claims while a worker is active.

The guarded harness is `node scripts/whatsapp/staging-dispatch-diagnostic.ts --synthetic`. It refuses production-like targets, requires `KANISA_ENVIRONMENT=local|staging`, `WHATSAPP_DIAGNOSTIC_DRY_RUN=true`, and `KANISA_WHATSAPP_STAGING_ACK=I_UNDERSTAND_DRY_RUN_ONLY`, verifies schema/RLS/RPCs, exercises the state machine and dispatcher, confirms no provider ID, and removes only its marker-tagged records.

For business-initiated messages outside the service window, create and obtain approval for a utility template in WhatsApp Manager, then send only that exact approved template/category. Do not send marketing automatically.

## Privacy, payments, and linking

A phone number is not identity proof. Public Mass information may be shown without linking, but private member/contribution data requires a one-time signed link or OTP and a `verified` contact link. Payment redirects are not proof; only a verified, idempotent provider callback may confirm payment. The provider-specific link/callback adapter remains to be connected to the church's payment provider.

## Disable and rollback

Disable one church by setting `whatsapp_enabled = false`, `whatsapp_mass_intentions_enabled = false`, and its account status to `disabled`. Rotate/revoke Meta and internal tokens if compromised. To roll back application behavior, stop/disable the webhook, sender, and dispatcher and disable the account; retain the additive tables for audit history. A later reviewed forward migration may remove them—do not reverse a production migration manually.

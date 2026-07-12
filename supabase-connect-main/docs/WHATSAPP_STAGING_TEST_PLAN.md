# WhatsApp staging test plan

Use a separate staging Supabase project and Meta test number. Never paste credentials into this document or commit them.

1. Apply `20260712120000_whatsapp_cloud_api_phase1.sql` and `20260712130000_whatsapp_dispatch_queue.sql` to staging only. Run the guarded diagnostic in read-only mode and confirm every schema check passes.
2. Configure staging-only server secrets: the Meta variables, Supabase service key, `WHATSAPP_INTERNAL_SEND_SECRET`, and a different `WHATSAPP_DISPATCH_SECRET`. Confirm no variable begins with `VITE_`.
3. Insert the Meta test phone-number mapping into `whatsapp_accounts` for the staging church with status `test`.
4. Set `whatsapp_enabled`, `whatsapp_mass_intentions_enabled`, fee/currency, service-window hours, daily limit, and manual-review settings on that staging church.
5. Create future `whatsapp_mass_slots` rows with deliberately small test capacities.
6. Deploy `whatsapp-webhook`, `whatsapp-send`, and `whatsapp-dispatch` to staging. Do not schedule live dispatch yet; invoke the dispatcher only with `dryRun=true`.
7. Configure Meta's test webhook URL, verification token, signature secret, and `messages` subscription. Verify GET challenge and rejected invalid signatures.
8. From an allowed Meta test recipient, send `MENU`. Confirm one inbound message and exactly one queued outbound reply. Dry-run dispatch it and inspect `dry_run_completed`.
9. Run the full Nia ya Misa path: choose type, details, future date, and available Mass. Exercise invalid input, back, cancellation, restart, closed/full slot handling, and confirmation. Keep dispatcher dry-run enabled.
10. Verify the conversation reaches `AWAITING_PAYMENT`. No payment link/provider is expected in this phase and no redirect may mark it paid.
11. Inspect every created contact, conversation, message, session, slot, attempt, and audit row. Confirm all use the same staging `church_id`, and managers from another church cannot read them.
12. Replay the same webhook provider message ID and confirm only one reply. Invoke two dispatchers concurrently and confirm one claim. Simulate retryable/permanent failures, stale claims, the attempt ceiling, daily limit, and closed service window.
13. Disable the church/account and confirm delivery is blocked. Remove the Meta staging webhook or stop staging functions, rotate staging internal secrets, retain audit records, and document the rollback result.

Before step 8, the safest synthetic test is:

```powershell
$env:KANISA_ENVIRONMENT='staging'; $env:WHATSAPP_DIAGNOSTIC_DRY_RUN='true'; $env:KANISA_WHATSAPP_STAGING_ACK='I_UNDERSTAND_DRY_RUN_ONLY'; node scripts/whatsapp/staging-dispatch-diagnostic.ts --synthetic
```

The script also requires staging `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `WHATSAPP_DISPATCH_SECRET`, and `WHATSAPP_DIAGNOSTIC_CHURCH_ID` in the process environment. It refuses the repository's documented project reference.

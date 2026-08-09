import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { authorizeInternal, classifyProviderFailure, MAX_ATTEMPTS, retryAt, safeBatchSize, safeClaimDiagnostic, safeFailureReason, sendUnlessDryRun, validateClaim, type ClaimedMessage, type DispatchOutcome } from "../_shared/whatsapp-dispatch-core.ts";
import { sendToMeta } from "../_shared/whatsapp-sender.ts";
import { isServiceFeatureAvailable } from "../_shared/feature-eligibility.ts";

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
type Complete = { outcome: DispatchOutcome; providerId?: string | null; category?: string | null; reason?: string | null; next?: string | null };

Deno.serve(async (request) => {
  if (request.method !== "POST") return json(405, { error: "Method not allowed" });
  if (!authorizeInternal(request.headers.get("x-whatsapp-dispatch-secret"), Deno.env.get("WHATSAPP_DISPATCH_SECRET"))) return json(403, { error: "Forbidden" });
  let input: { dryRun?: boolean; batchSize?: number; workerId?: string; messageId?: string };
  try { input = await request.json(); } catch { return json(400, { error: "Malformed JSON" }); }
  if (typeof input.dryRun !== "boolean") return json(400, { error: "dryRun must be explicit" });
  const batchSize = safeBatchSize(input.batchSize); const workerId = input.workerId?.trim() || `dispatch-${crypto.randomUUID()}`;
  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await db.rpc("claim_whatsapp_messages", { _worker_id: workerId, _batch_size: batchSize, _max_attempts: MAX_ATTEMPTS, _stale_after: "10 minutes", _message_id: input.messageId ?? null });
  if (error) { console.error("whatsapp-dispatch claim", safeFailureReason({ message: error.message })); return json(500, { error: "Queue claim failed" }); }
  const claimed = (data ?? []) as ClaimedMessage[]; const results: Array<{ id: string; outcome: string }> = [];
  const claimedDiagnostics = input.dryRun ? claimed.map(safeClaimDiagnostic) : undefined;
  if (claimedDiagnostics) console.info("whatsapp-dispatch dry-run claim", JSON.stringify({ projectRef: Deno.env.get("SUPABASE_URL")?.split("//")[1]?.split(".")[0] ?? null, claimed: claimedDiagnostics }));

  for (const message of claimed) {
    let completion: Complete;
    try {
      const validation = validateClaim(message, new Date(), { dryRun: input.dryRun });
      if (!validation.allowed) completion = { outcome: validation.outcome, category: validation.category, reason: validation.reason, next: validation.outcome === "retry_scheduled" ? retryAt(message.attempt_count, new Date(new Date().setHours(24, 0, 0, 0))) : null };
      else if (!await isServiceFeatureAvailable(db, message.church_id, "notifications")) completion = { outcome: "permanent_failed", category: "feature_disabled", reason: "Notifications are unavailable for this church" };
      else {
        const dispatch = await sendUnlessDryRun(input.dryRun, async () => {
          const token = Deno.env.get("WHATSAPP_ACCESS_TOKEN");
          if (!token) return { configured: false as const };
          return { configured: true as const, sent: await sendToMeta({ to: message.normalized_phone!, phoneNumberId: message.phone_number_id!, type: message.message_type, text: message.body, payload: message.payload }, { token, version: Deno.env.get("WHATSAPP_GRAPH_API_VERSION") ?? "v23.0" }) };
        });
        if (!dispatch.executed) completion = { outcome: "dry_run_completed" };
        else if (!dispatch.value.configured) completion = { outcome: "permanent_failed", category: "provider_auth", reason: "WhatsApp provider credentials are not configured" };
        else {
          const sent = dispatch.value.sent;
          if (sent.ok && sent.providerMessageId) completion = { outcome: "sent", providerId: sent.providerMessageId };
          else { const failure = classifyProviderFailure(sent.status, sent.errorCode); completion = failure.retryable && message.attempt_count < MAX_ATTEMPTS ? { outcome: "retry_scheduled", category: failure.category, reason: sent.failureReason, next: retryAt(message.attempt_count) } : { outcome: message.attempt_count >= MAX_ATTEMPTS ? "max_attempts" : "permanent_failed", category: message.attempt_count >= MAX_ATTEMPTS ? "max_attempts" : failure.category, reason: sent.failureReason }; }
        }
      }
    } catch (error) {
      completion = message.attempt_count < MAX_ATTEMPTS ? { outcome: "retry_scheduled", category: "worker_failure", reason: safeFailureReason({ message: error instanceof Error ? error.message : "Worker failure" }), next: retryAt(message.attempt_count) } : { outcome: "max_attempts", category: "max_attempts", reason: "Maximum dispatch attempts reached" };
    }
    const { data: completed, error: completeError } = await db.rpc("complete_whatsapp_dispatch", { _message_id: message.message_id, _worker_id: workerId, _outcome: completion.outcome, _provider_message_id: completion.providerId ?? null, _failure_category: completion.category ?? null, _failure_reason: completion.reason ?? null, _next_attempt_at: completion.next ?? null });
    if (completeError || completed !== true) console.error("whatsapp-dispatch completion", safeFailureReason({ messageId: message.message_id, error: completeError?.message ?? "claim ownership lost" }));
    results.push({ id: message.message_id, outcome: completeError ? "completion_failed" : completion.outcome });
  }
  return json(200, { dryRun: input.dryRun, workerId, claimed: claimed.length, results, ...(claimedDiagnostics ? { projectRef: Deno.env.get("SUPABASE_URL")?.split("//")[1]?.split(".")[0] ?? null, claimedDiagnostics } : {}) });
});

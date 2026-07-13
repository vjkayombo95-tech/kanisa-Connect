import { describe, expect, it, vi } from "vitest";
import { authorizeInternal, classifyProviderFailure, MASS_INTENTION_WORKFLOW, MAX_ATTEMPTS, retryAt, retryDelayMs, safeBatchSize, safeClaimDiagnostic, safeFailureReason, sendUnlessDryRun, validateClaim, type ClaimedMessage } from "../../supabase/functions/_shared/whatsapp-dispatch-core";
import { sendToMeta } from "../../supabase/functions/_shared/whatsapp-sender";
import { assertDryRunCompleted, dryRunFailureDetails, dryRunResultFields, runWithDiagnosticCleanup, safeProjectRefFromSupabaseUrl } from "../../scripts/whatsapp/staging-dispatch-diagnostic";

const message = (overrides: Partial<ClaimedMessage> = {}): ClaimedMessage => ({ message_id: "m", church_id: "c", conversation_id: "v", contact_id: "p", message_type: "text", message_category: "service", body: "hello", payload: { to: "255700000000" }, attempt_count: 1, service_window_expires_at: "2030-01-02T00:00:00Z", normalized_phone: "+255700000000", phone_number_id: "phone", account_status: "test", whatsapp_enabled: true, whatsapp_mass_intentions_enabled: true, whatsapp_daily_message_limit: 10, sent_today: 1, ...overrides });

describe("trusted WhatsApp dispatcher rules", () => {
  it("rejects unauthorized callers", () => { expect(authorizeInternal(null, "secret")).toBe(false); expect(authorizeInternal("bad", "secret")).toBe(false); expect(authorizeInternal("secret", "secret")).toBe(true); });
  it("caps the batch strictly", () => { expect(safeBatchSize(500)).toBe(25); expect(safeBatchSize(0)).toBe(1); expect(safeBatchSize("bad")).toBe(10); });
  it("allows free-form delivery inside the service window", () => expect(validateClaim(message(), new Date("2030-01-01Z"))).toEqual({ allowed: true }));
  it("treats whatsapp_enabled true booleans as enabled", () => expect(validateClaim(message({ whatsapp_enabled: true, whatsapp_mass_intentions_enabled: true }), new Date("2030-01-01Z"))).toEqual({ allowed: true }));
  it("allows generic service messages when Mass Intentions is disabled", () => expect(validateClaim(message({ whatsapp_mass_intentions_enabled: false }), new Date("2030-01-01Z"))).toEqual({ allowed: true }));
  it("blocks Mass Intention workflow messages with a distinct feature result", () => expect(validateClaim(message({ whatsapp_mass_intentions_enabled: false, payload: { workflow: MASS_INTENTION_WORKFLOW } }), new Date("2030-01-01Z"))).toEqual({ allowed: false, outcome: "permanent_failed", category: "feature_disabled", reason: "WhatsApp Mass Intentions is disabled for this church" }));
  it("blocks closed windows and requires a template", () => expect(validateClaim(message({ service_window_expires_at: "2029-12-31Z" }), new Date("2030-01-01Z"))).toMatchObject({ allowed: false, outcome: "requires_template", category: "service_window_closed" }));
  it("allows templates outside the service window", () => expect(validateClaim(message({ message_type: "template", body: null }), new Date("2030-01-01Z"))).toEqual({ allowed: true }));
  it.each([false, null])("blocks every message when the church WhatsApp switch is %s", (whatsapp_enabled) => expect(validateClaim(message({ whatsapp_enabled, whatsapp_mass_intentions_enabled: false }))).toEqual({ allowed: false, outcome: "permanent_failed", category: "church_disabled", reason: "WhatsApp is disabled for this church" }));
  it("blocks missing account mappings", () => expect(validateClaim(message({ phone_number_id: null }))).toMatchObject({ category: "account_missing" }));
  it("allows a synthetic dry-run without an account or phone-number ID", () => expect(validateClaim(message({ phone_number_id: null, account_status: null, whatsapp_mass_intentions_enabled: false }), new Date("2030-01-01Z"), { dryRun: true })).toEqual({ allowed: true }));
  it("keeps missing account configuration fatal for real dispatch", () => expect(validateClaim(message({ phone_number_id: null, account_status: null }), new Date("2030-01-01Z"), { dryRun: false })).toMatchObject({ allowed: false, category: "account_missing" }));
  it("blocks cross-tenant relationship mismatches", () => expect(validateClaim(message({ normalized_phone: null }))).toMatchObject({ category: "tenant_mismatch" }));
  it("respects daily limits", () => expect(validateClaim(message({ sent_today: 11, whatsapp_daily_message_limit: 10 }))).toMatchObject({ category: "daily_limit", outcome: "retry_scheduled" }));
  it("permanently rejects malformed payloads", () => expect(validateClaim(message({ body: null, payload: {} }))).toMatchObject({ category: "invalid_payload", outcome: "permanent_failed" }));
  it("stops at the maximum attempts", () => expect(validateClaim(message({ attempt_count: MAX_ATTEMPTS }))).toMatchObject({ outcome: "max_attempts" }));
  it("uses bounded exponential retry delays", () => { expect(retryDelayMs(1)).toBe(30_000); expect(retryDelayMs(2)).toBe(60_000); expect(retryDelayMs(20)).toBe(3_600_000); expect(retryAt(1, new Date("2030-01-01Z"))).toBe("2030-01-01T00:00:30.000Z"); });
  it("distinguishes retryable and permanent provider failures", () => { expect(classifyProviderFailure(500).retryable).toBe(true); expect(classifyProviderFailure(429).retryable).toBe(true); expect(classifyProviderFailure(400, 131026)).toEqual({ retryable: false, category: "invalid_recipient" }); expect(classifyProviderFailure(403).category).toBe("provider_auth"); });
  it("redacts secrets in auditable failure text", () => { const value = safeFailureReason({ authorization: "Bearer private", access_token: "private", message: "bad" }); expect(value).not.toContain("private"); expect(value).toContain("[REDACTED]"); });
  it("builds safe claim diagnostics without phone identifiers", () => expect(safeClaimDiagnostic(message({ normalized_phone: "+255700000000", phone_number_id: "phone-secret" }))).toEqual({ message_id: "m", church_id: "c", whatsapp_enabled: true, whatsapp_mass_intentions_enabled: true, account_status: "test", has_phone_number_id: true, has_normalized_phone: true }));
  it("dry-run completion has no provider ID and does not invoke a Meta sender", async () => { const sender = vi.fn(); const validation = validateClaim(message({ phone_number_id: null, account_status: null }), new Date("2030-01-01Z"), { dryRun: true }); const dispatch = await sendUnlessDryRun(true, sender); const completion = !dispatch.executed ? { outcome: "dry_run_completed", providerId: null } : null; expect(validation).toEqual({ allowed: true }); expect(sender).not.toHaveBeenCalled(); expect(completion).toEqual({ outcome: "dry_run_completed", providerId: null }); });
  it("persists provider IDs returned by the shared sender contract", async () => { const result = await sendToMeta({ to: "+255700000000", phoneNumberId: "phone", type: "text", text: "hello" }, { token: "test", version: "v23.0", fetcher: async () => new Response(JSON.stringify({ messages: [{ id: "wamid.1" }] }), { status: 200, headers: { "content-type": "application/json" } }) }); expect(result.providerMessageId).toBe("wamid.1"); });
  it("accepts successful diagnostic dry-run completion without a provider message id", () => {
    expect(dryRunResultFields).toContain("failure_reason");
    expect(() => assertDryRunCompleted({ dispatch_status: "dry_run_completed", provider_message_id: null, attempt_count: 1, failure_category: null, failure_reason: null, requires_template: false, status: "dry_run", claimed_by: null, next_attempt_at: null })).not.toThrow();
  });
  it("derives the function project ref from the same Supabase URL used by the diagnostic", () => expect(safeProjectRefFromSupabaseUrl("https://staging-ref.supabase.co")).toBe("staging-ref"));
  it("surfaces diagnostic dry-run failure reasons", () => {
    const failed = { dispatch_status: "permanent_failed", provider_message_id: null, attempt_count: 1, failure_category: "account_missing", failure_reason: "No enabled WhatsApp account mapping", requires_template: false, status: "failed", claimed_by: null, next_attempt_at: null };
    expect(dryRunFailureDetails(failed)).toEqual({ dispatch_status: "permanent_failed", status: "failed", attempt_count: 1, failure_category: "account_missing", failure_reason: "No enabled WhatsApp account mapping", requires_template: false, provider_message_id: null, claimed_by: null, next_attempt_at: null });
    expect(() => assertDryRunCompleted(failed)).toThrow(/No enabled WhatsApp account mapping/);
  });
  it("runs diagnostic cleanup after a synthetic failure", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
    const calls: Array<{ table: string; method: string; column?: string; value?: unknown }> = [];
    const db = { from: (table: string) => ({ delete: () => ({ in: (column: string, value: unknown) => { calls.push({ table, method: "in", column, value }); return Promise.resolve({}); }, eq: (column: string, value: unknown) => { calls.push({ table, method: "eq", column, value }); return Promise.resolve({}); } }) }) };
    await expect(runWithDiagnosticCleanup(db, { event: "event", contact: "contact", conversation: "conversation", inbound: "inbound", outbound: "outbound" }, "marker", async () => { throw new Error("synthetic failed"); })).rejects.toThrow("synthetic failed");
    expect(calls.map((call) => call.table)).toEqual(["whatsapp_messages", "whatsapp_session_states", "whatsapp_conversations", "whatsapp_contacts", "whatsapp_webhook_events"]);
    log.mockRestore();
  });
});

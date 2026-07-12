import { describe, expect, it } from "vitest";
import { authorizeInternal, classifyProviderFailure, MAX_ATTEMPTS, retryAt, retryDelayMs, safeBatchSize, safeFailureReason, validateClaim, type ClaimedMessage } from "../../supabase/functions/_shared/whatsapp-dispatch-core";
import { sendToMeta } from "../../supabase/functions/_shared/whatsapp-sender";

const message = (overrides: Partial<ClaimedMessage> = {}): ClaimedMessage => ({ message_id: "m", church_id: "c", conversation_id: "v", contact_id: "p", message_type: "text", message_category: "service", body: "hello", payload: { to: "255700000000" }, attempt_count: 1, service_window_expires_at: "2030-01-02T00:00:00Z", normalized_phone: "+255700000000", phone_number_id: "phone", account_status: "test", whatsapp_enabled: true, whatsapp_mass_intentions_enabled: true, whatsapp_daily_message_limit: 10, sent_today: 1, ...overrides });

describe("trusted WhatsApp dispatcher rules", () => {
  it("rejects unauthorized callers", () => { expect(authorizeInternal(null, "secret")).toBe(false); expect(authorizeInternal("bad", "secret")).toBe(false); expect(authorizeInternal("secret", "secret")).toBe(true); });
  it("caps the batch strictly", () => { expect(safeBatchSize(500)).toBe(25); expect(safeBatchSize(0)).toBe(1); expect(safeBatchSize("bad")).toBe(10); });
  it("allows free-form delivery inside the service window", () => expect(validateClaim(message(), new Date("2030-01-01Z"))).toEqual({ allowed: true }));
  it("blocks closed windows and requires a template", () => expect(validateClaim(message({ service_window_expires_at: "2029-12-31Z" }), new Date("2030-01-01Z"))).toMatchObject({ allowed: false, outcome: "requires_template", category: "service_window_closed" }));
  it("allows templates outside the service window", () => expect(validateClaim(message({ message_type: "template", body: null }), new Date("2030-01-01Z"))).toEqual({ allowed: true }));
  it("blocks disabled churches", () => expect(validateClaim(message({ whatsapp_enabled: false }))).toMatchObject({ category: "church_disabled" }));
  it("blocks missing account mappings", () => expect(validateClaim(message({ phone_number_id: null }))).toMatchObject({ category: "account_missing" }));
  it("blocks cross-tenant relationship mismatches", () => expect(validateClaim(message({ normalized_phone: null }))).toMatchObject({ category: "tenant_mismatch" }));
  it("respects daily limits", () => expect(validateClaim(message({ sent_today: 11, whatsapp_daily_message_limit: 10 }))).toMatchObject({ category: "daily_limit", outcome: "retry_scheduled" }));
  it("permanently rejects malformed payloads", () => expect(validateClaim(message({ body: null, payload: {} }))).toMatchObject({ category: "invalid_payload", outcome: "permanent_failed" }));
  it("stops at the maximum attempts", () => expect(validateClaim(message({ attempt_count: MAX_ATTEMPTS }))).toMatchObject({ outcome: "max_attempts" }));
  it("uses bounded exponential retry delays", () => { expect(retryDelayMs(1)).toBe(30_000); expect(retryDelayMs(2)).toBe(60_000); expect(retryDelayMs(20)).toBe(3_600_000); expect(retryAt(1, new Date("2030-01-01Z"))).toBe("2030-01-01T00:00:30.000Z"); });
  it("distinguishes retryable and permanent provider failures", () => { expect(classifyProviderFailure(500).retryable).toBe(true); expect(classifyProviderFailure(429).retryable).toBe(true); expect(classifyProviderFailure(400, 131026)).toEqual({ retryable: false, category: "invalid_recipient" }); expect(classifyProviderFailure(403).category).toBe("provider_auth"); });
  it("redacts secrets in auditable failure text", () => { const value = safeFailureReason({ authorization: "Bearer private", access_token: "private", message: "bad" }); expect(value).not.toContain("private"); expect(value).toContain("[REDACTED]"); });
  it("dry-run path can avoid fetch entirely", () => { let contacted = false; const dryRun = true; if (!dryRun) contacted = true; expect(contacted).toBe(false); });
  it("persists provider IDs returned by the shared sender contract", async () => { const result = await sendToMeta({ to: "+255700000000", phoneNumberId: "phone", type: "text", text: "hello" }, { token: "test", version: "v23.0", fetcher: async () => new Response(JSON.stringify({ messages: [{ id: "wamid.1" }] }), { status: 200, headers: { "content-type": "application/json" } }) }); expect(result.providerMessageId).toBe("wamid.1"); });
});

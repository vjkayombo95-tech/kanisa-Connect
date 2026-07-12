import { redactSecrets } from "./whatsapp-core.ts";

export const MAX_BATCH = 25;
export const MAX_ATTEMPTS = 5;
export type DispatchOutcome = "sent" | "dry_run_completed" | "retry_scheduled" | "requires_template" | "permanent_failed" | "max_attempts";
export type ClaimedMessage = {
  message_id: string; church_id: string; conversation_id: string; contact_id: string; message_type: string;
  message_category: string | null; body: string | null; payload: Record<string, unknown>; attempt_count: number;
  service_window_expires_at: string | null; normalized_phone: string | null; phone_number_id: string | null; account_status: string | null;
  whatsapp_enabled: boolean | null; whatsapp_mass_intentions_enabled: boolean | null; whatsapp_daily_message_limit: number | null; sent_today: number;
};

export function safeBatchSize(value: unknown) { const parsed = Number(value); return Number.isFinite(parsed) ? Math.min(MAX_BATCH, Math.max(1, Math.trunc(parsed))) : 10; }
export function authorizeInternal(provided: string | null, expected: string | undefined) { return !!expected && !!provided && provided.length === expected.length && provided === expected; }
export function retryDelayMs(attempt: number) { return Math.min(60 * 60_000, 30_000 * 2 ** Math.max(0, attempt - 1)); }
export function retryAt(attempt: number, now = new Date()) { return new Date(now.valueOf() + retryDelayMs(attempt)).toISOString(); }
export function classifyProviderFailure(status: number, code?: number): { retryable: boolean; category: string } {
  if ([400, 404].includes(status) || [100, 131008, 131009, 131026].includes(code ?? -1)) return { retryable: false, category: code === 131026 ? "invalid_recipient" : "invalid_payload" };
  if (status === 401 || status === 403) return { retryable: false, category: "provider_auth" };
  if ([132000, 132001, 132005, 132007, 132015].includes(code ?? -1)) return { retryable: false, category: "template_rejected" };
  return { retryable: status === 408 || status === 429 || status >= 500, category: "retryable_provider" };
}

export function validateClaim(message: ClaimedMessage, now = new Date()): { allowed: true } | { allowed: false; outcome: DispatchOutcome; category: string; reason: string } {
  if (!message.whatsapp_enabled || !message.whatsapp_mass_intentions_enabled) return { allowed: false, outcome: "permanent_failed", category: "church_disabled", reason: "WhatsApp is disabled for this church" };
  if (!message.phone_number_id || !["test", "active"].includes(message.account_status ?? "")) return { allowed: false, outcome: "permanent_failed", category: "account_missing", reason: "No enabled WhatsApp account mapping" };
  if (!message.conversation_id || !message.contact_id || !message.normalized_phone) return { allowed: false, outcome: "permanent_failed", category: "tenant_mismatch", reason: "Conversation or contact does not belong to message church" };
  if (message.sent_today > (message.whatsapp_daily_message_limit ?? 250)) return { allowed: false, outcome: "retry_scheduled", category: "daily_limit", reason: "Church daily safety limit reached" };
  const type = message.message_type; const payloadType = String(message.payload?.type ?? type);
  if (!message.body && !["template", "buttons", "list", "interactive"].includes(payloadType)) return { allowed: false, outcome: "permanent_failed", category: "invalid_payload", reason: "Malformed queued payload" };
  const freeForm = type !== "template";
  if (freeForm && (!message.service_window_expires_at || new Date(message.service_window_expires_at) <= now)) return { allowed: false, outcome: "requires_template", category: "service_window_closed", reason: "Service window is closed; template or member initiation required" };
  if (message.attempt_count >= MAX_ATTEMPTS) return { allowed: false, outcome: "max_attempts", category: "max_attempts", reason: "Maximum dispatch attempts reached" };
  return { allowed: true };
}

export function safeFailureReason(value: unknown) { const redacted = redactSecrets(value); return JSON.stringify(redacted).slice(0, 500); }

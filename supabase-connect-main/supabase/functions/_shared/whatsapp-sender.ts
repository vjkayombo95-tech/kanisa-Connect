import { safeFailureReason } from "./whatsapp-dispatch-core.ts";

export type ProviderSendInput = { to: string; phoneNumberId: string; type: string; text?: string | null; payload?: Record<string, unknown> };
export function buildProviderPayload(input: ProviderSendInput) {
  const existing = input.payload?.provider_payload;
  if (existing && typeof existing === "object") return existing;
  return { messaging_product: "whatsapp", recipient_type: "individual", to: input.to.replace(/^\+/, ""), type: "text", text: { preview_url: false, body: input.text } };
}
export async function sendToMeta(input: ProviderSendInput, config: { token: string; version: string; fetcher?: typeof fetch }) {
  const fetcher = config.fetcher ?? fetch; const providerPayload = buildProviderPayload(input);
  const response = await fetcher(`https://graph.facebook.com/${config.version}/${input.phoneNumberId}/messages`, { method: "POST", headers: { authorization: `Bearer ${config.token}`, "content-type": "application/json" }, body: JSON.stringify(providerPayload) });
  let body: any = {}; try { body = await response.json(); } catch { body = { error: { message: "Non-JSON provider response" } }; }
  return { ok: response.ok, status: response.status, providerMessageId: body?.messages?.[0]?.id ?? null, errorCode: body?.error?.code as number | undefined, failureReason: safeFailureReason(body?.error ?? body), providerPayload };
}

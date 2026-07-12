import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { redactSecrets } from "../_shared/whatsapp-core.ts";
import { buildProviderPayload, sendToMeta } from "../_shared/whatsapp-sender.ts";

type SendInput = { churchId: string; conversationId: string; contactId: string; to: string; type: "text" | "buttons" | "list" | "template"; text?: string; buttons?: Array<{ id: string; title: string }>; sections?: unknown[]; template?: { name: string; language: string; components?: unknown[] }; category?: "service" | "utility" | "marketing" | "authentication"; dryRun?: boolean };
const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

Deno.serve(async (request) => {
  if (request.method !== "POST") return json(405, { error: "Method not allowed" });
  const internalSecret = Deno.env.get("WHATSAPP_INTERNAL_SEND_SECRET");
  if (!internalSecret || request.headers.get("x-whatsapp-internal-secret") !== internalSecret) return json(403, { error: "Forbidden" });
  try {
    const input = await request.json() as SendInput;
    if (!input.churchId || !input.conversationId || !input.contactId || !input.to || !input.type) return json(400, { error: "Missing required fields" });
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const base = { messaging_product: "whatsapp", recipient_type: "individual", to: input.to.replace(/^\+/, "") };
    const providerPayload = input.type === "text" ? undefined : input.type === "buttons"
      ? { ...base, type: "interactive", interactive: { type: "button", body: { text: input.text }, action: { buttons: input.buttons?.slice(0, 3).map((button) => ({ type: "reply", reply: button })) } } }
      : input.type === "list" ? { ...base, type: "interactive", interactive: { type: "list", body: { text: input.text }, action: { button: "Chagua", sections: input.sections } } }
      : { ...base, type: "template", template: { name: input.template?.name, language: { code: input.template?.language }, components: input.template?.components } };
    const payload = buildProviderPayload({ to: input.to, phoneNumberId: Deno.env.get("WHATSAPP_PHONE_NUMBER_ID") ?? "", type: input.type, text: input.text, payload: { provider_payload: providerPayload } });
    if (input.dryRun) {
      const { data, error } = await supabase.from("whatsapp_messages").insert({ church_id: input.churchId, conversation_id: input.conversationId, contact_id: input.contactId, direction: "outbound", message_type: input.type, message_category: input.category ?? "service", status: "dry_run", body: input.text ?? null, payload }).select("id").single();
      if (error) throw error;
      return json(200, { dryRun: true, messageId: data.id, payload });
    }
    const token = Deno.env.get("WHATSAPP_ACCESS_TOKEN"); const phoneId = Deno.env.get("WHATSAPP_PHONE_NUMBER_ID"); const version = Deno.env.get("WHATSAPP_GRAPH_API_VERSION") ?? "v23.0";
    if (!token || !phoneId) return json(503, { error: "WhatsApp sender is not configured" });
    const response = await sendToMeta({ to: input.to, phoneNumberId: phoneId, type: input.type, text: input.text, payload: { provider_payload: payload as Record<string, unknown> } }, { token, version });
    const providerId = response.providerMessageId;
    const { error } = await supabase.from("whatsapp_messages").insert({ church_id: input.churchId, conversation_id: input.conversationId, contact_id: input.contactId, provider_message_id: providerId, direction: "outbound", message_type: input.type, message_category: input.category ?? "service", status: response.ok ? "sent" : "failed", body: input.text ?? null, payload: response.ok ? payload : { request: payload, response: response.failureReason }, failed_at: response.ok ? null : new Date().toISOString(), failure_reason: response.ok ? null : "Provider rejected message" });
    if (error) throw error;
    return json(response.ok ? 200 : 502, response.ok ? { providerMessageId: providerId } : { error: "Provider rejected message" });
  } catch (error) {
    console.error("whatsapp-send", redactSecrets({ message: error instanceof Error ? error.message : "Unknown error" }));
    return json(500, { error: "Send failed" });
  }
});

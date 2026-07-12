import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { normalizeTanzanianPhone, serviceWindow, statusPatch, transition, verifyChallenge, verifyMetaSignature, type NiaState } from "../_shared/whatsapp-core.ts";

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
const MAX_BODY = 1_000_000;
function eventKey(value: any, index: number) { return value.messages?.[0]?.id ?? value.statuses?.[0]?.id + ":" + value.statuses?.[0]?.status ?? `${value.metadata?.phone_number_id}:${index}:${JSON.stringify(value).slice(0, 200)}`; }

Deno.serve(async (request) => {
  if (request.method === "GET") {
    const url = new URL(request.url);
    const verification = verifyChallenge(url.searchParams, Deno.env.get("WHATSAPP_WEBHOOK_VERIFY_TOKEN"));
    return verification.valid ? new Response(verification.challenge, { status: 200 }) : new Response("Forbidden", { status: 403 });
  }
  if (request.method !== "POST") return json(405, { error: "Method not allowed" });
  const declared = Number(request.headers.get("content-length") ?? 0); if (declared > MAX_BODY) return json(413, { error: "Payload too large" });
  const raw = await request.text(); if (new TextEncoder().encode(raw).length > MAX_BODY) return json(413, { error: "Payload too large" });
  if (!await verifyMetaSignature(raw, request.headers.get("x-hub-signature-256"), Deno.env.get("WHATSAPP_APP_SECRET") ?? "")) return json(401, { error: "Invalid signature" });
  let payload: any; try { payload = JSON.parse(raw); } catch { return json(400, { error: "Malformed JSON" }); }
  if (payload.object !== "whatsapp_business_account" || !Array.isArray(payload.entry)) return json(400, { error: "Malformed webhook" });
  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  for (const entry of payload.entry) for (const change of entry.changes ?? []) {
    const value = change.value ?? {}; const key = eventKey(value, 0);
    const { data: inserted } = await db.from("whatsapp_webhook_events").insert({ provider_event_key: key, event_type: value.statuses ? "status" : "message", payload: value }).select("id").maybeSingle();
    if (!inserted) continue; // unique event key makes retries reply-free
    const phoneId = value.metadata?.phone_number_id; const { data: account } = await db.from("whatsapp_accounts").select("church_id").eq("phone_number_id", phoneId).eq("status", "active").maybeSingle();
    if (!account) { await db.from("whatsapp_webhook_events").update({ processing_status: "ignored", processed_at: new Date().toISOString() }).eq("id", inserted.id); continue; }
    await db.from("whatsapp_webhook_events").update({ church_id: account.church_id, processing_status: "processing" }).eq("id", inserted.id);
    for (const status of value.statuses ?? []) {
      const patch = statusPatch(status.status, Number(status.timestamp), status.errors?.[0]?.title);
      await db.from("whatsapp_messages").update(patch).eq("church_id", account.church_id).eq("provider_message_id", status.id);
    }
    for (const message of value.messages ?? []) {
      const e164 = normalizeTanzanianPhone(message.from); if (!e164) continue;
      const profileName = value.contacts?.find((c: any) => c.wa_id === message.from)?.profile?.name ?? null;
      const { data: contact } = await db.from("whatsapp_contacts").upsert({ church_id: account.church_id, wa_id: message.from, normalized_phone: e164, profile_name: profileName }, { onConflict: "church_id,wa_id" }).select("id").single();
      const window = serviceWindow(new Date(Number(message.timestamp) * 1000));
      let { data: conversation } = await db.from("whatsapp_conversations").select("id,current_state,context").eq("church_id", account.church_id).eq("contact_id", contact.id).order("updated_at", { ascending: false }).limit(1).maybeSingle();
      if (!conversation) ({ data: conversation } = await db.from("whatsapp_conversations").insert({ church_id: account.church_id, contact_id: contact.id }).select("id,current_state,context").single());
      const text = message.text?.body ?? message.interactive?.button_reply?.title ?? message.interactive?.list_reply?.title ?? "";
      await db.from("whatsapp_messages").insert({ church_id: account.church_id, conversation_id: conversation.id, contact_id: contact.id, provider_message_id: message.id, direction: "inbound", message_type: message.type, status: "received", body: text, payload: message });
      const result = transition(conversation.current_state as NiaState, conversation.context ?? {}, text);
      await db.from("whatsapp_conversations").update({ current_state: result.state, context: result.context, service_window_opened_at: window.openedAt, service_window_expires_at: window.expiresAt, last_inbound_at: window.openedAt }).eq("id", conversation.id).eq("church_id", account.church_id);
      await db.from("whatsapp_session_states").upsert({ conversation_id: conversation.id, church_id: account.church_id, state: result.state, collected_data: result.context, expires_at: window.expiresAt });
      // Queue only. A separate trusted worker invokes whatsapp-send; webhook never calls a billable API.
      await db.from("whatsapp_messages").insert({ church_id: account.church_id, conversation_id: conversation.id, contact_id: contact.id, direction: "outbound", message_type: "text", message_category: "service", status: "queued", dispatch_status: "queued", body: result.message, payload: { to: message.from, dry_run_safe: true } });
    }
    await db.from("whatsapp_webhook_events").update({ processing_status: "processed", processed_at: new Date().toISOString() }).eq("id", inserted.id);
  }
  return json(200, { received: true });
});

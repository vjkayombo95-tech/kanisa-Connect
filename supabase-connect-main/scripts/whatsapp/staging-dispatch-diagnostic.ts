import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { transition } from "../../supabase/functions/_shared/whatsapp-core.ts";

const ACK = "I_UNDERSTAND_DRY_RUN_ONLY";
const EXPECTED_SYNTHETIC_CHURCH_ID = "27fbab53-6b08-4cbd-a2f7-aaefa2a2dc51";
export const dryRunResultFields = "dispatch_status,provider_message_id,attempt_count,failure_category,failure_reason,requires_template,status,claimed_by,next_attempt_at";
type DiagnosticIds = { event?: string; contact?: string; conversation?: string; inbound?: string; outbound?: string };
type DryRunResult = {
  dispatch_status: string | null;
  provider_message_id: string | null;
  attempt_count: number | null;
  failure_category: string | null;
  failure_reason: string | null;
  requires_template: boolean | null;
  status: string | null;
  claimed_by: string | null;
  next_attempt_at: string | null;
};
type SafeDispatchResponse = {
  projectRef?: string | null;
  claimedDiagnostics?: Array<{
    message_id: string;
    church_id: string;
    whatsapp_enabled: boolean | null;
    whatsapp_mass_intentions_enabled: boolean | null;
    account_status: string | null;
    has_phone_number_id: boolean;
    has_normalized_phone: boolean;
  }>;
};

export function dryRunFailureDetails(completed: DryRunResult) {
  return {
    dispatch_status: completed.dispatch_status,
    status: completed.status,
    attempt_count: completed.attempt_count,
    failure_category: completed.failure_category,
    failure_reason: completed.failure_reason,
    requires_template: completed.requires_template,
    provider_message_id: completed.provider_message_id,
    claimed_by: completed.claimed_by,
    next_attempt_at: completed.next_attempt_at,
  };
}

export function assertDryRunCompleted(completed: DryRunResult) {
  if (completed.dispatch_status !== "dry_run_completed" || completed.provider_message_id) throw new Error(`Unexpected dry-run result: ${JSON.stringify(dryRunFailureDetails(completed))}`);
}

export function safeProjectRefFromSupabaseUrl(url: string) {
  return new URL(url).hostname.split('.')[0];
}

export async function cleanupDiagnosticRecords(db: any, ids: DiagnosticIds, marker: string) {
  if (ids.outbound || ids.inbound) await db.from("whatsapp_messages").delete().in("id", [ids.outbound, ids.inbound].filter(Boolean));
  if (ids.conversation) await db.from("whatsapp_session_states").delete().eq("conversation_id", ids.conversation);
  if (ids.conversation) await db.from("whatsapp_conversations").delete().eq("id", ids.conversation);
  if (ids.contact) await db.from("whatsapp_contacts").delete().eq("id", ids.contact);
  if (ids.event) await db.from("whatsapp_webhook_events").delete().eq("id", ids.event);
  console.log(`Cleaned diagnostic records for ${marker}.`);
}

export async function runWithDiagnosticCleanup<T>(db: any, ids: DiagnosticIds, marker: string, action: () => Promise<T>) {
  try { return await action(); } finally { await cleanupDiagnosticRecords(db, ids, marker); }
}

export async function main(argv = process.argv, env = process.env) {
  const environment = env.KANISA_ENVIRONMENT;
  const dryRun = env.WHATSAPP_DIAGNOSTIC_DRY_RUN === "true";
  if (!['local', 'staging'].includes(environment ?? '')) throw new Error("Refusing: KANISA_ENVIRONMENT must be local or staging.");
  if (!dryRun) throw new Error("Refusing: WHATSAPP_DIAGNOSTIC_DRY_RUN must be true.");
  if (env.KANISA_WHATSAPP_STAGING_ACK !== ACK) throw new Error(`Refusing: set KANISA_WHATSAPP_STAGING_ACK=${ACK}.`);

  const url = env.SUPABASE_URL; const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;
  const dispatchSecret = env.WHATSAPP_DISPATCH_SECRET;
  if (!url || !serviceKey || !dispatchSecret) throw new Error("Missing staging/local SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, or WHATSAPP_DISPATCH_SECRET.");
  const projectRef = safeProjectRefFromSupabaseUrl(url);
  const configuredRef = /project_id\s*=\s*"([^"]+)"/.exec(readFileSync(new URL("../../supabase/config.toml", import.meta.url), "utf8"))?.[1];
  if (environment === 'staging' && configuredRef && projectRef === configuredRef) throw new Error("Refusing: target matches the repository's documented project reference; use a separate staging project.");
  if (/prod/i.test(url) || projectRef === env.PRODUCTION_SUPABASE_PROJECT_REF) throw new Error("Refusing: target matches production configuration.");
  if (Object.keys(env).some((key) => /^VITE_.*WHATSAPP/i.test(key))) throw new Error("Refusing: VITE_ WhatsApp secrets are present.");

  const db = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: schema, error: schemaError } = await db.rpc("whatsapp_dispatch_schema_diagnostics");
  if (schemaError) throw schemaError;
  if (!Object.values(schema as Record<string, boolean>).every(Boolean)) throw new Error(`Schema diagnostic failed: ${JSON.stringify(schema)}`);
  console.log("Schema/RLS/RPC/constraint diagnostics passed.");

  if (!argv.includes("--synthetic")) {
    console.log("Read-only checks complete. Add --synthetic to create and clean up dry-run records.");
    return;
  }
  const churchId = env.WHATSAPP_DIAGNOSTIC_CHURCH_ID;
  if (!churchId) throw new Error("WHATSAPP_DIAGNOSTIC_CHURCH_ID is required for --synthetic.");
  if (churchId !== EXPECTED_SYNTHETIC_CHURCH_ID) throw new Error(`Refusing: WHATSAPP_DIAGNOSTIC_CHURCH_ID must be ${EXPECTED_SYNTHETIC_CHURCH_ID} for this staging diagnostic.`);
  console.log(`Diagnostic source project ref: ${projectRef}. Function URL is built from SUPABASE_URL.`);
  const marker = `kc-diagnostic-${crypto.randomUUID()}`; const ids: DiagnosticIds = {};
  await runWithDiagnosticCleanup(db, ids, marker, async () => {
    const { data: event, error: eventError } = await db.from("whatsapp_webhook_events").insert({ church_id: churchId, provider_event_key: marker, event_type: "diagnostic_inbound", payload: { diagnostic: marker }, processing_status: "processed", processed_at: new Date().toISOString() }).select("id").single();
    if (eventError) throw eventError; ids.event = event.id;
    const { data: contact, error: contactError } = await db.from("whatsapp_contacts").insert({ church_id: churchId, wa_id: marker, normalized_phone: "+255700000000", profile_name: marker }).select("id").single();
    if (contactError) throw contactError; ids.contact = contact.id;
    const expires = new Date(Date.now() + 24 * 3_600_000).toISOString();
    const { data: conversation, error: conversationError } = await db.from("whatsapp_conversations").insert({ church_id: churchId, contact_id: ids.contact, current_state: "SELECT_INTENTION_TYPE", service_window_opened_at: new Date().toISOString(), service_window_expires_at: expires, context: {} }).select("id").single();
    if (conversationError) throw conversationError; ids.conversation = conversation.id;
    const { data: inbound, error: inboundError } = await db.from("whatsapp_messages").insert({ church_id: churchId, conversation_id: ids.conversation, contact_id: ids.contact, provider_message_id: marker, direction: "inbound", message_type: "text", status: "received", body: "MENU", payload: { diagnostic: marker } }).select("id").single();
    if (inboundError) throw inboundError; ids.inbound = inbound.id;
    const flow = transition("IDLE", {}, "MENU");
    if (flow.state !== "SELECT_INTENTION_TYPE") throw new Error("State-machine diagnostic failed.");
    const reply = flow.message;
    const { data: outbound, error: outboundError } = await db.from("whatsapp_messages").insert({ church_id: churchId, conversation_id: ids.conversation, contact_id: ids.contact, direction: "outbound", message_type: "text", message_category: "service", status: "queued", dispatch_status: "queued", body: reply, payload: { to: "255700000000", diagnostic: marker } }).select("id,church_id").single();
    if (outboundError) throw outboundError; ids.outbound = outbound.id;
    if (outbound.church_id !== EXPECTED_SYNTHETIC_CHURCH_ID) throw new Error(`Synthetic outbound church_id mismatch: ${outbound.church_id}`);
    console.log(`Synthetic outbound row confirmed: ${JSON.stringify({ message_id: ids.outbound, church_id: outbound.church_id })}`);
    const endpoint = `${url}/functions/v1/whatsapp-dispatch`;
    const response = await fetch(endpoint, { method: "POST", headers: { "content-type": "application/json", "x-whatsapp-dispatch-secret": dispatchSecret }, body: JSON.stringify({ dryRun: true, batchSize: 1, workerId: marker, messageId: ids.outbound }) });
    if (!response.ok) throw new Error(`Dry-run dispatcher returned ${response.status}.`);
    const dispatchBody = await response.json() as SafeDispatchResponse;
    console.log(`Dispatcher dry-run project check: ${JSON.stringify({ diagnostic_project_ref: projectRef, edge_project_ref: dispatchBody.projectRef ?? null, same_project: dispatchBody.projectRef === projectRef })}`);
    console.log(`Dispatcher claim diagnostics before validation: ${JSON.stringify(dispatchBody.claimedDiagnostics ?? [])}`);
    const { data: completed, error: completedError } = await db.from("whatsapp_messages").select(dryRunResultFields).eq("id", ids.outbound).single();
    if (completedError) throw completedError;
    assertDryRunCompleted(completed as DryRunResult);
    console.log("Synthetic state-machine reply queued and dry-run completed; no provider message ID exists, so Meta was not contacted.");
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main();

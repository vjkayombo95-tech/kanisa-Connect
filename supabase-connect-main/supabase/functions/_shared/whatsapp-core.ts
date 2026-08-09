export const STATES = ["IDLE", "SELECT_INTENTION_TYPE", "ENTER_INTENTION_DETAILS", "SELECT_DATE", "SELECT_MASS_TIME", "CONFIRM_SUMMARY", "AWAITING_PAYMENT", "COMPLETED", "CANCELLED"] as const;
export type NiaState = typeof STATES[number];
export type FlowContext = { intentionType?: string; details?: string; date?: string; massTime?: string; massName?: string };
export type FlowResult = { state: NiaState; context: FlowContext; message: string; action?: "cancel" | "restart" | "create_draft" | "help" };

export const MESSAGES = {
  menu: "Karibu Nia ya Misa. Chagua aina:\n1. Marehemu\n2. Shukrani\n3. Uponyaji\n4. Nia maalum",
  details: "Andika maelezo mafupi ya nia yako.",
  date: "Andika tarehe ya Misa (YYYY-MM-DD).",
  time: "Chagua namba ya muda wa Misa uliopo.",
  cancelled: "Ombi limeghairiwa. Andika MENU kuanza tena.",
  help: "Andika MENU kuanza, RUDI kurudi, ANZA UPYA kuanza tena, au GHAIRI kusitisha.",
} as const;

export function normalizeCommand(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().replace(/\s+/g, " ").toUpperCase();
}

export function normalizeTanzanianPhone(value: string): string | null {
  const digits = value.trim().replace(/[\s().+-]/g, "");
  if (/^07\d{8}$/.test(digits)) return `+255${digits.slice(1)}`;
  if (/^2557\d{8}$/.test(digits)) return `+${digits}`;
  return null;
}

export function isEntryCommand(command: string): boolean {
  return ["NIA YA MISA", "NIA", "MISA INTENTION", "NATAKA NIA", "NATAKA KUWEKA NIA", "MENU"].includes(command);
}

const TYPES: Record<string, string> = { "1": "DECEASED", MAREHEMU: "DECEASED", DECEASED: "DECEASED", "2": "THANKSGIVING", SHUKRANI: "THANKSGIVING", THANKSGIVING: "THANKSGIVING", "3": "HEALING", UPONYAJI: "HEALING", HEALING: "HEALING", "4": "SPECIAL", MAALUM: "SPECIAL", "NIA MAALUM": "SPECIAL", SPECIAL: "SPECIAL" };
const previous: Partial<Record<NiaState, NiaState>> = { ENTER_INTENTION_DETAILS: "SELECT_INTENTION_TYPE", SELECT_DATE: "ENTER_INTENTION_DETAILS", SELECT_MASS_TIME: "SELECT_DATE", CONFIRM_SUMMARY: "SELECT_MASS_TIME", AWAITING_PAYMENT: "CONFIRM_SUMMARY" };

export function isPastIsoDate(value: string, today = new Date()): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return true;
  const parsed = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(parsed.valueOf()) || parsed.toISOString().slice(0, 10) !== value) return true;
  const current = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
  return parsed < current;
}

export function transition(state: NiaState, context: FlowContext, input: string, options: { today?: Date; availableMasses?: Array<{ id: string; label: string; available: boolean }> } = {}): FlowResult {
  const command = normalizeCommand(input);
  if (command === "MSAADA") return { state, context, message: MESSAGES.help, action: "help" };
  if (command === "GHAIRI") return { state: "CANCELLED", context: {}, message: MESSAGES.cancelled, action: "cancel" };
  if (command === "ANZA UPYA" || isEntryCommand(command)) return { state: "SELECT_INTENTION_TYPE", context: {}, message: MESSAGES.menu, action: "restart" };
  if (command === "RUDI") {
    const next = previous[state] ?? "SELECT_INTENTION_TYPE";
    return { state: next, context, message: next === "SELECT_INTENTION_TYPE" ? MESSAGES.menu : next === "ENTER_INTENTION_DETAILS" ? MESSAGES.details : next === "SELECT_DATE" ? MESSAGES.date : MESSAGES.time };
  }
  if (state === "IDLE" || state === "CANCELLED" || state === "COMPLETED") return { state, context, message: MESSAGES.help };
  if (state === "SELECT_INTENTION_TYPE") {
    const intentionType = TYPES[command];
    return intentionType ? { state: "ENTER_INTENTION_DETAILS", context: { ...context, intentionType }, message: MESSAGES.details } : { state, context, message: `Sijaelewa. ${MESSAGES.menu}` };
  }
  if (state === "ENTER_INTENTION_DETAILS") return input.trim().length >= 3 ? { state: "SELECT_DATE", context: { ...context, details: input.trim() }, message: MESSAGES.date } : { state, context, message: "Tafadhali andika maelezo yenye angalau herufi 3." };
  if (state === "SELECT_DATE") return isPastIsoDate(input.trim(), options.today) ? { state, context, message: "Tarehe si sahihi au imepita. Andika YYYY-MM-DD." } : { state: "SELECT_MASS_TIME", context: { ...context, date: input.trim() }, message: MESSAGES.time };
  if (state === "SELECT_MASS_TIME") {
    const masses = options.availableMasses ?? [];
    const selected = masses[Number(command) - 1] ?? masses.find((m) => normalizeCommand(m.label) === command || m.id === input.trim());
    return selected?.available ? { state: "CONFIRM_SUMMARY", context: { ...context, massTime: selected.id, massName: selected.label }, message: `Thibitisha: ${context.intentionType}; ${context.details}; ${context.date}; ${selected.label}. Jibu NDIYO au HAPANA.` } : { state, context, message: "Misa hiyo haipatikani au imejaa. Chagua muda mwingine." };
  }
  if (state === "CONFIRM_SUMMARY") return ["NDIYO", "YES", "1"].includes(command) ? { state: "AWAITING_PAYMENT", context, message: "Ombi limehifadhiwa. Tumia kiungo salama cha malipo utakachotumiwa.", action: "create_draft" } : ["HAPANA", "NO", "2"].includes(command) ? { state: "SELECT_INTENTION_TYPE", context: {}, message: MESSAGES.menu, action: "restart" } : { state, context, message: "Jibu NDIYO kuthibitisha au HAPANA kuanza tena." };
  return { state, context, message: "Tunasubiri uthibitisho wa malipo. Andika GHAIRI kusitisha." };
}

export async function verifyMetaSignature(rawBody: string, signature: string | null, secret: string): Promise<boolean> {
  if (!signature?.startsWith("sha256=") || !secret) return false;
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const actual = new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(rawBody)));
  const expected = signature.slice(7);
  if (expected.length !== actual.length * 2) return false;
  let mismatch = 0;
  for (let i = 0; i < actual.length; i++) mismatch |= actual[i] ^ Number.parseInt(expected.slice(i * 2, i * 2 + 2), 16);
  return mismatch === 0;
}

export function redactSecrets(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redactSecrets);
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([k, v]) => [/authorization|token|secret|apikey|api_key/i.test(k) ? k : k, /authorization|token|secret|apikey|api_key/i.test(k) ? "[REDACTED]" : redactSecrets(v)]));
  return value;
}

export function serviceWindow(now = new Date(), hours = 24) { return { openedAt: now.toISOString(), expiresAt: new Date(now.valueOf() + hours * 3_600_000).toISOString() }; }

export function verifyChallenge(params: URLSearchParams, expectedToken: string | undefined) {
  return params.get("hub.mode") === "subscribe" && !!expectedToken && params.get("hub.verify_token") === expectedToken
    ? { valid: true as const, challenge: params.get("hub.challenge") ?? "" } : { valid: false as const, challenge: "" };
}

export function statusPatch(status: string, timestamp: number, error?: string) {
  const at = new Date(timestamp * 1000).toISOString();
  if (status === "delivered") return { status, delivered_at: at };
  if (status === "read") return { status, read_at: at };
  if (status === "failed") return { status, failed_at: at, failure_reason: error ?? "Provider failure" };
  return { status };
}

export function paymentDecision(input: { alreadyProcessed: boolean; verified: boolean; slotAvailable: boolean; autoConfirm: boolean; manualReview: boolean }) {
  if (input.alreadyProcessed) return { outcome: "duplicate" as const, confirm: false };
  if (!input.verified) return { outcome: "unverified" as const, confirm: false };
  if (!input.slotAvailable) return { outcome: "capacity_conflict" as const, confirm: false };
  if (input.manualReview || !input.autoConfirm) return { outcome: "manual_review" as const, confirm: false };
  return { outcome: "confirmed" as const, confirm: true };
}

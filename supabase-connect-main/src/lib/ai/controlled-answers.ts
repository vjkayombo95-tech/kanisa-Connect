import { supabase } from "@/integrations/supabase/client";
import { fetchParishCalendarFeed } from "@/lib/calendar";

import { getKanisaAITargetRoute } from "./registry";
import type { KanisaAIContext, KanisaAIIntent } from "./types";

export type ControlledKanisaAIIntent =
  | "PENDING_INVITATIONS"
  | "UPCOMING_EVENTS"
  | "UNRESOLVED_PRAYER_REQUESTS"
  | "CONTRIBUTION_SUMMARY";

export type ControlledKanisaAIAnswer = {
  intent: ControlledKanisaAIIntent;
  summary: string;
  details?: Array<{ id: string; title: string; metadata?: string }>;
  metrics?: Record<string, string | number>;
  action?: { label: string; route: string };
  status: "success" | "empty" | "forbidden" | "error";
};

const quickQuestions: Record<string, ControlledKanisaAIIntent> = {
  "show pending invitations.": "PENDING_INVITATIONS",
  "what events are coming up?": "UPCOMING_EVENTS",
  "show unresolved prayer requests.": "UNRESOLVED_PRAYER_REQUESTS",
  "show contribution trends.": "CONTRIBUTION_SUMMARY",
};

function normalize(input: string) {
  return input.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^\p{L}\p{N}\s]/gu, " ").replace(/\s+/g, " ").trim();
}

export function getControlledQuickQuestionIntent(input: string) {
  return quickQuestions[input.trim().toLowerCase()] ?? null;
}

export function classifyControlledKanisaAIIntent(input: string, lastIntent?: ControlledKanisaAIIntent | null): ControlledKanisaAIIntent | null {
  const text = normalize(input);
  if (!text) return null;
  if (isAmbiguousControlledKanisaAIInput(input)) return null;

  const matches: ControlledKanisaAIIntent[] = [];
  if (/\b(invitation|invitations|invite|invites|mialiko)\b/.test(text)) matches.push("PENDING_INVITATIONS");
  if (/\b(event|events|calendar|matukio|tukio)\b/.test(text) || text.includes("happening this week")) matches.push("UPCOMING_EVENTS");
  if (/\b(prayer request|prayer requests|maombi)\b/.test(text) && /\b(unresolved|waiting|urgent|pending|hayajashughulikiwa|bado)\b/.test(text)) matches.push("UNRESOLVED_PRAYER_REQUESTS");
  if ((/\b(contribution|contributions|giving|collect|collection|collected|michango|tumekusanya)\b/.test(text) && /\b(trend|trends|doing|month|compare|inaendaje|mwezi)\b/.test(text)) || text === "michango inaendaje") matches.push("CONTRIBUTION_SUMMARY");

  const unique = [...new Set(matches)];
  if (unique.length === 1) return unique[0];
  if (unique.length > 1) return null;

  if (lastIntent === "CONTRIBUTION_SUMMARY" && /^(what about )?last month$|^(na )?mwezi uliopita$/.test(text)) return lastIntent;
  return null;
}

export function isAmbiguousControlledKanisaAIInput(input: string) {
  const text = normalize(input);
  const domains = [
    /\b(invitation|invitations|invite|invites|mialiko)\b/,
    /\b(event|events|calendar|matukio|tukio)\b/,
    /\b(prayer request|prayer requests|maombi)\b/,
    /\b(contribution|contributions|giving|collect|collection|collected|michango|tumekusanya)\b/,
  ];
  return domains.filter((pattern) => pattern.test(text)).length > 1;
}

function isAuthorized(intent: ControlledKanisaAIIntent, context: KanisaAIContext) {
  const role = context.role;
  if (intent === "PENDING_INVITATIONS") return context.workspace === "church_admin" && (role === "church_admin" || role === "secretary");
  if (intent === "UPCOMING_EVENTS") return context.workspace !== "super_admin" && Boolean(role) && role !== "community_leader";
  if (intent === "UNRESOLVED_PRAYER_REQUESTS") return (context.workspace === "church_admin" || context.workspace === "pastoral") && ["church_admin", "pastor", "secretary"].includes(role ?? "");
  return (context.workspace === "church_admin" || context.workspace === "finance") && ["church_admin", "treasurer"].includes(role ?? "");
}

function forbidden(intent: ControlledKanisaAIIntent): ControlledKanisaAIAnswer {
  const area = intent === "CONTRIBUTION_SUMMARY" ? "contribution details" : intent === "UNRESOLVED_PRAYER_REQUESTS" ? "unresolved prayer requests" : intent === "PENDING_INVITATIONS" ? "invitation details" : "upcoming events";
  return { intent, status: "forbidden", summary: `You don't currently have access to ${area}.` };
}

function actionFor(intent: ControlledKanisaAIIntent, context: KanisaAIContext) {
  const route = getKanisaAITargetRoute(intent, context);
  if (!route) return undefined;
  const labels: Record<ControlledKanisaAIIntent, string> = {
    PENDING_INVITATIONS: "Review invitations",
    UPCOMING_EVENTS: "View events",
    UNRESOLVED_PRAYER_REQUESTS: "Review prayer requests",
    CONTRIBUTION_SUMMARY: "View contribution details",
  };
  return { label: labels[intent], route };
}

function monthBounds(now: Date) {
  const currentStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const nextStart = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const previousStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const date = (value: Date) => `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;
  return { currentStart: date(currentStart), nextStart: date(nextStart), previousStart: date(previousStart) };
}

function formatTzs(value: number) {
  return `TZS ${value.toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
}

export async function answerControlledKanisaAIIntent(intent: ControlledKanisaAIIntent, context: KanisaAIContext, now = new Date()): Promise<ControlledKanisaAIAnswer> {
  if (!context.church.id || !isAuthorized(intent, context)) return forbidden(intent);
  const churchId = context.church.id;
  const action = actionFor(intent, context);

  try {
    if (intent === "PENDING_INVITATIONS") {
      const { data, error } = await supabase.from("invitations").select("id, status, created_at").eq("church_id", churchId).eq("status", "pending").order("created_at", { ascending: true });
      if (error) throw error;
      const rows = data ?? [];
      if (!rows.length) return { intent, status: "empty", summary: "There are currently no pending invitations. You're all caught up.", metrics: { pending: 0 }, action };
      const oldestDays = Math.max(0, Math.floor((now.getTime() - new Date(rows[0].created_at).getTime()) / 86_400_000));
      return { intent, status: "success", summary: `There ${rows.length === 1 ? "is" : "are"} ${rows.length} pending invitation${rows.length === 1 ? "" : "s"}. The oldest has been waiting for ${oldestDays} day${oldestDays === 1 ? "" : "s"}.`, metrics: { pending: rows.length, oldestPendingDays: oldestDays }, action };
    }

    if (intent === "UPCOMING_EVENTS") {
      const end = new Date(now);
      end.setDate(end.getDate() + 7);
      const events = await fetchParishCalendarFeed({ churchId, workspace: context.workspace, from: now, to: end });
      const upcoming = events
        .filter((event) => !event.church_id || event.church_id === churchId)
        .map((event) => ({ ...event, date: new Date(event.startsAt ?? event.start_date ?? event.start_time ?? "") }))
        .filter((event) => Number.isFinite(event.date.getTime()) && event.date >= now && event.date < end)
        .sort((a, b) => a.date.getTime() - b.date.getTime())
        .slice(0, 5);
      if (!upcoming.length) return { intent, status: "empty", summary: "There are no upcoming events in the next 7 days.", metrics: { nextSevenDays: 0 }, action };
      return {
        intent,
        status: "success",
        summary: `There ${upcoming.length === 1 ? "is" : "are"} ${upcoming.length} upcoming event${upcoming.length === 1 ? "" : "s"} in the next 7 days.`,
        details: upcoming.map((event) => ({ id: String(event.id), title: String(event.title), metadata: event.date.toLocaleString(context.language === "sw" ? "sw-TZ" : "en-TZ", { weekday: "long", hour: "numeric", minute: "2-digit" }) })),
        metrics: { nextSevenDays: upcoming.length },
        action,
      };
    }

    if (intent === "UNRESOLVED_PRAYER_REQUESTS") {
      const { data, error } = await supabase.from("prayer_requests").select("id, status").eq("church_id", churchId).eq("status", "pending");
      if (error) throw error;
      const count = data?.length ?? 0;
      if (!count) return { intent, status: "empty", summary: "There are currently no unresolved prayer requests.", metrics: { unresolved: 0 }, action };
      return { intent, status: "success", summary: `There ${count === 1 ? "is" : "are"} ${count} unresolved prayer request${count === 1 ? "" : "s"}.`, metrics: { unresolved: count }, action };
    }

    const { currentStart, nextStart, previousStart } = monthBounds(now);
    const { data, error } = await supabase.from("contributions").select("id, amount, date").eq("church_id", churchId).gte("date", previousStart).lt("date", nextStart);
    if (error) throw error;
    const rows = data ?? [];
    const current = rows.filter((row) => row.date >= currentStart);
    const previous = rows.filter((row) => row.date >= previousStart && row.date < currentStart);
    const total = (items: typeof rows) => items.reduce((sum, row) => sum + Number(row.amount ?? 0), 0);
    const currentTotal = total(current);
    const previousTotal = total(previous);
    if (!current.length) return { intent, status: "empty", summary: "There are no recorded contributions for this month.", metrics: { currentMonthTotal: 0, currentMonthPayments: 0, previousMonthTotal: previousTotal }, action };
    const comparison = previousTotal > 0
      ? `That is ${Math.abs(((currentTotal - previousTotal) / previousTotal) * 100).toFixed(0)}% ${currentTotal >= previousTotal ? "higher" : "lower"} than last month, when ${formatTzs(previousTotal)} was collected.`
      : "There is not enough previous-month activity for a meaningful percentage comparison.";
    return { intent, status: "success", summary: `Contributions this month total ${formatTzs(currentTotal)} from ${current.length} recorded payment${current.length === 1 ? "" : "s"}. ${comparison}`, metrics: { currentMonthTotal: currentTotal, currentMonthPayments: current.length, previousMonthTotal: previousTotal }, action };
  } catch {
    return { intent, status: "error", summary: "Kanisa AI could not load this information right now. Please try again." };
  }
}

export function isControlledKanisaAIIntent(intent: KanisaAIIntent): intent is ControlledKanisaAIIntent {
  return ["PENDING_INVITATIONS", "UPCOMING_EVENTS", "UNRESOLVED_PRAYER_REQUESTS", "CONTRIBUTION_SUMMARY"].includes(intent);
}

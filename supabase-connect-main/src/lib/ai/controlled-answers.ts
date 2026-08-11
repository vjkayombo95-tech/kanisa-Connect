import { supabase } from "@/integrations/supabase/client";
import { fetchParishCalendarFeed } from "@/lib/calendar";
import { fetchMemberLivestream } from "@/lib/church-livestreams";
import { fetchMemberRadioStations } from "@/lib/church-radio";
import { fetchContributionSummary, currentAndPreviousMonthPeriod } from "./contribution-report";

import { getKanisaAITargetRoute } from "./registry";
import type { KanisaAIContext, KanisaAIIntent } from "./types";

export type ControlledKanisaAIIntent =
  | "PENDING_INVITATIONS"
  | "UPCOMING_EVENTS"
  | "UNRESOLVED_PRAYER_REQUESTS"
  | "CONTRIBUTION_SUMMARY"
  | "MEMBER_COUNT"
  | "NEW_MEMBERS"
  | "OUTSTANDING_PLEDGES"
  | "PENDING_MASS_INTENTIONS"
  | "LIVE_MEDIA_STATUS"
  | "ATTENTION_SUMMARY";

export type ControlledReportType = "CONTRIBUTION_SUMMARY_REPORT";
export type ReportPeriod =
  | { kind: "current_month" }
  | { kind: "previous_month" }
  | { kind: "last_n_months"; months: 3 }
  | { kind: "custom"; startDate: string; endDate: string };

export type ControlledFollowUp = {
  id: string;
  type: "navigate" | "controlled_intent" | "generate_report" | "select_period" | "dismiss";
  label: string;
  intent?: ControlledKanisaAIIntent;
  route?: string;
  reportType?: ControlledReportType;
  period?: ReportPeriod;
};

export type ControlledKanisaAIAnswer = {
  intent: ControlledKanisaAIIntent;
  summary: string;
  details?: Array<{ id: string; title: string; metadata?: string }>;
  metrics?: Record<string, string | number>;
  action?: { label: string; route: string };
  followUps?: ControlledFollowUp[];
  partial?: boolean;
  status: "success" | "empty" | "forbidden" | "error";
};

const quickQuestions: Record<string, ControlledKanisaAIIntent> = {
  "show pending invitations.": "PENDING_INVITATIONS",
  "what events are coming up?": "UPCOMING_EVENTS",
  "show unresolved prayer requests.": "UNRESOLVED_PRAYER_REQUESTS",
  "show contribution trends.": "CONTRIBUTION_SUMMARY",
  "how many members do we have?": "MEMBER_COUNT", "any new members?": "NEW_MEMBERS", "how much is still unpaid?": "OUTSTANDING_PLEDGES", "any mass intentions waiting?": "PENDING_MASS_INTENTIONS", "is anything live?": "LIVE_MEDIA_STATUS", "what needs my attention?": "ATTENTION_SUMMARY",
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
  if (/\b(member|members|waumini)\b/.test(text) && /\b(how many|count|registered|wangapi|idadi)\b/.test(text) && !/\b(new|joined|wapya|wamejiunga)\b/.test(text)) matches.push("MEMBER_COUNT");
  if (/\b(new members|joined this month|waumini wapya|wamejiunga mwezi huu)\b/.test(text) || (text.includes("waumini") && text.includes("wapya"))) matches.push("NEW_MEMBERS");
  if (text.includes("how much is still unpaid") || (/\b(unpaid|outstanding|still owe|haijalipwa|hazijalipwa)\b/.test(text) && /\b(pledge|pledges|contribution|contributions|michango|ahadi)\b/.test(text))) matches.push("OUTSTANDING_PLEDGES");
  if (/\b(mass intention|mass intentions|nia za misa)\b/.test(text) && /\b(pending|waiting|zinazosubiri|hazijashughulikiwa|zipo)\b/.test(text)) matches.push("PENDING_MASS_INTENTIONS");
  if (/\b(live|radio|mubashara)\b/.test(text) && /\b(mass|anything|what|which|available|misa|kitu|gani|ipo|live|radio)\b/.test(text)) matches.push("LIVE_MEDIA_STATUS");
  if (/\b(needs my attention|should i work on|anything pending|should i do today|cha kushughulikia|nifanye nini leo|kazi gani zinazosubiri)\b/.test(text)) matches.push("ATTENTION_SUMMARY");

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
    /\b(contribution|contributions|giving|collect|collection|collected|michango|tumekusanya|pledge|pledges|ahadi)\b/,
    /\b(member|members|waumini)\b/,
    /\b(mass intention|mass intentions|nia za misa)\b/,
    /\b(live|radio|mubashara)\b/,
  ];
  return domains.filter((pattern) => pattern.test(text)).length > 1;
}

export function isAuthorizedControlledIntent(intent: ControlledKanisaAIIntent, context: KanisaAIContext) {
  const role = context.role;
  if (intent === "PENDING_INVITATIONS") return context.workspace === "church_admin" && (role === "church_admin" || role === "secretary");
  if (intent === "UPCOMING_EVENTS") return context.workspace !== "super_admin" && Boolean(role) && role !== "community_leader";
  if (intent === "UNRESOLVED_PRAYER_REQUESTS") return (context.workspace === "church_admin" || context.workspace === "pastoral") && ["church_admin", "pastor", "secretary"].includes(role ?? "");
  if (intent === "CONTRIBUTION_SUMMARY" || intent === "OUTSTANDING_PLEDGES") return (context.workspace === "church_admin" || context.workspace === "finance") && ["church_admin", "treasurer"].includes(role ?? "");
  if (intent === "MEMBER_COUNT" || intent === "NEW_MEMBERS") return context.workspace === "church_admin" && ["church_admin", "secretary"].includes(role ?? "");
  if (intent === "PENDING_MASS_INTENTIONS") return (context.workspace === "church_admin" || context.workspace === "pastoral") && ["church_admin", "pastor", "secretary"].includes(role ?? "");
  if (intent === "LIVE_MEDIA_STATUS") return context.workspace !== "super_admin" && role !== "community_leader" && Boolean(role);
  if (intent === "ATTENTION_SUMMARY") return ["church_admin", "secretary", "pastor", "treasurer", "member"].includes(role ?? "");
  return false;
}

function forbidden(intent: ControlledKanisaAIIntent): ControlledKanisaAIAnswer {
  const areas: Record<ControlledKanisaAIIntent, string> = { PENDING_INVITATIONS: "invitation details", UPCOMING_EVENTS: "upcoming events", UNRESOLVED_PRAYER_REQUESTS: "unresolved prayer requests", CONTRIBUTION_SUMMARY: "contribution details", MEMBER_COUNT: "member totals", NEW_MEMBERS: "new-member details", OUTSTANDING_PLEDGES: "pledge details", PENDING_MASS_INTENTIONS: "pending Mass intentions", LIVE_MEDIA_STATUS: "live media", ATTENTION_SUMMARY: "that attention summary" };
  const area = areas[intent];
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
    MEMBER_COUNT: "View Members",
    NEW_MEMBERS: "View New Members",
    OUTSTANDING_PLEDGES: "View Outstanding",
    PENDING_MASS_INTENTIONS: "Review Mass Intentions",
    LIVE_MEDIA_STATUS: "Open Live Media",
    ATTENTION_SUMMARY: "View Dashboard",
  };
  return { label: labels[intent], route };
}

function formatTzs(value: number) {
  return `TZS ${value.toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
}

export async function answerControlledKanisaAIIntent(intent: ControlledKanisaAIIntent, context: KanisaAIContext, now = new Date()): Promise<ControlledKanisaAIAnswer> {
  if (!context.church.id || !isAuthorizedControlledIntent(intent, context)) return forbidden(intent);
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

    if (intent === "MEMBER_COUNT" || intent === "NEW_MEMBERS") {
      const { currentStart, nextStart, previousStart } = currentAndPreviousMonthPeriod(now);
      const query = supabase.from("members").select("id,status,created_at").eq("church_id", churchId);
      if (intent === "NEW_MEMBERS") query.gte("created_at", currentStart).lt("created_at", nextStart);
      const { data, error } = await query.order("created_at", { ascending: false });
      if (error) throw error;
      const rows = data ?? [];
      if (intent === "MEMBER_COUNT") {
        const active = rows.filter((row) => row.status === "active").length;
        const inactive = rows.filter((row) => row.status !== "active").length;
        const joinedThisMonth = rows.filter((row) => row.created_at >= currentStart && row.created_at < nextStart).length;
        return { intent, status: rows.length ? "success" : "empty", summary: rows.length ? `Our church currently has ${rows.length.toLocaleString()} registered member${rows.length === 1 ? "" : "s"}.` : "Our church currently has no registered members.", metrics: { registeredMembers: rows.length, activeMembers: active, inactiveMembers: inactive, joinedThisMonth }, action, followUps: [{ id: "view-members", type: "navigate", label: "View Members", route: action?.route }, { id: "new-members", type: "controlled_intent", label: "New Members This Month", intent: "NEW_MEMBERS" }] };
      }
      const { data: previousData, error: previousError } = await supabase.from("members").select("id,created_at").eq("church_id", churchId).gte("created_at", previousStart).lt("created_at", currentStart);
      if (previousError) throw previousError;
      const previous = previousData?.length ?? 0;
      return { intent, status: rows.length ? "success" : "empty", summary: rows.length ? `${rows.length} new member${rows.length === 1 ? "" : "s"} joined this month.` : "No new members have joined this month.", metrics: { newMembersThisMonth: rows.length, newMembersPreviousMonth: previous }, action, followUps: action ? [{ id: "view-new-members", type: "navigate", label: "View New Members", route: `${action.route}?period=current-month` }, { id: "all-members", type: "navigate", label: "View All Members", route: action.route }] : [] };
    }

    if (intent === "OUTSTANDING_PLEDGES") {
      const { data, error } = await supabase.rpc("get_church_pledges_summary" as never, { _church_id: churchId } as never);
      if (error) throw error;
      const rows = (data ?? []) as Array<Record<string, unknown>>;
      const outstandingAmount = rows.reduce((sum, row) => sum + Number(row.balance ?? 0), 0);
      const paidAmount = rows.reduce((sum, row) => sum + Number(row.total_paid ?? 0), 0);
      const outstandingCount = rows.reduce((sum, row) => sum + Math.max(0, Number(row.pledge_count ?? 0) - Number(row.completed_count ?? 0)), 0);
      return { intent, status: outstandingCount || outstandingAmount ? "success" : "empty", summary: outstandingCount || outstandingAmount ? `Outstanding pledges currently total ${formatTzs(outstandingAmount)} across ${outstandingCount} recorded pledge${outstandingCount === 1 ? "" : "s"}.` : "There are currently no outstanding recorded pledges.", metrics: { outstandingAmount, outstandingPledges: outstandingCount, paidAmount }, action, followUps: action ? [{ id: "view-outstanding", type: "navigate", label: "View Outstanding", route: action.route }] : [] };
    }

    if (intent === "PENDING_MASS_INTENTIONS") {
      const { data, error } = await supabase.from("mass_intentions").select("id,status,mass_date").eq("church_id", churchId).eq("status", "pending").order("mass_date", { ascending: true });
      if (error) throw error;
      const rows = data ?? [];
      const nextDate = rows.find((row) => row.mass_date)?.mass_date ?? null;
      return { intent, status: rows.length ? "success" : "empty", summary: rows.length ? `There ${rows.length === 1 ? "is" : "are"} ${rows.length} Mass intention${rows.length === 1 ? "" : "s"} currently awaiting attention.` : "There are currently no pending Mass intentions.", metrics: { pendingMassIntentions: rows.length, ...(nextDate ? { nextScheduledDate: nextDate } : {}) }, action, followUps: action ? [{ id: "review-mass-intentions", type: "navigate", label: "Review Mass Intentions", route: action.route }] : [] };
    }

    if (intent === "LIVE_MEDIA_STATUS") {
      const [livestreamResult, radioResult] = await Promise.allSettled([fetchMemberLivestream(churchId), fetchMemberRadioStations(churchId)]);
      const stream = livestreamResult.status === "fulfilled" && livestreamResult.value?.churchId === churchId && livestreamResult.value.status === "live" ? livestreamResult.value : null;
      const stations = radioResult.status === "fulfilled" ? radioResult.value.filter((station) => station.churchId === churchId) : [];
      const partial = livestreamResult.status === "rejected" || radioResult.status === "rejected";
      const summary = stream && stations.length ? `Mass is live now. ${stations.length === 1 ? "One church radio station is" : `${stations.length} church radio stations are`} also available.` : stream ? "Mass is live now. There are no available church radio stations." : stations.length ? `There is no live Mass right now, but ${stations.length} radio station${stations.length === 1 ? " is" : "s are"} available.` : "There is currently no live Mass or available church radio.";
      const followUps: ControlledFollowUp[] = [];
      if (stream) followUps.push({ id: "watch-live", type: "navigate", label: "Watch Live", route: `/portal/live/${stream.id}` });
      if (stations.length) followUps.push({ id: "choose-radio", type: "navigate", label: stations.length > 1 ? "Choose Radio" : "Listen to Radio", route: "/portal/radio" });
      return { intent, status: stream || stations.length ? "success" : partial ? "error" : "empty", summary, metrics: { liveMass: stream ? 1 : 0, availableRadioStations: stations.length }, followUps, partial };
    }

    if (intent === "ATTENTION_SUMMARY") {
      const sourceRegistry: Partial<Record<string, ControlledKanisaAIIntent[]>> = { church_admin: ["PENDING_INVITATIONS", "UNRESOLVED_PRAYER_REQUESTS"], secretary: ["PENDING_INVITATIONS", "UNRESOLVED_PRAYER_REQUESTS"], pastor: ["UNRESOLVED_PRAYER_REQUESTS", "PENDING_MASS_INTENTIONS"], treasurer: ["OUTSTANDING_PLEDGES"], member: [] };
      const sources = sourceRegistry[context.role ?? ""];
      if (!sources) return forbidden(intent);
      const settled = await Promise.allSettled(sources.map((sourceIntent) => answerControlledKanisaAIIntent(sourceIntent, context, now)));
      const answers = settled.flatMap((result) => result.status === "fulfilled" ? [result.value] : []);
      const failed = settled.length - answers.length + answers.filter((answer) => answer.status === "error").length;
      const available = answers.filter((answer) => answer.status === "success" || answer.status === "empty");
      const countFor = (answer: ControlledKanisaAIAnswer) => Number(answer.metrics?.[answer.intent === "PENDING_INVITATIONS" ? "pending" : answer.intent === "UNRESOLVED_PRAYER_REQUESTS" ? "unresolved" : answer.intent === "PENDING_MASS_INTENTIONS" ? "pendingMassIntentions" : answer.intent === "OUTSTANDING_PLEDGES" ? "outstandingPledges" : "verifiedAttentionItems"] ?? 0);
      const total = available.reduce((sum, answer) => sum + countFor(answer), 0);
      const details = available.filter((answer) => countFor(answer) > 0).map((answer) => ({ id: answer.intent, title: `${countFor(answer)} ${answer.intent.replaceAll("_", " ").toLowerCase()}`, metadata: answer.summary }));
      const followUps = available.flatMap((answer) => answer.action ? [{ id: `attention-${answer.intent}`, type: "navigate" as const, label: `${countFor(answer)} ${answer.intent.replaceAll("_", " ").toLowerCase()}`, route: answer.action.route }] : []);
      if (!available.length && failed) return { intent, status: "error", summary: "I couldn't verify your attention items right now. No total has been calculated.", partial: true };
      return { intent, status: total ? "success" : "empty", summary: total ? `You have ${total} item${total === 1 ? "" : "s"} requiring attention${failed ? ". Some authorized areas could not be checked" : ""}.` : failed ? "No verified attention items were found, but some authorized areas could not be checked." : "You have no verified items requiring attention right now.", metrics: { verifiedAttentionItems: total }, details, followUps, partial: failed > 0 };
    }

    const [currentResult, previousResult] = await Promise.all([
      fetchContributionSummary(context, { kind: "current_month" }, { now }),
      fetchContributionSummary(context, { kind: "previous_month" }, { now }),
    ]);
    if (currentResult.status !== "success" || previousResult.status !== "success" || !currentResult.snapshot || !previousResult.snapshot) throw new Error("Contribution summary unavailable");
    const currentTotal = currentResult.snapshot.total;
    const previousTotal = previousResult.snapshot.total;
    const currentCount = currentResult.snapshot.paymentCount;
    const reportFollowUps: ControlledFollowUp[] = [
      { id: "generate-contribution-pdf", type: "generate_report", label: "Generate PDF", reportType: "CONTRIBUTION_SUMMARY_REPORT" },
      ...(action ? [{ id: "view-contributions", type: "navigate" as const, label: "View Contributions", route: action.route }] : []),
    ];
    if (!currentCount) return { intent, status: "empty", summary: "There are no recorded contributions for this month.", metrics: { currentMonthTotal: 0, currentMonthPayments: 0, previousMonthTotal: previousTotal }, action, followUps: reportFollowUps };
    const comparison = previousTotal > 0
      ? `That is ${Math.abs(((currentTotal - previousTotal) / previousTotal) * 100).toFixed(0)}% ${currentTotal >= previousTotal ? "higher" : "lower"} than last month, when ${formatTzs(previousTotal)} was collected.`
      : "There is not enough previous-month activity for a meaningful percentage comparison.";
    return { intent, status: "success", summary: `Contributions this month total ${formatTzs(currentTotal)} from ${currentCount} recorded payment${currentCount === 1 ? "" : "s"}. ${comparison}`, metrics: { currentMonthTotal: currentTotal, currentMonthPayments: currentCount, previousMonthTotal: previousTotal }, action, followUps: reportFollowUps };
  } catch {
    return { intent, status: "error", summary: "Kanisa AI could not load this information right now. Please try again." };
  }
}

export function isControlledKanisaAIIntent(intent: KanisaAIIntent): intent is ControlledKanisaAIIntent {
  return ["PENDING_INVITATIONS", "UPCOMING_EVENTS", "UNRESOLVED_PRAYER_REQUESTS", "CONTRIBUTION_SUMMARY", "MEMBER_COUNT", "NEW_MEMBERS", "OUTSTANDING_PLEDGES", "PENDING_MASS_INTENTIONS", "LIVE_MEDIA_STATUS", "ATTENTION_SUMMARY"].includes(intent);
}

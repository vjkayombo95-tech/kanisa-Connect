import { classifyKanisaIntent } from "./intent";
import { canRunKanisaAIAction, getKanisaAIDenialReason } from "./permissions";
import { findKanisaAIAction, getKanisaAITargetRoute } from "./registry";
import {
  cachedResponse,
  draftPlaceholderResponse,
  explanationPlaceholderResponse,
  navigationResponse,
  permissionDeniedResponse,
  summaryResponse,
  unknownResponse,
} from "./responses";
import { kanisaAICache } from "./cache";
import type { KanisaAIRequest, KanisaAIResponse, KanisaAIRouteDecision } from "./types";
import { addDays, dateKey, startOfWeek } from "@/components/calendar/calendarUtils";
import type { ParishCalendarEvent } from "@/components/calendar/types";
import { filterMemberDailyReadings, filterMemberPrayers, prayerMatchesCmsSearch, type CatholicPrayerContent, type CmsDailyReading } from "@/lib/catholic-cms";

export function buildKanisaAICacheKey(request: KanisaAIRequest) {
  return [
    request.context.tenant.id ?? "tenant:none",
    request.context.workspace,
    request.context.language,
    request.input.trim().toLowerCase(),
  ].join("|");
}

export function decideKanisaAIRoute(request: KanisaAIRequest): KanisaAIRouteDecision {
  const intent = classifyKanisaIntent(request.input);
  const action = findKanisaAIAction(intent, request.context);

  if (!action) {
    return {
      intent,
      action: null,
      requiresAI: false,
      handler: "none",
      allowed: intent !== "UNKNOWN",
      reason: intent === "UNKNOWN" ? "No matching action registered." : "Intent has no registered action.",
    };
  }

  const blockedMemberFinanceRequest =
    request.context.workspace === "member" &&
    intent === "OPEN_CONTRIBUTIONS" &&
    /\b(church|parish|finance|financial|trend|trends|analytics|report|reports|pledge completion|health|parokia|mwenendo|ripoti|fedha|afya)\b/i.test(request.input);
  const allowed = !blockedMemberFinanceRequest && canRunKanisaAIAction(action, request.context);

  return {
    intent,
    action,
    requiresAI: action.requiresAI,
    handler: action.handler,
    allowed,
    targetRoute: getKanisaAITargetRoute(intent, request.context),
    reason: allowed
      ? undefined
      : blockedMemberFinanceRequest
        ? "Members can view their own giving, but parish-wide finance analytics are not available in the Member Workspace."
        : getKanisaAIDenialReason(action, request.context),
  };
}

export function routeKanisaAIRequest(request: KanisaAIRequest): KanisaAIResponse {
  const decision = decideKanisaAIRoute(request);
  if (!decision.action) return unknownResponse();
  if (!decision.allowed) return permissionDeniedResponse(decision.action, decision.reason ?? "Permission denied.");

  const cacheKey = buildKanisaAICacheKey(request);
  const cached = kanisaAICache.get(cacheKey);
  if (cached) return cachedResponse(cached);

  if (decision.intent === "OPEN_CALENDAR" && isCalendarSummaryQuestion(request.input)) {
    const summary = summarizeCalendarFromCache(request);
    return summaryResponse(decision.action, summary, "query-cache");
  }

  if (decision.intent === "OPEN_PRAYER_LIBRARY") {
    const cmsSummary = summarizeCmsPrayerFromCache(request);
    if (cmsSummary) return summaryResponse(decision.action, cmsSummary, "query-cache");
  }

  if (decision.intent === "OPEN_DAILY_READINGS") {
    const dailyReadingSummary = summarizeDailyReadingFromCache(request);
    if (dailyReadingSummary) return summaryResponse(decision.action, dailyReadingSummary, "query-cache");
  }

  if (decision.action.handler === "navigate" && decision.targetRoute) {
    return navigationResponse(decision.intent, decision.targetRoute);
  }

  if (decision.intent === "AI_EXPLAIN_SCRIPTURE") return explanationPlaceholderResponse();
  if (decision.intent === "AI_DRAFT") return draftPlaceholderResponse();
  if (decision.intent === "AI_SUMMARIZE") {
    return summaryResponse(decision.action, "Summarization will be handled by a future AI provider.", "future-provider");
  }

  return summaryResponse(decision.action, "Kanisa AI routed this request without calling an AI provider.", "local");
}

function summarizeDailyReadingFromCache(request: KanisaAIRequest) {
  const queryClient = request.context.queryClient;
  if (!queryClient) return null;

  const matches = queryClient.getQueriesData<CmsDailyReading>({ queryKey: ["member-cms-daily-reading"] });
  const readings = filterMemberDailyReadings(matches.flatMap(([, data]) => (data ? [data] : [])));
  const matched = readings[0];
  if (!matched) return null;

  const celebration = matched.celebration || "Daily Readings";
  const refs = [
    matched.first_reading_reference && `First Reading: ${matched.first_reading_reference}`,
    matched.responsorial_psalm_reference && `Psalm: ${matched.responsorial_psalm_reference}`,
    matched.second_reading_reference && `Second Reading: ${matched.second_reading_reference}`,
    matched.gospel_reference && `Gospel: ${matched.gospel_reference}`,
  ].filter(Boolean);
  const reflection = matched.reflection ? ` Reflection: ${matched.reflection.replace(/\s+/g, " ").trim().slice(0, 180)}.` : "";
  return `${celebration} (${matched.reading_date}). ${refs.join("; ")}.${reflection}`;
}

function summarizeCmsPrayerFromCache(request: KanisaAIRequest) {
  const queryClient = request.context.queryClient;
  if (!queryClient) return null;

  const matches = queryClient.getQueriesData<CatholicPrayerContent[]>({ queryKey: ["member-catholic-library-prayers"] });
  const prayers = filterMemberPrayers(matches.flatMap(([, data]) => data ?? []));
  const matched = prayers.find((prayer) => prayerMatchesCmsSearch(prayer, request.input));
  if (!matched) return null;

  const excerpt = (matched.summary || matched.body).replace(/\s+/g, " ").trim().slice(0, 260);
  return `${matched.title}: ${excerpt}${excerpt.length >= 260 ? "..." : ""}`;
}

function isCalendarSummaryQuestion(input: string) {
  const text = input.toLowerCase();
  return [
    "what happens",
    "what is on",
    "what's on",
    "schedule today",
    "masses tomorrow",
    "meetings this week",
    "this week",
    "tomorrow",
    "sunday",
  ].some((phrase) => text.includes(phrase));
}

function summarizeCalendarFromCache(request: KanisaAIRequest) {
  const queryClient = request.context.queryClient;
  if (!queryClient) return "Open the Parish Calendar to load the latest parish schedule.";

  const matches = queryClient.getQueriesData<ParishCalendarEvent[]>({
    queryKey: ["parish-calendar-events", request.context.church.id, request.context.workspace],
  });
  const events = matches.flatMap(([, data]) => data ?? []);
  if (!events.length) return "The Parish Calendar has not loaded in this session yet. Open it once, then ask again for a local summary.";

  const target = getCalendarQuestionRange(request.input);
  const visible = events
    .filter((event) => {
      const starts = new Date(event.startsAt);
      return starts >= target.from && starts <= target.to;
    })
    .sort((left, right) => new Date(left.startsAt).getTime() - new Date(right.startsAt).getTime())
    .slice(0, 8);

  if (!visible.length) return `No Parish Calendar items found for ${target.label}.`;

  const lines = visible.map((event) => {
    const time = event.allDay ? "All day" : new Date(event.startsAt).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
    return `${time} ${event.title} (${event.category})`;
  });

  return `Parish Calendar for ${target.label}: ${lines.join("; ")}.`;
}

function getCalendarQuestionRange(input: string) {
  const text = input.toLowerCase();
  const today = new Date();
  if (text.includes("tomorrow")) {
    const tomorrow = addDays(today, 1);
    return { label: "tomorrow", from: new Date(`${dateKey(tomorrow)}T00:00:00`), to: new Date(`${dateKey(tomorrow)}T23:59:59`) };
  }
  if (text.includes("week")) {
    const start = startOfWeek(today);
    return { label: "this week", from: start, to: addDays(start, 7) };
  }
  if (text.includes("sunday")) {
    const sunday = addDays(startOfWeek(today), 7);
    return { label: "Sunday", from: new Date(`${dateKey(sunday)}T00:00:00`), to: new Date(`${dateKey(sunday)}T23:59:59`) };
  }
  return { label: "today", from: new Date(`${dateKey(today)}T00:00:00`), to: new Date(`${dateKey(today)}T23:59:59`) };
}

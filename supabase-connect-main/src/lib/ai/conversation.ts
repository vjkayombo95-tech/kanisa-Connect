import { classifyKanisaIntent } from "./intent";
import { decideKanisaAIRoute, routeKanisaAIRequest } from "./router";
import { getKanisaAITargetRoute } from "./registry";
import { retrieveKanisaAIContextForIntent } from "./retrieval";
import {
  answerControlledKanisaAIIntent,
  classifyControlledKanisaAIIntent,
  isControlledKanisaAIIntent,
  isAmbiguousControlledKanisaAIInput,
  type ControlledKanisaAIAnswer,
  type ControlledKanisaAIIntent,
} from "./controlled-answers";
import type { KanisaAIContext, KanisaAIIntent } from "./types";
import { filterMemberDailyReadings, filterMemberPrayers, prayerMatchesCmsSearch, type CatholicPrayerContent, type CmsDailyReading } from "@/lib/catholic-cms";
import { findCatholicEventTypeForPrompt } from "@/lib/calendar/catholic-event-taxonomy";
import { formatFeastDay, type LibrarySaint } from "@/lib/catholic-library";
import type { SaintOfDayResult } from "@/lib/saints";
import i18next from "i18next";

export type KanisaAIConversationStatus =
  | "success"
  | "empty"
  | "unavailable"
  | "unauthorized"
  | "forbidden"
  | "provider_required"
  | "error";

export type KanisaAIConversationAction = {
  id: string;
  label: string;
  route?: string;
  preview?: KanisaAIConversationPreview;
  retryInput?: string;
};

export type KanisaAIConversationPreview = {
  type: "saint" | "prayer" | "daily_reading" | "event" | "mass_intention" | "contribution_summary";
  title: string;
  subtitle?: string;
  badge?: string;
  imageUrl?: string | null;
  metadata?: Array<{
    label: string;
    value: string;
  }>;
  sections?: Array<{
    title: string;
    content: string;
  }>;
  primaryAction?: {
    id: string;
    label: string;
    route?: string;
  };
  secondaryAction?: {
    id: string;
    label: string;
    route?: string;
  };
};

export type KanisaAIConversationSection = {
  id: string;
  title: string;
  items?: Array<{
    id: string;
    title: string;
    description?: string;
    metadata?: string;
    route?: string;
    preview?: KanisaAIConversationPreview;
  }>;
  metrics?: Array<{
    label: string;
    value: string;
  }>;
};

export type KanisaAIConversationResponse = {
  id: string;
  intent: KanisaAIIntent;
  status: KanisaAIConversationStatus;
  title: string;
  summary: string;
  message: string;
  sections: KanisaAIConversationSection[];
  actions: KanisaAIConversationAction[];
  suggestions: string[];
  sourceType: "query-cache" | "local-router" | "future-provider" | "workspace-policy";
  providerRequired: boolean;
};

export type KanisaAIConversationMessage = {
  id: string;
  role: "user" | "assistant" | "system";
  timestamp: number;
  text: string;
  response?: KanisaAIConversationResponse;
  status?: "sending" | "complete" | "error";
  intent?: KanisaAIIntent;
};

function responseId() {
  return `kanisa-ai-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function normalize(input: string) {
  return input.toLowerCase().replace(/[^\p{L}\p{N}\s:,-]/gu, " ").replace(/\s+/g, " ").trim();
}

function action(id: string, label: string, route?: string, preview?: KanisaAIConversationPreview, retryInput?: string): KanisaAIConversationAction {
  return { id, label, route, preview, retryInput };
}

function tAi(context: KanisaAIContext, key: string, options?: Record<string, unknown>) {
  return i18next.t(`ai.conversation.${key}`, {
    lng: context.language === "sw" ? "sw" : "en",
    ...options,
  });
}

function baseResponse(input: {
  intent: KanisaAIIntent;
  status: KanisaAIConversationStatus;
  title: string;
  summary: string;
  message?: string;
  sections?: KanisaAIConversationSection[];
  actions?: KanisaAIConversationAction[];
  suggestions?: string[];
  sourceType?: KanisaAIConversationResponse["sourceType"];
  providerRequired?: boolean;
}): KanisaAIConversationResponse {
  return {
    id: responseId(),
    intent: input.intent,
    status: input.status,
    title: input.title,
    summary: input.summary,
    message: input.message ?? input.summary,
    sections: input.sections ?? [],
    actions: input.actions ?? [],
    suggestions: input.suggestions ?? [],
    sourceType: input.sourceType ?? "local-router",
    providerRequired: input.providerRequired ?? false,
  };
}

function controlledConversationResponse(answer: ControlledKanisaAIAnswer, retryInput: string): KanisaAIConversationResponse {
  const titles: Record<ControlledKanisaAIIntent, string> = {
    PENDING_INVITATIONS: "Pending Invitations",
    UPCOMING_EVENTS: "Upcoming Events",
    UNRESOLVED_PRAYER_REQUESTS: "Unresolved Prayer Requests",
    CONTRIBUTION_SUMMARY: "Contribution Summary",
  };
  const metricLabels: Record<string, string> = {
    pending: "Pending invitations",
    oldestPendingDays: "Oldest pending age",
    nextSevenDays: "Next 7 days",
    unresolved: "Unresolved requests",
    currentMonthTotal: "Current month total",
    currentMonthPayments: "Recorded payments",
    previousMonthTotal: "Previous month total",
  };
  const moneyMetrics = new Set(["currentMonthTotal", "previousMonthTotal"]);
  const sections: KanisaAIConversationSection[] = [];
  if (answer.details?.length) sections.push({ id: "controlled-details", title: "Upcoming", items: answer.details });
  if (answer.metrics) {
    sections.push({
      id: "controlled-metrics",
      title: "Summary",
      metrics: Object.entries(answer.metrics).map(([key, value]) => ({
        label: metricLabels[key] ?? key,
        value: moneyMetrics.has(key) ? `TZS ${Number(value).toLocaleString("en-US")}` : key === "oldestPendingDays" ? `${value} days` : String(value),
      })),
    });
  }
  return baseResponse({
    intent: answer.intent,
    status: answer.status,
    title: titles[answer.intent],
    summary: answer.summary,
    sections,
    actions: answer.action ? [action(`open-${answer.intent.toLowerCase()}`, answer.action.label, answer.action.route)] : answer.status === "error" ? [action("retry-question", "Retry", undefined, undefined, retryInput)] : [],
    sourceType: answer.status === "forbidden" ? "workspace-policy" : "local-router",
  });
}

function getCachedRows<T>(context: KanisaAIContext, queryKey: unknown[]) {
  const queryClient = context.queryClient;
  if (!queryClient) return [] as T[];

  return queryClient
    .getQueriesData<T | T[]>({ queryKey })
    .flatMap(([, data]) => {
      if (!data) return [];
      return Array.isArray(data) ? data : [data];
    });
}

function getFirstRoute(context: KanisaAIContext, intent: KanisaAIIntent) {
  return getKanisaAITargetRoute(intent, context);
}

function workspacePrefix(context: KanisaAIContext) {
  if (context.workspace === "member") return "/portal";
  if (context.workspace === "pastoral") return "/pastoral";
  if (context.workspace === "church_admin") return "/church-admin";
  if (context.workspace === "finance") return "/finance";
  return "";
}

function contentRoute(context: KanisaAIContext, type: "saint" | "prayer", slugOrId?: string | null) {
  if (!slugOrId) return undefined;
  const prefix = workspacePrefix(context);
  if (!prefix) return undefined;
  return type === "saint" ? `${prefix}/library/${slugOrId}` : `${prefix}/prayers/${slugOrId}`;
}

function compactText(value: unknown, fallback = "") {
  return String(value ?? fallback).replace(/\s+/g, " ").trim();
}

function previewAction(id: string, label: string, preview: KanisaAIConversationPreview) {
  return action(id, label, undefined, preview);
}

function saintResponse(context: KanisaAIContext): KanisaAIConversationResponse | null {
  const route = getFirstRoute(context, "OPEN_SAINT");
  const results = getCachedRows<SaintOfDayResult>(context, ["saint-of-day"]);
  const result = results.find((entry) => entry?.saint) ?? results[0];
  const today = new Date();
  const cachedSaints = getCachedRows<LibrarySaint>(context, ["member-catholic-library-saints"]);
  const fallbackSaint = cachedSaints.find((item) => item.feast_month === today.getMonth() + 1 && item.feast_day === today.getDate());
  const saint = (result?.saint ?? fallbackSaint) as LibrarySaint | null | undefined;
  const language = context.language === "sw" ? "sw" : "en";

  if (!saint) {
    return baseResponse({
      intent: "OPEN_SAINT",
      status: "empty",
      title: tAi(context, "saint_empty_title"),
      summary: tAi(context, "saint_empty_summary"),
      actions: route ? [action("open-saints", tAi(context, "open_saints"), route)] : [],
      sourceType: "query-cache",
    });
  }

  const feast = formatFeastDay(saint.feast_month, saint.feast_day, language);
  const fullRoute = contentRoute(context, "saint", saint.slug || saint.id) ?? route;
  const subtitle = [saint.title, feast].filter(Boolean).join(" • ");
  const summary = compactText(saint.biography_short || saint.biography_long, tAi(context, "saint_summary_unavailable"));
  const metadata = [
    feast ? { label: tAi(context, "feast_day"), value: feast } : null,
    saint.patron_of ? { label: tAi(context, "patronage"), value: saint.patron_of } : null,
    saint.liturgical_rank ? { label: tAi(context, "category"), value: saint.liturgical_rank } : null,
  ].filter(Boolean) as KanisaAIConversationPreview["metadata"];
  const preview: KanisaAIConversationPreview = {
    type: "saint",
    title: saint.name,
    subtitle,
    badge: tAi(context, "todays_saint"),
    imageUrl: saint.image_url,
    metadata,
    sections: [
      { title: tAi(context, "summary"), content: summary },
      saint.reflection ? { title: tAi(context, "reflection"), content: compactText(saint.reflection) } : null,
    ].filter(Boolean) as KanisaAIConversationPreview["sections"],
    primaryAction: { id: "open-full-saint-page", label: tAi(context, "open_full_saint_page"), route: fullRoute },
  };

  return baseResponse({
    intent: "OPEN_SAINT",
    status: "success",
    title: saint.name,
    summary: [subtitle, summary].filter(Boolean).join(" — "),
    sections: [
      {
        id: "saint",
        title: tAi(context, "todays_saint"),
        items: [{
          id: saint.id,
          title: saint.name,
          description: summary,
          metadata: [feast, saint.patron_of].filter(Boolean).join(" • ") || undefined,
          route: fullRoute,
          preview,
        }],
      },
    ],
    actions: [
      previewAction("preview-saint", tAi(context, "view_saint"), preview),
      ...(fullRoute ? [action("open-full-saint-page", tAi(context, "open_full_saint_page"), fullRoute)] : []),
    ],
    suggestions: [tAi(context, "open_daily_readings"), tAi(context, "find_peace_prayer")],
    sourceType: "query-cache",
  });
}

function dailyReadingResponse(context: KanisaAIContext): KanisaAIConversationResponse | null {
  const readings = filterMemberDailyReadings(getCachedRows<CmsDailyReading>(context, ["member-cms-daily-reading"]));
  const reading = readings[0];
  const route = getFirstRoute(context, "OPEN_DAILY_READINGS");
  if (!reading) {
    return baseResponse({
      intent: "OPEN_DAILY_READINGS",
      status: "empty",
      title: tAi(context, "daily_empty_title"),
      summary: tAi(context, "daily_empty_summary"),
      actions: [action("open-daily-readings", tAi(context, "open_daily_readings"), route)],
      suggestions: [tAi(context, "daily_empty_suggestion")],
      sourceType: "query-cache",
    });
  }

  const items = [
    [tAi(context, "first_reading"), reading.first_reading_reference],
    [tAi(context, "psalm"), reading.responsorial_psalm_reference],
    [tAi(context, "second_reading"), reading.second_reading_reference],
    [tAi(context, "gospel"), reading.gospel_reference],
  ]
    .filter(([, value]) => Boolean(value))
    .map(([title, value]) => ({
      id: String(title).toLowerCase().replace(/\s+/g, "-"),
      title: String(title),
      description: String(value),
    }));
  const preview: KanisaAIConversationPreview = {
    type: "daily_reading",
    title: reading.celebration || tAi(context, "todays_readings"),
    subtitle: reading.reading_date,
    badge: tAi(context, "daily_readings_label"),
    metadata: items.map((item) => ({ label: item.title, value: item.description })),
    sections: [
      reading.reflection ? { title: tAi(context, "reflection"), content: compactText(reading.reflection) } : null,
      reading.prayer ? { title: tAi(context, "prayer"), content: compactText(reading.prayer) } : null,
      reading.daily_challenge ? { title: tAi(context, "daily_challenge"), content: compactText(reading.daily_challenge) } : null,
    ].filter(Boolean) as KanisaAIConversationPreview["sections"],
    primaryAction: { id: "open-daily-readings", label: tAi(context, "open_daily_readings"), route },
  };

  return baseResponse({
    intent: "OPEN_DAILY_READINGS",
    status: "success",
    title: reading.celebration || tAi(context, "todays_readings"),
    summary: `${reading.celebration || tAi(context, "daily_readings_label")} for ${reading.reading_date}.`,
    sections: [{ id: "readings", title: tAi(context, "readings"), items }],
    actions: [previewAction("preview-daily-reading", tAi(context, "preview_reading"), preview), action("open-daily-readings", tAi(context, "open_daily_readings"), route), action("open-bible", tAi(context, "open_bible"), getFirstRoute(context, "OPEN_BIBLE"))],
    suggestions: [tAi(context, "open_bible"), tAi(context, "find_peace_prayer")],
    sourceType: "query-cache",
  });
}

function prayerResponse(context: KanisaAIContext, input: string): KanisaAIConversationResponse | null {
  const prayers = filterMemberPrayers(getCachedRows<CatholicPrayerContent>(context, ["member-catholic-library-prayers"]));
  const text = normalize(input);
  const requestTerms = text
    .split(/\s+/)
    .filter((term) => term.length > 3 && !["find", "prayer", "show", "give", "need"].includes(term));
  const matches = prayers
    .filter((prayer) => {
      if (prayerMatchesCmsSearch(prayer, input)) return true;
      const haystack = normalize([prayer.title, prayer.summary, prayer.body, prayer.category?.name, prayer.liturgical_season].filter(Boolean).join(" "));
      return requestTerms.some((term) => haystack.includes(term));
    })
    .slice(0, 4);
  const route = getFirstRoute(context, "OPEN_PRAYER_LIBRARY");
  if (!matches.length) {
    return baseResponse({
      intent: "OPEN_PRAYER_LIBRARY",
      status: "empty",
      title: tAi(context, "prayer_empty_title"),
      summary: tAi(context, "prayer_empty_summary"),
      actions: [action("open-prayer-library", tAi(context, "open_prayer_library"), route)],
      suggestions: [tAi(context, "prayer_empty_suggestion")],
      sourceType: "query-cache",
    });
  }

  const firstMatch = matches[0];
  const firstRoute = contentRoute(context, "prayer", firstMatch.slug || firstMatch.id) ?? route;
  const preview: KanisaAIConversationPreview = {
    type: "prayer",
    title: firstMatch.title,
    subtitle: firstMatch.category?.name || firstMatch.liturgical_season || undefined,
    badge: tAi(context, "prayer"),
    sections: [
      firstMatch.summary ? { title: tAi(context, "summary"), content: compactText(firstMatch.summary) } : null,
      { title: tAi(context, "prayer"), content: compactText(firstMatch.body) },
    ].filter(Boolean) as KanisaAIConversationPreview["sections"],
    primaryAction: { id: "open-full-prayer-page", label: tAi(context, "open_full_prayer_page"), route: firstRoute },
  };

  return baseResponse({
    intent: "OPEN_PRAYER_LIBRARY",
    status: "success",
    title: tAi(context, "prayer_results"),
    summary: tAi(context, "prayer_results_summary", { count: matches.length }),
    sections: [
      {
        id: "prayers",
        title: tAi(context, "prayers"),
        items: matches.map((prayer) => ({
          id: prayer.id,
          title: prayer.title,
          description: prayer.summary || prayer.body?.replace(/\s+/g, " ").slice(0, 180),
          metadata: prayer.category?.name || prayer.liturgical_season || undefined,
          route: contentRoute(context, "prayer", prayer.slug || prayer.id) ?? route,
          preview: prayer.id === firstMatch.id ? preview : undefined,
        })),
      },
    ],
    actions: [previewAction("preview-prayer", tAi(context, "preview_prayer"), preview), action("open-prayer-library", tAi(context, "open_prayer_library"), route)],
    suggestions: [tAi(context, "show_another_prayer"), tAi(context, "find_peace_prayer")],
    sourceType: "query-cache",
  });
}

function calendarResponse(context: KanisaAIContext, input = ""): KanisaAIConversationResponse | null {
  const events = getCachedRows<Record<string, unknown>>(context, ["parish-calendar-events", context.church.id, context.workspace]);
  const route = getFirstRoute(context, "OPEN_CALENDAR");
  if (!events.length) {
    return baseResponse({
      intent: "OPEN_CALENDAR",
      status: "empty",
      title: tAi(context, "calendar_empty_title"),
      summary: tAi(context, "calendar_empty_summary"),
      actions: [action("open-calendar", tAi(context, "view_parish_calendar"), route)],
      sourceType: "query-cache",
    });
  }

  const requestedType = findCatholicEventTypeForPrompt(input);
  const matchingEvents = requestedType
    ? events.filter((event) => String(event.type ?? event.event_type ?? "").toLowerCase() === requestedType.id)
    : events;

  if (requestedType && !matchingEvents.length) {
    return baseResponse({
      intent: "OPEN_CALENDAR",
      status: "empty",
      title: tAi(context, "calendar_empty_title"),
      summary: tAi(context, "calendar_service_empty_summary", { service: i18next.t(requestedType.labelKey, { lng: context.language === "sw" ? "sw" : "en" }) }),
      actions: [action("open-calendar", tAi(context, "view_parish_calendar"), route)],
      sourceType: "query-cache",
    });
  }

  const upcoming = matchingEvents
    .map((event) => {
      const title = String(event.title ?? tAi(context, "upcoming"));
      const startsAt = String(event.startsAt ?? event.start_date ?? event.start_time ?? "");
      const preview: KanisaAIConversationPreview = {
        type: "event",
        title,
        subtitle: startsAt ? new Date(startsAt).toLocaleString() : undefined,
        badge: String(event.event_type ?? event.type ?? tAi(context, "upcoming")),
        metadata: [
          event.location ? { label: tAi(context, "location"), value: String(event.location) } : null,
          event.visibility ? { label: tAi(context, "visibility"), value: String(event.visibility) } : null,
        ].filter(Boolean) as KanisaAIConversationPreview["metadata"],
        sections: event.description ? [{ title: tAi(context, "summary"), content: compactText(event.description) }] : [],
        primaryAction: { id: "open-calendar", label: tAi(context, "view_parish_calendar"), route },
      };
      return {
      id: String(event.id ?? event.title ?? Math.random()),
      title,
      description: String(event.description ?? event.category ?? ""),
      metadata: startsAt ? new Date(startsAt).toLocaleString() : undefined,
      route,
      preview,
      };
    })
    .slice(0, 5);

  return baseResponse({
    intent: "OPEN_CALENDAR",
    status: "success",
    title: tAi(context, "upcoming_calendar"),
    summary: tAi(context, "calendar_summary", { count: upcoming.length }),
    sections: [{ id: "events", title: tAi(context, "upcoming"), items: upcoming }],
    actions: upcoming[0]?.preview ? [previewAction("preview-event", tAi(context, "preview_event"), upcoming[0].preview), action("open-calendar", tAi(context, "view_parish_calendar"), route)] : [action("open-calendar", tAi(context, "view_parish_calendar"), route)],
    sourceType: "query-cache",
  });
}

function countRows(rows: unknown[]) {
  return rows.length.toLocaleString();
}

function sumAmount(rows: unknown[]) {
  const total = rows.reduce((sum, row) => {
    if (!row || typeof row !== "object") return sum;
    const amount = Number((row as Record<string, unknown>).amount ?? (row as Record<string, unknown>).net_amount ?? 0);
    return Number.isFinite(amount) ? sum + amount : sum;
  }, 0);
  return total > 0 ? `TZS ${total.toLocaleString()}` : "Not available";
}

function contributionsResponse(context: KanisaAIContext): KanisaAIConversationResponse | null {
  const route = getFirstRoute(context, "OPEN_CONTRIBUTIONS");
  const rows = context.workspace === "member"
    ? getCachedRows<Record<string, unknown>>(context, ["my-contributions"])
    : getCachedRows<Record<string, unknown>>(context, ["contributions"]);

  if (!rows.length) {
    return baseResponse({
      intent: "OPEN_CONTRIBUTIONS",
      status: "empty",
      title: context.workspace === "member" ? tAi(context, "no_contributions_member") : tAi(context, "no_contributions"),
      summary: context.workspace === "member"
        ? tAi(context, "no_contributions_member_summary")
        : tAi(context, "no_contributions_summary"),
      actions: [action(context.workspace === "member" ? "view-my-contributions" : "open-contributions", context.workspace === "member" ? tAi(context, "view_my_contributions") : tAi(context, "open_contributions"), route)],
      sourceType: "query-cache",
    });
  }
  const preview: KanisaAIConversationPreview = {
    type: "contribution_summary",
    title: context.workspace === "member" ? tAi(context, "my_contributions") : tAi(context, "contribution_summary"),
    badge: tAi(context, "summary"),
    metadata: [
      { label: tAi(context, "records"), value: countRows(rows) },
      { label: tAi(context, "loaded_total"), value: sumAmount(rows) },
    ],
    sections: [{ title: tAi(context, "summary"), content: tAi(context, "contribution_records_summary", { count: rows.length }) }],
    primaryAction: { id: context.workspace === "member" ? "view-my-contributions" : "open-contributions", label: context.workspace === "member" ? tAi(context, "view_my_contributions") : tAi(context, "open_contributions"), route },
  };

  return baseResponse({
    intent: "OPEN_CONTRIBUTIONS",
    status: "success",
    title: context.workspace === "member" ? tAi(context, "my_contributions") : tAi(context, "contribution_summary"),
    summary: tAi(context, "contribution_records_summary", { count: rows.length }),
    sections: [
      {
        id: "contribution-metrics",
        title: tAi(context, "summary"),
        metrics: [
          { label: tAi(context, "records"), value: countRows(rows) },
          { label: tAi(context, "loaded_total"), value: sumAmount(rows) },
        ],
      },
    ],
    actions: [previewAction("preview-contributions", tAi(context, "preview_summary"), preview), action(context.workspace === "member" ? "view-my-contributions" : "open-contributions", context.workspace === "member" ? tAi(context, "view_my_contributions") : tAi(context, "open_contributions"), route)],
    sourceType: "query-cache",
  });
}

function massIntentionsResponse(context: KanisaAIContext): KanisaAIConversationResponse | null {
  const route = getFirstRoute(context, "OPEN_MASS_INTENTIONS");
  const queryKey = context.workspace === "member" ? ["my-mass-intentions"] : ["mass-intentions-admin"];
  const rows = getCachedRows<Record<string, unknown>>(context, queryKey);

  if (!rows.length) {
    return baseResponse({
      intent: "OPEN_MASS_INTENTIONS",
      status: "empty",
      title: tAi(context, "no_mass_intentions"),
      summary: context.workspace === "member"
        ? tAi(context, "no_mass_intentions_member_summary")
        : tAi(context, "no_mass_intentions_summary"),
      actions: [action(context.workspace === "member" ? "view-my-mass-intentions" : "open-mass-intentions", context.workspace === "member" ? tAi(context, "view_my_mass_intentions") : tAi(context, "open_mass_intentions"), route)],
      sourceType: "query-cache",
    });
  }
  const firstIntention = rows[0];
  const preview: KanisaAIConversationPreview = {
    type: "mass_intention",
    title: String(firstIntention.intention_for ?? firstIntention.category ?? firstIntention.status ?? tAi(context, "mass_intentions")),
    subtitle: String(firstIntention.mass_date ?? firstIntention.requested_date ?? firstIntention.status ?? ""),
    badge: tAi(context, "mass_intentions"),
    metadata: [
      firstIntention.status ? { label: "Status", value: String(firstIntention.status) } : null,
      firstIntention.mass_date ? { label: "Mass date", value: String(firstIntention.mass_date) } : null,
    ].filter(Boolean) as KanisaAIConversationPreview["metadata"],
    sections: firstIntention.message || firstIntention.notes ? [{ title: tAi(context, "summary"), content: compactText(firstIntention.message ?? firstIntention.notes) }] : [],
    primaryAction: { id: context.workspace === "member" ? "view-my-mass-intentions" : "open-mass-intentions", label: context.workspace === "member" ? tAi(context, "view_my_mass_intentions") : tAi(context, "open_mass_intentions"), route },
  };

  return baseResponse({
    intent: "OPEN_MASS_INTENTIONS",
    status: "success",
    title: context.workspace === "member" ? tAi(context, "my_mass_intentions") : tAi(context, "mass_intentions"),
    summary: tAi(context, "mass_intention_records_summary", { count: rows.length }),
    sections: [
      {
        id: "mass-intentions",
        title: tAi(context, "recent"),
        items: rows.slice(0, 5).map((row) => ({
          id: String(row.id ?? row.message ?? Math.random()),
          title: String(row.intention_for ?? row.category ?? row.status ?? tAi(context, "mass_intentions")),
          description: String(row.message ?? row.notes ?? ""),
          metadata: String(row.status ?? row.mass_date ?? ""),
          route,
          preview: row === firstIntention ? preview : undefined,
        })),
      },
    ],
    actions: [previewAction("preview-mass-intention", tAi(context, "preview_mass_intention"), preview), action(context.workspace === "member" ? "view-my-mass-intentions" : "open-mass-intentions", context.workspace === "member" ? tAi(context, "view_my_mass_intentions") : tAi(context, "open_mass_intentions"), route)],
    sourceType: "query-cache",
  });
}

function operationalResponse(context: KanisaAIContext, input: string): KanisaAIConversationResponse | null {
  const text = normalize(input);
  if (context.workspace === "church_admin" && (text.includes("attention") || text.includes("pending invitation"))) {
    const invitations = getCachedRows<Record<string, unknown>>(context, ["church-invitations"]);
    const pendingInvitations = invitations.filter((row) => String(row.status ?? "").toLowerCase() === "pending").length;
    return baseResponse({
      intent: "SHOW_DASHBOARD",
      status: "success",
      title: text.includes("pending invitation") ? "Pending Invitations" : "Today's Parish Priorities",
      summary: pendingInvitations
        ? `${pendingInvitations} pending invitation${pendingInvitations === 1 ? "" : "s"} need attention.`
        : "No pending invitations are loaded in this session.",
      sections: [
        {
          id: "operations",
          title: "Operations",
          metrics: [{ label: "Pending invitations", value: String(pendingInvitations) }],
        },
      ],
      actions: [action("open-invitations", "Open Invite Hub", "/church-admin/roles")],
      sourceType: "query-cache",
    });
  }

  if (context.workspace === "super_admin" && (text.includes("system job") || text.includes("jobs"))) {
    return baseResponse({
      intent: "SHOW_DASHBOARD",
      status: "success",
      title: "System Jobs",
      summary: "System Jobs is available in the Super Admin workspace.",
      actions: [action("open-system-jobs", "Open System Jobs", "/super-admin/jobs")],
      sourceType: "local-router",
    });
  }

  if (context.workspace === "super_admin" && (text.includes("content health") || text.includes("daily readings manager") || text.includes("import status"))) {
    return baseResponse({
      intent: "SHOW_DASHBOARD",
      status: "success",
      title: text.includes("daily readings") ? "Daily Readings Manager" : "Catholic CMS",
      summary: "Catholic CMS platform tools are available in the Super Admin workspace.",
      actions: [
        action("open-catholic-cms", "Open Catholic CMS", "/super-admin/catholic-content"),
        action("open-imports", "Open Imports", "/super-admin/imports"),
      ],
      sourceType: "local-router",
    });
  }

  return null;
}

function restrictedWorkspaceRequest(context: KanisaAIContext, input: string): KanisaAIConversationResponse | null {
  const text = normalize(input);
  const memberRestricted = ["audit log", "audit logs", "imports", "system jobs", "tenant", "member management", "manage events", "manage announcements"];
  if (context.workspace === "member" && memberRestricted.some((phrase) => text.includes(phrase))) {
    return baseResponse({
      intent: "UNKNOWN",
      status: "unavailable",
      title: tAi(context, "member_unavailable"),
      summary: tAi(context, "member_unavailable_summary"),
      actions: [action("return-kanisa-ai", tAi(context, "return_to_kanisa_ai"), "/portal/kanisa-ai")],
      sourceType: "workspace-policy",
    });
  }
  if (context.workspace !== "super_admin" && ["system jobs", "audit logs", "tenant management", "imports"].some((phrase) => text.includes(phrase))) {
    return baseResponse({
      intent: "UNKNOWN",
      status: "unavailable",
      title: tAi(context, "workspace_unavailable"),
      summary: tAi(context, "workspace_unavailable_summary"),
      sourceType: "workspace-policy",
    });
  }
  return null;
}

export function answerKanisaAIConversation(input: string, context: KanisaAIContext): KanisaAIConversationResponse {
  const trimmed = input.trim();
  if (!trimmed) {
    return baseResponse({
      intent: "UNKNOWN",
      status: "empty",
      title: tAi(context, "ask_title"),
      summary: tAi(context, "ask_summary"),
      sourceType: "local-router",
    });
  }

  const restricted = restrictedWorkspaceRequest(context, trimmed);
  if (restricted) return restricted;

  const operational = operationalResponse(context, trimmed);
  if (operational) return operational;

  const intent = classifyKanisaIntent(trimmed);
  const decision = decideKanisaAIRoute({ input: trimmed, context });

  if (!decision.allowed && decision.action) {
    return baseResponse({
      intent,
      status: "unauthorized",
      title: tAi(context, "permission_needed"),
      summary: decision.reason || tAi(context, "permission_summary"),
      actions: context.workspace === "member" && intent === "OPEN_CONTRIBUTIONS"
        ? [action("view-my-contributions", tAi(context, "view_my_contributions"), "/portal/contribution-history")]
        : [],
      sourceType: "workspace-policy",
    });
  }

  if (intent === "AI_DRAFT" || intent === "AI_EXPLAIN_SCRIPTURE" || intent === "AI_SUMMARIZE") {
    return baseResponse({
      intent,
      status: "provider_required",
      title: tAi(context, "provider_required_title"),
      summary: tAi(context, "provider_required_summary"),
      actions: [action("return-kanisa-ai", tAi(context, "view_available_capabilities"), getKanisaAITargetRoute("SHOW_DASHBOARD", context))],
      sourceType: "future-provider",
      providerRequired: true,
    });
  }

  const local =
    intent === "OPEN_DAILY_READINGS"
      ? dailyReadingResponse(context)
      : intent === "OPEN_SAINT"
        ? saintResponse(context)
      : intent === "OPEN_PRAYER_LIBRARY"
        ? prayerResponse(context, trimmed)
        : intent === "OPEN_CALENDAR" || intent === "OPEN_EVENTS" || intent === "UPCOMING_EVENTS"
        ? calendarResponse(context, trimmed)
          : intent === "OPEN_CONTRIBUTIONS"
            ? contributionsResponse(context)
            : intent === "OPEN_MASS_INTENTIONS"
              ? massIntentionsResponse(context)
              : null;
  if (local) return local;

  const routed = routeKanisaAIRequest({ input: trimmed, context });
  if (routed.type === "navigation") {
    return baseResponse({
      intent: routed.intent,
      status: "success",
      title: tAi(context, "ready_to_open"),
      summary: tAi(context, "ready_to_open_summary"),
      actions: [action(`open-${routed.intent.toLowerCase()}`, tAi(context, "open"), routed.route)],
      sourceType: "local-router",
    });
  }
  if (routed.type === "summary") {
    return baseResponse({
      intent: routed.intent,
      status: routed.source === "future-provider" ? "provider_required" : "success",
      title: tAi(context, "kanisa_result"),
      summary: routed.summary,
      sourceType: routed.source === "future-provider" ? "future-provider" : "local-router",
      providerRequired: routed.source === "future-provider",
    });
  }
  if (routed.type === "permission_denied") {
    return baseResponse({
      intent: routed.intent,
      status: "unauthorized",
      title: tAi(context, "permission_needed"),
      summary: routed.message,
      sourceType: "workspace-policy",
    });
  }

  return baseResponse({
    intent,
    status: "unavailable",
    title: tAi(context, "no_local_answer"),
    summary: tAi(context, "no_local_answer_summary"),
    sourceType: "local-router",
  });
}

export async function answerKanisaAIConversationAsync(
  input: string,
  context: KanisaAIContext,
  options: { controlledIntent?: ControlledKanisaAIIntent | null; lastIntent?: ControlledKanisaAIIntent | null } = {},
): Promise<KanisaAIConversationResponse> {
  const trimmed = input.trim();
  if (!trimmed) return answerKanisaAIConversation(input, context);

  const restricted = restrictedWorkspaceRequest(context, trimmed);
  if (restricted) return restricted;

  if (!options.controlledIntent && isAmbiguousControlledKanisaAIInput(trimmed)) {
    return baseResponse({
      intent: "UNKNOWN",
      status: "unavailable",
      title: "Please choose an area",
      summary: "I'm not sure which area you mean. You can ask about contributions, invitations, events, or prayer requests.",
      sourceType: "local-router",
    });
  }

  const controlledIntent = options.controlledIntent ?? classifyControlledKanisaAIIntent(trimmed, options.lastIntent);
  if (controlledIntent) {
    const answer = await answerControlledKanisaAIIntent(controlledIntent, context);
    return controlledConversationResponse(answer, trimmed);
  }
  const operational = operationalResponse(context, trimmed);
  if (operational) return operational;

  const intent = classifyKanisaIntent(trimmed);
  if (isControlledKanisaAIIntent(intent)) {
    const answer = await answerControlledKanisaAIIntent(intent, context);
    return controlledConversationResponse(answer, trimmed);
  }
  const decision = decideKanisaAIRoute({ input: trimmed, context });
  if (!decision.allowed || intent === "AI_DRAFT" || intent === "AI_EXPLAIN_SCRIPTURE" || intent === "AI_SUMMARIZE") {
    return answerKanisaAIConversation(input, context);
  }

  try {
    await retrieveKanisaAIContextForIntent(intent, trimmed, context);
  } catch {
    return baseResponse({
      intent,
      status: "error",
      title: tAi(context, "retrieval_error_title"),
      summary: tAi(context, "retrieval_error_summary"),
      actions: [action("retry-question", tAi(context, "retry"), undefined, undefined, trimmed)],
      sourceType: "local-router",
    });
  }

  return answerKanisaAIConversation(input, context);
}

export function createKanisaUserMessage(text: string): KanisaAIConversationMessage {
  return {
    id: responseId(),
    role: "user",
    timestamp: Date.now(),
    text,
    status: "complete",
  };
}

export function createKanisaAssistantMessage(response: KanisaAIConversationResponse): KanisaAIConversationMessage {
  return {
    id: response.id,
    role: response.status === "unauthorized" || response.status === "forbidden" || response.status === "unavailable" ? "system" : "assistant",
    timestamp: Date.now(),
    text: response.message,
    response,
    status: "complete",
    intent: response.intent,
  };
}

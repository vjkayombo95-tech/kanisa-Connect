import { formatTZS } from "@/lib/currency";

import { assistantWorkspaceRoutes } from "./registry";
import type { AssistantBriefingItem, PersonalAssistantContext } from "./types";

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? value as Record<string, unknown> : {};
}

function getValue(source: unknown, path: string): unknown {
  return path.split(".").reduce<unknown>((current, key) => asRecord(current)[key], source);
}

function numberAt(source: unknown, path: string, fallback = 0) {
  const value = getValue(source, path);
  const numberValue = Number(value ?? fallback);
  return Number.isFinite(numberValue) ? numberValue : fallback;
}

function arrayLengthAt(source: unknown, path: string) {
  const value = getValue(source, path);
  return Array.isArray(value) ? value.length : 0;
}

function stringAt(source: unknown, path: string, fallback = "") {
  const value = getValue(source, path);
  return typeof value === "string" && value.trim() ? value : fallback;
}

function cachedLiturgy(context: PersonalAssistantContext) {
  const matches = context.queryClient?.getQueriesData({ queryKey: ["live-daily-readings"] }) ?? [];
  const latest = matches.map((entry) => entry[1]).find(Boolean);
  return asRecord(asRecord(latest).day);
}

export function generateAssistantBriefing(context: PersonalAssistantContext): AssistantBriefingItem[] {
  const data = context.dashboardContext;
  const routes = assistantWorkspaceRoutes[context.workspace];
  const liturgy = cachedLiturgy(context);
  const celebration = stringAt(data, "todayLiturgy.celebration", stringAt(liturgy, "celebration", "Today's celebration"));
  const gospel = stringAt(data, "todayLiturgy.daily_readings.0.gospel_reference", "Open today's readings");

  if (context.workspace === "member") {
    return [
      { id: "celebration", label: "Today's celebration", value: celebration, to: routes.readings },
      { id: "mass", label: "Today's Mass", value: "Check today's parish schedule", to: routes.calendar },
      { id: "readings", label: "Today's readings", value: gospel, to: routes.readings },
      { id: "events", label: "Upcoming parish events", value: `${arrayLengthAt(data, "events")} upcoming`, to: routes.events },
      { id: "intentions", label: "Active Mass intentions", value: `${numberAt(data, "massIntentions.totalCount", arrayLengthAt(data, "massIntentions.records"))} tracked`, to: routes.massIntentions },
      { id: "prayers", label: "Prayer request status", value: `${numberAt(data, "prayers.totalCount", arrayLengthAt(data, "prayers.records"))} tracked`, to: routes.prayerRequests },
      { id: "giving", label: "Giving reminder", value: context.featureFlags?.isFeatureEnabled?.("give") === false ? "Giving is not enabled" : "Giving is available", to: routes.giving },
      { id: "bible", label: "Continue reading Bible", value: "Open your Bible reader", to: routes.bible },
    ];
  }

  if (context.workspace === "pastoral") {
    return [
      { id: "ministry", label: "Today's ministry", value: celebration, to: routes.readings },
      { id: "intentions", label: "Mass intentions", value: `${numberAt(data, "summary.massIntentions.pending")} pending, ${numberAt(data, "summary.massIntentions.today")} today`, to: routes.massIntentions },
      { id: "prayers", label: "Prayer requests", value: `${numberAt(data, "summary.prayerRequests.pending")} pending review`, to: routes.prayerRequests },
      { id: "schedule", label: "Today's schedule", value: "Open pastoral calendar", to: routes.calendar },
      { id: "celebrations", label: "Upcoming celebrations", value: stringAt(data, "massSummary.mass.title", "No Mass summary yet"), to: routes.calendar },
      { id: "tasks", label: "Pending pastoral tasks", value: `${numberAt(data, "summary.communityHelp.pending")} help requests`, to: routes.prayerRequests },
    ];
  }

  if (context.workspace === "church_admin") {
    return [
      { id: "new-members", label: "New members", value: `${numberAt(data, "deferred.newMembersThisMonth")} this month`, to: routes.members },
      { id: "invitations", label: "Pending invitations", value: `${arrayLengthAt(data, "invitations")} total invitations`, to: routes.invitations },
      { id: "announcements", label: "Announcements awaiting publication", value: stringAt(data, "critical.latestAnnouncement.title", "No recent announcement"), to: routes.announcements },
      { id: "events", label: "Upcoming events", value: `${arrayLengthAt(data, "deferred.upcomingEvents")} upcoming`, to: routes.events },
      { id: "workflows", label: "Outstanding workflows", value: `${numberAt(data, "deferred.pendingMemberApprovals")} member approvals`, to: routes.members },
    ];
  }

  if (context.workspace === "finance") {
    const thisMonth = numberAt(data, "summary.thisMonthContributions");
    const trend = numberAt(data, "summary.thisMonthContributions") >= numberAt(data, "summary.lifetimeContributions") / 12 ? "steady" : "watch";
    return [
      { id: "collections", label: "Today's collections", value: formatTZS(numberAt(data, "summary.todayContributions")), to: routes.contributions },
      { id: "pledges", label: "Outstanding pledges", value: formatTZS(numberAt(data, "outstandingPledges")), to: routes.pledges },
      { id: "trend", label: "Contribution trend", value: `${formatTZS(thisMonth)} this month, ${trend}`, to: routes.reports },
      { id: "reconciliation", label: "Pending reconciliation", value: `${arrayLengthAt(data, "recentContributions")} recent rows to verify`, to: routes.contributions },
    ];
  }

  return [
    { id: "health", label: "Platform health", value: `${numberAt(data, "activeAlertCount")} active alerts`, to: routes.health },
    { id: "churches", label: "New churches", value: `${numberAt(data, "pendingChurchCount")} pending approvals`, to: routes.churches },
    { id: "storage", label: "Storage health", value: "Check system health", to: routes.health },
    { id: "tenants", label: "Tenant readiness", value: `${numberAt(data, "totalChurches")} churches tracked`, to: routes.churches },
    { id: "imports", label: "Recent imports", value: `${arrayLengthAt(data, "automationRuns")} automation runs`, to: routes.imports },
  ];
}


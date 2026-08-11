import type { WorkspaceId } from "@/components/workspace";

import type { KanisaAIAction, KanisaAIContext, KanisaAIIntent } from "./types";

export const kanisaAIActionRegistry: KanisaAIAction[] = [
  { id: "member-count", title: "Member Count", intent: "MEMBER_COUNT", requiresAI: false, permission: "workspace:admin", handler: "supabase", workspaces: ["church_admin"], discovery: [{ id: "member-count", category: "members", labelEn: "How many members do we have?", labelSw: "Tuna waumini wangapi?", priority: 30 }] },
  { id: "new-members", title: "New Members", intent: "NEW_MEMBERS", requiresAI: false, permission: "workspace:admin", handler: "supabase", workspaces: ["church_admin"], discovery: [{ id: "new-members", category: "members", labelEn: "Any new members this month?", labelSw: "Kuna waumini wapya mwezi huu?", priority: 60 }] },
  { id: "outstanding-pledges", title: "Outstanding Pledges", intent: "OUTSTANDING_PLEDGES", requiresAI: false, permission: "workspace:finance", handler: "supabase", workspaces: ["finance", "church_admin"], discovery: [{ id: "outstanding-pledges", category: "finance", labelEn: "How much is still unpaid?", labelSw: "Michango ambayo haijalipwa ni kiasi gani?", priority: 50 }] },
  { id: "pending-mass-intentions", title: "Pending Mass Intentions", intent: "PENDING_MASS_INTENTIONS", requiresAI: false, permission: "workspace:pastoral", handler: "supabase", workspaces: ["pastoral", "church_admin"], discovery: [{ id: "pending-mass-intentions", category: "pastoral", labelEn: "How many Mass intentions are pending?", labelSw: "Kuna nia za misa zinazosubiri?", priority: 55 }] },
  { id: "live-media-status", title: "Live Media Status", intent: "LIVE_MEDIA_STATUS", requiresAI: false, permission: "workspace:read", handler: "supabase", workspaces: ["member", "pastoral", "church_admin", "finance"], discovery: [{ id: "live-now", category: "live", labelEn: "Is anything live right now?", labelSw: "Kuna kitu live sasa?", priority: 57 }, { id: "radio-available", category: "live", labelEn: "Which radio stations are available?", labelSw: "Radio gani zinapatikana?", priority: 90 }] },
  { id: "attention-summary", title: "Attention Summary", intent: "ATTENTION_SUMMARY", requiresAI: false, permission: "workspace:read", handler: "supabase", workspaces: ["member", "pastoral", "church_admin", "finance"], discovery: [{ id: "attention-summary", category: "operations", labelEn: "What needs my attention?", labelSw: "Kuna nini cha kushughulikia?", priority: 10 }] },
  { id: "pending-invitations", title: "Pending Invitations", intent: "PENDING_INVITATIONS", requiresAI: false, permission: "workspace:admin", handler: "supabase", workspaces: ["church_admin"], discovery: [{ id: "pending-invitations", category: "operations", labelEn: "Show pending invitations", labelSw: "Onyesha mialiko inayosubiri", priority: 40 }] },
  { id: "upcoming-events", title: "Upcoming Events", intent: "UPCOMING_EVENTS", requiresAI: false, permission: "workspace:read", handler: "supabase", workspaces: ["member", "pastoral", "church_admin", "finance"], discovery: [{ id: "upcoming-events", category: "operations", labelEn: "What events are coming up?", labelSw: "Kuna matukio gani yanayokuja?", priority: 35 }] },
  { id: "unresolved-prayer-requests", title: "Unresolved Prayer Requests", intent: "UNRESOLVED_PRAYER_REQUESTS", requiresAI: false, permission: "workspace:pastoral", handler: "supabase", workspaces: ["pastoral", "church_admin"], discovery: [{ id: "unresolved-prayers", category: "pastoral", labelEn: "Any unresolved prayer requests?", labelSw: "Kuna maombi ambayo hayajashughulikiwa?", priority: 80 }] },
  { id: "contribution-summary", title: "Contribution Summary", intent: "CONTRIBUTION_SUMMARY", requiresAI: false, permission: "workspace:finance", handler: "supabase", workspaces: ["finance", "church_admin"], discovery: [{ id: "contribution-summary", category: "finance", labelEn: "How are contributions doing?", labelSw: "Michango inaendaje?", priority: 20 }, { id: "contribution-report", category: "finance", labelEn: "Generate a contribution report", labelSw: "Tengeneza ripoti ya michango", priority: 45, mode: "report" }] },
  { id: "open-bible", title: "Open Bible", intent: "OPEN_BIBLE", requiresAI: false, permission: "scripture:read", handler: "navigate" },
  { id: "open-daily-readings", title: "Open Daily Readings", intent: "OPEN_DAILY_READINGS", requiresAI: false, permission: "content:read", handler: "navigate" },
  { id: "open-saint", title: "Open Saints", intent: "OPEN_SAINT", requiresAI: false, permission: "content:read", handler: "navigate" },
  { id: "open-calendar", title: "Open Parish Calendar", intent: "OPEN_CALENDAR", requiresAI: false, permission: "workspace:read", handler: "navigate" },
  { id: "open-events", title: "Open Events", intent: "OPEN_EVENTS", requiresAI: false, permission: "workspace:read", handler: "navigate", workspaces: ["member", "pastoral", "church_admin"] },
  { id: "open-my-mass-intentions", title: "Open My Mass Intentions", intent: "OPEN_MASS_INTENTIONS", requiresAI: false, permission: "workspace:read", handler: "navigate", workspaces: ["member"] },
  { id: "open-mass-intentions", title: "Open Mass Intentions", intent: "OPEN_MASS_INTENTIONS", requiresAI: false, permission: "workspace:pastoral", handler: "navigate", workspaces: ["pastoral", "church_admin"] },
  { id: "open-my-prayer-requests", title: "Open My Prayer Requests", intent: "OPEN_PRAYER_REQUESTS", requiresAI: false, permission: "workspace:read", handler: "navigate", workspaces: ["member"] },
  { id: "open-prayer-requests", title: "Open Prayer Requests", intent: "OPEN_PRAYER_REQUESTS", requiresAI: false, permission: "workspace:pastoral", handler: "navigate", workspaces: ["pastoral", "church_admin"] },
  { id: "open-prayer-library", title: "Open Prayer Library", intent: "OPEN_PRAYER_LIBRARY", requiresAI: false, permission: "content:read", handler: "navigate" },
  { id: "open-sacraments", title: "Open Sacraments", intent: "OPEN_SACRAMENTS", requiresAI: false, permission: "workspace:pastoral", handler: "navigate", workspaces: ["pastoral", "church_admin"] },
  { id: "open-my-contributions", title: "Open My Contributions", intent: "OPEN_CONTRIBUTIONS", requiresAI: false, permission: "workspace:read", handler: "navigate", workspaces: ["member"] },
  { id: "open-contributions", title: "Open Contributions", intent: "OPEN_CONTRIBUTIONS", requiresAI: false, permission: "workspace:finance", handler: "navigate", workspaces: ["finance", "church_admin"] },
  { id: "show-dashboard", title: "Show Dashboard", intent: "SHOW_DASHBOARD", requiresAI: false, permission: "workspace:read", handler: "navigate" },
  { id: "search-scripture", title: "Search Scripture", intent: "SEARCH_SCRIPTURE", requiresAI: false, permission: "scripture:read", handler: "navigate" },
  { id: "explain-scripture", title: "Explain Scripture", intent: "AI_EXPLAIN_SCRIPTURE", requiresAI: true, permission: "scripture:read", handler: "future-provider" },
  { id: "summarize", title: "Summarize", intent: "AI_SUMMARIZE", requiresAI: true, permission: "content:read", handler: "future-provider", workspaces: ["member", "pastoral", "church_admin", "finance", "super_admin"] },
  { id: "draft", title: "Draft", intent: "AI_DRAFT", requiresAI: true, permission: "content:draft", handler: "future-provider", workspaces: ["pastoral", "church_admin"] },
];

export function findKanisaAIAction(intent: KanisaAIIntent, context?: KanisaAIContext) {
  const matches = kanisaAIActionRegistry.filter((action) => action.intent === intent);
  if (!context) return matches[0] ?? null;
  return matches.find((action) => !action.workspaces || action.workspaces.includes(context.workspace)) ?? matches[0] ?? null;
}

const workspaceRoutes: Record<WorkspaceId, Record<string, string>> = {
  member: {
    dashboard: "/portal",
    bible: "/portal/bible",
    dailyReadings: "/portal/daily-readings",
    saints: "/portal/library",
    calendar: "/portal/calendar",
    events: "/portal/events",
    massIntentions: "/portal/mass-intentions",
    prayerRequests: "/portal/prayer-requests",
    prayerLibrary: "/portal/library",
    sacraments: "/portal",
    contributions: "/portal/contribution-history",
  },
  pastoral: {
    dashboard: "/pastoral",
    bible: "/pastoral/bible",
    dailyReadings: "/pastoral/daily-readings",
    saints: "/pastoral/saints",
    calendar: "/pastoral/calendar",
    events: "/pastoral/events",
    massIntentions: "/pastoral/mass-intentions",
    prayerRequests: "/pastoral/prayer-requests",
    prayerLibrary: "/pastoral/saints",
    sacraments: "/pastoral/sacraments",
    contributions: "/pastoral/contributions",
  },
  church_admin: {
    dashboard: "/church-admin",
    bible: "/church-admin/bible",
    dailyReadings: "/church-admin/daily-readings",
    saints: "/church-admin/saints",
    calendar: "/church-admin/calendar",
    events: "/church-admin/events",
    massIntentions: "/church-admin/mass-intentions",
    prayerRequests: "/church-admin/prayer-requests",
    prayerLibrary: "/church-admin/saints",
    sacraments: "/pastoral/sacraments",
    contributions: "/church-admin/contributions",
  },
  finance: {
    dashboard: "/finance",
    bible: "/finance/bible",
    dailyReadings: "/finance/daily-readings",
    saints: "/finance/saints",
    calendar: "/finance/calendar",
    events: "/finance/calendar",
    massIntentions: "/finance/mass-intentions",
    prayerRequests: "/finance/prayer-requests",
    prayerLibrary: "/finance/saints",
    sacraments: "/finance",
    contributions: "/finance/contributions",
  },
  super_admin: {
    dashboard: "/super-admin",
    bible: "/super-admin/catholic",
    dailyReadings: "/super-admin/catholic-content/daily-readings",
    saints: "/super-admin/catholic-content/saints",
    calendar: "/super-admin",
    events: "/super-admin",
    massIntentions: "/super-admin",
    prayerRequests: "/super-admin",
    prayerLibrary: "/super-admin/catholic-content/prayer-library",
    sacraments: "/super-admin",
    contributions: "/super-admin/analytics",
  },
};

export function getKanisaAITargetRoute(intent: KanisaAIIntent, context: KanisaAIContext) {
  const routes = workspaceRoutes[context.workspace];
  switch (intent) {
    case "MEMBER_COUNT":
    case "NEW_MEMBERS":
      return context.workspace === "church_admin" ? "/church-admin/members" : undefined;
    case "OUTSTANDING_PLEDGES":
      return routes.contributions;
    case "PENDING_MASS_INTENTIONS":
      return routes.massIntentions;
    case "LIVE_MEDIA_STATUS":
      return context.workspace === "member" ? "/portal/live" : context.workspace === "church_admin" ? "/church-admin/livestreams" : undefined;
    case "PENDING_INVITATIONS":
      return context.workspace === "church_admin" ? "/church-admin/roles" : undefined;
    case "UPCOMING_EVENTS":
      return routes.events;
    case "UNRESOLVED_PRAYER_REQUESTS":
      return routes.prayerRequests;
    case "CONTRIBUTION_SUMMARY":
      return routes.contributions;
    case "OPEN_BIBLE":
    case "SEARCH_SCRIPTURE":
      return routes.bible;
    case "OPEN_DAILY_READINGS":
    case "AI_EXPLAIN_SCRIPTURE":
      return routes.dailyReadings;
    case "OPEN_SAINT":
      return routes.saints;
    case "OPEN_CALENDAR":
      return routes.calendar;
    case "OPEN_EVENTS":
      return routes.events;
    case "OPEN_MASS_INTENTIONS":
      return routes.massIntentions;
    case "OPEN_PRAYER_REQUESTS":
      return routes.prayerRequests;
    case "OPEN_PRAYER_LIBRARY":
      return routes.prayerLibrary;
    case "OPEN_SACRAMENTS":
      return routes.sacraments;
    case "OPEN_CONTRIBUTIONS":
      return routes.contributions;
    case "SHOW_DASHBOARD":
      return routes.dashboard;
    default:
      return undefined;
  }
}

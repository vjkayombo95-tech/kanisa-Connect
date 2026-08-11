import type { WorkspaceId } from "@/components/workspace";

import { canRunKanisaAIAction } from "./permissions";
import { kanisaAIActionRegistry } from "./registry";
import type { KanisaAIAction, KanisaAIContext, KanisaAIIntent } from "./types";

export type KanisaAICapabilityDomain =
  | "faith"
  | "scripture"
  | "prayer"
  | "parish_life"
  | "pastoral"
  | "finance"
  | "operations"
  | "content"
  | "platform";

export type KanisaAICapability = {
  id: string;
  label: string;
  domain: KanisaAICapabilityDomain;
  workspaces: WorkspaceId[];
  intents?: KanisaAIIntent[];
  routeByWorkspace?: Partial<Record<WorkspaceId, string>>;
  requiresAI?: boolean;
};

export type KanisaAIExperienceAssistant = {
  id: string;
  title: string;
  description: string;
  workspaces: WorkspaceId[];
  capabilityIds: string[];
  futureCapabilityIds?: string[];
  requiresAI?: boolean;
  routeByWorkspace?: Partial<Record<WorkspaceId, string>>;
};

export type ResolvedKanisaAIExperience = {
  workspace: WorkspaceId;
  title: string;
  description: string;
  sections: string[];
  assistants: Array<KanisaAIExperienceAssistant & {
    capabilities: KanisaAICapability[];
    futureCapabilities: KanisaAICapability[];
    route: string | null;
  }>;
  capabilities: KanisaAICapability[];
  suggestedPrompts: string[];
  allowedActions: KanisaAIAction[];
  allowedNavigationTargets: string[];
  allowedRetrievalIntents: KanisaAIIntent[];
  allowedActionIntents: KanisaAIIntent[];
  providerAvailability: "not_configured";
};

const capabilityRegistry: KanisaAICapability[] = [
  { id: "todays-readings", label: "Today's Readings", domain: "scripture", workspaces: ["member", "pastoral", "church_admin", "finance"], intents: ["OPEN_DAILY_READINGS"], routeByWorkspace: { member: "/portal/daily-readings", pastoral: "/pastoral/daily-readings", church_admin: "/church-admin/daily-readings", finance: "/finance/daily-readings" } },
  { id: "sunday-readings", label: "Sunday Readings", domain: "scripture", workspaces: ["member", "pastoral", "church_admin", "finance"], intents: ["OPEN_DAILY_READINGS"], routeByWorkspace: { member: "/portal/daily-readings", pastoral: "/pastoral/daily-readings", church_admin: "/church-admin/daily-readings", finance: "/finance/daily-readings" } },
  { id: "bible-search", label: "Bible Search", domain: "scripture", workspaces: ["member", "pastoral", "church_admin", "finance"], intents: ["OPEN_BIBLE", "SEARCH_SCRIPTURE"], routeByWorkspace: { member: "/portal/bible", pastoral: "/pastoral/bible", church_admin: "/church-admin/bible", finance: "/finance/bible" } },
  { id: "prayer-library", label: "Prayer Library", domain: "prayer", workspaces: ["member"], intents: ["OPEN_PRAYER_LIBRARY"], routeByWorkspace: { member: "/portal/library" } },
  { id: "saints", label: "Saints", domain: "faith", workspaces: ["member", "pastoral", "church_admin", "finance", "super_admin"], intents: ["OPEN_SAINT"], routeByWorkspace: { member: "/portal/library", pastoral: "/pastoral/saints", church_admin: "/church-admin/saints", finance: "/finance/saints", super_admin: "/super-admin/catholic-content/saints" } },
  { id: "liturgical-calendar", label: "Liturgical Calendar", domain: "faith", workspaces: ["member", "pastoral", "church_admin", "finance", "super_admin"], routeByWorkspace: { member: "/portal/liturgical-calendar", pastoral: "/pastoral/liturgical-calendar", church_admin: "/church-admin/liturgical-calendar", finance: "/finance/liturgical-calendar", super_admin: "/super-admin/catholic-content/liturgical-calendar" } },
  { id: "daily-prayer", label: "Daily Prayer", domain: "prayer", workspaces: ["member"], routeByWorkspace: { member: "/portal/library" } },
  { id: "parish-calendar", label: "Parish Calendar", domain: "parish_life", workspaces: ["member", "pastoral", "church_admin", "finance"], intents: ["OPEN_CALENDAR"], routeByWorkspace: { member: "/portal/calendar", pastoral: "/pastoral/calendar", church_admin: "/church-admin/calendar", finance: "/finance/calendar" } },
  { id: "parish-events", label: "Parish Events", domain: "parish_life", workspaces: ["member", "pastoral", "church_admin"], intents: ["OPEN_EVENTS"], routeByWorkspace: { member: "/portal/events", pastoral: "/pastoral/events", church_admin: "/church-admin/events" } },
  { id: "published-announcements", label: "Published Announcements", domain: "parish_life", workspaces: ["member"], routeByWorkspace: { member: "/portal/announcements" } },
  { id: "my-mass-intentions", label: "My Mass Intentions", domain: "parish_life", workspaces: ["member"], intents: ["OPEN_MASS_INTENTIONS"], routeByWorkspace: { member: "/portal/mass-intentions" } },
  { id: "my-contributions", label: "My Contributions", domain: "parish_life", workspaces: ["member"], intents: ["OPEN_CONTRIBUTIONS"], routeByWorkspace: { member: "/portal/contribution-history" } },
  { id: "my-communities", label: "My Communities", domain: "parish_life", workspaces: ["member"], routeByWorkspace: { member: "/portal/channels" } },
  { id: "my-notifications", label: "My Notifications", domain: "parish_life", workspaces: ["member"], routeByWorkspace: { member: "/portal/notifications" } },
  { id: "members", label: "Members", domain: "operations", workspaces: ["church_admin"], routeByWorkspace: { church_admin: "/church-admin/members" } },
  { id: "invitations", label: "Invitations", domain: "operations", workspaces: ["church_admin"], routeByWorkspace: { church_admin: "/church-admin/roles" } },
  { id: "attendance", label: "Attendance", domain: "operations", workspaces: ["church_admin"], routeByWorkspace: { church_admin: "/church-admin/attendance" } },
  { id: "manage-events", label: "Manage Events", domain: "operations", workspaces: ["church_admin"], intents: ["OPEN_EVENTS"], routeByWorkspace: { church_admin: "/church-admin/events" } },
  { id: "manage-announcements", label: "Manage Announcements", domain: "operations", workspaces: ["church_admin"], routeByWorkspace: { church_admin: "/church-admin/announcements" } },
  { id: "prayer-requests", label: "Prayer Requests", domain: "pastoral", workspaces: ["pastoral", "church_admin"], intents: ["OPEN_PRAYER_REQUESTS"], routeByWorkspace: { pastoral: "/pastoral/prayer-requests", church_admin: "/church-admin/prayer-requests" } },
  { id: "mass-intentions", label: "Mass Intentions", domain: "pastoral", workspaces: ["pastoral", "church_admin"], intents: ["OPEN_MASS_INTENTIONS"], routeByWorkspace: { pastoral: "/pastoral/mass-intentions", church_admin: "/church-admin/mass-intentions" } },
  { id: "sacraments", label: "Sacraments", domain: "pastoral", workspaces: ["pastoral", "church_admin"], intents: ["OPEN_SACRAMENTS"], routeByWorkspace: { pastoral: "/pastoral/sacraments", church_admin: "/church-admin/sacraments" } },
  { id: "communities", label: "Communities", domain: "operations", workspaces: ["church_admin", "pastoral"], routeByWorkspace: { church_admin: "/church-admin/communities", pastoral: "/pastoral/communities" } },
  { id: "ministries", label: "Ministries", domain: "operations", workspaces: ["church_admin", "pastoral"], routeByWorkspace: { church_admin: "/church-admin/ministries", pastoral: "/pastoral/ministries" } },
  { id: "contribution-summaries", label: "Contribution Summaries", domain: "finance", workspaces: ["church_admin", "finance"], intents: ["OPEN_CONTRIBUTIONS"], routeByWorkspace: { church_admin: "/church-admin/contributions", finance: "/finance/contributions" } },
  { id: "giving-trends", label: "Giving Trends", domain: "finance", workspaces: ["church_admin", "finance"], intents: ["OPEN_CONTRIBUTIONS"], routeByWorkspace: { church_admin: "/church-admin/finance-intelligence", finance: "/finance/finance-intelligence" } },
  { id: "pledge-completion", label: "Pledge Completion", domain: "finance", workspaces: ["church_admin", "finance"], routeByWorkspace: { church_admin: "/church-admin/pledges", finance: "/finance/pledges" } },
  { id: "financial-reports", label: "Financial Reports", domain: "finance", workspaces: ["church_admin", "finance"], routeByWorkspace: { church_admin: "/church-admin/reports", finance: "/finance/reports" } },
  { id: "parish-health", label: "Parish Health", domain: "finance", workspaces: ["church_admin"], routeByWorkspace: { church_admin: "/church-admin/finance-intelligence" } },
  { id: "draft-announcement", label: "Draft Announcement", domain: "content", workspaces: ["pastoral", "church_admin"], requiresAI: true, intents: ["AI_DRAFT"], routeByWorkspace: { pastoral: "/pastoral/announcements", church_admin: "/church-admin/announcements" } },
  { id: "draft-reflection", label: "Draft Reflection", domain: "content", workspaces: ["pastoral", "church_admin"], requiresAI: true, intents: ["AI_DRAFT"], routeByWorkspace: { pastoral: "/pastoral/announcements", church_admin: "/church-admin/announcements" } },
  { id: "draft-homily", label: "Draft Homily", domain: "content", workspaces: ["pastoral"], requiresAI: true, intents: ["AI_DRAFT"], routeByWorkspace: { pastoral: "/pastoral/daily-readings" } },
  { id: "tenants", label: "Tenants", domain: "platform", workspaces: ["super_admin"], routeByWorkspace: { super_admin: "/super-admin/churches" } },
  { id: "platform-health", label: "Platform Health", domain: "platform", workspaces: ["super_admin"], routeByWorkspace: { super_admin: "/super-admin/system-health" } },
  { id: "system-jobs", label: "System Jobs", domain: "platform", workspaces: ["super_admin"], routeByWorkspace: { super_admin: "/super-admin/jobs" } },
  { id: "audit-logs", label: "Audit Logs", domain: "platform", workspaces: ["super_admin"], routeByWorkspace: { super_admin: "/super-admin/audit-logs" } },
  { id: "feature-management", label: "Feature Management", domain: "platform", workspaces: ["super_admin"], routeByWorkspace: { super_admin: "/super-admin/features" } },
  { id: "billing-verification", label: "Billing Verification", domain: "platform", workspaces: ["super_admin"], routeByWorkspace: { super_admin: "/super-admin/billing-verification" } },
  { id: "catholic-cms", label: "Catholic CMS", domain: "content", workspaces: ["super_admin"], routeByWorkspace: { super_admin: "/super-admin/catholic-content" } },
  { id: "prayer-library-cms", label: "Prayer Library", domain: "content", workspaces: ["super_admin"], routeByWorkspace: { super_admin: "/super-admin/catholic-content/prayer-library" } },
  { id: "daily-readings-cms", label: "Daily Readings", domain: "content", workspaces: ["super_admin"], routeByWorkspace: { super_admin: "/super-admin/catholic-content/daily-readings" } },
  { id: "imports", label: "Imports", domain: "platform", workspaces: ["super_admin"], routeByWorkspace: { super_admin: "/super-admin/imports" } },
];

const assistantRegistry: KanisaAIExperienceAssistant[] = [
  {
    id: "my-faith-assistant",
    title: "My Faith Assistant",
    description: "A member companion for Catholic content, saints, prayer, and daily parish life.",
    workspaces: ["member"],
    capabilityIds: ["todays-readings", "sunday-readings", "saints", "liturgical-calendar", "daily-prayer"],
    routeByWorkspace: { member: "/portal/daily-readings" },
  },
  {
    id: "bible-readings-assistant",
    title: "Bible & Readings Assistant",
    description: "Open Scripture, daily readings, Gospel passages, and member-visible Catholic library content.",
    workspaces: ["member", "pastoral", "church_admin", "finance"],
    capabilityIds: ["todays-readings", "bible-search", "saints", "liturgical-calendar"],
    routeByWorkspace: { member: "/portal/bible", pastoral: "/pastoral/bible", church_admin: "/church-admin/bible", finance: "/finance/bible" },
  },
  {
    id: "prayer-assistant",
    title: "Prayer Assistant",
    description: "Find member-visible prayers, submit prayer requests, and continue your prayer journey.",
    workspaces: ["member"],
    capabilityIds: ["prayer-library", "daily-prayer"],
    routeByWorkspace: { member: "/portal/library" },
  },
  {
    id: "parish-life-assistant",
    title: "Parish Life Assistant",
    description: "Navigate member-visible parish events, announcements, Mass intentions, and activity.",
    workspaces: ["member"],
    capabilityIds: ["parish-calendar", "parish-events", "published-announcements", "my-mass-intentions", "my-contributions", "my-communities", "my-notifications"],
    routeByWorkspace: { member: "/portal/calendar" },
  },
  {
    id: "parish-operations-assistant",
    title: "Parish Operations Assistant",
    description: "Coordinate members, invitations, events, announcements, communities, and parish operations.",
    workspaces: ["church_admin"],
    capabilityIds: ["members", "invitations", "attendance", "parish-calendar", "manage-events", "manage-announcements", "communities", "ministries"],
    routeByWorkspace: { church_admin: "/church-admin" },
  },
  {
    id: "pastoral-operations-assistant",
    title: "Pastoral Operations Assistant",
    description: "Review pastoral care work across prayer requests, Mass intentions, and sacraments.",
    workspaces: ["pastoral", "church_admin"],
    capabilityIds: ["prayer-requests", "mass-intentions", "sacraments", "communities", "ministries", "parish-calendar"],
    routeByWorkspace: { pastoral: "/pastoral", church_admin: "/church-admin/prayer-requests" },
  },
  {
    id: "finance-intelligence",
    title: "Finance Intelligence",
    description: "Authorized contribution summaries, giving trends, pledge completion, and reports.",
    workspaces: ["finance", "church_admin"],
    capabilityIds: ["contribution-summaries", "giving-trends", "pledge-completion", "financial-reports", "parish-health"],
    routeByWorkspace: { finance: "/finance/finance-intelligence", church_admin: "/church-admin/finance-intelligence" },
  },
  {
    id: "content-assistant",
    title: "Content Assistant",
    description: "Provider-required drafting tools for authorized parish communication and pastoral content.",
    workspaces: ["pastoral", "church_admin"],
    capabilityIds: [],
    futureCapabilityIds: ["draft-announcement", "draft-reflection", "draft-homily"],
    requiresAI: true,
    routeByWorkspace: { pastoral: "/pastoral/announcements", church_admin: "/church-admin/announcements" },
  },
  {
    id: "platform-operations-assistant",
    title: "Platform Operations Assistant",
    description: "Platform-owned operations for tenants, health, jobs, billing, logs, and feature management.",
    workspaces: ["super_admin"],
    capabilityIds: ["tenants", "platform-health", "system-jobs", "audit-logs", "feature-management", "billing-verification"],
    routeByWorkspace: { super_admin: "/super-admin" },
  },
  {
    id: "catholic-cms-assistant",
    title: "Catholic CMS Assistant",
    description: "Platform Catholic content operations for Daily Readings, saints, prayer library, and imports.",
    workspaces: ["super_admin"],
    capabilityIds: ["catholic-cms", "prayer-library-cms", "daily-readings-cms", "imports", "saints", "liturgical-calendar"],
    routeByWorkspace: { super_admin: "/super-admin/catholic-content" },
  },
];

const promptsByWorkspace: Record<WorkspaceId, string[]> = {
  member: [
    "What events are coming up?",
    "Is anything live?",
    "What needs my attention?",
    "What are today's readings?",
  ],
  pastoral: [
    "What needs my attention?",
    "Any Mass intentions waiting?",
    "Show unresolved prayer requests.",
    "Is anything live?",
    "Open today's Gospel.",
    "Open the pastoral calendar.",
    "Show sacramental follow-up.",
  ],
  church_admin: [
    "Show contribution trends.",
    "What needs my attention?",
    "What events are coming up?",
    "Show pending invitations.",
    "How many members do we have?",
    "Any new members?",
    "How much is still unpaid?",
    "Any Mass intentions waiting?",
    "Show unresolved prayer requests.",
    "Is anything live?",
  ],
  finance: [
    "Show contribution trends.",
    "What needs my attention?",
    "How much is still unpaid?",
    "What events are coming up?",
  ],
  super_admin: [
    "Open platform health.",
    "Show system jobs.",
    "Open churches.",
    "Open feature management.",
    "Open Catholic CMS imports.",
  ],
};

const titlesByWorkspace: Record<WorkspaceId, { title: string; description: string; sections: string[] }> = {
  member: {
    title: "Kanisa AI",
    description: "Your Catholic faith and parish assistant.",
    sections: ["Continue Your Faith Journey", "Today", "Explore Scripture", "Prayer & Spiritual Life", "My Parish", "My Activity"],
  },
  pastoral: {
    title: "Pastoral Kanisa AI",
    description: "Pastoral, sacramental, and parish care assistance for your active workspace.",
    sections: ["Today's Ministry", "Pastoral Care", "Sacraments", "Parish Calendar"],
  },
  church_admin: {
    title: "Kanisa AI",
    description: "Parish operations assistance for administration, pastoral care, finance, and content.",
    sections: ["Today's Parish Priorities", "Operations", "Pastoral Care", "Finance", "Content"],
  },
  finance: {
    title: "Finance Kanisa AI",
    description: "Financial intelligence and reporting assistance for authorized finance work.",
    sections: ["Contributions", "Giving Trends", "Pledges", "Reports"],
  },
  super_admin: {
    title: "Platform Kanisa AI",
    description: "Platform operations and Catholic content assistance for Kanisa Connect.",
    sections: ["Platform Health", "Tenants", "System Jobs", "Catholic CMS"],
  },
};

export function getKanisaAICapabilitiesForWorkspace(workspace: WorkspaceId) {
  return capabilityRegistry.filter((capability) => capability.workspaces.includes(workspace));
}

export function resolveKanisaAIExperience(context: Pick<KanisaAIContext, "workspace" | "role">): ResolvedKanisaAIExperience {
  const workspace = context.workspace;
  const capabilities = getKanisaAICapabilitiesForWorkspace(workspace);
  const capabilityById = new Map(capabilities.map((capability) => [capability.id, capability]));
  const allowedActions = kanisaAIActionRegistry.filter((action) => {
    if (action.workspaces && !action.workspaces.includes(workspace)) return false;
    return canRunKanisaAIAction(action, context as KanisaAIContext);
  });

  const assistants = assistantRegistry
    .filter((assistant) => assistant.workspaces.includes(workspace))
    .map((assistant) => {
      const currentCapabilities = assistant.capabilityIds.flatMap((id) => capabilityById.get(id) ?? []);
      const futureCapabilities = (assistant.futureCapabilityIds ?? []).flatMap((id) => capabilityById.get(id) ?? []);

      return {
        ...assistant,
        capabilities: currentCapabilities,
        futureCapabilities,
        route: assistant.routeByWorkspace?.[workspace] ?? currentCapabilities.find((capability) => capability.routeByWorkspace?.[workspace])?.routeByWorkspace?.[workspace] ?? null,
      };
    })
    .filter((assistant) => assistant.capabilities.length > 0 || assistant.futureCapabilities.length > 0);

  const profile = titlesByWorkspace[workspace];
  const allowedNavigationTargets = capabilities.flatMap((capability) => capability.routeByWorkspace?.[workspace] ?? []);
  const allowedRetrievalIntents = [...new Set(capabilities.flatMap((capability) => capability.intents ?? []))];

  return {
    workspace,
    title: profile.title,
    description: profile.description,
    sections: profile.sections,
    assistants,
    capabilities,
    suggestedPrompts: promptsByWorkspace[workspace],
    allowedActions,
    allowedNavigationTargets,
    allowedRetrievalIntents,
    allowedActionIntents: [...new Set(allowedActions.map((action) => action.intent))],
    providerAvailability: "not_configured",
  };
}

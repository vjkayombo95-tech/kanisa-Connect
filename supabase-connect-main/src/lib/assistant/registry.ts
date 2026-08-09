import type { WorkspaceId } from "@/components/workspace";

import type { AssistantSuggestion, PersonalAssistantContext } from "./types";

type SuggestionTemplate = {
  id: string;
  label: string;
  route: Partial<Record<WorkspaceId, string>>;
  reason?: string;
  feature?: string;
};

export const assistantWorkspaceRoutes: Record<WorkspaceId, Record<string, string>> = {
  member: {
    dashboard: "/portal",
    readings: "/portal/daily-readings",
    bible: "/portal/bible",
    calendar: "/portal/calendar",
    prayerRequests: "/portal/prayer-requests",
    massIntentions: "/portal/mass-intentions",
    giving: "/portal/give",
    events: "/portal/events",
    announcements: "/portal/announcements",
  },
  pastoral: {
    dashboard: "/pastoral",
    readings: "/pastoral/daily-readings",
    bible: "/pastoral/bible",
    calendar: "/pastoral/calendar",
    prayerRequests: "/pastoral/prayer-requests",
    massIntentions: "/pastoral/mass-intentions",
    announcements: "/pastoral/announcements",
  },
  church_admin: {
    dashboard: "/church-admin",
    members: "/church-admin/members",
    invitations: "/church-admin/roles",
    announcements: "/church-admin/announcements",
    events: "/church-admin/events",
    calendar: "/church-admin/calendar",
    reports: "/church-admin/reports",
  },
  finance: {
    dashboard: "/finance",
    contributions: "/finance/contributions",
    pledges: "/finance/pledges",
    reports: "/finance/reports",
    receipts: "/finance/receipts",
    calendar: "/finance/calendar",
  },
  super_admin: {
    dashboard: "/super-admin",
    churches: "/super-admin/churches",
    health: "/super-admin/system-health",
    imports: "/super-admin/import-center",
    jobs: "/super-admin/system-jobs",
  },
};

const templates: Record<WorkspaceId, SuggestionTemplate[]> = {
  member: [
    { id: "read-gospel", label: "Read today's Gospel", route: { member: "/portal/daily-readings" }, reason: "Today's readings are ready when published." },
    { id: "open-calendar", label: "Open Calendar", route: { member: "/portal/calendar" }, feature: "events" },
    { id: "continue-bible", label: "Continue Bible Reading", route: { member: "/portal/bible" }, feature: "bible_verses" },
    { id: "track-prayers", label: "Track Prayer Requests", route: { member: "/portal/prayer-requests" }, feature: "prayer_requests" },
    { id: "giving", label: "Review Giving", route: { member: "/portal/give" }, feature: "give" },
  ],
  pastoral: [
    { id: "review-prayers", label: "Review Prayer Requests", route: { pastoral: "/pastoral/prayer-requests" } },
    { id: "review-intentions", label: "Review Mass Intentions", route: { pastoral: "/pastoral/mass-intentions" } },
    { id: "open-calendar", label: "Open Calendar", route: { pastoral: "/pastoral/calendar" } },
    { id: "read-gospel", label: "Read today's Gospel", route: { pastoral: "/pastoral/daily-readings" } },
  ],
  church_admin: [
    { id: "open-dashboard", label: "Open Church Dashboard", route: { church_admin: "/church-admin" } },
    { id: "review-members", label: "Review Members", route: { church_admin: "/church-admin/members" } },
    { id: "pending-invitations", label: "Pending Invitations", route: { church_admin: "/church-admin/roles" } },
    { id: "announcements", label: "Publish Announcements", route: { church_admin: "/church-admin/announcements" } },
    { id: "events", label: "Review Upcoming Events", route: { church_admin: "/church-admin/events" } },
  ],
  finance: [
    { id: "collections", label: "Review Collections", route: { finance: "/finance/contributions" } },
    { id: "pledges", label: "Outstanding Pledges", route: { finance: "/finance/pledges" } },
    { id: "report", label: "View Finance Report", route: { finance: "/finance/reports" } },
    { id: "receipts", label: "Open Receipts", route: { finance: "/finance/receipts" } },
  ],
  super_admin: [
    { id: "platform-health", label: "Platform Health", route: { super_admin: "/super-admin/system-health" } },
    { id: "new-churches", label: "Review Churches", route: { super_admin: "/super-admin/churches" } },
    { id: "recent-imports", label: "Recent Imports", route: { super_admin: "/super-admin/import-center" } },
    { id: "scheduled-jobs", label: "Scheduled Jobs", route: { super_admin: "/super-admin/system-jobs" } },
  ],
};

export function getBaseSuggestions(context: PersonalAssistantContext): AssistantSuggestion[] {
  return templates[context.workspace]
    .filter((item) => !item.feature || context.featureFlags?.isFeatureVisible?.(item.feature) !== false)
    .map((item) => ({
      id: item.id,
      label: item.label,
      to: item.route[context.workspace] ?? assistantWorkspaceRoutes[context.workspace].dashboard,
      reason: item.reason,
    }));
}

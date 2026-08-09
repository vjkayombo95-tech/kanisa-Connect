import type { KanisaAssistant } from "../shared/types";
import { parishRoute } from "../shared/routes";

export const parishAssistant: KanisaAssistant = {
  id: "parish-assistant",
  title: "Parish Assistant",
  description: "Workspace-aware parish navigation for calendar, events, announcements, requests, communities, and dashboards.",
  supportedIntents: ["OPEN_CALENDAR", "OPEN_EVENTS", "OPEN_PRAYER_REQUESTS", "OPEN_MASS_INTENTIONS", "SHOW_DASHBOARD"],
  visibleWorkspaces: ["member", "pastoral", "church_admin", "finance", "super_admin"],
  requiresAI: false,
  getPrimaryRoute: parishRoute,
  registeredActions: [
    { id: "parish-calendar", title: "Parish Calendar", intent: "OPEN_CALENDAR", requiresAI: false, permission: "workspace:read", handler: "navigate" },
    { id: "parish-events", title: "Events", intent: "OPEN_EVENTS", requiresAI: false, permission: "workspace:read", handler: "navigate" },
    { id: "parish-prayer-requests", title: "Prayer Requests", intent: "OPEN_PRAYER_REQUESTS", requiresAI: false, permission: "workspace:pastoral", handler: "navigate" },
    { id: "parish-mass-intentions", title: "Mass Intentions", intent: "OPEN_MASS_INTENTIONS", requiresAI: false, permission: "workspace:pastoral", handler: "navigate" },
    { id: "parish-dashboard", title: "Dashboard", intent: "SHOW_DASHBOARD", requiresAI: false, permission: "workspace:read", handler: "navigate" },
  ],
  capabilities: [
    { id: "calendar", label: "Parish Calendar", status: "available" },
    { id: "events", label: "Events", status: "available" },
    { id: "announcements", label: "Announcements", status: "available" },
    { id: "prayer-requests", label: "Prayer Requests", status: "available" },
    { id: "mass-intentions", label: "Mass Intentions", status: "available" },
    { id: "communities", label: "Communities", status: "available" },
    { id: "dashboard", label: "Dashboard", status: "available" },
  ],
  futureCapabilities: [],
};

import type { KanisaAssistant } from "../shared/types";
import { scriptureRoute } from "../shared/routes";

export const scriptureAssistant: KanisaAssistant = {
  id: "scripture-assistant",
  title: "Scripture Assistant",
  description: "Provider-free Scripture and Catholic content navigation using existing readings, Bible, saints, prayer, and reflection routes.",
  supportedIntents: ["OPEN_DAILY_READINGS", "OPEN_BIBLE", "SEARCH_SCRIPTURE", "OPEN_SAINT"],
  visibleWorkspaces: ["member", "pastoral", "super_admin"],
  requiresAI: false,
  getPrimaryRoute: scriptureRoute,
  registeredActions: [
    { id: "scripture-todays-gospel", title: "Today's Gospel", intent: "OPEN_DAILY_READINGS", requiresAI: false, permission: "scripture:read", handler: "navigate" },
    { id: "scripture-todays-readings", title: "Today's Readings", intent: "OPEN_DAILY_READINGS", requiresAI: false, permission: "scripture:read", handler: "navigate" },
    { id: "scripture-bible-search", title: "Bible Search", intent: "SEARCH_SCRIPTURE", requiresAI: false, permission: "scripture:read", handler: "navigate" },
    { id: "scripture-open-passage", title: "Open Passage", intent: "SEARCH_SCRIPTURE", requiresAI: false, permission: "scripture:read", handler: "navigate" },
    { id: "scripture-saint-search", title: "Saint Search", intent: "OPEN_SAINT", requiresAI: false, permission: "content:read", handler: "navigate" },
  ],
  capabilities: [
    { id: "todays-gospel", label: "Today's Gospel", status: "available" },
    { id: "todays-readings", label: "Today's Readings", status: "available" },
    { id: "bible-search", label: "Bible Search", status: "available" },
    { id: "open-passage", label: "Open Passage", status: "available" },
    { id: "saint-search", label: "Saint Search", status: "available" },
    { id: "liturgical-calendar", label: "Liturgical Calendar", status: "available" },
    { id: "daily-prayer", label: "Daily Prayer", status: "available" },
    { id: "reflection", label: "Reflection", status: "available" },
  ],
  futureCapabilities: [],
};

import type { KanisaAssistant } from "../shared/types";
import { contentRoute } from "../shared/routes";

export const contentAssistant: KanisaAssistant = {
  id: "content-assistant",
  title: "Content Assistant",
  description: "Future-ready drafting assistant for parish communication and pastoral content.",
  supportedIntents: ["AI_DRAFT"],
  visibleWorkspaces: ["pastoral", "church_admin", "super_admin"],
  requiresAI: true,
  getPrimaryRoute: contentRoute,
  registeredActions: [
    { id: "content-draft-announcement", title: "Draft Announcement", intent: "AI_DRAFT", requiresAI: true, permission: "content:draft", handler: "future-provider" },
    { id: "content-draft-reflection", title: "Draft Reflection", intent: "AI_DRAFT", requiresAI: true, permission: "content:draft", handler: "future-provider" },
    { id: "content-draft-homily", title: "Draft Homily", intent: "AI_DRAFT", requiresAI: true, permission: "content:draft", handler: "future-provider" },
    { id: "content-draft-newsletter", title: "Draft Newsletter", intent: "AI_DRAFT", requiresAI: true, permission: "content:draft", handler: "future-provider" },
    { id: "content-meeting-notes", title: "Generate Meeting Notes", intent: "AI_DRAFT", requiresAI: true, permission: "content:draft", handler: "future-provider" },
  ],
  capabilities: [],
  futureCapabilities: [
    { id: "draft-announcement", label: "Draft Announcement", status: "provider_required" },
    { id: "draft-reflection", label: "Draft Reflection", status: "provider_required" },
    { id: "draft-homily", label: "Draft Homily", status: "provider_required" },
    { id: "draft-newsletter", label: "Draft Newsletter", status: "provider_required" },
    { id: "meeting-notes", label: "Generate Meeting Notes", status: "provider_required" },
  ],
};

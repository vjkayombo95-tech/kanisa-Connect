import type { KanisaAssistant } from "../shared/types";
import { financeIntelligenceRoute } from "../shared/routes";

export const financeAssistant: KanisaAssistant = {
  id: "finance-intelligence",
  title: "Finance Intelligence",
  description: "Contribution analytics, church health, giving trends, pledge completion, insight feeds, summaries, and reports.",
  supportedIntents: ["OPEN_CONTRIBUTIONS", "AI_SUMMARIZE"],
  visibleWorkspaces: ["finance", "church_admin", "super_admin"],
  requiresAI: false,
  getPrimaryRoute: financeIntelligenceRoute,
  registeredActions: [
    {
      id: "finance-intelligence-open",
      title: "Open Finance Intelligence",
      intent: "OPEN_CONTRIBUTIONS",
      requiresAI: false,
      permission: "workspace:finance",
      handler: "navigate",
    },
    {
      id: "finance-intelligence-summary",
      title: "Contribution summaries",
      intent: "AI_SUMMARIZE",
      requiresAI: false,
      permission: "workspace:finance",
      handler: "supabase",
    },
  ],
  capabilities: [
    { id: "church-health", label: "Church Health", status: "available" },
    { id: "giving-trends", label: "Giving Trends", status: "available" },
    { id: "pledge-completion", label: "Pledge Completion", status: "available" },
    { id: "insights-feed", label: "AI Insights Feed", status: "available" },
    { id: "contribution-summaries", label: "Contribution summaries", status: "available" },
    { id: "analytics-reports", label: "Analytics reports", status: "available" },
  ],
  futureCapabilities: [],
};

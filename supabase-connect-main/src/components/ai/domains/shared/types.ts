import type { WorkspaceId } from "@/components/workspace";
import type { KanisaAIAction, KanisaAIIntent } from "@/lib/ai";

export type KanisaAssistantStatus = "available" | "provider_required" | "coming_soon";

export type KanisaAssistantCapability = {
  id: string;
  label: string;
  status: KanisaAssistantStatus;
  route?: string;
};

export type KanisaAssistant = {
  id: string;
  title: string;
  description: string;
  supportedIntents: KanisaAIIntent[];
  visibleWorkspaces: WorkspaceId[];
  requiresAI: boolean;
  registeredActions: KanisaAIAction[];
  capabilities: KanisaAssistantCapability[];
  futureCapabilities: KanisaAssistantCapability[];
  getPrimaryRoute: (workspace: WorkspaceId) => string | null;
};

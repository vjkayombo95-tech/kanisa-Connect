import type { WorkspaceId } from "@/components/workspace";
import type { PersonalAssistantContext } from "@/lib/assistant/types";

export type AssistantEventPriority = "critical" | "high" | "medium" | "low" | "info";

export type AssistantEventCategory =
  | "liturgy"
  | "pastoral"
  | "finance"
  | "community"
  | "administration"
  | "platform";

export type AssistantEvent = {
  id: string;
  dedupeKey: string;
  title: string;
  detail: string;
  priority: AssistantEventPriority;
  category: AssistantEventCategory;
  workspace: WorkspaceId;
  to?: string;
  actionLabel?: string;
  createdAt: string;
  expiresAt?: string | null;
};

export type EventIntelligenceInput = PersonalAssistantContext;

export type EventRule = {
  id: string;
  workspaces: WorkspaceId[];
  generate: (input: EventIntelligenceInput) => AssistantEvent[];
};


import type { QueryClient } from "@tanstack/react-query";

import type { WorkspaceId } from "@/components/workspace";
import type { AssistantEvent } from "./events";

export type AssistantPriority = "high" | "medium" | "low";

export type AssistantFeatureFlags = {
  isFeatureEnabled?: (key: string) => boolean;
  isFeatureVisible?: (key: string) => boolean;
};

export type PersonalAssistantContext = {
  workspace: WorkspaceId;
  role: string | null;
  churchName?: string | null;
  displayName?: string | null;
  route: string;
  today: Date;
  liturgicalSeason?: string | null;
  dashboardContext?: unknown;
  queryClient?: QueryClient;
  featureFlags?: AssistantFeatureFlags;
};

export type AssistantGreetingModel = {
  salutation: string;
  detail: string;
};

export type AssistantBriefingItem = {
  id: string;
  label: string;
  value: string;
  detail?: string;
  to?: string;
};

export type AssistantSuggestion = {
  id: string;
  label: string;
  to: string;
  reason?: string;
};

export type AssistantTask = {
  id: string;
  title: string;
  detail: string;
  priority: AssistantPriority;
  to?: string;
};

export type AssistantModel = {
  greeting: AssistantGreetingModel;
  events: AssistantEvent[];
  briefing: AssistantBriefingItem[];
  suggestions: AssistantSuggestion[];
  tasks: AssistantTask[];
};

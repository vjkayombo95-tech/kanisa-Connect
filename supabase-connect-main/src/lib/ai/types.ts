import type { QueryClient } from "@tanstack/react-query";
import type { User } from "@supabase/supabase-js";

import type { WorkspaceId } from "@/components/workspace";
import type { AppRole } from "@/lib/role-utils";

export type KanisaAIIntent =
  | "OPEN_BIBLE"
  | "OPEN_DAILY_READINGS"
  | "OPEN_SAINT"
  | "OPEN_CALENDAR"
  | "OPEN_EVENTS"
  | "OPEN_MASS_INTENTIONS"
  | "OPEN_PRAYER_REQUESTS"
  | "OPEN_PRAYER_LIBRARY"
  | "OPEN_SACRAMENTS"
  | "OPEN_CONTRIBUTIONS"
  | "SHOW_DASHBOARD"
  | "SEARCH_SCRIPTURE"
  | "AI_EXPLAIN_SCRIPTURE"
  | "AI_SUMMARIZE"
  | "AI_DRAFT"
  | "UNKNOWN";

export type KanisaAIHandlerType =
  | "navigate"
  | "query-cache"
  | "supabase"
  | "cached-ai"
  | "future-provider"
  | "none";

export type KanisaAIPermission =
  | "workspace:read"
  | "workspace:finance"
  | "workspace:pastoral"
  | "workspace:admin"
  | "workspace:super_admin"
  | "scripture:read"
  | "content:read"
  | "content:draft";

export type KanisaAIContext = {
  workspace: WorkspaceId;
  role: AppRole | null;
  church: {
    id: string | null;
    name?: string | null;
  };
  tenant: {
    id: string | null;
    slug?: string | null;
  };
  route: string;
  page?: string | null;
  selectedItem?: unknown;
  language: string;
  queryClient?: QueryClient;
  user?: Pick<User, "id" | "email"> | null;
};

export type KanisaAIRequest = {
  input: string;
  context: KanisaAIContext;
};

export type KanisaAIAction = {
  id: string;
  title: string;
  intent: KanisaAIIntent;
  requiresAI: boolean;
  permission: KanisaAIPermission;
  handler: KanisaAIHandlerType;
  workspaces?: WorkspaceId[];
};

export type KanisaAIRouteDecision = {
  intent: KanisaAIIntent;
  action: KanisaAIAction | null;
  requiresAI: boolean;
  handler: KanisaAIHandlerType;
  allowed: boolean;
  targetRoute?: string;
  reason?: string;
};

export type NavigationResponse = {
  type: "navigation";
  intent: KanisaAIIntent;
  requiresAI: false;
  handler: "navigate";
  route: string;
  message: string;
};

export type SummaryResponse = {
  type: "summary";
  intent: KanisaAIIntent;
  requiresAI: boolean;
  handler: KanisaAIHandlerType;
  summary: string;
  source: "query-cache" | "supabase" | "cached-ai" | "future-provider" | "local";
};

export type DraftResponse = {
  type: "draft";
  intent: "AI_DRAFT";
  requiresAI: true;
  handler: "future-provider" | "cached-ai";
  draft: string;
  source: "cached-ai" | "future-provider";
};

export type ExplanationResponse = {
  type: "explanation";
  intent: "AI_EXPLAIN_SCRIPTURE";
  requiresAI: true;
  handler: "future-provider" | "cached-ai";
  explanation: string;
  source: "cached-ai" | "future-provider";
};

export type PermissionDeniedResponse = {
  type: "permission_denied";
  intent: KanisaAIIntent;
  requiresAI: boolean;
  handler: KanisaAIHandlerType;
  message: string;
};

export type UnknownResponse = {
  type: "unknown";
  intent: "UNKNOWN";
  requiresAI: false;
  handler: "none";
  message: string;
};

export type KanisaAIResponse =
  | NavigationResponse
  | SummaryResponse
  | DraftResponse
  | ExplanationResponse
  | PermissionDeniedResponse
  | UnknownResponse;

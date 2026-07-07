import type {
  DraftResponse,
  ExplanationResponse,
  KanisaAIAction,
  KanisaAIIntent,
  KanisaAIResponse,
  NavigationResponse,
  PermissionDeniedResponse,
  SummaryResponse,
  UnknownResponse,
} from "./types";

export function navigationResponse(intent: KanisaAIIntent, route: string): NavigationResponse {
  return {
    type: "navigation",
    intent,
    requiresAI: false,
    handler: "navigate",
    route,
    message: `Navigate to ${route}.`,
  };
}

export function summaryResponse(action: KanisaAIAction, summary: string, source: SummaryResponse["source"] = "local"): SummaryResponse {
  return {
    type: "summary",
    intent: action.intent,
    requiresAI: action.requiresAI,
    handler: action.handler,
    summary,
    source,
  };
}

export function draftPlaceholderResponse(): DraftResponse {
  return {
    type: "draft",
    intent: "AI_DRAFT",
    requiresAI: true,
    handler: "future-provider",
    draft: "Draft generation will be handled by a future AI provider.",
    source: "future-provider",
  };
}

export function explanationPlaceholderResponse(): ExplanationResponse {
  return {
    type: "explanation",
    intent: "AI_EXPLAIN_SCRIPTURE",
    requiresAI: true,
    handler: "future-provider",
    explanation: "Scripture explanations will be handled by a future AI provider.",
    source: "future-provider",
  };
}

export function permissionDeniedResponse(action: KanisaAIAction, message: string): PermissionDeniedResponse {
  return {
    type: "permission_denied",
    intent: action.intent,
    requiresAI: action.requiresAI,
    handler: action.handler,
    message,
  };
}

export function unknownResponse(): UnknownResponse {
  return {
    type: "unknown",
    intent: "UNKNOWN",
    requiresAI: false,
    handler: "none",
    message: "Kanisa AI could not match this request to a known action.",
  };
}

export function cachedResponse(response: KanisaAIResponse): KanisaAIResponse {
  if (response.type === "summary") return { ...response, source: "cached-ai", handler: "cached-ai" };
  if (response.type === "draft") return { ...response, source: "cached-ai", handler: "cached-ai" };
  if (response.type === "explanation") return { ...response, source: "cached-ai", handler: "cached-ai" };
  return response;
}

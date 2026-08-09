import { getBaseSuggestions } from "./registry";
import type { AssistantSuggestion, PersonalAssistantContext } from "./types";

function currentPageSuggestion(context: PersonalAssistantContext): AssistantSuggestion | null {
  const route = context.route.toLowerCase();
  if (route.includes("prayer-requests")) {
    return { id: "current-prayers", label: "Review pending requests", to: context.route, reason: "You are already on prayer requests." };
  }
  if (route.includes("bible")) {
    return { id: "current-bible", label: "Continue reading", to: context.route, reason: "You are already in Bible." };
  }
  if (route.includes("calendar")) {
    return { id: "current-calendar", label: "Today's events", to: context.route, reason: "You are already on calendar." };
  }
  return null;
}

export function generateAssistantSuggestions(context: PersonalAssistantContext): AssistantSuggestion[] {
  const pageSuggestion = currentPageSuggestion(context);
  const suggestions = getBaseSuggestions(context);
  return [pageSuggestion, ...suggestions].filter(Boolean).slice(0, 5) as AssistantSuggestion[];
}


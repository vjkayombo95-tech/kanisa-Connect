import { generateAssistantBriefing } from "./briefing";
import { generateAssistantEvents } from "./events";
import { generateAssistantGreeting } from "./greeting";
import { generateAssistantSuggestions } from "./suggestions";
import { generateAssistantTasks } from "./tasks";
import type { AssistantModel, PersonalAssistantContext } from "./types";

export function createPersonalAssistantModel(context: PersonalAssistantContext): AssistantModel {
  return {
    greeting: generateAssistantGreeting(context),
    events: generateAssistantEvents(context),
    briefing: generateAssistantBriefing(context),
    suggestions: generateAssistantSuggestions(context),
    tasks: generateAssistantTasks(context),
  };
}

export type {
  AssistantBriefingItem,
  AssistantEvent,
  AssistantGreetingModel,
  AssistantModel,
  AssistantPriority,
  AssistantSuggestion,
  AssistantTask,
  PersonalAssistantContext,
} from "./types";
export type { AssistantEventCategory, AssistantEventPriority } from "./events";

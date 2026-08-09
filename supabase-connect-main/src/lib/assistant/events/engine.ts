import { compareEvents, highestPriority } from "./priorities";
import { eventRules } from "./rules";
import type { AssistantEvent, EventIntelligenceInput } from "./types";
import { getAutomationAssistantEvents } from "@/lib/automation";

function isExpired(event: AssistantEvent, now: Date) {
  return event.expiresAt ? new Date(event.expiresAt).getTime() <= now.getTime() : false;
}

function dedupeEvents(events: AssistantEvent[]) {
  const byKey = new Map<string, AssistantEvent>();

  for (const event of events) {
    const existing = byKey.get(event.dedupeKey);
    byKey.set(event.dedupeKey, existing ? highestPriority(existing, event) : event);
  }

  return Array.from(byKey.values());
}

export function generateAssistantEvents(input: EventIntelligenceInput): AssistantEvent[] {
  const generated = eventRules
    .filter((rule) => rule.workspaces.includes(input.workspace))
    .flatMap((rule) => rule.generate(input))
    .filter((event) => !isExpired(event, input.today));
  const automationEvents = getAutomationAssistantEvents()
    .filter((event) => event.workspace === input.workspace)
    .filter((event) => !isExpired(event, input.today));

  return dedupeEvents([...automationEvents, ...generated]).sort(compareEvents).slice(0, 5);
}

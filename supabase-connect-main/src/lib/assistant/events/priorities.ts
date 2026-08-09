import type { AssistantEvent, AssistantEventPriority } from "./types";

export const eventPriorityWeight: Record<AssistantEventPriority, number> = {
  critical: 50,
  high: 40,
  medium: 30,
  low: 20,
  info: 10,
};

export const eventPriorityStyles: Record<AssistantEventPriority, string> = {
  critical: "border-destructive/40 bg-destructive/10 text-destructive",
  high: "border-orange-500/35 bg-orange-500/10 text-orange-600",
  medium: "border-amber-500/35 bg-amber-500/10 text-amber-600",
  low: "border-primary/30 bg-primary/10 text-primary",
  info: "border-sky-500/30 bg-sky-500/10 text-sky-600",
};

export function compareEvents(left: AssistantEvent, right: AssistantEvent) {
  const priorityDelta = eventPriorityWeight[right.priority] - eventPriorityWeight[left.priority];
  if (priorityDelta !== 0) return priorityDelta;
  return new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime();
}

export function highestPriority(left: AssistantEvent, right: AssistantEvent) {
  return compareEvents(left, right) <= 0 ? left : right;
}


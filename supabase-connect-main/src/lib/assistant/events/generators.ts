import type { AssistantEvent, AssistantEventCategory, AssistantEventPriority, EventIntelligenceInput } from "./types";

export function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? value as Record<string, unknown> : {};
}

export function valueAt(source: unknown, path: string): unknown {
  return path.split(".").reduce<unknown>((current, key) => asRecord(current)[key], source);
}

export function numberAt(source: unknown, path: string, fallback = 0) {
  const value = valueAt(source, path);
  const parsed = Number(value ?? fallback);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function stringAt(source: unknown, path: string, fallback = "") {
  const value = valueAt(source, path);
  return typeof value === "string" && value.trim() ? value : fallback;
}

export function arrayAt(source: unknown, path: string): unknown[] {
  const value = valueAt(source, path);
  return Array.isArray(value) ? value : [];
}

export function dateAfter(input: EventIntelligenceInput, hours: number) {
  return new Date(input.today.getTime() + hours * 60 * 60 * 1000).toISOString();
}

export function endOfToday(input: EventIntelligenceInput) {
  const end = new Date(input.today);
  end.setHours(23, 59, 59, 999);
  return end.toISOString();
}

export function tomorrowEnd(input: EventIntelligenceInput) {
  const end = new Date(input.today);
  end.setDate(end.getDate() + 1);
  end.setHours(23, 59, 59, 999);
  return end.toISOString();
}

export function cachedLiturgy(input: EventIntelligenceInput) {
  const matches = input.queryClient?.getQueriesData({ queryKey: ["live-daily-readings"] }) ?? [];
  const latest = matches.map((entry) => entry[1]).find(Boolean);
  return asRecord(asRecord(latest).day);
}

export function makeEvent(
  input: EventIntelligenceInput,
  event: Omit<AssistantEvent, "createdAt" | "workspace">,
): AssistantEvent {
  return {
    ...event,
    workspace: input.workspace,
    createdAt: input.today.toISOString(),
  };
}

export function countLabel(count: number, singular: string, plural = `${singular}s`) {
  return `${count} ${count === 1 ? singular : plural}`;
}

export function priorityForCount(count: number, highAt = 5, mediumAt = 1): AssistantEventPriority {
  if (count >= highAt) return "high";
  if (count >= mediumAt) return "medium";
  return "info";
}

export function categoryEvent(
  input: EventIntelligenceInput,
  id: string,
  category: AssistantEventCategory,
  priority: AssistantEventPriority,
  title: string,
  detail: string,
  to?: string,
  actionLabel = "Open",
  expiresAt?: string | null,
) {
  return makeEvent(input, {
    id,
    dedupeKey: `${input.workspace}:${category}:${id}`,
    title,
    detail,
    priority,
    category,
    to,
    actionLabel,
    expiresAt: expiresAt ?? endOfToday(input),
  });
}


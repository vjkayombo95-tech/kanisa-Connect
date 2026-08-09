import type { AutomationCondition, AutomationContext, AutomationEvent } from "./types";

function readValue(source: unknown, path: string): unknown {
  return path.split(".").reduce<unknown>((current, key) => {
    if (!current || typeof current !== "object") return undefined;
    return (current as Record<string, unknown>)[key];
  }, source);
}

function hoursSince(value: unknown, now: Date) {
  if (typeof value !== "string") return 0;
  const time = new Date(value).getTime();
  if (!Number.isFinite(time)) return 0;
  return (now.getTime() - time) / (60 * 60 * 1000);
}

export function evaluateCondition(condition: AutomationCondition, event: AutomationEvent, context: AutomationContext) {
  const payload = event.payload ?? {};

  switch (condition.kind) {
    case "waiting_time":
      return hoursSince(readValue(payload, condition.field ?? "createdAt") ?? event.occurredAt, context.now) >= condition.gteHours;
    case "priority":
      return readValue(payload, "priority") === condition.equals;
    case "role":
      return !!event.role && condition.oneOf.includes(event.role);
    case "workspace":
      return condition.oneOf.includes(event.workspace);
    case "church":
      return event.churchId === condition.churchId;
    case "feature_enabled":
      return context.features?.isFeatureEnabled?.(condition.key) !== false;
    case "liturgical_season":
      return condition.oneOf.includes(String(readValue(payload, "liturgicalSeason") ?? ""));
    case "contribution_amount":
      return Number(readValue(payload, "amount") ?? 0) >= condition.gte;
    case "event_status":
      return String(readValue(payload, "status") ?? "") === condition.equals;
    default:
      return false;
  }
}

export function evaluateConditions(conditions: AutomationCondition[] | undefined, event: AutomationEvent, context: AutomationContext) {
  return (conditions ?? []).every((condition) => evaluateCondition(condition, event, context));
}


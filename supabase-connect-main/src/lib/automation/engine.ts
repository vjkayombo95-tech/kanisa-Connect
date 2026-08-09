import { executeAutomationAction } from "./actions";
import { evaluateConditions } from "./conditions";
import { getAutomationRules } from "./registry";
import type { AutomationContext, AutomationEvent, AutomationRunResult } from "./types";

export function evaluateAutomationEvent(
  event: AutomationEvent,
  context: Partial<AutomationContext> = {},
): AutomationRunResult {
  const runtimeContext: AutomationContext = {
    now: context.now ?? new Date(),
    features: context.features,
    dashboardCache: context.dashboardCache,
  };

  const matchedRules = getAutomationRules()
    .filter((rule) => rule.enabled !== false)
    .filter((rule) => rule.eventTypes.includes(event.type))
    .filter((rule) => rule.workspaces.includes(event.workspace))
    .map((rule) => {
      const conditionsMatched = evaluateConditions(rule.conditions, event, runtimeContext);

      if (!conditionsMatched) {
        return {
          rule,
          matched: false,
          reason: "Conditions did not match.",
          actions: [],
        };
      }

      return {
        rule,
        matched: true,
        actions: rule.actions.map((action) => executeAutomationAction(event, rule, action)),
      };
    });

  return {
    event,
    matchedRules,
  };
}

export function createAutomationEvent(input: Omit<AutomationEvent, "id" | "occurredAt"> & { id?: string; occurredAt?: string }): AutomationEvent {
  return {
    id: input.id ?? crypto.randomUUID(),
    occurredAt: input.occurredAt ?? new Date().toISOString(),
    type: input.type,
    workspace: input.workspace,
    role: input.role,
    churchId: input.churchId,
    route: input.route,
    payload: input.payload,
  };
}


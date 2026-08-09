import type { AssistantEvent } from "@/lib/assistant/events";

import { addAutomationHistory } from "./history";
import { queueFutureReminder } from "./scheduler";
import type { AutomationAction, AutomationActionResult, AutomationEvent, AutomationRule } from "./types";

const assistantEvents: AssistantEvent[] = [];

function createAssistantEvent(event: AutomationEvent, rule: AutomationRule, action: AutomationAction): AssistantEvent | undefined {
  if (!action.assistantEvent) return undefined;

  return {
    id: `${rule.id}:${event.id}:${action.id}`,
    dedupeKey: `${event.workspace}:automation:${rule.id}:${action.id}:${event.type}`,
    title: action.assistantEvent.title,
    detail: action.assistantEvent.detail,
    priority: action.assistantEvent.priority,
    category: action.assistantEvent.category,
    workspace: event.workspace,
    to: action.assistantEvent.to ?? action.to,
    actionLabel: action.assistantEvent.actionLabel ?? action.label,
    createdAt: new Date().toISOString(),
    expiresAt: action.assistantEvent.expiresAt ?? null,
  };
}

export function getAutomationAssistantEvents() {
  return [...assistantEvents];
}

export function clearAutomationAssistantEvents() {
  assistantEvents.splice(0, assistantEvents.length);
}

export function executeAutomationAction(event: AutomationEvent, rule: AutomationRule, action: AutomationAction): AutomationActionResult {
  let status: AutomationActionResult["status"] = "executed";
  let message = `${action.label} executed.`;
  let assistantEvent: AssistantEvent | undefined;

  if (["EMAIL", "SMS", "WHATSAPP", "PUSH"].includes(action.type)) {
    status = "queued";
    message = `${action.type} is a future provider action.`;
  } else if (action.type === "QUEUE_FUTURE_REMINDER") {
    const runAt = action.delayUntil ?? new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    queueFutureReminder(event, action, runAt);
    status = "queued";
    message = `Reminder queued for ${new Date(runAt).toLocaleString()}.`;
  } else if (action.type === "CREATE_ASSISTANT_EVENT") {
    assistantEvent = createAssistantEvent(event, rule, action);
    if (assistantEvent) assistantEvents.unshift(assistantEvent);
    message = "Assistant event published.";
  } else if (action.type === "CREATE_NOTIFICATION") {
    message = action.notification ? `Notification: ${action.notification.title}` : "Notification created in memory.";
  } else if (action.type === "NAVIGATE") {
    message = action.to ? `Navigation action ready for ${action.to}.` : "Navigation action ready.";
  } else if (action.type === "SHOW_REMINDER") {
    message = "Reminder shown.";
  } else if (action.type === "LOG_AUTOMATION") {
    message = "Automation logged.";
  }

  addAutomationHistory({
    ruleId: rule.id,
    trigger: event.type,
    time: new Date().toISOString(),
    action: action.type,
    status,
    message,
  });

  return { action, status, message, assistantEvent };
}


import type { AutomationAction, AutomationEvent } from "./types";

type QueuedReminder = {
  id: string;
  event: AutomationEvent;
  action: AutomationAction;
  runAt: string;
};

const queue: QueuedReminder[] = [];

export function queueFutureReminder(event: AutomationEvent, action: AutomationAction, runAt: string) {
  const reminder = {
    id: crypto.randomUUID(),
    event,
    action,
    runAt,
  };
  queue.push(reminder);
  return reminder;
}

export function getQueuedReminders() {
  return [...queue].sort((left, right) => new Date(left.runAt).getTime() - new Date(right.runAt).getTime());
}

export function dueQueuedReminders(now = new Date()) {
  return getQueuedReminders().filter((item) => new Date(item.runAt).getTime() <= now.getTime());
}


import type { AutomationHistoryEntry } from "./types";

const HISTORY_LIMIT = 100;
const history: AutomationHistoryEntry[] = [];

export function addAutomationHistory(entry: Omit<AutomationHistoryEntry, "id">) {
  const next: AutomationHistoryEntry = {
    id: crypto.randomUUID(),
    ...entry,
  };
  history.unshift(next);
  history.splice(HISTORY_LIMIT);
  return next;
}

export function getAutomationHistory() {
  return [...history];
}

export function clearAutomationHistory() {
  history.splice(0, history.length);
}


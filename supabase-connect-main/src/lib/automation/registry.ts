import { defaultAutomationRules } from "./rules";
import type { AutomationRule } from "./types";

let registeredRules: AutomationRule[] = [...defaultAutomationRules];

export function getAutomationRules() {
  return [...registeredRules];
}

export function registerAutomationRule(rule: AutomationRule) {
  registeredRules = [rule, ...registeredRules.filter((item) => item.id !== rule.id)];
}

export function resetAutomationRules() {
  registeredRules = [...defaultAutomationRules];
}


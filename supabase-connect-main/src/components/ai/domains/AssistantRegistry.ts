import type { WorkspaceId } from "@/components/workspace";
import type { KanisaAssistant } from "./shared/types";
import { financeAssistant } from "./FinanceAssistant";
import { scriptureAssistant } from "./ScriptureAssistant";
import { parishAssistant } from "./ParishAssistant";
import { contentAssistant } from "./ContentAssistant";

export const assistantRegistry: KanisaAssistant[] = [
  financeAssistant,
  scriptureAssistant,
  parishAssistant,
  contentAssistant,
];

export function getVisibleAssistants(workspace: WorkspaceId) {
  return assistantRegistry.filter((assistant) => assistant.visibleWorkspaces.includes(workspace));
}

export function getAssistantById(id: string) {
  return assistantRegistry.find((assistant) => assistant.id === id) ?? null;
}

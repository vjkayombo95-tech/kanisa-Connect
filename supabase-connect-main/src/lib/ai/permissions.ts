import type { WorkspaceId } from "@/components/workspace";

import type { KanisaAIAction, KanisaAIContext, KanisaAIPermission } from "./types";

const permissionMatrix: Record<KanisaAIPermission, WorkspaceId[]> = {
  "workspace:read": ["member", "pastoral", "church_admin", "finance", "super_admin"],
  "workspace:finance": ["finance", "church_admin", "super_admin"],
  "workspace:pastoral": ["pastoral", "church_admin", "super_admin"],
  "workspace:admin": ["church_admin", "super_admin"],
  "workspace:super_admin": ["super_admin"],
  "scripture:read": ["member", "pastoral", "church_admin", "finance", "super_admin"],
  "content:read": ["member", "pastoral", "church_admin", "finance", "super_admin"],
  "content:draft": ["pastoral", "church_admin", "super_admin"],
};

export function canRunKanisaAIAction(action: KanisaAIAction, context: KanisaAIContext) {
  return permissionMatrix[action.permission]?.includes(context.workspace) ?? false;
}

export function getKanisaAIDenialReason(action: KanisaAIAction, context: KanisaAIContext) {
  if (action.permission === "workspace:finance") return `${context.workspace} cannot access finance workspace data.`;
  if (action.permission === "workspace:pastoral") return `${context.workspace} cannot access pastoral workspace data.`;
  if (action.permission === "workspace:super_admin") return `${context.workspace} cannot access super admin tools.`;
  return `${context.workspace} does not have permission for ${action.title}.`;
}

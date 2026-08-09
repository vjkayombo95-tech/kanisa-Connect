import { assistantWorkspaceRoutes } from "@/lib/assistant/registry";
import type { WorkspaceId } from "@/components/workspace";

export const eventRoutes = assistantWorkspaceRoutes;

export function routeFor(workspace: WorkspaceId, key: string) {
  return eventRoutes[workspace][key] ?? eventRoutes[workspace].dashboard;
}


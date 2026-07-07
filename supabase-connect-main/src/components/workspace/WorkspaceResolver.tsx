import { useMemo } from "react";

import { useAuth } from "@/contexts/AuthContext";
import type { DashboardWidget } from "@/components/portal/dashboard";

import { WorkspaceRenderer } from "./framework";
import {
  getWorkspaceConfig,
  getWorkspaceConfigForRole,
  getWorkspaceIdForRole,
} from "./registry";
import type { WorkspaceId } from "./framework";

type WorkspaceResolverProps<TContext> = {
  workspaceId?: WorkspaceId;
  context: TContext;
  widgets: Record<string, DashboardWidget<TContext>>;
  dashboardClassName?: string;
};

export function WorkspaceResolver<TContext>({
  workspaceId,
  context,
  widgets,
  dashboardClassName,
}: WorkspaceResolverProps<TContext>) {
  const { isSuperAdmin, userRole } = useAuth();

  const workspace = useMemo(
    () => (workspaceId ? getWorkspaceConfig(workspaceId) : getWorkspaceConfigForRole(userRole, isSuperAdmin)),
    [isSuperAdmin, userRole, workspaceId],
  );

  const resolvedRole = isSuperAdmin ? "super_admin" : userRole;

  return (
    <WorkspaceRenderer
      workspace={workspace}
      role={resolvedRole}
      context={context}
      widgets={widgets}
      dashboardClassName={dashboardClassName}
    />
  );
}

export { getWorkspaceIdForRole };

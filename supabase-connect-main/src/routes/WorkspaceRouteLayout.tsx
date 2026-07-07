import { useMemo } from "react";
import { Outlet, useLocation } from "react-router-dom";

import { WorkspaceLayout, WorkspaceProvider } from "@/components/workspace/framework";
import { getWorkspaceConfig } from "@/components/workspace/registry";
import { useAuth } from "@/contexts/AuthContext";
import type { WorkspaceId } from "@/components/workspace/framework";

type WorkspaceRouteLayoutProps = {
  workspaceId: WorkspaceId;
};

export function WorkspaceRouteLayout({ workspaceId }: WorkspaceRouteLayoutProps) {
  const location = useLocation();
  const { churchId, isSuperAdmin, profile, user, userRole } = useAuth();
  const workspace = getWorkspaceConfig(workspaceId);
  const role = isSuperAdmin ? "super_admin" : userRole;
  const churchName = profile?.church_name ?? profile?.church?.name ?? null;
  const page = location.pathname.split("/").filter(Boolean).at(-1) ?? "dashboard";
  const userId = user?.id ?? null;
  const routeContext = useMemo(
    () => ({
      workspace: workspaceId,
      role,
      churchId,
      churchName,
      route: location.pathname,
      page,
      userId,
    }),
    [churchId, churchName, location.pathname, page, role, userId, workspaceId],
  );

  return (
    <WorkspaceProvider workspace={workspace} role={role} context={routeContext}>
      <WorkspaceLayout workspace={workspace}>
        <Outlet />
      </WorkspaceLayout>
    </WorkspaceProvider>
  );
}

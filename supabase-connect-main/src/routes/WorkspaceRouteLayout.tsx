import { useMemo } from "react";
import { Outlet, useLocation } from "react-router-dom";

import { WorkspaceLayout, WorkspaceProvider } from "@/components/workspace/framework";
import { getWorkspaceConfig } from "@/components/workspace/registry";
import { useAuth } from "@/contexts/AuthContext";
import { useChurchPermission, usePermissionCacheInvalidation } from "@/hooks/use-church-permission";
import { getWorkspaceRoutePermission } from "@/lib/workspace-route-permissions";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LoadingState } from "@/components/ui/page-state";
import type { WorkspaceId } from "@/components/workspace/framework";

type WorkspaceRouteLayoutProps = {
  workspaceId: WorkspaceId;
};

export function WorkspaceRouteLayout({ workspaceId }: WorkspaceRouteLayoutProps) {
  const location = useLocation();
  const { churchId, isSuperAdmin, profile, user, userRole } = useAuth();
  const workspace = getWorkspaceConfig(workspaceId);
  usePermissionCacheInvalidation();
  const routePermission = useMemo(() => getWorkspaceRoutePermission(location.pathname), [location.pathname]);
  const permission = useChurchPermission(routePermission?.featureKey ?? "", routePermission?.action ?? "view");
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

  if (routePermission && permission.isLoading) {
    return <div className="mx-auto max-w-5xl p-8"><LoadingState variant="dashboard" title="Checking access" /></div>;
  }

  if (routePermission && !permission.allowed) {
    return <div className="mx-auto max-w-3xl p-6"><Card><CardHeader><CardTitle>Access unavailable</CardTitle><CardDescription>This feature is disabled for your church, unavailable under its subscription, or your role does not have permission to view it.</CardDescription></CardHeader></Card></div>;
  }

  return (
    <WorkspaceProvider workspace={workspace} role={role} context={routeContext}>
      <WorkspaceLayout workspace={workspace}>
        <Outlet />
      </WorkspaceLayout>
    </WorkspaceProvider>
  );
}

import { useMemo } from "react";
import { useLocation } from "react-router-dom";

import { useAuth } from "@/contexts/AuthContext";
import { useFeatureAccess } from "@/hooks/use-feature-access";
import { useChurchPermission } from "@/hooks/use-church-permission";
import type { AppRole } from "@/lib/role-utils";
import { getWorkspaceRoutePermission } from "@/lib/workspace-route-permissions";

import { useWorkspaceContext } from "./framework";
import { getWorkspaceConfig, getWorkspaceConfigForRole } from "./registry";
import {
  WORKSPACE_PAGE_PERMISSIONS,
  type WorkspacePageContext,
  type WorkspacePagePermission,
} from "./page-context";

export function useWorkspacePage(): WorkspacePageContext {
  const workspaceContext = useWorkspaceContext();
  const { isSuperAdmin, userRole } = useAuth();
  const featureFlags = useFeatureAccess();
  const location = useLocation();
  const routePermission = getWorkspaceRoutePermission(location.pathname);
  const featureKey = routePermission?.featureKey ?? "";
  const view = useChurchPermission(featureKey, "view");
  const create = useChurchPermission(featureKey, "create");
  const edit = useChurchPermission(featureKey, "edit");
  const remove = useChurchPermission(featureKey, "delete");
  const approve = useChurchPermission(featureKey, "approve");
  const publish = useChurchPermission(featureKey, "publish");
  const manage = useChurchPermission(featureKey, "manage");

  const workspace = workspaceContext?.workspace ?? getWorkspaceConfigForRole(userRole, isSuperAdmin);
  const role = (workspaceContext?.role ?? (isSuperAdmin ? "super_admin" : userRole)) as AppRole | "priest" | "finance" | null;

  return useMemo(() => {
    const permissions = new Set<WorkspacePagePermission>(WORKSPACE_PAGE_PERMISSIONS[workspace.id] ?? []);
    if (routePermission) {
      const decisions: Record<WorkspacePagePermission, boolean> = {
        read: view.allowed,
        create: create.allowed,
        edit: edit.allowed,
        archive: edit.allowed || remove.allowed,
        publish: publish.allowed,
        review: approve.allowed,
        assign: approve.allowed,
        respond: edit.allowed,
        complete: approve.allowed,
        schedule: approve.allowed,
        export: manage.allowed,
        manage: manage.allowed,
        cms: manage.allowed,
        payment_status: approve.allowed,
      };
      for (const permission of permissions) {
        if (!decisions[permission]) permissions.delete(permission);
      }
    }
    const workspaceConfig = getWorkspaceConfig(workspace.id);

    return {
      workspace: workspaceConfig,
      workspaceId: workspace.id,
      role,
      permissions,
      featureFlags: {
        getFeatureState: featureFlags.getFeatureState,
        isFeatureVisible: featureFlags.isFeatureVisible,
        isFeatureLocked: featureFlags.isFeatureLocked,
        isFeatureEnabled: featureFlags.isFeatureEnabled,
      },
      navigation: workspaceConfig.navigation,
      branding: {
        title: workspaceConfig.title,
        description: workspaceConfig.description,
        badge: workspaceConfig.title.replace(/\s+Workspace$/i, ""),
        icon: workspaceConfig.icon,
      },
      quickActions: workspaceConfig.quickActions ?? [],
    };
  }, [
    featureFlags.getFeatureState,
    featureFlags.isFeatureEnabled,
    featureFlags.isFeatureLocked,
    featureFlags.isFeatureVisible,
    approve.allowed,
    create.allowed,
    edit.allowed,
    location.pathname,
    manage.allowed,
    publish.allowed,
    remove.allowed,
    role,
    routePermission,
    view.allowed,
    workspace.id,
  ]);
}

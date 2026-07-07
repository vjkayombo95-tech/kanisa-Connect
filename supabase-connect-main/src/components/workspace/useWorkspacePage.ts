import { useMemo } from "react";

import { useAuth } from "@/contexts/AuthContext";
import { useFeatureAccess } from "@/hooks/use-feature-access";
import type { AppRole } from "@/lib/role-utils";

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

  const workspace = workspaceContext?.workspace ?? getWorkspaceConfigForRole(userRole, isSuperAdmin);
  const role = (workspaceContext?.role ?? (isSuperAdmin ? "super_admin" : userRole)) as AppRole | "priest" | "finance" | null;

  return useMemo(() => {
    const permissions = new Set<WorkspacePagePermission>(WORKSPACE_PAGE_PERMISSIONS[workspace.id] ?? []);
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
    role,
    workspace.id,
  ]);
}

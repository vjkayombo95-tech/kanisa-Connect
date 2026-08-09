import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { getWorkspaceConfigForRoles } from "@/components/workspace/registry";
import { NavigationGroups } from "@/components/workspace/navigation-groups";
import { hasAnyRole } from "@/lib/role-utils";
import { getWorkspaceRoutePermission } from "@/lib/workspace-route-permissions";

function navigationFor(roles: string[]) {
  return getWorkspaceConfigForRoles("church_admin", roles).navigation;
}

function flattenedNavigation(roles: string[]) {
  return navigationFor(roles).flatMap((group) => group.items);
}

describe("Church Admin + Pastor pastoral access", () => {
  it("does not reuse scalar-only authorization caches", () => {
    const authContext = readFileSync(resolve(process.cwd(), "src/contexts/AuthContext.tsx"), "utf8");
    expect(authContext).toContain("offline-cache:auth-context:v2:");
    expect(authContext).toContain("offline-cache:current-user-context:v2:");
  });

  it("keeps Pastor-only navigation unchanged", () => {
    const workspace = getWorkspaceConfigForRoles("pastoral", ["pastor"]);
    expect(workspace.navigation.find((group) => group.id === NavigationGroups.PASTORAL_CARE)?.items.map((item) => item.id)).toEqual([
      "mass-intentions",
      "prayer-requests",
      "community-help",
      "mass-schedule",
      "sacraments",
    ]);
  });

  it("adds the complete Pastoral Care group to the Church Admin workspace", () => {
    const pastoralCare = navigationFor(["church_admin", "pastor"])
      .find((group) => group.id === NavigationGroups.PASTORAL_CARE);

    expect(pastoralCare?.items.map((item) => item.to)).toEqual([
      "/pastoral/mass-intentions",
      "/pastoral/prayer-requests",
      "/pastoral/community-help",
      "/pastoral/mass-schedule",
      "/pastoral/sacraments",
    ]);
  });

  it("does not add Pastoral Care for Church Admin-only or after Pastor removal", () => {
    expect(navigationFor(["church_admin"]).some((group) => group.id === NavigationGroups.PASTORAL_CARE)).toBe(false);
    expect(navigationFor(["church_admin", "pastor"]).some((group) => group.id === NavigationGroups.PASTORAL_CARE)).toBe(true);
    expect(navigationFor(["church_admin"]).some((group) => group.id === NavigationGroups.PASTORAL_CARE)).toBe(false);
  });

  it("produces no duplicate navigation item IDs or route keys", () => {
    const items = flattenedNavigation(["church_admin", "pastor"]);
    expect(new Set(items.map((item) => item.id)).size).toBe(items.length);
    expect(new Set(items.map((item) => item.to)).size).toBe(items.length);
  });

  it("produces unique routes for Pastor + Treasurer and member navigation", () => {
    const pastoralFinanceItems = getWorkspaceConfigForRoles("pastoral", ["pastor", "treasurer"])
      .navigation.flatMap((group) => group.items);
    const memberItems = getWorkspaceConfigForRoles("member", [])
      .navigation.flatMap((group) => group.items);

    expect(new Set(pastoralFinanceItems.map((item) => item.to)).size).toBe(pastoralFinanceItems.length);
    expect(new Set(memberItems.map((item) => item.to)).size).toBe(memberItems.length);
  });

  it("requires administrative manage permission for role and settings routes", () => {
    for (const path of ["/church-admin/roles", "/church-admin/settings", "/finance/settings"]) {
      expect(getWorkspaceRoutePermission(path)).toMatchObject({
        featureKey: "feature_permissions_admin",
        action: "manage",
      });
    }
  });

  it("uses all assigned roles for the pastoral workspace boundary", () => {
    expect(hasAnyRole(["pastor"], ["pastor"])).toBe(true);
    expect(hasAnyRole(["church_admin", "pastor"], ["pastor"])).toBe(true);
    expect(hasAnyRole(["church_admin"], ["pastor"])).toBe(false);
    expect(hasAnyRole(["treasurer"], ["pastor"])).toBe(false);
    expect(hasAnyRole([], ["pastor"])).toBe(false);
  });

  it("guards every Pastoral Care direct route with its feature view permission", () => {
    const routes = [
      ["/pastoral/mass-intentions", "mass_intentions"],
      ["/pastoral/prayer-requests", "prayer_requests"],
      ["/pastoral/community-help", "community_help"],
      ["/pastoral/mass-schedule", "events"],
      ["/pastoral/sacraments", "sacraments"],
    ] as const;

    for (const [path, featureKey] of routes) {
      expect(getWorkspaceRoutePermission(path)).toMatchObject({ featureKey, action: "view" });
    }
  });
});

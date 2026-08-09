import { describe, expect, it } from "vitest";

import { filterVisibleNavigationGroups } from "@/components/workspace/navigation-merge";
import { workspaceRegistry } from "@/components/workspace/registry";
import { getWorkspaceRoutePermission } from "@/lib/workspace-route-permissions";
import en from "@/locales/en.json";
import sw from "@/locales/sw.json";

const adminGroups = workspaceRegistry.church_admin.navigation;
const livestreamItem = adminGroups.flatMap((group) => group.items).find((item) => item.id === "livestreams");

describe("Church Admin livestream navigation", () => {
  it("registers the localized secondary service in Liturgy", () => {
    expect(livestreamItem).toMatchObject({
      label: "Livestreams",
      to: "/church-admin/livestreams",
      featureFlag: "livestream",
      requireFeatureEnabled: true,
    });
    expect(adminGroups.find((group) => group.id === "admin-liturgy")?.items).toContain(livestreamItem);
    expect(en.navigation.items.livestreams).toBe("Livestreams");
    expect(sw.navigation.items.livestreams).toBe("Matangazo Mubashara");
  });

  it("appears in desktop and mobile group data only after permission approval", () => {
    const allowed = filterVisibleNavigationGroups(adminGroups, (item) => item.id === "livestreams");
    expect(allowed.flatMap((group) => group.items)).toContainEqual(livestreamItem);

    const denied = filterVisibleNavigationGroups(adminGroups, (item) => item.id !== "livestreams");
    expect(denied.flatMap((group) => group.items).some((item) => item.id === "livestreams")).toBe(false);
  });

  it("keeps direct navigation protected by livestream manage permission", () => {
    expect(getWorkspaceRoutePermission("/church-admin/livestreams")).toEqual({
      path: "/church-admin/livestreams",
      featureKey: "livestream",
      action: "manage",
    });
  });

  it("does not register management navigation in the member workspace", () => {
    const memberItems = workspaceRegistry.member.navigation.flatMap((group) => group.items);
    expect(memberItems.some((item) => item.id === "livestreams" || item.to === "/church-admin/livestreams")).toBe(false);
  });
});

import { describe, expect, it } from "vitest";

import { STAFF_MOBILE_CONFIGS, canSuperAdminEnterChurchWorkspace, getCommunityMobileConfig, isStaffRouteAllowed } from "@/lib/staff-mobile-registry";
import { hasUnsupportedProductionRole, normalizeProductionRoles, resolveStaffMobileWorkspace } from "@/lib/staff-mobile-role";

describe("production-native Wave 3 role resolution", () => {
  it.each([
    [["member", "church_admin"], "admin"],
    [["member", "pastor"], "pastoral"],
    [["member", "treasurer"], "finance"],
    [["pastor", "church_admin"], "admin"],
  ] as const)("resolves %j deterministically to %s", (roles, expected) => {
    expect(resolveStaffMobileWorkspace(roles)).toBe(expected);
    expect(resolveStaffMobileWorkspace([...roles].reverse())).toBe(expected);
  });

  it("does not manufacture a known workspace from inconsistent role data", () => {
    expect(resolveStaffMobileWorkspace(["unexpected-role"])).toBeNull();
    expect(hasUnsupportedProductionRole(["member", "unexpected-role"])).toBe(true);
    expect(normalizeProductionRoles(["PASTOR", "pastor", " member "])).toEqual(["member", "pastor"]);
  });

  it("keeps community leadership out of church-wide role union", () => {
    expect(resolveStaffMobileWorkspace(["member"])).toBe("member");
  });
});

describe("production-native Wave 3 route registry", () => {
  it("uses only existing production route roots", () => {
    for (const config of Object.values(STAFF_MOBILE_CONFIGS)) {
      for (const service of config.services) {
        expect(service.route).not.toMatch(/^\/(pastoral|finance)(\/|$)/);
      }
    }
  });

  it("provides the approved three-item mobile navigation destinations", () => {
    expect(STAFF_MOBILE_CONFIGS.admin).toMatchObject({ workLabel: "Wanachama", workRoute: "/church-admin/members" });
    expect(STAFF_MOBILE_CONFIGS.pastoral).toMatchObject({ workLabel: "Nia", workRoute: "/church-admin/mass-intentions" });
    expect(STAFF_MOBILE_CONFIGS.finance).toMatchObject({ workLabel: "Michango", workRoute: "/church-admin/contributions" });
    expect(STAFF_MOBILE_CONFIGS.super_admin).toMatchObject({ workLabel: "Makanisa", workRoute: "/super-admin/churches" });
  });

  it("limits primary home actions to four", () => {
    for (const config of Object.values(STAFF_MOBILE_CONFIGS)) {
      expect(config.services.filter((service) => service.primary).length).toBeLessThanOrEqual(4);
    }
  });

  it("denies direct finance and administration routes to pastoral presentation", () => {
    expect(isStaffRouteAllowed("pastoral", "/church-admin/mass-intentions")).toBe(true);
    expect(isStaffRouteAllowed("pastoral", "/church-admin/contributions")).toBe(false);
    expect(isStaffRouteAllowed("pastoral", "/church-admin/settings")).toBe(false);
    expect(isStaffRouteAllowed("pastoral", "/church-admin/roles")).toBe(false);
  });

  it("denies pastoral and administration routes to finance presentation", () => {
    expect(isStaffRouteAllowed("finance", "/church-admin/contributions")).toBe(true);
    expect(isStaffRouteAllowed("finance", "/church-admin/mass-intentions")).toBe(false);
    expect(isStaffRouteAllowed("finance", "/church-admin/settings")).toBe(false);
    expect(isStaffRouteAllowed("finance", "/church-admin/members")).toBe(false);
  });

  it("keeps every community destination tied to the exact verified community", () => {
    const config = getCommunityMobileConfig("community-a");
    expect(config.home).toBe("/community/community-a/dashboard");
    expect(config.services.every((service) => service.route.startsWith("/community/community-a/"))).toBe(true);
    expect(config.services.some((service) => service.route.startsWith("/church-admin"))).toBe(false);
  });

  it("requires the existing livestream permission in addition to its feature", () => {
    const livestream = STAFF_MOBILE_CONFIGS.admin.services.find((service) => service.id === "livestreams");
    expect(livestream).toMatchObject({ featureKey: "livestream", livestreamPermission: true });
    expect(STAFF_MOBILE_CONFIGS.finance.services.some((service) => service.id === "livestreams")).toBe(false);
  });

  it("does not infer a church tenant for super administrators", () => {
    expect(canSuperAdminEnterChurchWorkspace(null)).toBe(false);
    expect(canSuperAdminEnterChurchWorkspace("")).toBe(false);
    expect(canSuperAdminEnterChurchWorkspace("explicit-church-id")).toBe(true);
  });
});

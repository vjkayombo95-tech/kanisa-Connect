import { renderToStaticMarkup } from "react-dom/server";
import type { AnchorHTMLAttributes } from "react";
import { describe, expect, it, vi } from "vitest";

vi.mock("react-router-dom", () => ({
  Link: ({ to, ...props }: { to: string } & AnchorHTMLAttributes<HTMLAnchorElement>) => <a href={to} {...props} />,
}));

vi.mock("@/components/staff-mobile/StaffMobileExperience", () => ({
  useVisibleStaffServices: (config: { services: unknown[] } | null) => ({
    services: config?.services ?? [],
    isLoading: false,
  }),
}));

import {
  ChurchDashboardQuickActions,
} from "@/components/church-admin/ChurchDashboardExperience";
import {
  STAFF_MOBILE_CONFIGS,
  getCommunityMobileConfig,
  getStaffMobileConfig,
  type StaffMobileConfig,
} from "@/lib/staff-mobile-registry";
import { resolveStaffMobileWorkspace } from "@/lib/staff-mobile-role";

const quickActionIds = new Set(["members", "contributions", "announcements", "mass-intentions", "events"]);

function renderedRoutes(config: StaffMobileConfig | null) {
  const markup = renderToStaticMarkup(
    <ChurchDashboardQuickActions config={config} />,
  );
  return [...markup.matchAll(/href="([^"]+)"/g)].map((match) => match[1]);
}

function expectedRoutes(config: StaffMobileConfig) {
  return config.services
    .filter((service) => quickActionIds.has(service.id))
    .map((service) => service.route);
}

describe("Dashboard Parity D role-aware Quick Actions", () => {
  it("renders only canonical admin actions for a church admin", () => {
    const workspace = resolveStaffMobileWorkspace(["church_admin"]);
    const config = getStaffMobileConfig(workspace);
    expect(config).toBe(STAFF_MOBILE_CONFIGS.admin);
    expect(renderedRoutes(config)).toEqual(expectedRoutes(STAFF_MOBILE_CONFIGS.admin));
  });

  it("uses the canonical admin workspace assigned to secretaries without adding outside actions", () => {
    const workspace = resolveStaffMobileWorkspace(["secretary"]);
    const config = getStaffMobileConfig(workspace);
    expect(workspace).toBe("admin");
    expect(renderedRoutes(config)).toEqual(expectedRoutes(STAFF_MOBILE_CONFIGS.admin));
  });

  it("keeps pastor actions inside the pastoral registry", () => {
    const config = getStaffMobileConfig(resolveStaffMobileWorkspace(["pastor"]));
    const routes = renderedRoutes(config);
    expect(routes).toEqual(expectedRoutes(STAFF_MOBILE_CONFIGS.pastoral));
    expect(routes).not.toContain("/church-admin/members");
    expect(routes).not.toContain("/church-admin/contributions");
  });

  it("keeps treasurer actions inside the finance registry", () => {
    const config = getStaffMobileConfig(resolveStaffMobileWorkspace(["treasurer"]));
    const routes = renderedRoutes(config);
    expect(routes).toEqual(expectedRoutes(STAFF_MOBILE_CONFIGS.finance));
    expect(routes).toEqual(["/church-admin/contributions"]);
    expect(routes).not.toContain("/church-admin/mass-intentions");
    expect(routes).not.toContain("/church-admin/members");
  });

  it("renders only canonical community actions when given the existing community registry", () => {
    const config = getCommunityMobileConfig("community-a");
    const routes = renderedRoutes(config);
    expect(routes).toEqual(expectedRoutes(config));
    expect(routes).toEqual([
      "/community/community-a/members",
      "/community/community-a/contributions",
    ]);
    expect(routes.some((route) => route?.startsWith("/church-admin"))).toBe(false);
  });

  it("fails closed for unknown and member-only workspaces", () => {
    expect(getStaffMobileConfig(null)).toBeNull();
    expect(renderedRoutes(null)).toEqual([]);
    expect(renderedRoutes(getStaffMobileConfig(resolveStaffMobileWorkspace(["unexpected-role"])))).toEqual([]);
    expect(renderedRoutes(getStaffMobileConfig(resolveStaffMobileWorkspace(["member"])))).toEqual([]);
  });

  it("renders no staging-only or unsupported topology for any production registry", () => {
    const configs = [
      STAFF_MOBILE_CONFIGS.admin,
      STAFF_MOBILE_CONFIGS.pastoral,
      STAFF_MOBILE_CONFIGS.finance,
      getCommunityMobileConfig("community-a"),
    ];
    const routes = configs.flatMap(renderedRoutes);
    expect(routes).not.toContain(expect.stringMatching(/\/(operations|audio|preview-member|finance-intelligence)(\/|$)/));
    expect(routes).not.toContain(expect.stringMatching(/^\/(pastoral|finance)(\/|$)/));
  });
});

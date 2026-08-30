import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { isStaffRouteAllowed } from "@/lib/staff-mobile-registry";

const root = process.cwd();
const read = (relative: string) => fs.readFileSync(path.join(root, relative), "utf8");

describe("Production workspace UI parity C boundaries", () => {
  const layout = read("src/components/church-admin/ChurchAdminLayout.tsx");
  const sidebar = read("src/components/church-admin/ChurchAdminSidebar.tsx");
  const command = read("src/components/church-admin/ChurchAdminCommandMenu.tsx");
  const dashboardExperience = read("src/components/church-admin/ChurchDashboardExperience.tsx");
  const portalGive = read("src/pages/portal/PortalGive.tsx");
  const portalPrayerRequests = read("src/pages/portal/PortalPrayerRequests.tsx");
  const routes = read("src/routes/AdminRoutes.tsx");

  it("uses the compact grouped shell and production-approved registry", () => {
    expect(sidebar).toContain("Church Admin Workspace");
    expect(sidebar).toContain("getStaffMobileConfig(staffWorkspace)");
    expect(sidebar).toContain("useVisibleStaffServices(workspaceConfig");
    expect(sidebar).toContain("groups.map");
    expect(layout).toContain("ChurchAdminCommandMenu");
    expect(layout).toContain("pageTitle");
  });

  it("communicates expired access without bypassing feature decisions", () => {
    expect(sidebar).toContain("billing.isExpired");
    expect(sidebar).toContain("Workspace access limited");
    expect(sidebar).not.toContain("getFeatureState");
  });

  it("keeps search limited to visible production services", () => {
    expect(command).toContain("getStaffMobileConfig(staffWorkspace)");
    expect(command).toContain("useVisibleStaffServices(workspaceConfig");
    expect(command).toContain("Ctrl K");
    expect(command).not.toMatch(/operations|audio-processing|preview-member|finance-intelligence/);
  });

  it("does not label unknown staff workspaces as Church Admin", () => {
    for (const source of [layout, sidebar, dashboardExperience]) {
      expect(source).toContain('=== "admin"');
      expect(source).toContain('"Staff Workspace"');
      expect(source).not.toContain(': "Church Admin Workspace"');
    }
    expect(dashboardExperience).toContain('"Staff"');
    expect(dashboardExperience).not.toContain(': "Church Admin"');
  });

  it("keeps portal giving categories church scoped", () => {
    expect(portalGive).toContain('.from("contribution_categories")');
    expect(portalGive).toContain('.eq("church_id", churchId)');
    expect(portalGive).toContain("enabled: !!churchId");
  });

  it("logs prayer toggle failures against the actual prayer marker mutation", () => {
    expect(portalPrayerRequests).toContain('function: "togglePrayer"');
    expect(portalPrayerRequests).toContain('table: "prayer_request_prayers"');
    expect(portalPrayerRequests).toContain('attemptedPrayerOperation.current = prayerStats.prayedByMe ? "delete" : "insert"');
    expect(portalPrayerRequests).toContain("operation: attemptedPrayerOperation.current");
    expect(portalPrayerRequests).toContain("prayer_request_id: request.id");
  });

  it("hides fixed desktop links denied to the active workspace", () => {
    const fixedRoutes = ["/church-admin/notifications", "/church-admin/settings", "/church-admin/billing"];

    expect(fixedRoutes.every((route) => isStaffRouteAllowed("admin", route))).toBe(true);
    expect(fixedRoutes.some((route) => isStaffRouteAllowed("finance", route))).toBe(false);
    expect(fixedRoutes.some((route) => isStaffRouteAllowed("pastoral", route))).toBe(false);
    expect(fixedRoutes.some((route) => isStaffRouteAllowed(null, route))).toBe(false);
    expect(layout).toContain('isStaffRouteAllowed(staffWorkspace, "/church-admin/notifications")');
    expect(layout).toContain('isStaffRouteAllowed(staffWorkspace, "/church-admin/settings")');
    expect(layout).toContain("canOpenNotifications ? (");
    expect(layout).toContain("canOpenSettings ? (");
    expect(sidebar).toContain('isStaffRouteAllowed(staffWorkspace, "/church-admin/billing")');
    expect(sidebar).toContain("canOpenBilling ? <div");
  });

  it("does not add staging-only route topology", () => {
    expect(routes).not.toContain("WorkspaceRouteLayout");
    expect(routes).not.toMatch(/path="(operations|audio|preview-member|finance-intelligence|kanisa-ai)"/);
  });
});

import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const read = (relative: string) => fs.readFileSync(path.join(root, relative), "utf8");

describe("Release A Church Admin desktop UI parity boundaries", () => {
  const routes = read("src/routes/AdminRoutes.tsx");
  const layout = read("src/components/church-admin/ChurchAdminLayout.tsx");
  const sidebar = read("src/components/church-admin/ChurchAdminSidebar.tsx");
  const dashboard = read("src/pages/church-admin/ChurchDashboard.tsx");
  const mobileDashboard = read("src/components/church-admin/ChurchDashboardMobileExperience.tsx");
  const mobile = read("src/components/staff-mobile/StaffMobileExperience.tsx");
  const registry = read("src/lib/staff-mobile-registry.ts");

  const expectedRoutePaths = [
    "services", "qr-payments", "members", "contributions", "pledges", "communities", "ministries", "families",
    "events", "events/:eventId/registrations", "calendar", "mass-timetable", "mass-schedule", "event-requests",
    "announcements", "sermons", "bible-verses", "prayer-requests", "mass-intentions", "community-help",
    "notifications", "channels", "roles", "settings", "settings/billing", "reports", "analytics",
    "analytics-assistant", "data-import", "audit-logs", "billing", "livestreams", "radio",
  ];

  it("preserves the exact production route topology", () => {
    const actual = [...routes.matchAll(/<Route path="([^"]+)"/g)].map((match) => match[1]);
    expect(actual).toEqual(expectedRoutePaths);
    expect(routes).toContain("<Route element={<ChurchAdminLayout />}>");
    expect(routes).not.toContain("WorkspaceRouteLayout");
    expect(routes).not.toMatch(/path="(operations|audio|preview-member|finance-intelligence|kanisa-ai)"/);
  });

  it("keeps feature-gated production navigation and media destinations", () => {
    expect(sidebar).toContain("useVisibleStaffServices(STAFF_MOBILE_CONFIGS.admin)");
    expect(mobile).toContain("features.getFeatureState(service.featureKey)");
    expect(mobile).toContain("livestream.data !== true");
    expect(mobile).toContain("radio.data !== true");
    expect(registry).toContain('route: "/church-admin/radio"');
    expect(registry).toContain('route: "/church-admin/livestreams"');
    expect(routes).toContain('path="radio"');
    expect(routes).toContain('path="livestreams"');
    expect(sidebar).not.toMatch(/\/(audio|operations|preview-member|finance-intelligence)(["/])/);
  });

  it("removes legacy branding without importing the staging workspace architecture", () => {
    expect(sidebar).not.toContain("Church OS");
    expect(sidebar).toContain("Kanisa Connect");
    expect(layout).toContain("<ChurchAdminSidebar />");
    expect(layout).not.toContain("WorkspaceRouteLayout");
    expect(layout).not.toContain("components/workspace");
  });

  it("preserves the Wave 3 mobile and desktop split", () => {
    expect(layout).toContain('<div className="hidden lg:block">');
    expect(dashboard).toContain('className="hidden space-y-8 lg:block"');
    expect(mobileDashboard).toContain('className="space-y-7 lg:hidden"');
    expect(dashboard).toContain("ChurchDashboardMobileExperience");
    expect(layout).toContain("StaffMobileBottomNav");
    expect(mobile).toContain("services.filter((service) => service.primary).slice(0, 4)");
    expect(mobile).toContain("Tafuta huduma");
    expect(mobile).toContain("StaffMobileBottomNav");
  });

  it("keeps the dashboard on its existing production data contract", () => {
    expect(dashboard).not.toContain("get_church_admin_pending_counts");
    expect(dashboard).not.toContain("get_church_financial_summary");
    expect(dashboard).toContain("this_month_giving");
    expect(dashboard).toContain("attendance_confirmed");
    expect(dashboard).toContain("currentPlanDefinition");
  });
});

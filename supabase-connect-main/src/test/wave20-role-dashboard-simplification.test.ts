import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();

const read = (relative: string) =>
  fs.readFileSync(path.join(root, relative), "utf8");

describe("Wave 20 role dashboard simplification", () => {
  const sw = JSON.parse(read("src/locales/sw.json"));
  const en = JSON.parse(read("src/locales/en.json"));
  const sidebar = read(
    "src/components/church-admin/ChurchAdminSidebar.tsx",
  );

  const dashboard = read(
    "src/components/church-admin/ChurchDashboardExperience.tsx",
  );

  it("keeps the desktop sidebar focused and sends secondary services to Zaidi", () => {
    expect(sidebar).toContain('"/church-admin/services"');
    expect(sidebar).toContain('label={t("nav.more")}');
    expect(sw.nav.more).toBe("Zaidi");

    for (const primaryService of [
      "members",
      "contributions",
      "mass-intentions",
      "announcements",
      "mass-timetable",
    ]) {
      expect(sidebar).toContain(`"${primaryService}"`);
    }

    expect(sidebar).toContain(
      "useVisibleStaffServices(workspaceConfig)",
    );

    expect(sidebar).toContain("isStaffRouteAllowed");
  });

  it("uses a simple task-first desktop dashboard hierarchy", () => {
    const sections = [
      "church_admin_dashboard.priorities.title",
      "church_admin_dashboard.quick_actions.title",
      "church_admin_dashboard.today.title",
      "church_admin_dashboard.summary.title",
      "church_admin_dashboard.activity.title",
    ];

    const positions = sections.map((section) =>
      dashboard.indexOf(section),
    );

    expect(
      positions.every((position) => position >= 0),
    ).toBe(true);

    expect(positions).toEqual(
      [...positions].sort((left, right) => left - right),
    );

    expect(sw.church_admin_dashboard.priorities.title).toBe(
      "Cha kufanya leo",
    );
    expect(sw.church_admin_dashboard.quick_actions.title).toBe(
      "Haraka",
    );
    expect(sw.church_admin_dashboard.today.title).toBe(
      "Ratiba ya leo",
    );
    expect(sw.church_admin_dashboard.summary.title).toBe(
      "Muhtasari wa kanisa",
    );
    expect(sw.church_admin_dashboard.activity.title).toBe(
      "Shughuli za karibuni",
    );
  });

  it("keeps existing role-aware dashboard intelligence and quick actions", () => {
    expect(dashboard).toMatch(
      /visiblePendingActions\(\s*counts,\s*intelligence\.staffWorkspace,\s*\)/,
    );

    expect(dashboard).toMatch(
      /getStaffMobileConfig\(\s*intelligence\.staffWorkspace,\s*\)/,
    );

    expect(dashboard).toMatch(
      /<ChurchDashboardQuickActions\s+config=\{quickActionConfig\}\s*\/>/,
    );

    expect(dashboard).not.toContain("supabase.");
  });

  it("limits today's visible priorities and recent activity", () => {
    expect(dashboard).toContain(
      "priorities.slice(0, 4)",
    );

    expect(dashboard).toContain(
      "recentActivity.slice(0, 4)",
    );
  });

  it("keeps the simplified desktop layout responsive", () => {
    expect(dashboard).toContain(
      "sm:grid-cols-2 xl:grid-cols-4",
    );

    expect(dashboard).toContain(
      "sm:grid-cols-2 xl:grid-cols-5",
    );

    expect(dashboard).toContain(
      "grid gap-6 xl:grid-cols-2",
    );

    expect(dashboard).not.toMatch(
      /marginLeft|left:\s*\d|sidebar.*offset/i,
    );
  });

  it("distinguishes exact staff roles in the desktop dashboard presentation", () => {
    expect(dashboard).toContain(
      "translateRoleLabel(t, userRole)",
    );

    expect(sw.role_labels.church_admin).toBe(
      "Usimamizi wa Kanisa",
    );
    expect(en.role_labels.church_admin).toBe(
      "Church Admin",
    );

    expect(sw.role_labels.secretary).toBe("Katibu");
    expect(en.role_labels.secretary).toBe("Secretary");

    expect(sw.role_labels.pastor).toBe("Mchungaji");
    expect(sw.role_labels.priest).toBe("Padri");
    expect(en.role_labels.pastor).toBe("Pastor");
    expect(en.role_labels.priest).toBe("Priest");

    expect(sw.role_labels.treasurer).toBe("Mhazini");
    expect(sw.role_labels.finance).toBe("Kitengo cha Fedha");
    expect(en.role_labels.treasurer).toBe("Treasurer");
    expect(en.role_labels.finance).toBe("Finance");
  });
});

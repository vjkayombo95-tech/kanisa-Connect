import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();

const read = (relative: string) =>
  fs.readFileSync(path.join(root, relative), "utf8");

describe("Wave 20 role dashboard simplification", () => {
  const sidebar = read(
    "src/components/church-admin/ChurchAdminSidebar.tsx",
  );

  const dashboard = read(
    "src/components/church-admin/ChurchDashboardExperience.tsx",
  );

  it("keeps the desktop sidebar focused and sends secondary services to Zaidi", () => {
    expect(sidebar).toContain('"/church-admin/services"');
    expect(sidebar).toContain("Zaidi");

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
      "Cha kufanya leo",
      "Haraka",
      "Ratiba ya leo",
      "Muhtasari wa kanisa",
      "Shughuli za karibuni",
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
      'userRole === "church_admin"',
    );
    expect(dashboard).toContain(
      '"Msimamizi wa Kanisa"',
    );

    expect(dashboard).toContain(
      'userRole === "secretary"',
    );
    expect(dashboard).toContain(
      '"Sekretarieti"',
    );

    expect(dashboard).toContain(
      'userRole === "pastor" || userRole === "priest"',
    );
    expect(dashboard).toContain(
      '"Kichungaji"',
    );

    expect(dashboard).toContain(
      'userRole === "treasurer" || userRole === "finance"',
    );
    expect(dashboard).toContain(
      '"Fedha na Michango"',
    );
  });
});
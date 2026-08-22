import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const read = (relative: string) => fs.readFileSync(path.join(root, relative), "utf8");

describe("production dashboard visual parity D", () => {
  const dashboard = read("src/pages/church-admin/ChurchDashboard.tsx");
  const experience = read("src/components/church-admin/ChurchDashboardExperience.tsx");
  const intelligence = read("src/components/church-admin/ChurchDashboardIntelligence.tsx");
  const hook = read("src/hooks/use-church-dashboard-intelligence.ts");

  it("renders the task-first dashboard hierarchy in the required order", () => {
    const sections = [
      "Workspace briefing",
      "Today's Priorities",
      "Assistant Daily Briefing",
      "Operational Snapshot",
      "Pending Work + Financial Summary",
      "Today's Activity Timeline",
      "Quick Actions",
    ];
    const positions = sections.map((section) => experience.indexOf(section));
    expect(positions.every((position) => position >= 0)).toBe(true);
    expect(positions).toEqual([...positions].sort((left, right) => left - right));
    expect(dashboard.indexOf("<ChurchDashboardExperience")).toBeLessThan(dashboard.indexOf("Production Utilities"));
  });

  it("derives priorities and the daily briefing from the existing Release B hook", () => {
    expect(experience).toContain("useChurchDashboardIntelligence()");
    expect(experience).toContain("visiblePendingActions(counts, intelligence.staffWorkspace)");
    expect(experience).toContain("border-success/20 bg-success/5");
    expect(experience).toContain("deterministic summary derived only from current production dashboard data");
    expect(hook).toContain('.rpc("get_church_admin_pending_counts"');
    expect(hook).toContain('supabase.rpc("get_church_financial_summary"');
    expect(hook).not.toContain("refetchInterval");
    expect(intelligence).toContain("ChurchDashboardIntelligenceView");
  });

  it("uses the existing feature- and role-aware service registry for quick actions", () => {
    expect(experience).toContain("getStaffMobileConfig(intelligence.staffWorkspace)");
    expect(experience).toContain("<ChurchDashboardQuickActions config={quickActionConfig} />");
    expect(experience).not.toContain("useVisibleStaffServices(STAFF_MOBILE_CONFIGS.admin)");
    for (const service of ["members", "contributions", "announcements", "mass-intentions", "events"]) {
      expect(experience).toContain(`"${service}"`);
    }
    expect(experience).not.toMatch(/WorkspaceResolver|Event Intelligence|Personal Assistant|model provider/i);
    expect(experience).not.toMatch(/operations|audio-processing|preview-member|finance-intelligence/i);
    expect(experience).not.toContain("supabase.");
  });

  it("retains all production utility sections and existing loaded-record sources", () => {
    for (const utility of ["Plan & Billing", "Invite Members", "Giving Over Time", "Recent Records"]) {
      expect(dashboard).toContain(utility);
    }
    expect(dashboard).toContain("recentContributions.map");
    expect(dashboard).toContain("data?.announcements");
    expect(dashboard).toContain("deferredData.upcomingEvents");
    expect(dashboard).toContain("deferredData.birthdayMembers");
    expect(dashboard).toContain("deferredData.anniversaryMembers");
  });

  it("uses responsive, overflow-safe grids without sidebar-dependent positioning", () => {
    expect(dashboard).toContain("max-w-7xl overflow-hidden");
    expect(experience).toContain("sm:grid-cols-2 xl:grid-cols-4");
    expect(experience).toContain("md:grid-cols-2 xl:grid-cols-3");
    expect(experience).toContain("sm:grid-cols-2 xl:grid-cols-5");
    expect(experience).not.toMatch(/marginLeft|left:\s*\d|sidebar.*offset/i);
  });
});

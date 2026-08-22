import { renderToStaticMarkup } from "react-dom/server";
import type { AnchorHTMLAttributes } from "react";
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";

vi.mock("react-router-dom", () => ({
  Link: ({ to, ...props }: { to: string } & AnchorHTMLAttributes<HTMLAnchorElement>) => <a href={to} {...props} />,
}));

vi.mock("@/components/staff-mobile/StaffMobileExperience", () => ({
  useVisibleStaffServices: (config: { services: unknown[] }) => ({ services: config.services, isLoading: false }),
}));

import { ChurchDashboardMobileExperience } from "@/components/church-admin/ChurchDashboardMobileExperience";
import type { ChurchDashboardIntelligenceState } from "@/components/church-admin/ChurchDashboardIntelligence";
import { EMPTY_FINANCIAL_SUMMARY, EMPTY_PENDING_COUNTS } from "@/lib/church-dashboard-intelligence";
import { getStaffMobileConfig } from "@/lib/staff-mobile-registry";
import { resolveStaffMobileWorkspace } from "@/lib/staff-mobile-role";

type RenderOptions = {
  pendingError?: boolean;
  pendingLoading?: boolean;
  pendingZero?: boolean;
  criticalError?: boolean;
  criticalLoading?: boolean;
  deferredError?: boolean;
  deferredLoading?: boolean;
  financialError?: boolean;
  noMass?: boolean;
  upcomingEventCount?: number;
};

function intelligence(financialEnabled = false, options: RenderOptions = {}): ChurchDashboardIntelligenceState {
  return {
    staffWorkspace: "admin",
    pendingEnabled: true,
    financialEnabled,
    pending: { data: options.pendingZero ? EMPTY_PENDING_COUNTS : { ...EMPTY_PENDING_COUNTS, massIntentions: 4, prayerRequests: 3, announcements: 2, invitations: 1, total: 10 }, isLoading: !!options.pendingLoading, isError: !!options.pendingError },
    financial: { data: EMPTY_FINANCIAL_SUMMARY, isLoading: false, isError: !!options.financialError },
  } as ChurchDashboardIntelligenceState;
}

function renderFor(role: "church_admin" | "secretary" | "pastor" | "treasurer", financialEnabled = false, options: RenderOptions = {}) {
  const config = getStaffMobileConfig(resolveStaffMobileWorkspace([role]));
  if (!config) return "";
  return renderToStaticMarkup(<ChurchDashboardMobileExperience config={config} intelligence={{ ...intelligence(financialEnabled, options), staffWorkspace: config.workspace === "community" ? null : config.workspace }} administratorName="Amina Admin" greeting="Good morning" churchName="St Joseph" activeMembers={82} totalMembers={100} announcementCount={2} upcomingEventCount={options.upcomingEventCount ?? 1} attendance={{ title: options.deferredError || options.noMass ? null : "Sunday Mass", yes: 20, maybe: 4, responseRate: 60 }} criticalLoading={!!options.criticalLoading} criticalError={!!options.criticalError} deferredLoading={!!options.deferredLoading} deferredError={!!options.deferredError} />);
}

describe("Release D.1 mobile and tablet dashboard parity", () => {
  it("renders the approved task-first hierarchy in order", () => {
    const markup = renderFor("church_admin");
    const labels = ["Good morning", "Today&#x27;s Focus", "Today&#x27;s Priorities", "Quick Actions", "Assistant Daily Briefing", "Operational Snapshot", "Pending Work + Financial Summary", "Huduma zote"];
    const positions = labels.map((label) => markup.indexOf(label));
    expect(positions.every((position) => position >= 0)).toBe(true);
    expect(positions).toEqual([...positions].sort((left, right) => left - right));
  });

  it("caps priorities at three and quick actions at four", () => {
    const markup = renderFor("church_admin");
    expect((markup.match(/waiting/g) ?? [])).toHaveLength(3);
    const quickActions = markup.match(/min-h-24 items-center gap-3/g) ?? [];
    expect(quickActions.length).toBeLessThanOrEqual(4);
  });

  it("keeps role-specific quick actions in canonical registries", () => {
    const admin = renderFor("secretary");
    const pastor = renderFor("pastor");
    const treasurer = renderFor("treasurer", true);
    expect(admin).toContain('href="/church-admin/members"');
    expect(pastor).toContain('href="/church-admin/mass-intentions"');
    expect(pastor).not.toContain('href="/church-admin/members"');
    expect(treasurer).toContain('href="/church-admin/contributions"');
    expect(treasurer).not.toContain('href="/church-admin/members"');
  });

  it("fails closed for unknown roles and preserves financial authorization", () => {
    expect(getStaffMobileConfig(resolveStaffMobileWorkspace(["unknown-role"]))).toBeNull();
    expect(renderFor("pastor")).not.toContain("Financial summary");
    expect(renderFor("treasurer", true)).toContain("Financial summary");
  });

  it("documents the exact 1023/1024 CSS boundary without a visible collision", () => {
    const dashboard = fs.readFileSync(path.join(process.cwd(), "src/pages/church-admin/ChurchDashboard.tsx"), "utf8");
    const mobile = fs.readFileSync(path.join(process.cwd(), "src/components/church-admin/ChurchDashboardMobileExperience.tsx"), "utf8");
    const layout = fs.readFileSync(path.join(process.cwd(), "src/components/church-admin/ChurchAdminLayout.tsx"), "utf8");
    const intelligenceView = fs.readFileSync(path.join(process.cwd(), "src/components/church-admin/ChurchDashboardIntelligence.tsx"), "utf8");
    expect(dashboard).toContain('className="hidden space-y-8 lg:block"');
    expect(mobile).toContain('className="space-y-7 lg:hidden"');
    expect(layout).toContain('<div className="hidden lg:block">');
    expect(layout).not.toContain('mobileConfig && isHome ? "hidden lg:block"');
    expect(intelligenceView).toContain('compact ? "grid gap-3 md:grid-cols-2"');
  });

  it("owns existing dashboard requests once and passes one Release B state to both views", () => {
    const dashboard = fs.readFileSync(path.join(process.cwd(), "src/pages/church-admin/ChurchDashboard.tsx"), "utf8");
    const desktop = fs.readFileSync(path.join(process.cwd(), "src/components/church-admin/ChurchDashboardExperience.tsx"), "utf8");
    const mobile = fs.readFileSync(path.join(process.cwd(), "src/components/church-admin/ChurchDashboardMobileExperience.tsx"), "utf8");
    expect(dashboard.match(/useChurchDashboardIntelligence\(\)/g)).toHaveLength(1);
    expect(desktop).not.toContain("useChurchDashboardIntelligence()");
    expect(mobile).not.toContain("useChurchDashboardIntelligence()");
    expect(mobile).not.toContain("supabase.");
    expect(mobile).not.toContain("useQuery(");
  });

  it("shows green clear state only after a successful zero pending response", () => {
    const markup = renderFor("church_admin", false, { pendingZero: true });
    expect(markup).toContain("No priorities need attention");
    expect(markup).toContain("Authorized work queues are clear");
  });

  it("uses neutral pending wording after an error and never claims clear", () => {
    const markup = renderFor("church_admin", false, { pendingError: true, pendingZero: true });
    expect(markup).toContain("Priorities are temporarily unavailable");
    expect(markup).toContain("Pending work status is temporarily unavailable");
    expect(markup).not.toContain("Authorized work queues are clear");
    expect(markup).not.toContain("No priorities need attention");
  });

  it("does not turn critical metric failure into zero certainty", () => {
    const markup = renderFor("church_admin", false, { criticalError: true, pendingZero: true });
    expect(markup).toContain("Member activity is temporarily unavailable");
    expect(markup).not.toContain("0 active of 0 registered members");
    expect((markup.match(/>—</g) ?? []).length).toBeGreaterThanOrEqual(2);
  });

  it("can show a valid event focus while pending remains explicitly unavailable", () => {
    const markup = renderFor("church_admin", false, { pendingError: true, pendingZero: true, noMass: true, upcomingEventCount: 2 });
    expect(markup).toContain("2 upcoming events to prepare for");
    expect(markup).toContain("Priorities are temporarily unavailable");
    expect(markup).not.toContain("Authorized work queues are clear");
  });

  it("does not render zero-valued finance certainty after an authorized finance error", () => {
    const markup = renderFor("treasurer", true, { financialError: true });
    expect(markup).toContain("Financial summary is temporarily unavailable");
    expect(markup).not.toContain("TZS 0");
  });

  it("uses skeletons while loading instead of calm or zero conclusions", () => {
    const markup = renderFor("church_admin", false, { pendingLoading: true, pendingZero: true, criticalLoading: true, deferredLoading: true });
    expect(markup).not.toContain("No urgent dashboard work needs attention");
    expect(markup).not.toContain("Authorized work queues are clear");
    expect(markup).not.toContain("No priorities need attention");
    expect(markup).toContain("animate-pulse");
  });
});

import type { AnchorHTMLAttributes } from "react";
import { renderToStaticMarkup } from "react-dom/server";
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

import { ChurchDashboardExperience } from "@/components/church-admin/ChurchDashboardExperience";
import { ChurchDashboardIntelligenceView, type ChurchDashboardIntelligenceState } from "@/components/church-admin/ChurchDashboardIntelligence";
import i18n, { changeAppLanguage } from "@/i18n";
import en from "@/locales/en.json";
import sw from "@/locales/sw.json";
import { EMPTY_FINANCIAL_SUMMARY, EMPTY_PENDING_COUNTS, visiblePendingActions } from "@/lib/church-dashboard-intelligence";

type LocaleTree = Record<string, unknown>;

function flattenKeys(tree: LocaleTree, prefix = ""): string[] {
  return Object.entries(tree).flatMap(([key, value]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    return value && typeof value === "object" && !Array.isArray(value)
      ? flattenKeys(value as LocaleTree, path)
      : [path];
  });
}

function intelligence(financialEnabled = true): ChurchDashboardIntelligenceState {
  return {
    staffWorkspace: "admin",
    pendingEnabled: true,
    financialEnabled,
    pending: {
      data: { ...EMPTY_PENDING_COUNTS, events: 2, massIntentions: 1, total: 3 },
      isLoading: false,
      isError: false,
    },
    financial: {
      data: { ...EMPTY_FINANCIAL_SUMMARY, thisMonthReceived: 125000, totalReceived: 250000, transactionCount: 2 },
      isLoading: false,
      isError: false,
    },
  } as ChurchDashboardIntelligenceState;
}

function renderDesktop(language: "en" | "sw") {
  void i18n.changeLanguage(language);
  return renderToStaticMarkup(
    <ChurchDashboardExperience
      userRole="church_admin"
      intelligence={intelligence()}
      administratorName="Amina Admin"
      greeting={language === "sw" ? "Habari za asubuhi" : "Good morning"}
      churchName="St Joseph Parish"
      bannerUrl={null}
      bannerPositionY={38}
      activeMembers={82}
      totalMembers={100}
      announcementCount={2}
      upcomingEventCount={1}
      attendance={{ title: "Sunday Youth Mass", yes: 20, maybe: 4, responseRate: 60 }}
      recentActivity={[
        {
          id: "activity-1",
          title: "Community Clean-up",
          detail: language === "sw" ? "Tukio lijalo limepangwa" : "Upcoming event scheduled",
          date: "2026-09-01",
        },
      ]}
      criticalLoading={false}
      deferredLoading={false}
    />,
  );
}

describe("Wave 26C-2A church admin dashboard localization", () => {
  it("keeps dashboard locale keys in parity", () => {
    expect(flattenKeys(sw.church_admin_dashboard).sort()).toEqual(flattenKeys(en.church_admin_dashboard).sort());
    expect(en.statuses.trial).toBe("Trial");
    expect(sw.statuses.trial).toBe("Majaribio");
  });

  it("renders the desktop dashboard in English and Kiswahili without translating user content", async () => {
    await changeAppLanguage("en");
    const enMarkup = renderDesktop("en");
    expect(enMarkup).toContain("Good morning, Amina.");
    expect(enMarkup).toContain("What to do today");
    expect(enMarkup).toContain("Event approvals");
    expect(enMarkup).toContain("Church summary");
    expect(enMarkup).toContain("Verified contributions this month");
    expect(enMarkup).toContain("St Joseph Parish");
    expect(enMarkup).toContain("Sunday Youth Mass");
    expect(enMarkup).toContain("Community Clean-up");

    await changeAppLanguage("sw");
    const swMarkup = renderDesktop("sw");
    expect(swMarkup).toContain("Habari za asubuhi, Amina.");
    expect(swMarkup).toContain("Cha kufanya leo");
    expect(swMarkup).toContain("Uhakiki wa matukio");
    expect(swMarkup).toContain("Muhtasari wa kanisa");
    expect(swMarkup).toContain("Michango iliyothibitishwa mwezi huu");
    expect(swMarkup).toContain("St Joseph Parish");
    expect(swMarkup).toContain("Sunday Youth Mass");
    expect(swMarkup).toContain("Community Clean-up");
  });

  it("uses translated pending-action labels without changing routes or stored keys", async () => {
    const actions = visiblePendingActions(intelligence().pending.data ?? EMPTY_PENDING_COUNTS, "admin");
    expect(actions.map((action) => action.route)).toEqual([
      "/church-admin/event-requests",
      "/church-admin/mass-intentions",
    ]);
    expect(actions.map((action) => action.labelKey)).toEqual([
      "church_admin_dashboard.pending_actions.events",
      "church_admin_dashboard.pending_actions.mass_intentions",
    ]);

    await changeAppLanguage("sw");
    const markup = renderToStaticMarkup(<ChurchDashboardIntelligenceView intelligence={intelligence()} />);
    expect(markup).toContain("Uhakiki wa matukio");
    expect(markup).toContain("Nia za Misa");
    expect(markup).toContain('href="/church-admin/event-requests"');
  });
});

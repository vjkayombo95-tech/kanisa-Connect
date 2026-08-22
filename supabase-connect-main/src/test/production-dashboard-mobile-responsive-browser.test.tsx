import fs from "node:fs";
import path from "node:path";
import type { AnchorHTMLAttributes } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import postcss from "postcss";
import tailwindcss from "tailwindcss";
import { chromium, type Browser } from "playwright";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("react-router-dom", () => ({
  Link: ({ to, ...props }: { to: string } & AnchorHTMLAttributes<HTMLAnchorElement>) => <a href={to} {...props} />,
}));

vi.mock("@/components/staff-mobile/StaffMobileExperience", () => ({
  useVisibleStaffServices: (config: { services: unknown[] }) => ({ services: config.services, isLoading: false }),
}));

import { ChurchDashboardMobileExperience } from "@/components/church-admin/ChurchDashboardMobileExperience";
import type { ChurchDashboardIntelligenceState } from "@/components/church-admin/ChurchDashboardIntelligence";
import { EMPTY_FINANCIAL_SUMMARY, EMPTY_PENDING_COUNTS } from "@/lib/church-dashboard-intelligence";
import { STAFF_MOBILE_CONFIGS } from "@/lib/staff-mobile-registry";

const viewports = [
  { width: 390, height: 844 },
  { width: 430, height: 932 },
  { width: 768, height: 1024 },
  { width: 820, height: 1180 },
  { width: 1023, height: 768 },
  { width: 1024, height: 768 },
  { width: 1280, height: 800 },
  { width: 1440, height: 900 },
] as const;

const intelligence = {
  staffWorkspace: "admin",
  pendingEnabled: true,
  financialEnabled: true,
  pending: { data: { ...EMPTY_PENDING_COUNTS, massIntentions: 2, prayerRequests: 1, announcements: 1, total: 4 }, isLoading: false, isError: false },
  financial: { data: { ...EMPTY_FINANCIAL_SUMMARY, thisMonthReceived: 150000, totalReceived: 500000, transactionCount: 4 }, isLoading: false, isError: false },
} as ChurchDashboardIntelligenceState;

function acceptanceMarkup() {
  const mobile = renderToStaticMarkup(<ChurchDashboardMobileExperience config={STAFF_MOBILE_CONFIGS.admin} intelligence={intelligence} administratorName="Amina Admin" greeting="Good morning" churchName="St Joseph" activeMembers={82} totalMembers={100} announcementCount={2} upcomingEventCount={1} attendance={{ title: "Sunday Mass", yes: 20, maybe: 4, responseRate: 60 }} criticalLoading={false} criticalError={false} deferredLoading={false} deferredError={false} />);
  return `<div class="flex min-h-screen w-full"><aside data-testid="desktop-sidebar" class="hidden w-60 shrink-0 border-r lg:block">Desktop sidebar</aside><main class="min-w-0 flex-1 overflow-hidden px-4 pb-24 pt-5 lg:px-7 lg:pb-8"><div data-testid="mobile-dashboard">${mobile}</div><section data-testid="desktop-dashboard" class="hidden min-h-96 space-y-8 lg:block"><div class="rounded-xl border p-6">Release D desktop dashboard</div></section></main><nav data-testid="bottom-nav" class="fixed inset-x-0 bottom-0 z-50 border-t bg-white pb-[env(safe-area-inset-bottom)] lg:hidden"><div class="mx-auto grid max-w-lg grid-cols-3 px-3 py-1.5"><a class="flex min-h-14 items-center justify-center">Home</a><a class="flex min-h-14 items-center justify-center">Work</a><a class="flex min-h-14 items-center justify-center">More</a></div></nav></div>`;
}

describe("Release D.1 real responsive browser acceptance", () => {
  let browser: Browser;
  let css: string;

  beforeAll(async () => {
    const config = (await import("../../tailwind.config")).default;
    css = (await postcss([tailwindcss(config)]).process("@tailwind base; @tailwind components; @tailwind utilities;", { from: path.join(process.cwd(), "src/test/release-d1-browser.css") })).css;
    browser = await chromium.launch({ headless: true });
  }, 60_000);

  afterAll(async () => {
    await browser?.close();
  });

  for (const viewport of viewports) {
    it(`${viewport.width}x${viewport.height} stays inside the actual CSS viewport with one dashboard`, async () => {
      const page = await browser.newPage({ viewport });
      await page.setContent(`<style>${css}html,body{margin:0;max-width:100%;}*,*::before,*::after{box-sizing:border-box;}</style>${acceptanceMarkup()}`);
      const evidence = await page.evaluate(() => {
        const visible = (element: Element | null) => {
          if (!element) return false;
          const rect = element.getBoundingClientRect();
          const style = getComputedStyle(element);
          return style.display !== "none" && style.visibility !== "hidden" && rect.width > 0 && rect.height > 0;
        };
        const viewportWidth = document.documentElement.clientWidth;
        const viewportHeight = document.documentElement.clientHeight;
        const mobile = document.querySelector('[data-testid="church-dashboard-mobile-parity-core"]');
        const desktop = document.querySelector('[data-testid="desktop-dashboard"]');
        const sidebar = document.querySelector('[data-testid="desktop-sidebar"]');
        const bottomNav = document.querySelector('[data-testid="bottom-nav"]');
        const bounded = [...document.querySelectorAll('[data-testid="church-dashboard-mobile-parity-core"] section, [data-testid="church-dashboard-mobile-parity-core"] a, [data-testid="bottom-nav"]')]
          .filter(visible)
          .every((element) => { const rect = element.getBoundingClientRect(); return rect.left >= -0.5 && rect.right <= viewportWidth + 0.5 && rect.width > 0; });
        const navRect = bottomNav?.getBoundingClientRect();
        return {
          viewportWidth,
          viewportHeight,
          nominalWidth: window.innerWidth,
          zoomRatio: window.outerWidth > 0 ? window.outerWidth / window.innerWidth : 1,
          scrollWidth: document.documentElement.scrollWidth,
          mobileVisible: visible(mobile),
          desktopVisible: visible(desktop),
          sidebarVisible: visible(sidebar),
          bottomNavVisible: visible(bottomNav),
          bottomNavBounded: !navRect || (navRect.left >= -0.5 && navRect.right <= viewportWidth + 0.5 && navRect.bottom <= viewportHeight + 0.5),
          bounded,
        };
      });
      const desktopExpected = evidence.viewportWidth >= 1024;
      expect(evidence.scrollWidth).toBe(evidence.viewportWidth);
      expect(evidence.bounded).toBe(true);
      expect(evidence.mobileVisible).toBe(!desktopExpected);
      expect(evidence.desktopVisible).toBe(desktopExpected);
      expect(evidence.sidebarVisible).toBe(desktopExpected);
      expect(evidence.bottomNavVisible).toBe(!desktopExpected);
      expect(evidence.bottomNavBounded).toBe(true);
      expect(evidence.viewportWidth).toBe(evidence.nominalWidth);
      await page.close();
    }, 30_000);
  }

  it("keeps one dashboard request owner across both responsive presentations", () => {
    const dashboard = fs.readFileSync(path.join(process.cwd(), "src/pages/church-admin/ChurchDashboard.tsx"), "utf8");
    const mobile = fs.readFileSync(path.join(process.cwd(), "src/components/church-admin/ChurchDashboardMobileExperience.tsx"), "utf8");
    const desktop = fs.readFileSync(path.join(process.cwd(), "src/components/church-admin/ChurchDashboardExperience.tsx"), "utf8");
    expect(dashboard.match(/useChurchDashboardIntelligence\(\)/g)).toHaveLength(1);
    expect(mobile).not.toContain("useChurchDashboardIntelligence()");
    expect(desktop).not.toContain("useChurchDashboardIntelligence()");
    expect(mobile).not.toContain("useQuery(");
    expect(desktop).not.toContain("useQuery(");
  });
});

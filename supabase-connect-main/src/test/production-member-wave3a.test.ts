import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { vi } from "vitest";
import { act, createElement, type ComponentPropsWithoutRef } from "react";
import { createRoot } from "react-dom/client";
import { dailyLifeKeys, normalizeNextMassSummary } from "@/lib/member-daily-life";
import { getMemberServiceForPath, isOrdinaryMemberPathAllowed, memberServiceRegistry } from "@/lib/member-service-registry";
import { getDarEsSalaamDateKey, publishedDailyReadingKey } from "@/lib/daily-readings";
import { MobileMemberHome } from "@/components/portal/MobileMemberHome";

vi.mock("@/components/AppLink", () => ({ AppLink: ({ to, children, ...props }: { to: string } & ComponentPropsWithoutRef<"a">) => createElement("a", { href: to, ...props }, children) }));
vi.mock("@/components/portal/ProductionLiveMassCard", () => ({ ProductionLiveMassCard: () => null }));

const read = (path: string) => readFileSync(join(process.cwd(), "src", path), "utf8");

describe("Wave 3A member reliability contracts", () => {
  it("uses tenant-scoped canonical query keys", () => {
    expect(dailyLifeKeys.nextMass("church-a")).toEqual(["member-daily-life", "next-mass", "church-a"]);
    expect(dailyLifeKeys.nextMass("church-b")).not.toEqual(dailyLifeKeys.nextMass("church-a"));
    expect(publishedDailyReadingKey("2026-08-23")).toEqual(["member-daily-readings", "published", "2026-08-23"]);
  });

  it("resolves the Today date in the parish timezone at UTC boundaries", () => {
    expect(getDarEsSalaamDateKey(new Date("2026-08-22T22:30:00Z"))).toBe("2026-08-23");
    expect(getDarEsSalaamDateKey(new Date("2026-08-23T21:30:00Z"))).toBe("2026-08-24");
  });

  it("normalizes the RPC response into one stable shape", () => {
    expect(normalizeNextMassSummary({ mass: { id: "mass-1", title: "Misa", mass_date: "2026-08-24", start_time: "09:00", ask_for_rsvp: true, my_response: "yes" }, yes_count: 3, response_rate: 75 })).toEqual({
      mass: { id: "mass-1", title: "Misa", description: null, massDate: "2026-08-24", startTime: "09:00", endTime: null, responseDeadline: null, askForRsvp: true, memberId: null, memberResponse: "yes" },
      responseCounts: { yes: 3, maybe: 0, no: 0 },
      responseRate: 75,
    });
  });

  it("keeps the registry unique and every visible service routable", () => {
    expect(new Set(memberServiceRegistry.map((item) => item.id)).size).toBe(memberServiceRegistry.length);
    const visible = memberServiceRegistry.filter((item) => item.showInServices);
    expect(visible.length).toBeGreaterThan(0);
    visible.forEach((item) => expect(isOrdinaryMemberPathAllowed(item.path), item.path).toBe(true));
  });

  it("implements the approved route decisions without exposing deferred routes", () => {
    for (const route of ["/portal/prayer-requests", "/portal/sermons", "/portal/events", "/portal/contribution-history", "/portal/pledges"]) {
      expect(isOrdinaryMemberPathAllowed(route), route).toBe(true);
    }
    for (const route of ["/portal/channels", "/portal/community-help", "/portal/event-requests"]) {
      expect(isOrdinaryMemberPathAllowed(route), route).toBe(false);
      expect(memberServiceRegistry.some((item) => item.path === route && item.showInServices)).toBe(false);
    }
  });

  it("keeps detail routes scoped to their registered member destination", () => {
    expect(getMemberServiceForPath("/portal/live/stream-1")?.id).toBe("livestream");
    expect(getMemberServiceForPath("/portal/ministries/ministry-1")?.id).toBe("ministries");
    expect(getMemberServiceForPath("/portal/contribution-receipt/receipt-1")?.id).toBe("contribution-history");
    expect(isOrdinaryMemberPathAllowed("/portal/not-a-member-route")).toBe(false);
  });

  it("adds one secondary mobile Mass card and preserves four primary actions", () => {
    const home = read("components/portal/MobileMemberHome.tsx");
    expect((home.match(/id: "(?:give|mass|announcements|history)"/g) ?? [])).toHaveLength(4);
    expect(home).toContain('data-testid="mobile-next-mass"');
    expect(home).toContain("Hakuna Misa ijayo iliyopangwa");
    expect(home).toContain("Taarifa ya Misa haikupatikana");
  });

  it.each([[390, 844], [430, 932]])("renders a bounded mobile Mass card at %sx%s", (width, height) => {
    Object.defineProperty(window, "innerWidth", { configurable: true, value: width });
    Object.defineProperty(window, "innerHeight", { configurable: true, value: height });
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    act(() => root.render(createElement(MobileMemberHome, {
      announcementsVisible: true, churchName: "Parokia", giveVisible: true,
      latestAnnouncement: null, massVisible: true, memberName: "Mshirika",
      nextMass: { id: "mass-1", title: "Misa yenye jina refu sana kwa majaribio ya simu", description: null, massDate: "2026-08-24", startTime: "09:00", endTime: null, responseDeadline: null, askForRsvp: false, memberId: null, memberResponse: null },
      nextMassError: false, nextMassLoading: false,
    })));
    expect(container.querySelector('[data-testid="mobile-next-mass"]')).not.toBeNull();
    const links = [...container.querySelectorAll("a")];
    expect(links.filter((link) => ["Michango", "Nia za Misa", "Matangazo", "Historia Yangu"].some((label) => link.textContent?.includes(label)))).toHaveLength(4);
    expect(links.filter((link) => link.textContent === "Kalenda")).toHaveLength(1);
    act(() => root.unmount());
    container.remove();
  });

  it("shares Mass and published-reading helpers without placeholder authority", () => {
    const dashboard = read("components/portal/MemberDashboard.tsx");
    const today = read("pages/portal/MemberTodayPage.tsx");
    const parish = read("pages/portal/MemberMyParishPage.tsx");
    const readings = read("pages/portal/DailyReadingsPage.tsx");
    for (const source of [dashboard, today, parish]) expect(source).toContain("fetchNextMassSummary");
    expect(today).toContain("fetchPublishedDailyReading");
    expect(readings).toContain("fetchPublishedDailyReading");
    expect(dashboard).not.toContain("getTodayReadingEntry");
    expect(today).not.toContain("getTodayReadingEntry");
  });

  it("does not execute proven desktop-only Home requests on mobile", () => {
    const dashboard = read("components/portal/MemberDashboard.tsx");
    expect(dashboard).toContain('["simple-member-home", user?.id, user?.email, churchId]');
    expect(dashboard).toContain('["member-home-financials", churchId, memberId]');
    expect(dashboard).toContain("enabled: enabled && !!churchId && !!memberId");
    expect(dashboard).toContain("useMemberFinancialData(churchId, data?.memberId ?? null, isDesktop)");
    expect(dashboard).toContain("useIsDesktop");
  });

  it("keeps desktop Home focused on parish identity, finance, Mass, one announcement, and up to three actions", () => {
    const dashboard = read("components/portal/MemberDashboard.tsx");
    expect(dashboard).toContain("Karibu");
    expect(dashboard).toContain("Muhtasari wa michango");
    expect(dashboard).toContain("FinancialSummarySurface");
    expect(dashboard).toContain("xl:divide-x xl:divide-border/60");
    expect(dashboard).toContain("Misa ijayo");
    expect(dashboard).toContain("Hakuna misa iliyopangwa kwa sasa.");
    expect(dashboard).toContain("Ratiba mpya itaonekana hapa itakapochapishwa.");
    expect(dashboard).toContain("Tangazo la Karibuni");
    expect(dashboard).toContain("Hatua za haraka");
    expect(dashboard).toContain("<ProductionLiveMassCard />");
    expect((dashboard.match(/label: "(?:Lipa Sasa|Nia ya Misa|Matangazo)"/g) ?? [])).toHaveLength(3);
    expect((dashboard.match(/quickActions\.push/g) ?? [])).toHaveLength(3);
    expect(dashboard).toContain("submitMassResponse.mutate(response)");
    expect(dashboard).toContain('queryFn: () => fetchNextMassSummary(churchId!)');
    expect(dashboard).toContain("fetchPortalAnnouncements(member.church_id, 1)");
    expect(dashboard).not.toContain('label="Historia Yangu"');
    expect(dashboard).not.toContain('label="Masomo ya Leo"');
    expect(dashboard).not.toContain('label="Watakatifu"');
    expect(dashboard).not.toContain('to="/member/library"');
    expect(dashboard).not.toContain("get_saint_of_the_day");
    expect(dashboard).not.toContain("Saint of the Day");
    expect(dashboard).not.toContain("Watakatifu");
    expect(dashboard).not.toContain("Wasifu na malipo yako");
    expect(dashboard).not.toContain("MemberDesktopSidebar");
    expect(dashboard).not.toContain("member-desktop-sidebar");
  });

  it("preserves desktop Home feature gates for the remaining quick actions", () => {
    const dashboard = read("components/portal/MemberDashboard.tsx");
    expect(dashboard).toContain('const giveVisible = getFeatureState("give").visible;');
    expect(dashboard).toContain('const massVisible = getFeatureState("mass_intentions").visible;');
    expect(dashboard).toContain('const announcementsVisible = getFeatureState("announcements").visible;');
    expect(dashboard).toContain("if (giveVisible) quickActions.push({ icon: HandCoins");
    expect(dashboard).toContain("if (massVisible) quickActions.push({ icon: HeartHandshake");
    expect(dashboard).toContain("if (announcementsVisible) quickActions.push({ icon: Megaphone");
  });
});

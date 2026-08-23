import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { isEventToday } from "@/lib/member-daily-life";

const read = (path: string) => readFileSync(join(process.cwd(), "src", path), "utf8");

describe("Wave 2 member Today", () => {
  const page = read("pages/portal/MemberTodayPage.tsx");
  const helper = read("lib/member-daily-life.ts");

  it("uses production daily content and independent parish summaries", () => {
    expect(page).toContain("getTodayReadingEntry");
    expect(page).toContain("daily-readings-today-saints");
    expect(page).toContain("dailyLifeKeys.nextMass");
    expect(page).toContain("dailyLifeKeys.events");
    expect(page).toContain("dailyLifeKeys.announcements");
    expect(page).toContain("ProductionLiveMassCard");
    expect(page).toContain("mass.isError || events.isError || announcement.isError || saints.isError");
  });

  it("scopes every parish read and reuses established cache identities", () => {
    expect(helper).toContain('.eq("church_id", churchId)');
    expect(helper).toContain('events: (churchId?: string | null) => ["portal-events", churchId]');
    expect(helper).toContain('nextMass: (churchId?: string | null) => ["next-mass-summary", churchId]');
    expect(helper).toContain("fetchPortalAnnouncements(churchId, 1)");
  });

  it("identifies only events occurring today", () => {
    const now = new Date("2026-08-23T10:00:00+03:00");
    expect(isEventToday({ id: "1", churchId: "a", title: "Mass", description: null, startDate: "2026-08-23T17:00:00+03:00", location: null }, now)).toBe(true);
    expect(isEventToday({ id: "2", churchId: "a", title: "Later", description: null, startDate: "2026-08-24T08:00:00+03:00", location: null }, now)).toBe(false);
  });
});

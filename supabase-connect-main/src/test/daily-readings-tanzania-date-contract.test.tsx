import { readFileSync } from "node:fs";
import { join } from "node:path";
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  DAILY_READINGS_MEMBER_CONTENT_CONTRACT,
  getDarEsSalaamDateKey,
  getTanzaniaMemberDate,
  publishedDailyReadingKey,
  useTanzaniaMemberDate,
} from "@/lib/daily-readings";

const read = (path: string) => readFileSync(join(process.cwd(), "src", path), "utf8");

afterEach(() => {
  vi.useRealTimers();
});

describe("canonical Tanzania member date", () => {
  it.each([
    ["UTC before Tanzania midnight", "2026-08-31T20:59:59.000Z", "2026-08-31", 8, 31],
    ["Tanzania crossed midnight while UTC has not", "2026-08-31T21:00:00.000Z", "2026-09-01", 9, 1],
    ["browser timezone behind Tanzania", "2026-08-31T23:30:00-07:00", "2026-09-01", 9, 1],
    ["browser timezone ahead of Tanzania", "2026-09-01T00:30:00+09:00", "2026-08-31", 8, 31],
  ])("derives the same date identity regardless of browser-local date: %s", (_label, isoDate, dateKey, month, day) => {
    const memberDate = getTanzaniaMemberDate(new Date(isoDate));

    expect(memberDate).toMatchObject({ dateKey, month, day });
    expect(getDarEsSalaamDateKey(new Date(isoDate))).toBe(dateKey);
  });

  it("calculates the next Tanzania midnight as a real UTC instant", () => {
    expect(getTanzaniaMemberDate(new Date("2026-08-31T20:59:59.000Z")).nextMidnightAt.toISOString()).toBe("2026-08-31T21:00:00.000Z");
    expect(getTanzaniaMemberDate(new Date("2026-08-31T21:00:00.000Z")).nextMidnightAt.toISOString()).toBe("2026-09-01T21:00:00.000Z");
  });

  it("uses Tanzania month and day for saint lookup identity", () => {
    const memberDate = getTanzaniaMemberDate(new Date("2026-08-31T21:30:00.000Z"));

    expect(memberDate.dateKey).toBe("2026-09-01");
    expect(["daily-readings-today-saints", memberDate.dateKey, memberDate.month, memberDate.day]).toEqual([
      "daily-readings-today-saints",
      "2026-09-01",
      9,
      1,
    ]);
  });

  it("rolls the effective member date and query identity after Tanzania midnight", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-31T20:59:58.000Z"));
    const seenDates: string[] = [];
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    function Probe() {
      const memberDate = useTanzaniaMemberDate();
      seenDates.push(memberDate.dateKey);
      return createElement("div", { "data-date-key": memberDate.dateKey });
    }

    await act(async () => {
      root.render(createElement(Probe));
    });

    expect(seenDates.at(-1)).toBe("2026-08-31");
    expect(publishedDailyReadingKey(seenDates.at(-1)!)).toEqual(["member-daily-readings", "published", "2026-08-31"]);

    await act(async () => {
      vi.setSystemTime(new Date("2026-08-31T21:00:01.000Z"));
      await vi.advanceTimersByTimeAsync(3_000);
    });

    expect(seenDates.at(-1)).toBe("2026-09-01");
    expect(publishedDailyReadingKey(seenDates.at(-1)!)).toEqual(["member-daily-readings", "published", "2026-09-01"]);

    await act(async () => {
      root.unmount();
    });
    container.remove();
  });

  it("keeps saint selection off browser-local month and day in Daily Readings member paths", () => {
    const todayPage = read("pages/portal/MemberTodayPage.tsx");
    const dailyReadingsPage = read("pages/portal/DailyReadingsPage.tsx");

    for (const source of [todayPage, dailyReadingsPage]) {
      expect(source).toContain("useTanzaniaMemberDate");
      expect(source).not.toMatch(/getMonth\(\)\s*\+\s*1|getDate\(\)/);
      expect(source).toContain('eq("feast_month", today.month)');
      expect(source).toContain('eq("feast_day", today.day)');
    }
  });

  it("documents the future member content contract without implementing the future database RPC", () => {
    expect(DAILY_READINGS_MEMBER_CONTENT_CONTRACT).toMatchObject({
      date: "tanzania-date",
      source: "canonical-cms-read-boundary",
      language: "sw-first-deterministic-fallback",
      liturgicalIdentity: "resolved-by-liturgical-days",
      publication: "member-publishable-only",
      readings: "reference-only-is-explicit-no-placeholder-scripture",
      provenance: "source-and-translation-metadata-required",
      legacy: "temporary-explicit-compatibility-only",
      saint: "same-tanzania-date-identity",
      missingContent: "explicit-empty-state-no-invented-scripture-no-wrong-day-fallback",
    });
    expect(read("lib/daily-readings.ts")).not.toContain("get_member_daily_reading");
  });
});

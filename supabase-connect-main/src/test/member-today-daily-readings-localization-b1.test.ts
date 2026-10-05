import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import en from "@/locales/en.json";
import sw from "@/locales/sw.json";
import { formatAppDate, translateMemberServiceDescription, translateMemberServiceLabel } from "@/lib/localization";
import { memberServiceRegistry } from "@/lib/member-service-registry";

const root = process.cwd();
const read = (relative: string) => fs.readFileSync(path.join(root, relative), "utf8");

function translator(locale: Record<string, unknown>) {
  return (key: string, options?: Record<string, unknown>) => {
    const value = key.split(".").reduce<unknown>((current, part) => (
      current && typeof current === "object" ? (current as Record<string, unknown>)[part] : undefined
    ), locale);
    return typeof value === "string" ? value : String(options?.defaultValue ?? key);
  };
}

describe("member Today and Daily Readings B1 localization", () => {
  it("keeps Today presentation localized while preserving Tanzania reading identity", () => {
    const todayPage = read("src/pages/portal/MemberTodayPage.tsx");

    expect(todayPage).toContain("useTranslation");
    expect(todayPage).toContain('t("member_services.today.label")');
    expect(todayPage).toContain('t("member_today.readings.title")');
    expect(todayPage).toContain('t("member_today.readings.read_all")');
    expect(todayPage).toContain('t("member_today.quick_actions.aria")');
    expect(todayPage).toContain("translateMemberServiceLabel(t, service)");
    expect(todayPage).toContain("translateMemberServiceDescription(t, service)");
    expect(todayPage).toContain("formatAppDate(reading.data?.date ?? today.dateKey, i18n.language");
    expect(todayPage).toContain("publishedDailyReadingKey(today.dateKey)");
    expect(todayPage).toContain("fetchPublishedDailyReading(today.dateKey)");
    expect(todayPage).toContain('["daily-readings-today-saints", today.dateKey, today.month, today.day]');
    expect(todayPage).not.toContain('new Intl.DateTimeFormat("sw-TZ"');
    expect(todayPage).not.toContain('toLocaleString("sw-TZ"');
  });

  it("keeps Daily Readings presentation copy behind locale keys", () => {
    const page = read("src/pages/portal/DailyReadingsPage.tsx");
    const presentation = read("src/components/portal/daily-readings/DailyReadingPresentation.tsx");
    const card = read("src/components/portal/daily-readings/ReadingCard.tsx");

    expect(page).toContain('t("member_daily_readings.hero.title")');
    expect(page).toContain('t("member_daily_readings.search.placeholder")');
    expect(page).toContain('formatAppDate(entry.date, i18n.language, { dateStyle: "full" })');
    expect(presentation).toContain('t("member_daily_readings.states.empty_title")');
    expect(presentation).toContain('t("member_daily_readings.sections.source")');
    expect(presentation).toContain('formatAppDate(reading.date, i18n.language, { dateStyle: "full" })');
    expect(card).toContain('t("member_daily_readings.actions.read_in_bible")');
    expect(card).toContain("READING_TITLE_KEYS");

    for (const source of [page, presentation, card]) {
      expect(source).not.toContain("Soma kwenye Biblia");
      expect(source).not.toContain("Tafuta Masomo");
      expect(source).not.toContain("Inapakia masomo ya leo");
      expect(source).not.toContain("Somo la Kwanza");
    }
  });

  it("provides EN/SW locale values and reuses canonical service labels for Today quick actions", () => {
    expect(en.member_today.readings.title).toBe("Today's readings");
    expect(sw.member_today.readings.title).toBe("Masomo ya leo");
    expect(en.member_daily_readings.reading_labels.first).toBe("First Reading");
    expect(sw.member_daily_readings.reading_labels.first).toBe("Somo la Kwanza");
    expect(en.member_daily_readings.actions.read_in_bible).toBe("Read in Bible");
    expect(sw.member_daily_readings.actions.read_in_bible).toBe("Soma kwenye Biblia");

    const tEn = translator(en);
    const tSw = translator(sw);
    const bible = memberServiceRegistry.find((service) => service.id === "bible")!;
    const prayers = memberServiceRegistry.find((service) => service.id === "prayers")!;
    const calendar = memberServiceRegistry.find((service) => service.id === "liturgical-calendar")!;

    expect(translateMemberServiceLabel(tEn, bible)).toBe("Bible");
    expect(translateMemberServiceDescription(tEn, bible)).toBe("Read the Bible");
    expect(translateMemberServiceLabel(tSw, prayers)).toBe("Sala");
    expect(translateMemberServiceDescription(tSw, prayers)).toBe("Soma sala zilizochapishwa");
    expect(translateMemberServiceLabel(tEn, calendar)).toBe("Liturgical Calendar");
    expect(translateMemberServiceDescription(tSw, calendar)).toBe("Sikukuu na majira ya Kanisa");
  });

  it("formats the same Tanzania-local instant by selected language without changing the calendar identity", () => {
    const instant = new Date("2026-10-04T21:30:00Z");
    const enDate = formatAppDate(instant, "en", { dateStyle: "medium", timeStyle: "short" });
    const swDate = formatAppDate(instant, "sw", { dateStyle: "medium", timeStyle: "short" });

    for (const rendered of [enDate, swDate]) {
      expect(rendered).toContain("2026");
      expect(rendered).toContain("00:30");
      expect(rendered).toMatch(/5/);
    }

    expect(enDate).toMatch(/Oct|October/);
    expect(swDate).toMatch(/Okt|Oct/);
    expect(formatAppDate("2026-10-05", "en", { dateStyle: "medium" })).toMatch(/2026/);
    expect(formatAppDate("2026-10-05", "sw", { dateStyle: "medium" })).toMatch(/2026/);
  });
});

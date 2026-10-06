import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import en from "@/locales/en.json";
import sw from "@/locales/sw.json";
import { formatAppDate } from "@/lib/localization";

const root = process.cwd();
const read = (relative: string) => fs.readFileSync(path.join(root, relative), "utf8");

function lookup(locale: Record<string, unknown>, key: string) {
  return key.split(".").reduce<unknown>((current, part) => (
    current && typeof current === "object" ? (current as Record<string, unknown>)[part] : undefined
  ), locale);
}

describe("member Prayers, Reflections, and Liturgical Calendar B2 localization", () => {
  it("keeps Prayers presentation behind i18n while preserving the published-content contract", () => {
    const listPage = read("src/pages/portal/PrayersPage.tsx");
    const detailPage = read("src/pages/portal/PrayerDetailPage.tsx");
    const combined = `${listPage}\n${detailPage}`;

    expect(combined).toContain("useTranslation");
    expect(listPage).toContain('t("member_prayers.title")');
    expect(listPage).toContain('t("member_prayers.featured")');
    expect(listPage).toContain('t("member_prayers.actions.read")');
    expect(detailPage).toContain('t("member_prayers.not_found.title")');
    expect(detailPage).toContain('t("member_prayers.actions.back_to_prayers")');
    expect(listPage).toContain('queryKey: ["published-prayers"]');
    expect(detailPage).toContain('queryKey: ["published-prayer", slug]');
    expect(combined).toContain("/portal/prayers");
    expect(combined).not.toContain("Hakuna sala iliyochapishwa kwa sasa.");
    expect(combined).not.toContain("Sala hazikuweza kupakiwa. Tafadhali jaribu tena.");
    expect(combined).not.toContain("Sala haijapatikana.");
  });

  it("keeps Reflections presentation and dates localized without changing published-reading identity", () => {
    const listPage = read("src/pages/portal/ReflectionsPage.tsx");
    const detailPage = read("src/pages/portal/ReflectionDetailPage.tsx");
    const combined = `${listPage}\n${detailPage}`;

    expect(combined).toContain("useTranslation");
    expect(combined).toContain("formatAppDate");
    expect(combined).toContain("formatReflectionDate");
    expect(listPage).toContain('t("member_reflections.title")');
    expect(listPage).toContain('t("member_reflections.card_title", { date })');
    expect(detailPage).toContain('t("member_reflections.sections.gospel")');
    expect(detailPage).toContain('t("member_reflections.not_found.title")');
    expect(listPage).toContain('queryKey: ["published-reflections"]');
    expect(detailPage).toContain('queryKey: ["published-reflection", reflectionId]');
    expect(combined).not.toContain('Intl.DateTimeFormat("sw-KE"');
    expect(combined).not.toContain("Tafakari haijapatikana.");
    expect(combined).not.toContain("Soma tafakari");
  });

  it("keeps Liturgical Calendar UI localized while preserving local today/month behavior and saint queries", () => {
    const page = read("src/pages/portal/LiturgicalCalendarPage.tsx");

    expect(page).toContain("useTranslation");
    expect(page).toContain('t("member_liturgical_calendar.hero.title")');
    expect(page).toContain('t("member_liturgical_calendar.search.placeholder")');
    expect(page).toContain("getMonthLabel(selectedMonth, i18n.language)");
    expect(page).toContain("getWeekdayLabels(i18n.language)");
    expect(page).toContain("formatFeastDayLabel(saint.feast_month, saint.feast_day, i18n.language)");
    expect(page).toContain("return new Date().getMonth() + 1;");
    expect(page).toContain("day: today.getDate()");
    expect(page).toContain('queryKey: ["member-liturgical-calendar-saints", selectedMonth]');
    expect(page).toContain('queryKey: ["member-liturgical-calendar-today", today.month, today.day]');
    expect(page).toContain('to={saintDetailPath(saint.slug)}');
    expect(page).not.toContain("const MONTHS");
    expect(page).not.toContain("const WEEKDAYS");
    expect(page).not.toContain("formatFeastDay,");
    expect(page).not.toContain("Tafuta jina, mwezi, mlezi, nchi, au lebo...");
    expect(page).not.toContain("Fuatilia maadhimisho ya Kanisa na watakatifu katika mwaka mzima.");
  });

  it("provides symmetric EN/SW locale copy for the B2 member surfaces", () => {
    const requiredKeys = [
      "member_prayers.title",
      "member_prayers.actions.read",
      "member_prayers.not_found.title",
      "member_reflections.title",
      "member_reflections.card_title",
      "member_reflections.sections.gospel",
      "member_liturgical_calendar.hero.title",
      "member_liturgical_calendar.today.empty_title",
      "member_liturgical_calendar.search.placeholder",
      "member_liturgical_calendar.calendar.open_saint",
    ];

    for (const key of requiredKeys) {
      expect(lookup(en, key)).toEqual(expect.any(String));
      expect(lookup(sw, key)).toEqual(expect.any(String));
      expect(lookup(en, key)).not.toBe(lookup(sw, key));
    }

    expect(en.member_prayers.title).toBe("Prayers");
    expect(sw.member_prayers.title).toBe("Sala");
    expect(en.member_reflections.title).toBe("Reflections");
    expect(sw.member_reflections.title).toBe("Tafakari");
    expect(en.member_liturgical_calendar.hero.title).toBe("Liturgical Calendar");
    expect(sw.member_liturgical_calendar.hero.title).toBe("Kalenda ya Liturujia");
  });

  it("formats B2 dates by selected language without changing date identity", () => {
    const reflectionDate = "2026-10-05";
    const enDate = formatAppDate(reflectionDate, "en", { dateStyle: "long" });
    const swDate = formatAppDate(reflectionDate, "sw", { dateStyle: "long" });

    for (const rendered of [enDate, swDate]) {
      expect(rendered).toContain("2026");
      expect(rendered).toMatch(/5/);
    }

    expect(enDate).toMatch(/Oct|October/);
    expect(swDate).toMatch(/Okt|Oct/);
    expect(enDate).not.toBe(swDate);
  });
});

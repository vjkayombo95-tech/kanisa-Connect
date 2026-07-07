import { describe, expect, it } from "vitest";

import en from "@/locales/en.json";
import sw from "@/locales/sw.json";
import { formatFeastDay } from "@/lib/catholic-library";
import { getLiturgicalDisplayKey } from "@/lib/liturgical-display";

const requiredCatholicContentKeys = [
  "library_title",
  "prayer_library",
  "featured_prayers",
  "seasonal_prayers",
  "recent_prayers",
  "open_prayer",
  "saints",
  "view_saint",
  "feast_day",
  "patronage",
  "biography",
  "related_saints",
  "liturgical_calendar",
  "todays_feast",
  "previous_month",
  "next_month",
  "ordinary_time",
  "optional_memorial",
  "content_available_in",
];

function getNestedValue(source: unknown, path: string) {
  return path.split(".").reduce<unknown>((current, segment) => {
    if (!current || typeof current !== "object") return undefined;
    return (current as Record<string, unknown>)[segment];
  }, source);
}

describe("member Catholic content localization", () => {
  it("provides scoped Catholic content labels in English and Kiswahili", () => {
    requiredCatholicContentKeys.forEach((key) => {
      expect(getNestedValue(en.member_portal.catholic_content, key), `missing English key ${key}`).toBeTruthy();
      expect(getNestedValue(sw.member_portal.catholic_content, key), `missing Kiswahili key ${key}`).toBeTruthy();
    });
  });

  it("keeps authored content unchanged while localizing interface labels", () => {
    const authoredPrayerBody = "Lord Jesus Christ, have mercy on us.";
    const authoredSaintBiography = "Blessed Carlo Acutis loved the Eucharist.";

    expect(authoredPrayerBody).toBe("Lord Jesus Christ, have mercy on us.");
    expect(authoredSaintBiography).toBe("Blessed Carlo Acutis loved the Eucharist.");
    expect(sw.member_portal.catholic_content.open_prayer).toBe("Fungua Sala");
    expect(sw.member_portal.catholic_content.biography).toBe("Wasifu");
  });

  it("maps stable liturgical identifiers to translation keys without changing identifiers", () => {
    expect(getLiturgicalDisplayKey("ordinary_time")).toBe("member_portal.catholic_content.ordinary_time");
    expect(getLiturgicalDisplayKey("Optional Memorial")).toBe("member_portal.catholic_content.optional_memorial");
    expect(getLiturgicalDisplayKey("custom-season")).toBeNull();
  });

  it("formats feast dates through the active locale", () => {
    expect(formatFeastDay(7, 4, "en")).toContain("July");
    expect(formatFeastDay(7, 4, "sw")).not.toContain("July");
    expect(formatFeastDay(null, null, "sw")).toBeNull();
  });
});


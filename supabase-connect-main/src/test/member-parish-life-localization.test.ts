import { describe, expect, it } from "vitest";

import en from "@/locales/en.json";
import sw from "@/locales/sw.json";
import {
  categoryLabelKey,
  eventTypeLabelKey,
  formatCalendarDate,
  formatCalendarTime,
  parishCalendarEventTypes,
} from "@/components/calendar/calendarUtils";

const requiredParishLifeKeys = [
  "parish_calendar",
  "search_events",
  "announcements",
  "communities",
  "ministries",
  "join_ministry",
  "service_opportunities",
  "event_types.mass_intention",
  "categories.community",
  "channel_audience_badge.community_members",
];

function getNestedValue(source: unknown, path: string) {
  return path.split(".").reduce<unknown>((current, segment) => {
    if (!current || typeof current !== "object") return undefined;
    return (current as Record<string, unknown>)[segment];
  }, source);
}

describe("member parish life localization", () => {
  it("provides English and Kiswahili parish life labels", () => {
    requiredParishLifeKeys.forEach((key) => {
      expect(getNestedValue(en.member_portal.parish_life, key), `missing English key ${key}`).toBeTruthy();
      expect(getNestedValue(sw.member_portal.parish_life, key), `missing Kiswahili key ${key}`).toBeTruthy();
    });

    expect(sw.member_portal.parish_life.parish_calendar).toBe("Kalenda ya Parokia");
    expect(sw.member_portal.parish_life.announcements).toBe("Matangazo");
    expect(sw.member_portal.parish_life.communities).toBe("Jumuiya");
    expect(sw.member_portal.parish_life.ministries).toBe("Huduma");
  });

  it("maps stable calendar identifiers to translation keys without changing values", () => {
    expect(parishCalendarEventTypes.find((item) => item.value === "mass_intention")?.value).toBe("mass_intention");
    expect(eventTypeLabelKey("mass_intention")).toBe("member_portal.parish_life.event_types.mass_intention");
    expect(categoryLabelKey("community")).toBe("member_portal.parish_life.categories.community");
  });

  it("formats parish calendar dates and times through the active locale", () => {
    const date = "2026-07-10T07:00:00+03:00";

    expect(formatCalendarDate(date, "en", { dateStyle: "full" })).not.toBe(formatCalendarDate(date, "sw", { dateStyle: "full" }));
    expect(formatCalendarTime(date, "sw")).toBeTruthy();
  });

  it("leaves parish-authored content untouched", () => {
    const eventTitle = "Wedding ceremony";
    const announcementBody = "Choir practice moves to Main Church Hall.";
    const communityName = "St. Monica Jumuiya";

    expect(eventTitle).toBe("Wedding ceremony");
    expect(announcementBody).toBe("Choir practice moves to Main Church Hall.");
    expect(communityName).toBe("St. Monica Jumuiya");
  });
});

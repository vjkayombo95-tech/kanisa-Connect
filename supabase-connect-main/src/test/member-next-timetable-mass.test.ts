import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  dailyLifeKeys,
  getTanzaniaDateKey,
  getTanzaniaTimeKey,
  selectNextTimetableMass,
  type MemberParishScheduleOccurrence,
} from "@/lib/member-daily-life";

const read = (path: string) => readFileSync(join(process.cwd(), "src", path), "utf8");

const row = (overrides: Partial<MemberParishScheduleOccurrence>): MemberParishScheduleOccurrence => ({
  id: "row",
  occurrence_date: "2026-09-27",
  start_time: "09:00:00",
  name: "Timetable Mass",
  location_name: "Main Church",
  status: "scheduled",
  activity_type: "mass",
  ...overrides,
});

describe("member next timetable Mass", () => {
  it("uses a tenant-keyed member-safe timetable query for the mobile next Mass card", () => {
    const helper = read("lib/member-daily-life.ts");
    const dashboard = read("components/portal/MemberDashboard.tsx");

    expect(dailyLifeKeys.nextTimetableMass("church-a")).toEqual(["member-daily-life", "next-timetable-mass", "church-a"]);
    expect(helper).toContain('supabase.rpc("get_member_parish_schedule_masses"');
    expect(helper).toContain("p_church_id: churchId");
    expect(helper).toContain("p_from_date: getTanzaniaDateKey(now)");
    expect(dashboard).toContain("fetchNextTimetableMass");
    expect(dashboard).toContain("nextMass={mobileNextMass ?? null}");
    expect(dashboard).toContain("nextMassError={mobileMassError}");
    expect(dashboard).toContain("nextMassLoading={mobileMassLoading}");
  });

  it("keeps the desktop RSVP flow on the legacy RSVP summary", () => {
    const dashboard = read("components/portal/MemberDashboard.tsx");

    expect(dashboard).toContain("fetchNextMassSummary(churchId!)");
    expect(dashboard).toContain("const displayNextMass = mobileNextMass ?? null");
    expect(dashboard).toContain("const rsvpMass = massSummary?.mass ?? null");
    expect(dashboard).toContain("{displayNextMass ? (");
    expect(dashboard).toContain("{rsvpMass ? (");
    expect(dashboard).not.toContain("{displayNextMass && rsvpMass ? (");
    expect(dashboard).toContain('supabase.rpc("submit_mass_response"');
    expect(dashboard).toContain("p_mass_event_id: massSummary.mass.id");
    expect(dashboard).not.toContain("p_mass_event_id: displayNextMass.id");
    expect(dashboard).not.toContain("p_mass_event_id: mobileNextMass.id");
  });

  it("uses the timetable Mass helper for every informational member next Mass surface", () => {
    const dashboard = read("components/portal/MemberDashboard.tsx");
    const today = read("pages/portal/MemberTodayPage.tsx");
    const parish = read("pages/portal/MemberMyParishPage.tsx");

    for (const source of [dashboard, today, parish]) {
      expect(source).toContain("fetchNextTimetableMass");
      expect(source).toContain("dailyLifeKeys.nextTimetableMass(churchId)");
    }
    expect(today).not.toContain("fetchNextMassSummary");
    expect(today).not.toContain("dailyLifeKeys.nextMass(churchId)");
    expect(today).not.toContain("mass.data?.mass");
    expect(parish).not.toContain("fetchNextMassSummary");
    expect(parish).not.toContain("dailyLifeKeys.nextMass(churchId)");
    expect(parish).not.toContain("mass.data?.mass");
  });

  it("selects only the nearest future explicitly classified Mass", () => {
    const now = new Date("2026-09-27T07:00:00Z"); // 10:00 in Africa/Dar_es_Salaam.
    const next = selectNextTimetableMass([
      row({ id: "past-today", occurrence_date: "2026-09-27", start_time: "06:30:00", activity_type: "mass" }),
      row({ id: "confession", occurrence_date: "2026-09-27", start_time: "10:30:00", activity_type: "confession", name: "Confession" }),
      row({ id: "null-type", occurrence_date: "2026-09-27", start_time: "11:00:00", activity_type: null, name: "Unclassified" }),
      row({ id: "future-mass", occurrence_date: "2026-09-28", start_time: "06:30:00", activity_type: "mass", name: "Morning Mass" }),
      row({ id: "later-mass", occurrence_date: "2026-09-28", start_time: "08:30:00", activity_type: "mass" }),
    ], now);

    expect(next).toMatchObject({
      id: "future-mass",
      title: "Morning Mass",
      description: "Main Church",
      massDate: "2026-09-28",
      startTime: "06:30",
      askForRsvp: false,
    });
  });

  it("includes remaining Masses today using Tanzania time boundaries", () => {
    const now = new Date("2026-09-26T21:30:00Z"); // 00:30 on 2026-09-27 in Africa/Dar_es_Salaam.

    expect(getTanzaniaDateKey(now)).toBe("2026-09-27");
    expect(getTanzaniaTimeKey(now)).toBe("00:30");
    expect(selectNextTimetableMass([
      row({ id: "today-early", occurrence_date: "2026-09-27", start_time: "00:15:00" }),
      row({ id: "today-next", occurrence_date: "2026-09-27", start_time: "06:30:00" }),
    ], now)?.id).toBe("today-next");
  });

  it("excludes malformed timetable rows before choosing the next Mass", () => {
    const now = new Date("2026-09-27T07:00:00Z"); // 10:00 in Africa/Dar_es_Salaam.
    const malformedRows = [
      row({ id: "null-time", occurrence_date: "2026-09-27", start_time: null }),
      row({ id: "empty-time", occurrence_date: "2026-09-27", start_time: "" }),
      row({ id: "malformed-time", occurrence_date: "2026-09-27", start_time: "soon" }),
      row({ id: "impossible-hour", occurrence_date: "2026-09-27", start_time: "25:00:00" }),
      row({ id: "impossible-minute", occurrence_date: "2026-09-27", start_time: "12:99:00" }),
      row({ id: "null-date", occurrence_date: null, start_time: "10:30:00" }),
      row({ id: "empty-date", occurrence_date: "", start_time: "10:30:00" }),
      row({ id: "malformed-date", occurrence_date: "09/27/2026", start_time: "10:30:00" }),
      row({ id: "impossible-day", occurrence_date: "2026-02-30", start_time: "10:30:00" }),
      row({ id: "impossible-month", occurrence_date: "2026-13-01", start_time: "10:30:00" }),
    ];

    expect(selectNextTimetableMass(malformedRows, now)).toBeNull();
    expect(selectNextTimetableMass([
      ...malformedRows,
      row({ id: "valid-later", occurrence_date: "2026-09-27", start_time: "11:00:00", name: "Valid Later Mass" }),
    ], now)).toMatchObject({
      id: "valid-later",
      title: "Valid Later Mass",
      massDate: "2026-09-27",
      startTime: "11:00",
    });
  });

  it("keeps valid Masses later today and tomorrow eligible", () => {
    const now = new Date("2026-09-27T07:00:00Z"); // 10:00 in Africa/Dar_es_Salaam.

    expect(selectNextTimetableMass([
      row({ id: "later-today", occurrence_date: "2026-09-27", start_time: "10:30:00" }),
      row({ id: "tomorrow", occurrence_date: "2026-09-28", start_time: "06:30:00" }),
    ], now)?.id).toBe("later-today");
    expect(selectNextTimetableMass([
      row({ id: "past-today", occurrence_date: "2026-09-27", start_time: "09:30:00" }),
      row({ id: "tomorrow", occurrence_date: "2026-09-28", start_time: "06:30:00" }),
    ], now)?.id).toBe("tomorrow");
  });

  it("returns null for empty, non-Mass, unclassified or unavailable rows", () => {
    const now = new Date("2026-09-27T07:00:00Z");

    expect(selectNextTimetableMass([], now)).toBeNull();
    expect(selectNextTimetableMass([
      row({ id: "confession", start_time: "11:00:00", activity_type: "confession" }),
      row({ id: "adoration", start_time: "12:00:00", activity_type: "adoration" }),
      row({ id: "prayer", start_time: "13:00:00", activity_type: "prayer" }),
      row({ id: "other", start_time: "14:00:00", activity_type: "other" }),
      row({ id: "null", start_time: "15:00:00", activity_type: null }),
      row({ id: "cancelled", start_time: "16:00:00", activity_type: "mass", status: "cancelled" }),
    ], now)).toBeNull();
  });

  it("keeps the member parish calendar on display labels for all timetable activity types", () => {
    const calendar = read("pages/ParishCalendarPage.tsx");
    const sw = JSON.parse(read("locales/sw.json"));

    expect(calendar).toContain("function getActivityKind");
    expect(calendar).toContain("TIMETABLE_ACTIVITY_LABEL_KEYS");
    expect(sw.mass_timetable_admin.activity_types.confession).toBe("Maungamo");
    expect(sw.mass_timetable_admin.activity_types.adoration).toBe("Kuabudu Ekaristi");
    expect(sw.mass_timetable_admin.activity_types.unclassified).toBe("Haijaainishwa");
    expect(calendar).toContain("kind: getActivityKind(t, mass.activity_type ?? null)");
  });
});

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const read = (relativePath: string) =>
  readFileSync(join(root, relativePath), "utf8").replace(/\r\n/g, "\n");

const calendar = read("src/pages/ParishCalendarPage.tsx");
const serviceRegistry = read("src/lib/member-service-registry.ts");
const portalLayout = read("src/components/portal/PortalLayout.tsx");
const memberMyParish = read("src/pages/portal/MemberMyParishPage.tsx");
const mobileHome = read("src/components/portal/MobileMemberHome.tsx");
const sw = JSON.parse(read("src/locales/sw.json")) as {
  member_calendar: { title: string; subtitle: string; groups: { today: string; week: string; later: string }; activity: { event: string } };
  member_services: { calendar: { label: string; back_title: string } };
  member_my_parish: { actions: { schedule: string } };
  mass_timetable_admin: { activity_types: Record<string, string> };
};

describe("member parish schedule visual copy contract", () => {
  it("uses Ratiba ya Parokia for the member schedule surface", () => {
    expect(calendar).toContain('t("member_calendar.title")');
    expect(calendar).toContain('t("member_calendar.subtitle")');
    expect(sw.member_calendar.title).toBe("Ratiba ya Parokia");
    expect(sw.member_calendar.subtitle).toBe("Misa na matukio yajayo katika parokia yako.");
    expect(serviceRegistry).toContain('label: "Ratiba ya Parokia"');
    expect(serviceRegistry).toContain('backTitle: "Ratiba"');
  });

  it("defines the intended member agenda groups without requiring empty sections", () => {
    expect(calendar).toContain('title: t("member_calendar.groups.today")');
    expect(calendar).toContain('title: t("member_calendar.groups.week")');
    expect(calendar).toContain('title: t("member_calendar.groups.later")');
    expect(sw.member_calendar.groups.today).toBe("Leo");
    expect(sw.member_calendar.groups.week).toBe("Wiki Hii");
    expect(sw.member_calendar.groups.later).toBe("Baadaye");
    expect(calendar).toContain("groups.filter((group) => group.items.length > 0)");
  });

  it("keeps timetable classification and Tukio distinctions visible on agenda items", () => {
    expect(calendar).toContain("function getActivityKind");
    expect(calendar).toContain("TIMETABLE_ACTIVITY_LABEL_KEYS");
    expect(sw.mass_timetable_admin.activity_types.mass).toBe("Misa");
    expect(sw.mass_timetable_admin.activity_types.confession).toBe("Maungamo");
    expect(sw.mass_timetable_admin.activity_types.adoration).toBe("Kuabudu Ekaristi");
    expect(sw.mass_timetable_admin.activity_types.prayer).toBe("Sala / Ibada");
    expect(sw.mass_timetable_admin.activity_types.other).toBe("Nyingine");
    expect(sw.mass_timetable_admin.activity_types.unclassified).toBe("Haijaainishwa");
    expect(calendar).toContain("kind: getActivityKind(t, mass.activity_type ?? null)");
    expect(calendar).toContain('event.event_type || t("member_calendar.activity.event")');
    expect(sw.member_calendar.activity.event).toBe("Tukio");
    expect(calendar).toContain('item.source === "mass"');
    expect(calendar).toContain("<MemberScheduleItem");
  });

  it("uses Tanzania timezone presentation helpers without changing backend filtering", () => {
    expect(calendar).toContain('const TANZANIA_TIME_ZONE = "Africa/Dar_es_Salaam"');
    expect(calendar).toContain("getTanzaniaDateKey");
    expect(calendar).toContain("getUpcomingSundayKey");
    expect(calendar).toContain('.gte("start_date", now)');
    expect(calendar).toContain('.gte("occurrence_date", today)');
  });

  it("uses Ratiba for member navigation copy while preserving the route", () => {
    expect(portalLayout).toContain('serviceNavItem("calendar", "/portal/calendar", EventsIcon, "events")');
    expect(serviceRegistry).toContain('labelKey: "member_services.calendar.label"');
    expect(serviceRegistry).toContain('backTitleKey: "member_services.calendar.back_title"');
    expect(sw.member_services.calendar.label).toBe("Ratiba ya Parokia");
    expect(sw.member_services.calendar.back_title).toBe("Ratiba");
    expect(sw.member_my_parish.actions.schedule).toBe("Ratiba");
    expect(memberMyParish).toContain('to="/portal/calendar"');
    expect(memberMyParish).toContain('t("member_my_parish.actions.schedule")');
    expect(memberMyParish).toContain('t("member_services.calendar.label")');
    expect(mobileHome).toContain('to="/portal/calendar"');
    expect(mobileHome).toContain('t("member_my_parish.actions.schedule")');
  });
});

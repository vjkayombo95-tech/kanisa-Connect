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
const sw = JSON.parse(read("src/locales/sw.json")) as { member_services: { calendar: { label: string; back_title: string } }; member_my_parish: { actions: { schedule: string } } };

describe("member parish schedule visual copy contract", () => {
  it("uses Ratiba ya Parokia for the member schedule surface", () => {
    expect(calendar).toContain("Ratiba ya Parokia");
    expect(calendar).toContain("Misa na matukio yajayo katika parokia yako.");
    expect(serviceRegistry).toContain('label: "Ratiba ya Parokia"');
    expect(serviceRegistry).toContain('backTitle: "Ratiba"');
  });

  it("defines the intended member agenda groups without requiring empty sections", () => {
    expect(calendar).toContain('title: "Leo"');
    expect(calendar).toContain('title: "Wiki Hii"');
    expect(calendar).toContain('title: "Baadaye"');
    expect(calendar).toContain("groups.filter((group) => group.items.length > 0)");
  });

  it("keeps timetable classification and Tukio distinctions visible on agenda items", () => {
    expect(calendar).toContain("function getActivityKind");
    expect(calendar).toContain('case "mass"');
    expect(calendar).toContain('return "Misa"');
    expect(calendar).toContain('case "confession"');
    expect(calendar).toContain('return "Maungamo"');
    expect(calendar).toContain('case "adoration"');
    expect(calendar).toContain('return "Kuabudu Ekaristi"');
    expect(calendar).toContain('case "prayer"');
    expect(calendar).toContain('return "Sala / Ibada"');
    expect(calendar).toContain('case "other"');
    expect(calendar).toContain('return "Nyingine"');
    expect(calendar).toContain('return "Haijaainishwa"');
    expect(calendar).toContain("kind: getActivityKind(mass.activity_type ?? null)");
    expect(calendar).toContain('event.event_type || "Tukio"');
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
    expect(mobileHome).toContain(">Ratiba</AppLink>");
  });
});

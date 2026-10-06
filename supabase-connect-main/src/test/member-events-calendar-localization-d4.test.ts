import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import i18n, { changeAppLanguage } from "@/i18n";
import { formatAppDate } from "@/lib/localization";

const root = process.cwd();
const read = (relative: string) => fs.readFileSync(path.join(root, relative), "utf8");

const eventsSource = read("src/pages/portal/PortalEvents.tsx");
const calendarSource = read("src/pages/ParishCalendarPage.tsx");
const memberRoutesSource = read("src/routes/MemberRoutes.tsx");
const adminRoutesSource = read("src/routes/AdminRoutes.tsx");
const portalFeaturesSource = read("src/lib/portal-features.ts");
const massTimetableSource = read("src/lib/mass-timetable.ts");
const en = JSON.parse(read("src/locales/en.json"));
const sw = JSON.parse(read("src/locales/sw.json"));

describe("member events and calendar localization D4", () => {
  it("provides English and Kiswahili Events UI while preserving dynamic event content", async () => {
    await changeAppLanguage("en");
    expect(i18n.t("member_events.title")).toBe("Events");
    expect(i18n.t("member_events.rsvp.yes")).toBe("Yes");
    expect(i18n.t("member_events.rsvp.no")).toBe("No");
    expect(i18n.t("member_events.fallback_description")).toBe("Join us for this event.");

    await changeAppLanguage("sw");
    expect(i18n.t("member_events.title")).toBe("Matukio");
    expect(i18n.t("member_events.rsvp.yes")).toBe("Ndiyo");
    expect(i18n.t("member_events.rsvp.no")).toBe("Hapana");
    expect(i18n.t("member_events.fallback_description")).toBe("Jiunge nasi katika tukio hili.");

    expect(eventsSource).toContain("{event.title}");
    expect(eventsSource).toContain("event.description || t(\"member_events.fallback_description\")");
    expect(eventsSource).toContain("{event.location}");
    expect(eventsSource).not.toMatch(/\bt\s*\(\s*event\.title/);
    expect(eventsSource).not.toMatch(/\bt\s*\(\s*event\.description/);
    expect(eventsSource).not.toMatch(/\bt\s*\(\s*event\.location/);
  });

  it("preserves AttendanceResponse and the exact event attendance write contract", () => {
    expect(eventsSource).toContain('type AttendanceResponse = "yes" | "no"');
    expect(eventsSource).not.toContain('"maybe"');
    expect(eventsSource).toContain('respondToEvent.mutate({ eventId: event.id, response: "yes" })');
    expect(eventsSource).toContain('respondToEvent.mutate({ eventId: event.id, response: "no" })');
    expect(eventsSource).toContain('.from("event_attendances").upsert');
    for (const field of ["church_id: churchId", "event_id: eventId", "member_id: member.id", "response", "responded_at: new Date().toISOString()"]) {
      expect(eventsSource).toContain(field);
    }
    expect(eventsSource).toContain('{ onConflict: "event_id,member_id" }');
  });

  it("keeps Events query, tenant scope, and selected-language date display separate", () => {
    expect(eventsSource).toContain('queryKey: ["portal-events", churchId]');
    expect(eventsSource).toContain('.from("events")');
    expect(eventsSource).toContain('.eq("church_id", churchId)');
    expect(eventsSource).toContain('.is("archived_at", null)');
    expect(eventsSource).toContain('.order("start_date", { ascending: true })');
    expect(eventsSource).toContain("formatAppDate(event.start_date, i18n.language");
    expect(eventsSource).not.toContain('toLocaleDateString("en-US"');
    expect(eventsSource).not.toContain('toLocaleTimeString("en-US"');

    const instant = "2026-10-05T12:15:00Z";
    expect(formatAppDate(instant, "en", { month: "short" })).not.toBe(formatAppDate(instant, "sw", { month: "short" }));
  });

  it("provides member Calendar EN/SW presentation while preserving dynamic Mass and event content", async () => {
    await changeAppLanguage("en");
    expect(i18n.t("member_calendar.title")).toBe("Parish Schedule");
    expect(i18n.t("member_calendar.groups.today")).toBe("Today");
    expect(i18n.t("member_calendar.registration.parish_event")).toBe("Parish event");

    await changeAppLanguage("sw");
    expect(i18n.t("member_calendar.title")).toBe("Ratiba ya Parokia");
    expect(i18n.t("member_calendar.groups.today")).toBe("Leo");
    expect(i18n.t("member_calendar.registration.parish_event")).toBe("Tukio la parokia");

    expect(calendarSource).toContain("title: event.title");
    expect(calendarSource).toContain("detail: event.location");
    expect(calendarSource).toContain("title: mass.name");
    expect(calendarSource).toContain("detail: mass.location_name");
    expect(calendarSource).not.toMatch(/\bt\s*\(\s*event\.title/);
    expect(calendarSource).not.toMatch(/\bt\s*\(\s*mass\.name/);
  });

  it("preserves calendar workspace branching, queries, RPC arguments, and Tanzania date identity", () => {
    expect(memberRoutesSource).toContain('<Route path="calendar" element={<ParishCalendarPage workspace="member" />} />');
    expect(adminRoutesSource).toContain('<Route path="calendar" element={<ParishCalendarPage workspace="admin" />} />');
    expect(portalFeaturesSource).toContain('{ prefix: "/portal/calendar", featureKey: "events" }');

    expect(calendarSource).toContain('queryKey: ["wave4a-parish-calendar", workspace, churchId]');
    expect(calendarSource).toContain('const massesQuery = workspace === "member"');
    expect(calendarSource).toContain('db.rpc("get_member_parish_schedule_masses", { p_church_id: churchId, p_from_date: today })');
    expect(calendarSource).toContain(': db.from("mass_occurrences").select("*").eq("church_id", churchId)');
    expect(calendarSource).toContain('db.from("events").select("id,church_id,title,description,start_date,end_date,location,event_type,registration_type,archived_at")');
    expect(calendarSource).toContain('const dateKeyFormatter = new Intl.DateTimeFormat("en-GB"');
    expect(calendarSource).toContain('timeZone: TANZANIA_TIME_ZONE');
    expect(calendarSource).toContain('const TANZANIA_TIME_ZONE = "Africa/Dar_es_Salaam"');
    expect(calendarSource).toContain("p_from_date: today");
  });

  it("localizes calendar display labels without mutating backend status values", () => {
    expect(calendarSource).toContain('row.payment_status === "paid" ? "paid" : row.registration_status');
    expect(calendarSource).toContain("translateStatusLabel(t, registrationStatus)");
    expect(calendarSource).toContain("translateStatusLabel(t, mass.status)");
    expect(calendarSource).toContain("TIMETABLE_ACTIVITY_LABEL_KEYS");
    expect(massTimetableSource).toContain("TIMETABLE_ACTIVITY_LABEL_KEYS");
    expect(calendarSource).toContain('event.registration_type === "paid"');
    expect(calendarSource).toContain('kind: event.event_type || t("member_calendar.activity.event")');
  });

  it("keeps locale namespaces symmetrical", () => {
    expect(Object.keys(en.member_events).sort()).toEqual(Object.keys(sw.member_events).sort());
    expect(Object.keys(en.member_calendar).sort()).toEqual(Object.keys(sw.member_calendar).sort());
  });
});

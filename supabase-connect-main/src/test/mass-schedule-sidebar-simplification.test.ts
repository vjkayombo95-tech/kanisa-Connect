import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { STAFF_MOBILE_CONFIGS, isStaffRouteAllowed } from "@/lib/staff-mobile-registry";

const source = (path: string) => readFileSync(join(process.cwd(), "src", path), "utf8");

describe("Mass schedule sidebar simplification", () => {
  it("exposes exactly one primary Mass schedule service for church admins", () => {
    const massServices = STAFF_MOBILE_CONFIGS.admin.services.filter((service) =>
      service.route === "/church-admin/mass-schedule" || service.route === "/church-admin/mass-timetable"
    );

    expect(massServices).toHaveLength(1);
    expect(massServices[0]).toMatchObject({
      id: "mass-timetable",
      label: "Ratiba za Misa",
      route: "/church-admin/mass-timetable",
      featureKey: "events",
    });
  });

  it("keeps the canonical timetable service available to pastoral staff", () => {
    const massServices = STAFF_MOBILE_CONFIGS.pastoral.services.filter((service) =>
      service.route === "/church-admin/mass-schedule" || service.route === "/church-admin/mass-timetable"
    );

    expect(massServices).toHaveLength(1);
    expect(massServices[0]).toMatchObject({
      id: "mass-timetable",
      label: "Ratiba za Misa",
      route: "/church-admin/mass-timetable",
      featureKey: "events",
    });
    expect(isStaffRouteAllowed("pastoral", "/church-admin/mass-timetable")).toBe(true);
  });

  it("preserves the specialized RSVP route and page wiring", () => {
    const routes = source("routes/AdminRoutes.tsx");

    expect(routes).toContain('const MassSchedulePage = lazy(() => import("@/pages/church-admin/MassSchedulePage"))');
    expect(routes).toContain('const MassTimetablePage = lazy(() => import("@/pages/church-admin/MassTimetablePage"))');
    expect(routes).toContain('<Route path="mass-schedule" element={<MassSchedulePage />} />');
    expect(routes).toContain('<Route path="mass-timetable" element={<MassTimetablePage />} />');
    expect(isStaffRouteAllowed("admin", "/church-admin/mass-schedule")).toBe(true);
    expect(isStaffRouteAllowed("pastoral", "/church-admin/mass-schedule")).toBe(true);
  });

  it("does not change member routes or Mass workflow data contracts", () => {
    const memberRoutes = source("routes/MemberRoutes.tsx");
    const massSchedulePage = source("pages/church-admin/MassSchedulePage.tsx");
    const massTimetablePage = source("pages/church-admin/MassTimetablePage.tsx");
    const memberDailyLife = source("lib/member-daily-life.ts");
    const portalIntentions = source("pages/portal/PortalMassIntentions.tsx");
    const parishCalendar = source("pages/ParishCalendarPage.tsx");

    expect(memberRoutes).toContain('path="today"');
    expect(memberRoutes).toContain('path="calendar"');
    expect(massSchedulePage).toContain('"mass_events"');
    expect(massSchedulePage).toContain('"mass_responses"');
    expect(memberDailyLife).toContain("get_next_mass_summary");
    expect(massTimetablePage).toContain('"mass_schedules"');
    expect(massTimetablePage).toContain('"mass_occurrences"');
    expect(massTimetablePage).toContain("generate_mass_occurrences");
    expect(portalIntentions).toContain("get_available_mass_occurrences");
    expect(parishCalendar).toContain("get_member_parish_schedule_masses");
  });
});

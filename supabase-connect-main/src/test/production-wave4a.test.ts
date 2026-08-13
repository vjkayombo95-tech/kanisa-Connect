import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { STAFF_MOBILE_CONFIGS, getCommunityMobileConfig, isStaffRouteAllowed } from "@/lib/staff-mobile-registry";
import { validateMassTimes } from "@/lib/mass-timetable";

const source = (path: string) => readFileSync(join(process.cwd(), "src", path), "utf8");
const migration = readFileSync(join(process.cwd(), "supabase/migrations/20260719120000_mass_timetable_and_intention_booking.sql"), "utf8");

describe("production catch-up Wave 4A", () => {
  it("registers only the approved routes", () => {
    const adminRoutes = source("routes/AdminRoutes.tsx");
    const memberRoutes = source("routes/MemberRoutes.tsx");
    expect(adminRoutes).toContain('path="mass-timetable"');
    expect(adminRoutes).toContain('path="calendar"');
    expect(adminRoutes).toContain('path="events/:eventId/registrations"');
    expect(memberRoutes).toContain('path="calendar"');
    expect(`${adminRoutes}${memberRoutes}`).not.toMatch(/path="(?:pastoral|finance|today)/);
  });

  it("keeps direct reads and mutations tenant-filtered", () => {
    for (const file of ["pages/ParishCalendarPage.tsx", "pages/church-admin/MassTimetablePage.tsx", "pages/church-admin/EventRegistrationsPage.tsx"]) {
      expect(source(file)).toContain('.eq("church_id", churchId)');
    }
  });

  it("uses the production event columns without an invented event status", () => {
    const calendar = source("pages/ParishCalendarPage.tsx");
    expect(calendar).not.toContain("registration_type,status,archived_at");
    expect(calendar).not.toContain('.neq("status", "cancelled")');
    expect(calendar).toContain("registration_type,archived_at");
  });

  it("allows only the approved member Calendar route and retains feature gating", () => {
    const layout = source("components/portal/PortalLayout.tsx");
    const services = source("pages/portal/MemberServicesPage.tsx");
    expect(layout).toContain('"/portal/calendar"');
    expect(layout).not.toContain('"/portal/today"');
    expect(layout).not.toContain('"/portal/radio"');
    expect(services).toContain('to: "/portal/calendar"');
    expect(services).toContain('featureKey: "events"');
    expect(services).toContain("getFeatureState(item.featureKey).visible");
  });

  it("uses authoritative occurrence and roster RPCs", () => {
    expect(source("pages/portal/PortalMassIntentions.tsx")).toContain("get_available_mass_occurrences");
    expect(source("lib/member-linked-requests.ts")).toContain("submit_portal_mass_intention_for_occurrence");
    expect(source("pages/church-admin/MassTimetablePage.tsx")).toContain("generate_mass_occurrences");
    expect(source("pages/church-admin/EventRegistrationsPage.tsx")).toContain("get_event_registration_roster");
    expect(source("pages/church-admin/EventRegistrationsPage.tsx")).toContain("mark_event_registration_attendance");
  });

  it("preserves backend capacity, cancellation, tenant and idempotency protections", () => {
    expect(migration).toContain("on conflict (mass_schedule_id, occurrence_date)");
    expect(migration).toContain("where id = p_mass_occurrence_id and church_id = p_church_id");
    expect(migration).toContain("v_occ.status not in ('scheduled','rescheduled')");
    expect(migration).toContain("v_booked >= v_occ.intention_capacity");
    expect(migration).toContain("idempotency_key=v_key");
    expect(migration).toContain("'pending','approved','scheduled','completed','archived'");
  });

  it("keeps Wave 3 role boundaries", () => {
    expect(isStaffRouteAllowed("pastoral", "/church-admin/mass-timetable")).toBe(true);
    expect(isStaffRouteAllowed("pastoral", "/church-admin/calendar")).toBe(true);
    expect(isStaffRouteAllowed("pastoral", "/church-admin/events/event-a/registrations")).toBe(true);
    expect(isStaffRouteAllowed("finance", "/church-admin/mass-timetable")).toBe(false);
    expect(isStaffRouteAllowed("finance", "/church-admin/calendar")).toBe(false);
    expect(STAFF_MOBILE_CONFIGS.super_admin.services.some(item => item.id === "mass-timetable")).toBe(false);
    expect(getCommunityMobileConfig("community-a").services.some(item => item.route.startsWith("/church-admin"))).toBe(false);
  });

  it("validates schedule time ranges", () => {
    expect(validateMassTimes("06:30", "07:30")).toBe(true);
    expect(validateMassTimes("07:30", "06:30")).toBe(false);
  });
});

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const read = (relativePath: string) => readFileSync(join(root, relativePath), "utf8");

const calendar = read("src/pages/ParishCalendarPage.tsx");
const memberRoutes = read("src/routes/MemberRoutes.tsx");
const portalFeatures = read("src/lib/portal-features.ts");
const serviceRegistry = read("src/lib/member-service-registry.ts");
const portalLayout = read("src/components/portal/PortalLayout.tsx");
const memberServices = read("src/pages/portal/MemberServicesPage.tsx");
const memberMyParish = read("src/pages/portal/MemberMyParishPage.tsx");
const memberToday = read("src/pages/portal/MemberTodayPage.tsx");
const migration = read("supabase/migrations/20260906120000_member_parish_schedule_masses.sql");

describe("member Parish schedule behavior contract", () => {
  it("keeps the member schedule route on /portal/calendar", () => {
    expect(memberRoutes).toContain('const ParishCalendarPage = lazy(() => import("@/pages/ParishCalendarPage"))');
    expect(memberRoutes).toContain('<Route path="calendar" element={<ParishCalendarPage workspace="member" />} />');
    expect(serviceRegistry).toContain('id: "calendar"');
    expect(serviceRegistry).toContain('path: "/portal/calendar"');
    expect(serviceRegistry).toContain('ordinaryMemberAllowed: true');
  });

  it("keeps the member schedule behind the existing events feature", () => {
    expect(portalFeatures).toContain('{ prefix: "/portal/calendar", featureKey: "events" }');
    expect(serviceRegistry).toMatch(/id: "calendar"[\s\S]*featureKey: "events"/);
    expect(portalLayout).toContain("const activeFeatureKey = getPortalFeatureForPath(location.pathname)");
    expect(portalLayout).toContain("activeFeatureKey && !activeFeatureState?.visible");
  });

  it("keeps member Mass reads on the narrow member-safe RPC", () => {
    expect(calendar).toContain('const massesQuery = workspace === "member"');
    expect(calendar).toContain('db.rpc("get_member_parish_schedule_masses"');
    expect(calendar).toContain("p_church_id: churchId");
    expect(calendar).toContain("p_from_date: today");
    expect(calendar).toContain('type CalendarMass = Pick<MassOccurrence, "id" | "occurrence_date" | "start_time" | "name" | "location_name" | "status">');
  });

  it("does not restore ordinary-member direct mass_occurrences reads", () => {
    expect(calendar).toMatch(/workspace === "member"\s*\?\s*db\.rpc\("get_member_parish_schedule_masses"/);
    expect(calendar).not.toMatch(/workspace === "member"\s*\?\s*db\.from\("mass_occurrences"\)/);
  });

  it("preserves the admin/non-member direct manager Mass path", () => {
    expect(calendar).toContain('\n      : db.from("mass_occurrences").select("*").eq("church_id", churchId)');
    expect(calendar).toContain('.gte("occurrence_date", today)');
    expect(calendar).toContain('.in("status", ["scheduled", "rescheduled"])');
    expect(calendar).toContain('.order("occurrence_date").order("start_time").limit(100)');
  });

  it("preserves the existing Events source and tenant filter", () => {
    expect(calendar).toContain('db.from("events").select("id,church_id,title,description,start_date,end_date,location,event_type,registration_type,archived_at")');
    expect(calendar).toContain('.eq("church_id", churchId)');
    expect(calendar).toContain('.gte("start_date", now)');
    expect(calendar).toContain('.is("archived_at", null)');
    expect(calendar).toContain('.order("start_date").limit(100)');
  });

  it("keeps query keys and merged chronological ordering stable", () => {
    expect(calendar).toContain('queryKey: ["wave4a-parish-calendar", workspace, churchId]');
    expect(calendar).toContain('id: `event-${event.id}`');
    expect(calendar).toContain('id: `mass-${mass.id}`');
    expect(calendar).toContain("].sort(compareScheduleItems)");
  });

  it("keeps the rendered Mass and Event fields within the current display contract", () => {
    for (const fragment of [
      "title: mass.name",
      'kind: "Misa"',
      "detail: mass.location_name",
      "status: mass.status",
      "title: event.title",
      'kind: event.event_type || "Tukio"',
      "detail: event.location",
      "event.registration_type === \"paid\"",
    ]) {
      expect(calendar).toContain(fragment);
    }
  });

  it("does not introduce member schedule mutations or new member actions", () => {
    expect(calendar).not.toMatch(/useMutation|\.insert\(|\.update\(|\.upsert\(|\.delete\(|respondToEvent|submitPortal|onClick=/);
    expect(calendar).not.toMatch(/event_attendances"\)\.upsert|mass_intentions"\)\.insert/);
  });

  it("keeps the secure RPC contract referenced by the member schedule", () => {
    expect(migration).toContain("create or replace function public.get_member_parish_schedule_masses");
    expect(migration).toMatch(/returns table \(\s*id uuid,\s*occurrence_date date,\s*start_time time,\s*name text,\s*location_name text,\s*status text\s*\)/);
    expect(migration).toContain("public.is_church_member(v_actor, p_church_id)");
    expect(migration).toContain("public.can_manage_church_workspace(v_actor, p_church_id)");
    expect(migration).toContain("public.is_super_admin()");
    expect(migration).toContain("o.status in ('scheduled', 'rescheduled')");
    expect(migration).not.toContain("o.accepts_intentions");
  });

  it("keeps member navigation entry points pointing to the existing route", () => {
    expect(portalLayout).toContain('{ titleKey: "Ratiba", url: "/portal/calendar", icon: EventsIcon, featureKey: "events" }');
    expect(serviceRegistry).toContain('label: "Ratiba ya Parokia"');
    expect(memberServices).toContain('calendar: "parish-services"');
    expect(memberMyParish).toContain('to="/portal/calendar"');
    expect(memberToday).toContain('to="/portal/calendar"');
  });
});

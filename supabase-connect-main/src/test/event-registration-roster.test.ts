import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import en from "../locales/en.json";
import sw from "../locales/sw.json";
import {
  buildEventRosterCsv,
  rosterValueMatchesSearch,
  summarizeEventRoster,
  type EventRegistrationRosterRow,
} from "../lib/events/registration-roster";

const migrationPath = path.resolve("supabase/migrations/20260704139000_event_registration_roster.sql");
const migration = fs.readFileSync(migrationPath, "utf8");

const row = (overrides: Partial<EventRegistrationRosterRow> = {}): EventRegistrationRosterRow => ({
  attendance_id: overrides.attendance_id ?? "attendance-1",
  event_id: "event-1",
  church_id: "church-1",
  event_title: "Kongamano la Vijana",
  event_start_date: "2026-07-12T09:00:00Z",
  event_end_date: null,
  event_location: "Bagamoyo",
  audience_mode: "specific_groups",
  registration_type: "paid",
  registration_fee: 10000,
  registration_currency: "TZS",
  registration_capacity: 100,
  member_id: "member-1",
  full_name: "Amina John",
  phone: "+255700000001",
  email: "amina@example.com",
  community_names: "Mtakatifu Petro",
  ministry_names: "Youth Ministry",
  registration_status: "confirmed",
  payment_status: "paid",
  registered_at: "2026-07-01T10:00:00Z",
  attendance_status: "unmarked",
  amount_due: 10000,
  payment_reference: "ABC1234",
  latest_payment_status: "approved",
  expected_revenue: 20000,
  verified_revenue: 10000,
  pending_verification: 10000,
  ...overrides,
});

describe("event registration roster architecture", () => {
  it("creates a dedicated authorized roster RPC without broad member access", () => {
    expect(migration).toContain("create or replace function public.get_event_registration_roster");
    expect(migration).toContain("public.can_manage_event_roster(auth.uid(), p_event_id)");
    expect(migration).toContain("public.can_manage_church_roles(_user_id, e.church_id)");
    expect(migration).toContain("public.can_manage_church_workspace(_user_id, e.church_id)");
    expect(migration).not.toContain("public.can_view_event(auth.uid(), p_event_id)");
  });

  it("resolves roster identity and relationships in one server-side query", () => {
    expect(migration).toContain("join public.members m on m.id = ea.member_id");
    expect(migration).toContain("left join public.profiles pr on pr.id = m.user_id");
    expect(migration).toContain("left join auth.users au on au.id = m.user_id");
    expect(migration).toContain("from public.member_communities mc");
    expect(migration).toContain("from public.member_ministries mm");
    expect(migration).toContain("legacy_jumuiya");
    expect(migration).not.toContain("select * from public.members where id =");
  });

  it("keeps RSVP, payment, registration confirmation, and actual attendance distinct", () => {
    expect(migration).toContain("attendance_status text not null default 'unmarked'");
    expect(migration).toContain("check (attendance_status in ('unmarked', 'attended', 'absent'))");
    expect(migration).toContain("coalesce(ea.registration_status, 'registered') as registration_status");
    expect(migration).toContain("coalesce(ea.payment_status, 'not_required') as payment_status");
    expect(migration).toContain("where ea.response = 'yes'");
  });

  it("keeps event-specific revenue server-side and excludes cancelled or refunded rows", () => {
    expect(migration).toContain("coalesce(sum(coalesce(ea.amount_due, 0)) filter");
    expect(migration).toContain("coalesce(ea.registration_status, 'registered') not in ('cancelled', 'refunded')");
    expect(migration).toContain("coalesce(sum(p.amount) filter (where p.status = 'approved'), 0) as verified_revenue");
    expect(migration).toContain("coalesce(sum(p.amount) filter (where p.status = 'pending'), 0) as pending_verification");
    expect(migration).not.toContain("where p.status in ('pending', 'approved', 'rejected')");
  });

  it("updates attendance through a bounded same-event RPC", () => {
    expect(migration).toContain("create or replace function public.mark_event_registration_attendance");
    expect(migration).toContain("ea.id = any(coalesce(p_attendance_ids, array[]::uuid[]))");
    expect(migration).toContain("ea.church_id = (select e.church_id from public.events e where e.id = p_event_id)");
    expect(migration).toContain("attendance_marked_by = auth.uid()");
  });

  it("summarizes and exports the same normalized roster rows", () => {
    const rows = [
      row(),
      row({ attendance_id: "attendance-2", full_name: "Baraka Musa", payment_status: "submitted", registration_status: "payment_submitted", attendance_status: "attended" }),
      row({ attendance_id: "attendance-3", full_name: "Clara Neema", payment_status: "pending", registration_status: "payment_pending", attendance_status: "absent" }),
    ];

    expect(summarizeEventRoster(rows)).toMatchObject({
      totalRegistered: 3,
      confirmed: 1,
      paymentPending: 2,
      paid: 1,
      attended: 1,
      absent: 1,
      expectedRevenue: 20000,
      verifiedRevenue: 10000,
      pendingVerification: 10000,
    });
    expect(rosterValueMatchesSearch(rows[0], "amina")).toBe(true);
    expect(rosterValueMatchesSearch(rows[0], "+255700")).toBe(true);
    expect(rosterValueMatchesSearch(rows[0], "missing")).toBe(false);
    expect(buildEventRosterCsv(rows)).toContain("Event,Full Name,Phone,Email,Jumuiya,Ministry");
    expect(buildEventRosterCsv(rows)).toContain("Kongamano la Vijana,Amina John,+255700000001,amina@example.com");
  });

  it("localizes required roster labels in English and Kiswahili", () => {
    expect(en.church_admin.events.roster.view_registrations).toBe("View Registrations");
    expect(sw.church_admin.events.roster.view_registrations).toBe("Tazama Waliojisajili");
    expect(en.church_admin.events.roster.mark_attended).toBe("Mark as Attended");
    expect(sw.church_admin.events.roster.mark_absent).toBe("Weka Hajahudhuria");
  });
});

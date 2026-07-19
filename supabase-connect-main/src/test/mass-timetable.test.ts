import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { MASS_RESERVING_STATUSES, MASS_WEEKDAYS, calculateMassAvailability, occurrenceDisplay, validateMassTimes } from "@/lib/mass-timetable";

const root = process.cwd();
const migration = readFileSync(join(root, "supabase/migrations/20260719120000_mass_timetable_and_intention_booking.sql"), "utf8");
const cancellationFix = readFileSync(join(root, "supabase/migrations/20260719210000_fix_mass_cancellation_notification_type.sql"), "utf8");
const adminPage = readFileSync(join(root, "src/pages/church-admin/MassTimetablePage.tsx"), "utf8");
const memberPage = readFileSync(join(root, "src/pages/portal/PortalMassIntentions.tsx"), "utf8");
const intentionsPage = readFileSync(join(root, "src/pages/church-admin/MassIntentionsPage.tsx"), "utf8");
const adminRoutes = readFileSync(join(root, "src/routes/AdminRoutes.tsx"), "utf8");
const registry = readFileSync(join(root, "src/components/workspace/registry.ts"), "utf8");

describe("Mass timetable domain", () => {
  it("registers the linked Church Admin route behind Mass Intentions access", () => {
    expect(intentionsPage).toContain('to="/church-admin/mass-timetable"');
    expect(adminRoutes).toContain('import("@/pages/church-admin/MassTimetablePage")');
    expect(adminRoutes).toContain('path="mass-timetable"');
    expect(adminRoutes).toContain('<FeatureProtectedRoute featureKey="mass_intentions">');
    expect(adminRoutes).toContain('<Route element={<WorkspaceRouteLayout workspaceId="church_admin" />}>');
    expect(registry).toContain('id: "mass-timetable", label: "Mass Timetable", to: "/church-admin/mass-timetable", icon: CalendarDays, featureFlag: "mass_intentions"');
  });

  it("uses the documented Sunday-first weekday convention", () => {
    expect(MASS_WEEKDAYS).toEqual(["Jumapili", "Jumatatu", "Jumanne", "Jumatano", "Alhamisi", "Ijumaa", "Jumamosi"]);
    expect(migration).toContain("extract(dow from d)::integer = s.day_of_week");
  });

  it("calculates limited, full, and unlimited availability", () => {
    expect(calculateMassAvailability(10, 8)).toEqual({ remainingSlots: 2, isFull: false });
    expect(calculateMassAvailability(10, 10)).toEqual({ remainingSlots: 0, isFull: true });
    expect(calculateMassAvailability(null, 999)).toEqual({ remainingSlots: null, isFull: false });
  });

  it("validates end times without rejecting an omitted end time", () => {
    expect(validateMassTimes("06:30", "07:30")).toBe(true);
    expect(validateMassTimes("06:30", null)).toBe(true);
    expect(validateMassTimes("06:30", "06:00")).toBe(false);
  });

  it("provides occurrence-first display values with a location fallback", () => {
    expect(occurrenceDisplay({ name: "Morning Mass", occurrence_date: "2026-07-26", start_time: "06:30:00", location_name: null })).toMatchObject({ name: "Morning Mass", date: "2026-07-26", time: "06:30", location: "Kanisa kuu" });
  });
});

describe("Mass timetable migration security and integrity", () => {
  it("creates both tenant-owned tables and the compatible intention link", () => {
    expect(migration).toContain("create table if not exists public.mass_schedules");
    expect(migration).toContain("create table if not exists public.mass_occurrences");
    expect(migration).toContain("add column if not exists mass_occurrence_id uuid");
    expect(migration).toContain("on delete restrict");
  });

  it("enforces tenant isolation for reads and management", () => {
    expect(migration).toContain("public.is_church_member(auth.uid(), p_church_id)");
    expect(migration).toContain("public.can_manage_church_workspace(auth.uid(), church_id)");
    expect(migration).toContain("alter table public.mass_schedules enable row level security");
    expect(migration).toContain("alter table public.mass_occurrences enable row level security");
    expect(migration).toContain("foreign key (mass_occurrence_id, church_id)");
  });

  it("generates only active effective schedules without duplicates", () => {
    expect(migration).toContain("where s.church_id = p_church_id and s.is_active");
    expect(migration).toContain("d::date >= s.effective_from");
    expect(migration).toContain("on conflict (mass_schedule_id, occurrence_date)");
    expect(migration).toContain("Generation window cannot exceed 365 days");
  });

  it("supports special Masses without linking a recurring schedule", () => {
    expect(adminPage).toContain("mass_schedule_id: form.id ? undefined : null");
    expect(adminPage).toContain("is_special_mass: form.is_special_mass");
  });

  it("counts only the existing active intention statuses", () => {
    expect(MASS_RESERVING_STATUSES).toEqual(["pending", "approved", "scheduled", "completed", "archived"]);
    expect(migration).toContain("('pending','approved','scheduled','completed','archived')");
    expect(migration).not.toContain("('pending','approved','scheduled','completed','rejected')");
  });

  it("serializes capacity checks to prevent concurrent overbooking", () => {
    expect(migration).toContain("pg_advisory_xact_lock");
    expect(migration).toContain("for update");
    expect(migration).toContain("This Mass is fully booked");
  });

  it("makes occurrence-linked member creation RPC-only and guards legacy updates", () => {
    expect(migration).toContain('drop policy if exists "Members create their own pending mass intentions"');
    expect(migration).toContain("enforce_mass_intention_occurrence_booking_trigger");
    expect(migration).toContain("Mass occurrence and booking snapshots cannot be changed directly");
  });

  it("uses authoritative occurrence values including a server-owned fee", () => {
    expect(migration).toContain("new.mass_date := v_occ.occurrence_date");
    expect(migration).toContain("new.mass_time := v_occ.start_time::text");
    expect(migration).toContain("new.mass_name := v_occ.name");
    expect(migration).toContain("new.mass_location := v_occ.location_name");
    expect(migration).toContain("v_amount := coalesce(v_occ.intention_fee, 0)");
  });

  it("excludes cancelled Masses from member availability", () => {
    expect(migration).toContain("o.status in ('scheduled','rescheduled')");
    expect(memberPage).toContain("disabled={full}");
  });

  it("links new intentions and copies compatibility snapshots", () => {
    expect(migration).toContain("mass_occurrence_id,mass_date,mass_time,mass_name,mass_location");
    expect(memberPage).toContain("mass_occurrence_id: massOccurrenceId");
  });

  it("keeps legacy intentions visible without an occurrence", () => {
    expect(readFileSync(join(root, "src/pages/church-admin/MassIntentionsPage.tsx"), "utf8")).toContain("Legacy record");
  });

  it("edits one occurrence without updating its recurring schedule", () => {
    expect(adminPage).toContain('.from("mass_occurrences").update');
    expect(adminPage).toContain("Misa hii pekee, si ratiba ya kila wiki");
  });

  it("protects schedule history and notifies affected members on cancellation", () => {
    expect(migration).toContain("protect_mass_schedule_history_trigger");
    expect(migration).toContain("insert into public.notifications");
    expect(migration).toContain("new.status='cancelled'");
    expect(migration).toContain("select distinct new.church_id,m.user_id");
  });

  it("hardens all security-definer search paths and Tanzania-local dates", () => {
    const definers = migration.match(/security definer set search_path\s*=\s*public, pg_temp/g) ?? [];
    expect(definers).toHaveLength(6);
    expect(migration).not.toMatch(/security definer set search_path\s*=\s*public\s+as/);
    expect(migration).toContain("Africa/Dar_es_Salaam");
  });

  it("does not rewrite snapshots after completion or expose timetable tables to members", () => {
    expect(migration).toContain("old.status not in ('completed','cancelled')");
    expect(migration).not.toContain("or (is_active and public.is_church_member");
    expect(migration).not.toContain("occurrence_date >= current_date and status");
  });

  it("adds indexes for common tenant timetable access paths", () => {
    expect(migration).toContain("mass_occurrences_church_status_date_idx");
    expect(migration).toContain("mass_schedules_church_active_idx");
    expect(migration).toContain("mass_occurrences_schedule_date_uidx");
    expect(migration).toContain("mass_intentions_occurrence_idx");
  });

  it("casts cancellation notification types explicitly in the forward fix", () => {
    const normalizedSql = cancellationFix.toLowerCase().replace(/\s+/g, " ");

    expect(normalizedSql).toContain(
      "create or replace function public.sync_mass_occurrence_intentions() returns trigger",
    );
    expect(cancellationFix).toContain("security definer");
    expect(cancellationFix).toContain("set search_path = public, pg_temp");
    expect(cancellationFix).toContain("'warning'::public.notification_type");
    expect(cancellationFix).not.toMatch(/,\s*'warning'\s*(?:\n|\r|from)/i);
    expect(cancellationFix).toContain("old.status is distinct from new.status");
    expect(cancellationFix).toContain("new.status = 'cancelled'");
    expect(cancellationFix).toContain("select distinct");
    expect(cancellationFix).toContain("m.church_id = new.church_id");
    expect(cancellationFix).toContain("mi.church_id = new.church_id");
    expect(cancellationFix).toContain("mi.mass_occurrence_id = new.id");
    expect(cancellationFix).toContain("return new;");
    expect(normalizedSql).not.toMatch(
      /\b(drop table|drop column|drop policy|drop trigger|truncate table|delete from)\b/,
    );
    expect(normalizedSql).not.toMatch(/supabase_migrations\.schema_migrations/);
  });
});

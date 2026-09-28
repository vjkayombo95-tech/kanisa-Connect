import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const migration = readFileSync(
  join(root, "supabase/migrations/20260927120000_add_timetable_activity_classification.sql"),
  "utf8",
);
const sqlTest = readFileSync(
  join(root, "supabase/tests/timetable_activity_classification.sql"),
  "utf8",
);

describe("timetable activity classification migration contract", () => {
  it("adds nullable activity_type columns and constrained approved values only", () => {
    expect(migration).toContain("alter table public.mass_schedules");
    expect(migration).toContain("add column if not exists activity_type text");
    expect(migration).toContain("alter table public.mass_occurrences");
    expect(migration).toContain("mass_schedules_activity_type_check");
    expect(migration).toContain("mass_occurrences_activity_type_check");
    expect(migration).toContain("activity_type is null");
    expect(migration).toContain("'mass', 'confession', 'adoration', 'prayer', 'other'");
    expect(migration).not.toMatch(/set\s+activity_type\s*=\s*'mass'/i);
    expect(migration).not.toMatch(/default\s+'mass'/i);
  });

  it("propagates schedule activity_type during new occurrence generation only", () => {
    expect(migration).toContain("create or replace function public.generate_mass_occurrences");
    expect(migration).toMatch(/insert into public\.mass_occurrences \([\s\S]*activity_type[\s\S]*created_by\s*\)/);
    expect(migration).toMatch(/s\.activity_type,\s*'scheduled'/);
    expect(migration).toContain("on conflict (mass_schedule_id, occurrence_date) where mass_schedule_id is not null do nothing");
  });

  it("uses a drop and recreate strategy for the widened member-safe RPC return type", () => {
    expect(migration).toContain("drop function if exists public.get_member_parish_schedule_masses(uuid, date)");
    expect(migration).toMatch(/returns table \([\s\S]*status text,\s*activity_type text\s*\)/);
    expect(migration).toContain("public.is_church_member(v_actor, p_church_id)");
    expect(migration).toContain("public.can_manage_church_workspace(v_actor, p_church_id)");
    expect(migration).toContain("where o.church_id = p_church_id");
    expect(migration).toContain("grant execute on function public.get_member_parish_schedule_masses(uuid, date) to authenticated");
    expect(migration).toContain("revoke all on function public.get_member_parish_schedule_masses(uuid, date) from public, anon");
  });

  it("protects Mass intention booking from non-Mass and unclassified occurrences", () => {
    expect(migration).toContain("create or replace function public.get_available_mass_occurrences");
    expect(migration).toContain("and o.activity_type = 'mass'");
    expect(migration).toContain("create or replace function public.enforce_mass_intention_occurrence_booking");
    expect(migration.match(/v_occ\.activity_type is distinct from 'mass'/g)).toHaveLength(3);
    expect(migration).toContain("create or replace function public.submit_portal_mass_intention_for_occurrence");
    expect(migration).toContain("'activity_type', o.activity_type");
  });

  it("adds only a justified occurrence index for classified lookup paths", () => {
    expect(migration).toContain("create index if not exists mass_occurrences_church_activity_status_date_idx");
    expect(migration).toContain("on public.mass_occurrences(church_id, activity_type, status, occurrence_date, start_time)");
    expect(migration).not.toContain("mass_schedules_church_activity_idx");
  });

  it("includes SQL regression coverage for constraints, generation, tenant isolation, and booking restrictions", () => {
    expect(sqlTest).toContain("mass_schedules rejects unsupported activity_type");
    expect(sqlTest).toContain("mass_occurrences rejects unsupported activity_type");
    expect(sqlTest).toContain("generated Mass occurrence receives activity_type mass");
    expect(sqlTest).toContain("member-safe schedule RPC rejects cross-church access");
    expect(sqlTest).toContain("available Mass occurrence RPC only returns explicit Mass rows");
    expect(sqlTest).toContain("portal Mass intention submission rejects Confession occurrence");
    expect(sqlTest).toContain("portal Mass intention submission rejects unclassified occurrence");
    expect(sqlTest).toContain("portal Mass intention submission accepts explicit Mass occurrence");
  });
});

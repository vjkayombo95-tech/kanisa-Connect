import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const migration = readFileSync(
  join(root, "supabase/migrations/20260927120000_add_timetable_activity_classification.sql"),
  "utf8",
);
const memberScheduleRpc = migration.slice(
  migration.indexOf("create or replace function public.get_member_parish_schedule_masses"),
  migration.indexOf("create or replace function public.get_available_mass_occurrences"),
);

describe("member parish schedule Mass RPC security contract", () => {
  it("creates one hardened SECURITY DEFINER RPC with an explicit search path", () => {
    expect(memberScheduleRpc).toContain("create or replace function public.get_member_parish_schedule_masses");
    expect(memberScheduleRpc).toContain("security definer");
    expect(memberScheduleRpc).toContain("set search_path = public, pg_temp");
  });

  it("requires an authenticated caller and requested church context", () => {
    expect(memberScheduleRpc).toContain("v_actor uuid := auth.uid()");
    expect(memberScheduleRpc).toContain("if v_actor is null then");
    expect(memberScheduleRpc).toContain("raise exception 'Authentication required' using errcode = '42501'");
    expect(memberScheduleRpc).toContain("if p_church_id is null then");
    expect(memberScheduleRpc).toContain("raise exception 'Church context is required' using errcode = '22023'");
  });

  it("authorizes only same-church members, workspace managers, or super admins", () => {
    expect(memberScheduleRpc).toContain("public.is_church_member(v_actor, p_church_id)");
    expect(memberScheduleRpc).toContain("public.can_manage_church_workspace(v_actor, p_church_id)");
    expect(memberScheduleRpc).toContain("public.is_super_admin()");
    expect(memberScheduleRpc).toContain("raise exception 'Forbidden' using errcode = '42501'");
    expect(memberScheduleRpc).not.toMatch(/p_member_id|member_id uuid/i);
  });

  it("returns only display-safe Mass occurrence fields", () => {
    expect(memberScheduleRpc).toMatch(/returns table \(\s*id uuid,\s*occurrence_date date,\s*start_time time,\s*name text,\s*location_name text,\s*status text,\s*activity_type text\s*\)/);
    for (const field of ["created_by", "created_at", "updated_at", "mass_schedule_id", "location_id", "intention_capacity", "intention_fee", "accepts_intentions", "celebrant_name", "notes"]) {
      expect(memberScheduleRpc).not.toContain(field);
    }
    expect(memberScheduleRpc).toContain("o.activity_type");
  });

  it("keeps filtering tenant-scoped, current-or-future, and display-status-only", () => {
    expect(memberScheduleRpc).toContain("where o.church_id = p_church_id");
    expect(memberScheduleRpc).toContain("coalesce(p_from_date, (now() at time zone 'Africa/Dar_es_Salaam')::date)");
    expect(memberScheduleRpc).toContain("o.occurrence_date >= v_from_date");
    expect(memberScheduleRpc).toContain("o.status in ('scheduled', 'rescheduled')");
  });

  it("hardens execute permissions without weakening mass_occurrences RLS", () => {
    expect(migration).toContain("revoke all on function public.get_member_parish_schedule_masses(uuid, date) from public, anon");
    expect(migration).toContain("grant execute on function public.get_member_parish_schedule_masses(uuid, date) to authenticated");
    expect(migration).not.toMatch(/create policy[\s\S]*mass_occurrences/i);
    expect(migration).not.toMatch(/grant select[\s\S]*mass_occurrences/i);
  });
});

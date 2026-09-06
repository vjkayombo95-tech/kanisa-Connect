import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const migration = readFileSync(
  join(root, "supabase/migrations/20260906120000_member_parish_schedule_masses.sql"),
  "utf8",
);

describe("member parish schedule Mass RPC security contract", () => {
  it("creates one hardened SECURITY DEFINER RPC with an explicit search path", () => {
    expect(migration).toContain("create or replace function public.get_member_parish_schedule_masses");
    expect(migration).toContain("security definer");
    expect(migration).toContain("set search_path = public, pg_temp");
  });

  it("requires an authenticated caller and requested church context", () => {
    expect(migration).toContain("v_actor uuid := auth.uid()");
    expect(migration).toContain("if v_actor is null then");
    expect(migration).toContain("raise exception 'Authentication required' using errcode = '42501'");
    expect(migration).toContain("if p_church_id is null then");
    expect(migration).toContain("raise exception 'Church context is required' using errcode = '22023'");
  });

  it("authorizes only same-church members, workspace managers, or super admins", () => {
    expect(migration).toContain("public.is_church_member(v_actor, p_church_id)");
    expect(migration).toContain("public.can_manage_church_workspace(v_actor, p_church_id)");
    expect(migration).toContain("public.is_super_admin()");
    expect(migration).toContain("raise exception 'Forbidden' using errcode = '42501'");
    expect(migration).not.toMatch(/p_member_id|member_id uuid/i);
  });

  it("returns only display-safe Mass occurrence fields", () => {
    expect(migration).toMatch(/returns table \(\s*id uuid,\s*occurrence_date date,\s*start_time time,\s*name text,\s*location_name text,\s*status text\s*\)/);
    for (const field of ["created_by", "created_at", "updated_at", "mass_schedule_id", "location_id", "intention_capacity", "intention_fee", "accepts_intentions", "celebrant_name", "notes"]) {
      expect(migration).not.toContain(field);
    }
  });

  it("keeps filtering tenant-scoped, current-or-future, and display-status-only", () => {
    expect(migration).toContain("where o.church_id = p_church_id");
    expect(migration).toContain("coalesce(p_from_date, (now() at time zone 'Africa/Dar_es_Salaam')::date)");
    expect(migration).toContain("o.occurrence_date >= v_from_date");
    expect(migration).toContain("o.status in ('scheduled', 'rescheduled')");
  });

  it("hardens execute permissions without weakening mass_occurrences RLS", () => {
    expect(migration).toContain("revoke all on function public.get_member_parish_schedule_masses(uuid, date) from public, anon");
    expect(migration).toContain("grant execute on function public.get_member_parish_schedule_masses(uuid, date) to authenticated");
    expect(migration).not.toMatch(/alter table public\.mass_occurrences/i);
    expect(migration).not.toMatch(/create policy[\s\S]*mass_occurrences/i);
    expect(migration).not.toMatch(/grant select[\s\S]*mass_occurrences/i);
  });
});

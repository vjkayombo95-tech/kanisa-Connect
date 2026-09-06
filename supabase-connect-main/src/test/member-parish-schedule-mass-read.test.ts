import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const read = (relativePath: string) => readFileSync(join(root, relativePath), "utf8");

const calendar = read("src/pages/ParishCalendarPage.tsx");
const massIntentions = read("src/pages/portal/PortalMassIntentions.tsx");
const migration = read("supabase/migrations/20260906120000_member_parish_schedule_masses.sql");

describe("member parish schedule Mass read contract", () => {
  it("uses the member parish schedule RPC for member Calendar Masses", () => {
    expect(calendar).toContain('workspace === "member"');
    expect(calendar).toContain('db.rpc("get_member_parish_schedule_masses"');
    expect(calendar).toContain("p_church_id: churchId");
    expect(calendar).toContain("p_from_date: today");
  });

  it("keeps member Calendar off direct mass_occurrences select star", () => {
    expect(calendar).toContain('type CalendarMass = Pick<MassOccurrence, "id" | "occurrence_date" | "start_time" | "name" | "location_name" | "status">');
    expect(calendar).toContain('const massesQuery = workspace === "member"\n      ? db.rpc("get_member_parish_schedule_masses"');
    expect(calendar).toContain('\n      : db.from("mass_occurrences").select("*")');
  });

  it("preserves the admin Calendar direct manager path", () => {
    expect(calendar).toContain(': db.from("mass_occurrences").select("*").eq("church_id", churchId)');
    expect(calendar).toContain('.in("status", ["scheduled", "rescheduled"])');
  });

  it("leaves the existing Events query unchanged", () => {
    expect(calendar).toContain('db.from("events").select("id,church_id,title,description,start_date,end_date,location,event_type,registration_type,archived_at").eq("church_id", churchId).gte("start_date", now).is("archived_at", null).order("start_date").limit(100)');
  });

  it("keeps Mass Intentions on the availability RPC", () => {
    expect(massIntentions).toContain('supabase.rpc("get_available_mass_occurrences"');
    expect(massIntentions).toContain("{ p_church_id: churchId, p_date: null }");
    expect(massIntentions).not.toContain("get_member_parish_schedule_masses");
  });

  it("documents the display schedule filters in the migration", () => {
    expect(migration).toContain("o.occurrence_date >= v_from_date");
    expect(migration).toContain("o.status in ('scheduled', 'rescheduled')");
    expect(migration).not.toContain("o.accepts_intentions");
    expect(migration).toContain("order by o.occurrence_date asc, o.start_time asc nulls last, o.id asc");
  });
});

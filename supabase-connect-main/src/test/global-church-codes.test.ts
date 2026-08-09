import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const migration = fs.readFileSync(path.resolve("supabase/migrations/20260706100000_global_church_codes.sql"), "utf8");
const publicRegistration = fs.readFileSync(path.resolve("src/lib/public-registration.ts"), "utf8");
const joinChurchPage = fs.readFileSync(path.resolve("src/pages/auth/JoinChurchPage.tsx"), "utf8");
const churchManagement = fs.readFileSync(path.resolve("src/pages/super-admin/ChurchManagement.tsx"), "utf8");
const settingsPage = fs.readFileSync(path.resolve("src/pages/church-admin/SettingsPage.tsx"), "utf8");
const rolesPage = fs.readFileSync(path.resolve("src/pages/church-admin/RolesPage.tsx"), "utf8");
const analyticsPdf = fs.readFileSync(path.resolve("src/components/church-admin/AnalyticsReportPdf.tsx"), "utf8");

describe("global church codes", () => {
  it("adds globally unique public church code columns without changing UUID identity", () => {
    expect(migration).toContain("add column if not exists church_code text");
    expect(migration).toContain("add column if not exists short_code text");
    expect(migration).toContain("add column if not exists code_generated_at timestamptz");
    expect(migration).toContain("alter column church_code set not null");
    expect(migration).toContain("add constraint churches_church_code_key unique (church_code)");
    expect(migration).toContain("add constraint churches_short_code_key unique (short_code)");
    expect(migration).not.toContain("drop column id");
    expect(migration).not.toContain("references public.churches(church_code)");
  });

  it("generates readable and short join codes with collision checks", () => {
    expect(migration).toContain("create or replace function public.generate_church_code");
    expect(migration).toContain("format('KC-%s-%s', v_region, v_name)");
    expect(migration).toContain("lpad(v_sequence::text, 3, '0')");
    expect(migration).toContain("create or replace function public.generate_church_join_code");
    expect(migration).toContain("lpad(floor(random() * 10000)::int::text, 4, '0')");
    expect(migration).toContain("where upper(c.short_code) = v_candidate");
    expect(migration).toContain("pg_advisory_xact_lock");
  });

  it("backfills existing churches safely and assigns future inserts through a trigger", () => {
    expect(migration).toContain("for v_church in");
    expect(migration).toContain("order by created_at, id");
    expect(migration).toContain("create trigger set_church_public_codes_before_write");
    expect(migration).toContain("before insert or update of name, address, church_code, short_code");
  });

  it("updates creation and public lookup RPCs for church code and join code", () => {
    expect(migration).toContain("'church_code', _church.church_code");
    expect(migration).toContain("'short_code', _church.short_code");
    expect(migration).toContain("upper(c.church_code) = upper($1)");
    expect(migration).toContain("upper(c.short_code) = upper(regexp_replace($1");
    expect(migration).toContain("or c.name ilike $1");
  });

  it("lets onboarding search by name, church code, or join code", () => {
    expect(publicRegistration).toContain("church_code?: string | null");
    expect(publicRegistration).toContain("short_code?: string | null");
    expect(publicRegistration).toContain("church_code.eq");
    expect(publicRegistration).toContain("short_code.eq");
    expect(joinChurchPage).toContain("Join Existing Church");
    expect(joinChurchPage).toContain("STJ8472 or KC-DAR-STJ-001");
  });

  it("shows codes in admin, super admin, invitation, and analytics reporting surfaces", () => {
    expect(settingsPage).toContain("Join Code");
    expect(churchManagement).toContain("Search name, church code, or join code");
    expect(churchManagement).toContain("Church Code");
    expect(churchManagement).toContain("Join Code");
    expect(rolesPage).toContain("Church Code:");
    expect(rolesPage).toContain("Join Code:");
    expect(analyticsPdf).toContain("CHURCH CODE:");
  });
});

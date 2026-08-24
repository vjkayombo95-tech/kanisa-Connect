import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const harness = readFileSync(join(root, "scripts/db/Invoke-LocalMigrationReplay.ps1"), "utf8");
const fixture = readFileSync(join(root, "supabase/tests/wave5a_disposable_prereqs.sql"), "utf8");
const migrations = readdirSync(join(root, "supabase/migrations"));

describe("Wave 4A.1B1 disposable migration replay harness", () => {
  it("keeps the historical prerequisite out of authoritative migrations", () => {
    expect(migrations).not.toContain("20260622005000_DISPOSABLE_REPLAY_PREREQS.sql");
    expect(harness).toContain("Copy-Item -LiteralPath $fixturePath");
    expect(harness).toContain("20260622005000_DISPOSABLE_REPLAY_PREREQS.sql");
    expect(harness).toContain("Disposable local Supabase Storage prerequisites are unavailable");
  });

  it("fails closed around remote database configuration", () => {
    expect(harness).toContain("SUPABASE_PRODUCTION_DB_URL");
    expect(harness).toContain("SUPABASE_STAGING_DB_URL");
    expect(harness).toContain("--local");
    expect(harness).not.toContain("--linked");
    expect(harness).not.toContain("--project-id");
  });

  it("uses the existing disposable fixture without credentials", () => {
    expect(fixture).toContain("hauletino55@gmail.com");
    expect(fixture).toContain("create table if not exists storage.objects");
    expect(fixture).not.toMatch(/password|service[_-]?role[_-]?key/i);
  });

  it("always removes local containers and the temporary workspace", () => {
    expect(harness).toContain("supabase stop --workdir $temporaryRoot --no-backup");
    expect(harness).toContain("Remove-Item -LiteralPath $temporaryRoot -Recurse -Force");
    expect(harness).toContain("finally {");
  });
});

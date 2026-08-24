import { readFileSync, readdirSync } from "node:fs";
import { execFileSync, spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const harness = readFileSync(join(root, "scripts/db/Invoke-LocalMigrationReplay.ps1"), "utf8");
const fixture = readFileSync(join(root, "supabase/tests/wave5a_disposable_prereqs.sql"), "utf8");
const migrations = readdirSync(join(root, "supabase/migrations"));
const canonicalTypes = join(root, "src/integrations/supabase/types.ts");
const freshTypesPath = process.env.KANISA_REPLAY_FRESH_TYPES_PATH;

const validateOutputPath = (candidate: string) => execFileSync(
  "powershell.exe",
  ["-NoProfile", "-File", join(root, "scripts/db/Invoke-LocalMigrationReplay.ps1"), "-TypesOutputPath", candidate, "-ValidateOutputPathOnly"],
  { cwd: tmpdir(), encoding: "utf8" },
).trim();

const rejectOutputPath = (candidate: string) => spawnSync(
  "powershell.exe",
  ["-NoProfile", "-File", join(root, "scripts/db/Invoke-LocalMigrationReplay.ps1"), "-TypesOutputPath", candidate, "-ValidateOutputPathOnly"],
  { cwd: tmpdir(), encoding: "utf8" },
);

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

  it("resolves relative, absolute, and spaced output paths deterministically", () => {
    expect(validateOutputPath("src/integrations/supabase/types.ts")).toBe(canonicalTypes);
    const external = join(tmpdir(), "Kanisa replay verification", "types.ts");
    expect(validateOutputPath(external)).toBe(external);
  });

  it.each([
    "supabase/migrations/output.ts",
    "supabase/migrations/nested/output.ts",
    "supabase/tests/output.ts",
    ".git/output.ts",
    ".github/output.ts",
    "package.json",
    "src/App.tsx",
  ])("rejects unsafe repository output path %s", (candidate) => {
    const result = rejectOutputPath(candidate);
    expect(result.status).not.toBe(0);
    expect(`${result.stdout}${result.stderr}`).toContain("Refusing generated-types output inside the repository");
  });

  it("fails closed for an invalid empty output path", () => {
    const result = rejectOutputPath("   ");
    expect(result.status).not.toBe(0);
    expect(`${result.stdout}${result.stderr}`).toContain("Invalid generated-types output path");
  });

  it("installs the generator output without text normalization", () => {
    expect(harness).toContain("Copy-Item -LiteralPath $generatedCandidate -Destination $typesPath -Force");
    expect(harness).not.toContain("WriteAllText($typesPath");
    expect(readFileSync(canonicalTypes).at(-1)).toBe(0x0a);
  });

  it.skipIf(!freshTypesPath)("matches a fresh replay output byte-for-byte", () => {
    expect(readFileSync(freshTypesPath!)).toEqual(readFileSync(canonicalTypes));
  });
});

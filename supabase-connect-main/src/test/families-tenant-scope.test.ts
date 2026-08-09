import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const source = readFileSync(resolve(process.cwd(), "src/pages/church-admin/FamiliesPage.tsx"), "utf8");

describe("family workspace tenant scope", () => {
  it("does not query families before the active church is known", () => {
    expect(source).toContain("enabled: !!churchId");
  });

  it("scopes family reads to the active church", () => {
    expect(source).toContain('.eq("church_id", churchId).order("name")');
  });

  it("includes the trusted active church in family inserts", () => {
    expect(source).toContain('if (!churchId) throw new Error("No active church workspace")');
    expect(source).toContain("church_id: churchId");
  });
});

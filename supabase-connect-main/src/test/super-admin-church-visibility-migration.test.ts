import { readFileSync } from "fs";
import { join } from "path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  join(
    process.cwd(),
    "supabase/migrations/20261013120000_super_admin_church_visibility.sql"
  ),
  "utf8"
);

const sql = migration
  .split("\n")
  .filter((line) => !line.trim().startsWith("--"))
  .join("\n")
  .replace(/\s+/g, " ")
  .toLowerCase();

describe("Super Admin church visibility migration", () => {
  it("creates a SELECT policy for authenticated users", () => {
    expect(sql).toContain(
      'create policy "platform_super_admin_select_all_churches"'
    );
    expect(sql).toContain("on public.churches");
    expect(sql).toMatch(/for select\s+to authenticated/);
  });

  it("requires verified platform Super Admin authorization", () => {
    expect(sql).toContain(
      "public.is_platform_super_admin((select auth.uid()))"
    );
    expect(sql).toContain(
      "public.is_super_admin((select auth.uid()))"
    );
  });

  it("does not grant unrestricted access", () => {
    expect(sql).not.toMatch(/using\s*\(\s*true\s*\)/);
    expect(sql).not.toMatch(/to\s+public\s+using/);
    expect(sql).not.toMatch(/disable\s+row\s+level\s+security/);
  });

  it("does not modify church data or unrelated permissions", () => {
    expect(sql).not.toMatch(/\b(update|delete|truncate)\s+public\.churches\b/);
    expect(sql).not.toMatch(/\bgrant\s+/);
    expect(sql).not.toMatch(/\bcreate\s+or\s+replace\s+function\b/);
    expect(sql).not.toContain("church_memberships");
    expect(sql).not.toContain("diocese_staff");
  });
});
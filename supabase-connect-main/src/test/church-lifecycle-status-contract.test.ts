import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  join(process.cwd(), "supabase/migrations/20260824120000_add_church_lifecycle_status.sql"),
  "utf8",
);
const churchManagement = readFileSync(
  join(process.cwd(), "src/pages/super-admin/ChurchManagement.tsx"),
  "utf8",
);
const platformDashboard = readFileSync(
  join(process.cwd(), "src/pages/super-admin/PlatformDashboard.tsx"),
  "utf8",
);
const publicRegistration = readFileSync(
  join(process.cwd(), "src/lib/public-registration.ts"),
  "utf8",
);

function extractMigrationStatuses() {
  const match = migration.match(/check\s*\(\s*status\s+in\s*\(([^)]+)\)\s*\)/i);
  if (!match) return [];

  return match[1]
    .split(",")
    .map((value) => value.trim().replace(/^'|'$/g, ""))
    .sort();
}

function extractChurchManagementFilterStatuses() {
  const statuses = Array.from(churchManagement.matchAll(/<SelectItem value="([^"]+)">(?:Pending|Active|Inactive|Suspended)<\/SelectItem>/g))
    .map((match) => match[1]);

  return Array.from(new Set(statuses)).sort();
}

describe("church lifecycle status contract", () => {
  it("adds the expected church lifecycle status column without an enum dependency", () => {
    expect(migration).toContain("add column if not exists status text");
    expect(migration).toContain("alter column status set default 'active'");
    expect(migration).toContain("alter column status set not null");
    expect(migration).not.toMatch(/church_status|create type/i);
  });

  it("preserves existing churches as active and allows frontend status values", () => {
    expect(migration).toContain("set status = 'active'");
    expect(migration).toContain("where status is null");
    expect(extractMigrationStatuses()).toEqual(["active", "inactive", "pending", "suspended"]);
    expect(extractChurchManagementFilterStatuses()).toEqual(["active", "inactive", "pending", "suspended"]);
  });

  it("matches the super-admin status workflows", () => {
    expect(platformDashboard).toContain('.eq("status", "pending")');
    expect(platformDashboard).toContain('.update({ status: "active" })');
    expect(churchManagement).toContain('<SelectItem value="pending">Pending</SelectItem>');
    expect(churchManagement).toContain('<SelectItem value="inactive">Inactive</SelectItem>');
    expect(churchManagement).toContain('<SelectItem value="suspended">Suspended</SelectItem>');
    expect(churchManagement).toContain('status: "inactive"');
  });

  it("keeps public registration discovery active-only after the column exists", () => {
    expect(migration).toContain("and c.status = ''active''");
    expect(migration).toContain("get_public_registration_church");
    expect(publicRegistration).toContain('.eq("status", "active")');
  });
});

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  join(process.cwd(), "supabase/migrations/20260815190000_fix_portal_announcements_timestamp_contract.sql"),
  "utf8",
);

describe("portal announcement timestamp contract migration", () => {
  it("replaces the existing RPC without destructive DDL", () => {
    expect(migration).toContain("create or replace function public.get_portal_announcements");
    expect(migration).not.toMatch(/drop\s+function/i);
  });

  it("preserves the timestamptz API and explicitly converts both legacy timestamp columns", () => {
    expect(migration).toContain("published_at timestamptz");
    expect(migration).toContain("created_at timestamptz");
    expect(migration).toContain("a.published_at at time zone 'UTC'");
    expect(migration).toContain("a.created_at at time zone 'UTC'");
  });

  it("authorizes the requested church before lifecycle updates and keeps publication filters", () => {
    expect(migration.indexOf("if not (")).toBeLessThan(migration.indexOf("perform public.update_announcement_lifecycle"));
    expect(migration).toContain("ur.church_id = _church_id");
    expect(migration).toContain("m.church_id = _church_id");
    expect(migration).toContain("a.church_id = _church_id");
    expect(migration).toContain("a.is_published = true");
    expect(migration).toContain("a.status in ('active', 'featured')");
  });
});

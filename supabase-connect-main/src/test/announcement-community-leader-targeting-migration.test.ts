import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve(
    process.cwd(),
    "supabase/migrations/20261003120000_add_announcement_community_leader_targeting.sql",
  ),
  "utf8",
);

describe("announcement community leader targeting migration", () => {
  it("adds and validates the community audience column", () => {
    expect(migration).toContain("add column if not exists community_audience text not null default 'all'");
    expect(migration).toContain("announcements_community_audience_check");
    expect(migration).toContain("check (community_audience in ('all', 'leaders'))");
  });

  it("persists the new save_church_announcement argument", () => {
    expect(migration).toContain("_community_audience text default 'all'");
    expect(migration).toContain("v_community_audience text := lower(trim(coalesce(_community_audience, 'all')))");
    expect(migration).toContain("community_audience,");
    expect(migration).toContain("community_audience = v_community_audience");
  });

  it("checks all authoritative community leadership columns for leader-only announcements", () => {
    expect(migration).toContain("coalesce(a.community_audience, 'all') = 'leaders'");
    expect(migration).toContain("community.mwenyekiti_id = m.id");
    expect(migration).toContain("community.makamu_mwenyekiti_id = m.id");
    expect(migration).toContain("community.katibu_id = m.id");
    expect(migration).toContain("community.mweka_hazina_id = m.id");
  });

  it("keeps sensitive announcement RPCs authenticated-only", () => {
    expect(migration).toContain("revoke all on function public.get_portal_announcements(uuid, integer)");
    expect(migration).toContain("revoke all on function public.save_church_announcement(");
    expect(migration).toContain("from public, anon;");
    expect(migration).toContain("grant execute on function public.get_portal_announcements(uuid, integer)");
    expect(migration).toContain("grant execute on function public.save_church_announcement(");
    expect(migration).toContain("to authenticated;");
  });
});

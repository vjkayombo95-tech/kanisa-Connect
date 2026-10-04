import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve(
    process.cwd(),
    "supabase/migrations/20261003210000_add_church_wide_community_leader_announcements.sql",
  ),
  "utf8",
);

describe("church-wide community leader announcement targeting migration", () => {
  it("extends the authenticated portal announcements RPC without changing its shape", () => {
    expect(migration).toContain("drop function if exists public.get_portal_announcements(uuid, integer)");
    expect(migration).toContain("create or replace function public.get_portal_announcements(");
    expect(migration).toContain("_church_id uuid");
    expect(migration).toContain("_limit integer default 50");
    expect(migration).toContain("image_key text");
    expect(migration).toContain("security definer");
    expect(migration).toContain("set search_path = pg_catalog, public");
  });

  it("authorizes church-wide community leaders from the canonical community columns", () => {
    expect(migration).toContain("'community_leaders' = any(a.audience)");
    expect(migration).toContain("community.church_id = a.church_id");
    expect(migration).toContain("community.mwenyekiti_id = m.id");
    expect(migration).toContain("community.makamu_mwenyekiti_id = m.id");
    expect(migration).toContain("community.katibu_id = m.id");
    expect(migration).toContain("community.mweka_hazina_id = m.id");
  });

  it("preserves existing targeting filters and RPC grants", () => {
    expect(migration).toContain("'everyone' = any(a.audience)");
    expect(migration).toContain("'members' = any(a.audience)");
    expect(migration).toContain("lower(ur.role::text) = any(a.audience)");
    expect(migration).toContain("join public.member_ministries mm");
    expect(migration).toContain("join public.member_communities mc");
    expect(migration).toContain("coalesce(a.community_audience, 'all') = 'leaders'");
    expect(migration).toContain("revoke all on function public.get_portal_announcements(uuid, integer)");
    expect(migration).toContain("from public, anon;");
    expect(migration).toContain("grant execute on function public.get_portal_announcements(uuid, integer)");
    expect(migration).toContain("to authenticated;");
  });
});

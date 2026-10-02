import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve(
    process.cwd(),
    "supabase/migrations/20261002120000_enforce_announcement_audience_targets.sql",
  ),
  "utf8",
);

describe("announcement audience targeting migration", () => {
  it("preserves the authenticated portal announcements RPC contract", () => {
    expect(migration).toContain(
      "create or replace function public.get_portal_announcements(",
    );
    expect(migration).toContain("_church_id uuid");
    expect(migration).toContain("_limit integer default 50");
    expect(migration).toContain("security definer");
    expect(migration).toContain(
      "revoke all on function public.get_portal_announcements(uuid, integer)",
    );
    expect(migration).toContain(
      "grant execute on function public.get_portal_announcements(uuid, integer)",
    );
    expect(migration).toContain("to authenticated;");
  });

  it("preserves lifecycle and general audience filtering", () => {
    expect(migration).toContain("a.archived_at is null");
    expect(migration).toContain("a.publish_at <= now()");
    expect(migration).toContain(
      "a.never_expires = true or a.expires_at is null or a.expires_at > now()",
    );
    expect(migration).toContain("'everyone' = any(a.audience)");
    expect(migration).toContain("'members' = any(a.audience)");
    expect(migration).toContain(
      "lower(ur.role::text) = any(a.audience)",
    );
  });

  it("restricts ministry-targeted announcements to ministry members", () => {
    expect(migration).toContain(
      "nullif(trim(a.target_ministry), '') is null",
    );
    expect(migration).toContain("join public.member_ministries mm");
    expect(migration).toContain("on mm.member_id = m.id");
    expect(migration).toContain("join public.ministries ministry");
    expect(migration).toContain("on ministry.id = mm.ministry_id");
    expect(migration).toContain(
      "lower(trim(ministry.name)) = lower(trim(a.target_ministry))",
    );
    expect(migration).toContain("ministry.church_id = a.church_id");
  });

  it("restricts community-targeted announcements to community members", () => {
    expect(migration).toContain(
      "nullif(trim(a.target_community), '') is null",
    );
    expect(migration).toContain("join public.member_communities mc");
    expect(migration).toContain("on mc.member_id = m.id");
    expect(migration).toContain("join public.communities community");
    expect(migration).toContain("on community.id = mc.community_id");
    expect(migration).toContain(
      "lower(trim(community.name)) = lower(trim(a.target_community))",
    );
    expect(migration).toContain("community.church_id = a.church_id");
  });

  it("matches targeted membership to the authenticated member", () => {
    expect(migration).toContain("m.user_id = auth.uid()");
    expect(migration).toContain(
      "lower(trim(m.email)) = lower(trim(v_user_email))",
    );
  });

  it("treats blank legacy target values as untargeted", () => {
    expect(migration).toContain(
      "nullif(trim(a.target_ministry), '') is null",
    );
    expect(migration).toContain(
      "nullif(trim(a.target_community), '') is null",
    );
  });
});
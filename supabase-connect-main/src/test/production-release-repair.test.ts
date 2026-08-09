import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migration = (name: string) =>
  readFileSync(resolve(process.cwd(), "supabase", "migrations", name), "utf8");

describe("production release repair migrations", () => {
  it("cleans only the seed-shaped legacy profile and never creates an account", () => {
    const sql = migration("20260720120000_remove_legacy_admin_profile_side_effect.sql");

    expect(sql).toContain("delete from public.profiles");
    expect(sql).toContain("p.role = 'member'");
    expect(sql).toContain("p.full_name is null");
    expect(sql).toContain("p.church_id is null");
    expect(sql).toContain("not exists");
    expect(sql).not.toMatch(/insert\s+into\s+(auth\.users|public\.profiles)/i);
  });

  it("validates the Bible constraint proven clean by the restored-production rehearsal", () => {
    const sql = migration("20260720121000_validate_bible_verse_chapter_constraint.sql");

    expect(sql).toMatch(
      /alter table public\.bible_verses\s+validate constraint bible_verses_chapter_fk_matches_book/i,
    );
  });

  it("keeps prayer validation with the migration that creates its constraint", () => {
    const sql = migration("20260720121100_validate_prayer_published_body_constraint.sql");

    expect(sql).toContain("20260718120000_expand_catholic_prayer_library.sql");
    expect(sql).toMatch(
      /alter table public\.content_prayers\s+validate constraint content_prayers_published_body_check/i,
    );
  });

  it("pins the exact SECURITY DEFINER overload search path without replacing its body", () => {
    const sql = migration("20260720122000_fix_assign_default_member_role_search_path.sql");

    expect(sql).toMatch(
      /alter function public\.assign_default_member_role\(uuid, text\)\s+set search_path = public, pg_temp/i,
    );
    expect(sql).not.toMatch(/create\s+(or\s+replace\s+)?function/i);
  });
});

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  join(process.cwd(), "supabase/migrations/20260907130000_get_member_daily_reading.sql"),
  "utf8",
);

const normalized = migration.replace(/\s+/g, " ").toLowerCase();

const legacyMigrations = [
  "supabase/migrations/20260624142500_create_daily_readings_bible_references.sql",
  "supabase/migrations/20260630110000_create_liturgical_platform_foundation.sql",
  "supabase/migrations/20260701090000_relax_legacy_daily_readings_date.sql",
].map((path) => readFileSync(join(process.cwd(), path), "utf8").toLowerCase()).join("\n");

const migrationBackedDailyReadingsColumns = new Set([
  "id",
  "reading_date",
  "liturgical_season",
  "first_reading",
  "psalm",
  "second_reading",
  "gospel",
  "reflection",
  "prayer",
  "is_published",
  "created_at",
  "updated_at",
  "liturgical_day_id",
  "first_reading_reference",
  "responsorial_psalm_reference",
  "psalm_response",
  "second_reading_reference",
  "gospel_acclamation",
  "gospel_reference",
]);

describe("canonical member Daily Readings RPC contract", () => {
  it("creates the authenticated hardened RPC boundary", () => {
    expect(normalized).toContain("create or replace function public.get_member_daily_reading(p_reading_date date)");
    expect(normalized).toContain("returns table");
    expect(normalized).toContain("stable");
    expect(normalized).toContain("security definer");
    expect(normalized).toContain("set search_path = public, pg_temp");
    expect(normalized).toContain("if v_actor is null then");
    expect(normalized).toContain("raise exception 'authentication required' using errcode = '42501'");
    expect(normalized).toContain("revoke all on function public.get_member_daily_reading(date) from public");
    expect(normalized).toContain("revoke all on function public.get_member_daily_reading(date) from anon");
    expect(normalized).toContain("grant execute on function public.get_member_daily_reading(date) to authenticated");
  });

  it("enforces member-safe CMS publication, visibility, and supplied date", () => {
    expect(normalized).toContain("from public.content_daily_readings cdr");
    expect(normalized).toContain("where cdr.reading_date = p_reading_date");
    expect(normalized).toContain("cdr.status in ('published', 'featured')");
    expect(normalized).toContain("cdr.visibility in ('public', 'member')");
    expect(normalized).not.toMatch(/cdr\.status\s+in\s+\([^)]*draft|cdr\.status\s+in\s+\([^)]*review|cdr\.status\s+in\s+\([^)]*archived/);
    expect(normalized).not.toContain("cdr.visibility in ('public', 'member', 'pastoral'");
    expect(normalized).not.toContain("cdr.visibility in ('public', 'member', 'admin'");
  });

  it("orders language before publication, then ties deterministically", () => {
    expect(normalized).toContain("when cl.code = 'sw' then 1");
    expect(normalized).toContain("when cl.code = 'en' then 2");
    expect(normalized).toContain("when cdr.language_id is null then 3");
    expect(normalized).toMatch(/when cl\.code = 'sw' then 1[\s\S]*when cdr\.status = 'featured' then 1/);
    expect(normalized).toContain("cdr.updated_at desc");
    expect(normalized).toContain("cdr.created_at desc");
    expect(normalized).toContain("cdr.id asc");
    expect(normalized).toContain("limit 1");
  });

  it("uses liturgical days as optional authoritative metadata", () => {
    expect(normalized).toContain("left join public.liturgical_days ld on ld.date = cdr.reading_date");
    expect(normalized).toContain("coalesce(nullif(ld.season, ''), nullif(cdr.liturgical_season, ''))");
    expect(normalized).toContain("coalesce(nullif(ld.celebration, ''), nullif(cdr.celebration, ''))");
  });

  it("keeps temporary legacy compatibility explicit and published-only", () => {
    expect(normalized).toContain("legacy_candidate as");
    expect(normalized).toContain("from public.daily_readings dr");
    expect(normalized).toContain("where dr.reading_date = p_reading_date");
    expect(normalized).toContain("dr.is_published = true");
    expect(normalized).toContain("not exists (select 1 from cms_candidate)");
    expect(normalized).toContain("'legacy'::text as source");
    expect(normalized).toContain("null::text as language_code");
    expect(normalized).toContain("'published'::text as status");
    expect(normalized).toContain("order by dr.updated_at desc, dr.id asc");
  });

  it("references only migration-backed legacy daily_readings columns", () => {
    expect(legacyMigrations).toContain("create table if not exists public.daily_readings");
    expect(legacyMigrations).toContain("add column if not exists liturgical_day_id");

    const referencedColumns = Array.from(migration.matchAll(/\bdr\.([a-z_]+)/g), (match) => match[1]);
    expect(new Set(referencedColumns)).toEqual(
      new Set(referencedColumns.filter((column) => migrationBackedDailyReadingsColumns.has(column))),
    );
    expect(referencedColumns).not.toContain("language_code");
    expect(referencedColumns).not.toContain("status");
    expect(referencedColumns).not.toContain("celebration");
    expect(referencedColumns).not.toContain("liturgical_year");
    expect(referencedColumns).not.toContain("weekday_cycle");
    expect(referencedColumns).not.toContain("liturgical_color");
  });

  it("does not reintroduce an ambiguous legacy liturgical OR join", () => {
    expect(normalized).toContain("left join public.liturgical_days ld on ld.id = dr.liturgical_day_id");
    expect(normalized).not.toMatch(/ld\.id = dr\.liturgical_day_id\s+or\s+ld\.date = dr\.reading_date/);
  });

  it("marks CMS as reference-only and avoids invented scripture or translation metadata", () => {
    expect(normalized).toContain("true as is_reference_only");
    expect(normalized).toContain("'cms'::text as source");
    expect(normalized).toContain("cib.source_organization");
    expect(normalized).toContain("cib.source_publication");
    expect(normalized).not.toMatch(/scripture_text|translation_version|bible_translation_code/);
  });
});

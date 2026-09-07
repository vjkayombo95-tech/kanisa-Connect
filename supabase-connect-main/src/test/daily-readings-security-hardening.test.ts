import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const legacyMigration = readFileSync(
  join(root, "supabase/migrations/20260624142500_create_daily_readings_bible_references.sql"),
  "utf8",
);
const liturgicalMigration = readFileSync(
  join(root, "supabase/migrations/20260630110000_create_liturgical_platform_foundation.sql"),
  "utf8",
);
const cmsMigration = readFileSync(
  join(root, "supabase/migrations/20260704110000_create_cms_daily_readings.sql"),
  "utf8",
);
const hardeningMigration = readFileSync(
  join(root, "supabase/migrations/20260907120000_harden_legacy_daily_readings_visibility.sql"),
  "utf8",
);

function normalizeSql(sql: string) {
  return sql.replace(/\s+/g, " ").trim();
}

function normalizeSqlLower(sql: string) {
  return normalizeSql(sql).toLowerCase();
}

function policyBody(sql: string, policyName: string) {
  const escapedName = policyName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = sql.match(new RegExp(`CREATE POLICY "${escapedName}"[\\s\\S]*?(?=\\n\\s*(?:DROP POLICY|CREATE POLICY|GRANT|ALTER TABLE|$))`, "i"));
  return normalizeSql(match?.[0] ?? "");
}

const publishedLegacySelectPolicy = policyBody(legacyMigration, "Authenticated users view published daily readings");
const legacyPassagesSelectPolicy = policyBody(legacyMigration, "Authenticated users view published daily reading passages");
const cmsDailyReadingsSelectPolicy = policyBody(cmsMigration, "Authenticated users can read published CMS daily readings");
const insertDailyReadingsPolicy = policyBody(liturgicalMigration, "Super admins can insert daily readings");
const updateDailyReadingsPolicy = policyBody(liturgicalMigration, "Super admins can update daily readings");
const deleteDailyReadingsPolicy = policyBody(liturgicalMigration, "Super admins can delete daily readings");

describe("daily readings legacy visibility hardening", () => {
  it("removes only the broad legacy daily_readings member SELECT policy", () => {
    expect(normalizeSql(hardeningMigration)).toBe(
      'DROP POLICY IF EXISTS "Authenticated users can read daily readings" ON public.daily_readings;',
    );
    expect(hardeningMigration).not.toMatch(/CREATE\s+POLICY/i);
    expect(hardeningMigration).not.toMatch(/ALTER\s+TABLE/i);
    expect(hardeningMigration).not.toMatch(/GRANT\s+|REVOKE\s+/i);
    expect(hardeningMigration).not.toMatch(/CREATE\s+(?:OR\s+REPLACE\s+)?FUNCTION|CREATE\s+TRIGGER|INSERT\s+INTO|UPDATE\s+public|DELETE\s+FROM/i);
  });

  it("keeps the guaranteed published-only legacy SELECT policy as the member read contract", () => {
    const policy = normalizeSqlLower(publishedLegacySelectPolicy);

    expect(legacyMigration).toMatch(/create policy "Authenticated users view published daily readings"/i);
    expect(policy).toContain("on public.daily_readings");
    expect(policy).toContain("for select");
    expect(policy).toContain("to authenticated");
    expect(policy).toContain("using (is_published = true)");
    expect(hardeningMigration).not.toContain('DROP POLICY IF EXISTS "Authenticated users view published daily readings"');
  });

  it("preserves super-admin write policies on legacy daily_readings", () => {
    for (const policy of [insertDailyReadingsPolicy, updateDailyReadingsPolicy, deleteDailyReadingsPolicy]) {
      const normalizedPolicy = normalizeSqlLower(policy);

      expect(normalizedPolicy).toContain("on public.daily_readings");
      expect(normalizedPolicy).toContain("to authenticated");
      expect(policy).toContain("public.is_super_admin()");
    }
    expect(normalizeSqlLower(insertDailyReadingsPolicy)).toContain("for insert");
    expect(normalizeSqlLower(insertDailyReadingsPolicy)).toContain("with check (public.is_super_admin())");
    expect(normalizeSqlLower(updateDailyReadingsPolicy)).toContain("for update");
    expect(normalizeSqlLower(updateDailyReadingsPolicy)).toContain("using (public.is_super_admin())");
    expect(normalizeSqlLower(updateDailyReadingsPolicy)).toContain("with check (public.is_super_admin())");
    expect(normalizeSqlLower(deleteDailyReadingsPolicy)).toContain("for delete");
    expect(normalizeSqlLower(deleteDailyReadingsPolicy)).toContain("using (public.is_super_admin())");
  });

  it("leaves daily_reading_passages restricted to published parent readings", () => {
    const policy = normalizeSqlLower(legacyPassagesSelectPolicy);

    expect(policy).toContain("on public.daily_reading_passages");
    expect(policy).toContain("for select");
    expect(policy).toContain("to authenticated");
    expect(policy).toContain("from public.daily_readings dr");
    expect(policy).toContain("dr.id = daily_reading_passages.daily_reading_id");
    expect(policy).toContain("dr.is_published = true");
    expect(hardeningMigration).not.toMatch(/daily_reading_passages/i);
  });

  it("leaves CMS daily readings published and featured member visibility untouched", () => {
    const policy = normalizeSqlLower(cmsDailyReadingsSelectPolicy);

    expect(policy).toContain("on public.content_daily_readings");
    expect(policy).toContain("for select to authenticated");
    expect(policy).toContain("status in ('published', 'featured')");
    expect(policy).toContain("public.is_platform_super_admin(auth.uid())");
    expect(policy).toContain("public.is_super_admin(auth.uid())");
    expect(hardeningMigration).not.toMatch(/content_daily_readings/i);
  });
});

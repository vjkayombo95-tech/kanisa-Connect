import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const cmsMigration = readFileSync(
  join(root, "supabase/migrations/20260704110000_create_cms_daily_readings.sql"),
  "utf8",
);
const hardeningMigration = readFileSync(
  join(root, "supabase/migrations/20260907140000_harden_daily_readings_member_visibility.sql"),
  "utf8",
);
const canonicalRpcMigration = readFileSync(
  join(root, "supabase/migrations/20260907130000_get_member_daily_reading.sql"),
  "utf8",
);
const legacyHardeningMigration = readFileSync(
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
  const match = sql.match(
    new RegExp(`create policy "${escapedName}"[\\s\\S]*?(?=\\n\\s*(?:drop policy|create policy|grant|revoke|alter table|comment on|$))`, "i"),
  );
  return normalizeSql(match?.[0] ?? "");
}

const originalMemberPolicy = policyBody(cmsMigration, "Authenticated users can read published CMS daily readings");
const replacementMemberPolicy = policyBody(hardeningMigration, "Authenticated users can read member-visible CMS daily readings");
const superAdminManagePolicy = policyBody(cmsMigration, "Super admins manage CMS daily readings");

function ordinaryMemberCanSelect(status: string, visibility: string) {
  return ["published", "featured"].includes(status) && ["public", "member"].includes(visibility);
}

describe("daily readings CMS direct visibility hardening", () => {
  it("replaces the vulnerable status-only authenticated SELECT policy", () => {
    const original = normalizeSqlLower(originalMemberPolicy);
    const replacement = normalizeSqlLower(replacementMemberPolicy);

    expect(original).toContain("on public.content_daily_readings for select to authenticated");
    expect(original).toContain("status in ('published', 'featured')");
    expect(original).not.toContain("visibility in ('public', 'member')");
    expect(original).toContain("public.is_platform_super_admin(auth.uid())");
    expect(original).toContain("public.is_super_admin(auth.uid())");

    expect(normalizeSqlLower(hardeningMigration)).toContain(
      'drop policy if exists "authenticated users can read published cms daily readings" on public.content_daily_readings',
    );
    expect(replacement).toContain("on public.content_daily_readings");
    expect(replacement).toContain("for select");
    expect(replacement).toContain("to authenticated");
  });

  it("requires canonical publication status and member-safe visibility for ordinary authenticated reads", () => {
    const policy = normalizeSqlLower(replacementMemberPolicy);

    expect(policy).toContain("status in ('published', 'featured')");
    expect(policy).toContain("visibility in ('public', 'member')");
    expect(policy).not.toMatch(/visibility\s+in\s+\([^)]*pastoral/);
    expect(policy).not.toMatch(/visibility\s+in\s+\([^)]*admin/);
    expect(policy).not.toMatch(/status\s+in\s+\([^)]*draft|status\s+in\s+\([^)]*review|status\s+in\s+\([^)]*archived/);
    expect(hardeningMigration).not.toMatch(/to\s+anon/i);
    expect(hardeningMigration).not.toMatch(/grant\s+/i);
  });

  it("preserves the separate super-admin management path", () => {
    const policy = normalizeSqlLower(superAdminManagePolicy);

    expect(policy).toContain("on public.content_daily_readings for all to authenticated");
    expect(policy).toContain("using (public.is_platform_super_admin(auth.uid()) or public.is_super_admin(auth.uid()))");
    expect(policy).toContain("with check (public.is_platform_super_admin(auth.uid()) or public.is_super_admin(auth.uid()))");
    expect(hardeningMigration).not.toContain('DROP POLICY IF EXISTS "Super admins manage CMS daily readings"');
  });

  it("has no broad replacement SELECT policy that undermines visibility filtering", () => {
    const policyCreations = Array.from(
      hardeningMigration.matchAll(/create\s+policy\s+"([^"]+)"[\s\S]*?(?=\n\s*(?:drop policy|create policy|grant|revoke|alter table|comment on|$))/gi),
      (match) => normalizeSqlLower(match[0]),
    );

    expect(policyCreations).toHaveLength(1);
    expect(policyCreations[0]).toContain("for select");
    expect(policyCreations[0]).toContain("status in ('published', 'featured')");
    expect(policyCreations[0]).toContain("visibility in ('public', 'member')");
    expect(policyCreations[0]).not.toMatch(/using\s*\(\s*true\s*\)/);
    expect(policyCreations[0]).not.toMatch(/public\.is_super_admin|public\.is_platform_super_admin/);
  });

  it("documents the intended ordinary authenticated effective SELECT contract", () => {
    expect(ordinaryMemberCanSelect("published", "public")).toBe(true);
    expect(ordinaryMemberCanSelect("featured", "public")).toBe(true);
    expect(ordinaryMemberCanSelect("published", "member")).toBe(true);
    expect(ordinaryMemberCanSelect("featured", "member")).toBe(true);
    expect(ordinaryMemberCanSelect("published", "pastoral")).toBe(false);
    expect(ordinaryMemberCanSelect("featured", "pastoral")).toBe(false);
    expect(ordinaryMemberCanSelect("published", "admin")).toBe(false);
    expect(ordinaryMemberCanSelect("featured", "admin")).toBe(false);
    expect(ordinaryMemberCanSelect("draft", "public")).toBe(false);
    expect(ordinaryMemberCanSelect("review", "member")).toBe(false);
    expect(ordinaryMemberCanSelect("archived", "public")).toBe(false);
  });

  it("does not alter the canonical RPC or legacy hardening migration", () => {
    expect(canonicalRpcMigration).toContain("create or replace function public.get_member_daily_reading(p_reading_date date)");
    expect(canonicalRpcMigration).toContain("cdr.visibility in ('public', 'member')");
    expect(canonicalRpcMigration).toContain("grant execute on function public.get_member_daily_reading(date) to authenticated");
    expect(normalizeSql(legacyHardeningMigration)).toBe(
      'DROP POLICY IF EXISTS "Authenticated users can read daily readings" ON public.daily_readings;',
    );
  });
});

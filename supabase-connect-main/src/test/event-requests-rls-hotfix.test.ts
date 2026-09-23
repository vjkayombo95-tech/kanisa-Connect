import { readdirSync, readFileSync } from "fs";
import { join } from "path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const read = (path: string) => readFileSync(join(root, path), "utf8");

const hotfixName = "20260921150000_fix_event_request_staff_policy_permissions.sql";
const hotfix = read(`supabase/migrations/${hotfixName}`);
const migrations = readdirSync(join(root, "supabase", "migrations")).filter((name) => name.endsWith(".sql")).sort();

function normalizedSql(value: string) {
  return value.replace(/\s+/g, " ").toLowerCase();
}

function executableSql(value: string) {
  return value
    .split("\n")
    .filter((line) => !line.trim().startsWith("--"))
    .join("\n");
}

describe("event_requests Production RLS hotfix", () => {
  it("is ordered after the deployed compatibility migration and before incompatible Wave 23D", () => {
    expect(migrations.indexOf("20260921140000_event_request_permission_compat.sql")).toBeLessThan(
      migrations.indexOf(hotfixName),
    );
    expect(migrations.indexOf(hotfixName)).toBeLessThan(
      migrations.indexOf("20260922120000_fix_event_request_staff_rls.sql"),
    );
    expect(normalizedSql(hotfix)).toContain("all pending migrations while wave 23d remains pending");
  });

  it("replaces only the two staff event_requests policies and preserves member policies", () => {
    expect(hotfix).toContain('drop policy if exists "Church staff can read permitted event requests"');
    expect(hotfix).toContain('drop policy if exists "Church staff can review permitted event requests"');
    expect(hotfix).toContain('create policy "Church staff can read permitted event requests"');
    expect(hotfix).toContain('create policy "Church staff can review permitted event requests"');
    expect(hotfix).not.toContain('"Members can read own event requests"');
    expect(hotfix).not.toContain('"Members can create own event requests"');
    expect(hotfix).not.toMatch(/create\s+(or\s+replace\s+)?function/i);
    expect(hotfix).not.toMatch(/create\s+trigger|drop\s+trigger/i);
  });

  it("uses the existing SECURITY DEFINER feature-permission helper instead of direct permission-table access", () => {
    const sql = normalizedSql(executableSql(hotfix));

    expect(sql).toContain("public.has_church_feature_permission(");
    expect(sql).toContain("'event_requests'");
    expect(sql).toContain("'view'");
    expect(sql).toContain("'edit'");
    expect(sql).not.toContain("church_role_permissions");
    expect(sql).not.toContain("platform_features");
    expect(sql).not.toMatch(/grant\s+select/);
    expect(sql).not.toContain("has_event_request_staff_permission");
    expect(sql).not.toContain("enforce_feature_mutation_permission");
  });

  it("keeps staff access tenant-scoped and excludes member roles from staff policies", () => {
    const sql = normalizedSql(hotfix);

    expect(sql).toContain("from public.user_roles ur");
    expect(sql).toContain("ur.user_id = auth.uid()");
    expect(sql).toContain("ur.church_id = event_requests.church_id");
    expect(sql).toContain("lower(coalesce(ur.role::text, '')) <> 'member'");
  });

  it("keeps read and update semantics aligned with the deployed Production policies", () => {
    const sql = normalizedSql(hotfix);

    expect(sql).toMatch(/for select[\s\S]*public\.has_church_feature_permission\(\s*auth\.uid\(\),\s*church_id,\s*'event_requests',\s*'view'\s*\)/);
    expect(sql).toMatch(/for update[\s\S]*using \([\s\S]*public\.has_church_feature_permission\(\s*auth\.uid\(\),\s*church_id,\s*'event_requests',\s*'edit'\s*\)/);
    expect(sql).toMatch(/with check \([\s\S]*public\.has_church_feature_permission\(\s*auth\.uid\(\),\s*church_id,\s*'event_requests',\s*'edit'\s*\)/);
  });
});

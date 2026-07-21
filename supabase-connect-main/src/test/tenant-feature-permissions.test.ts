import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");
const initial = read("supabase/migrations/20260721120000_tenant_feature_permissions.sql");
const hardened = read("supabase/migrations/20260721130000_harden_tenant_feature_permissions.sql");
const migrations = `${initial}\n${hardened}`;
const featureHook = read("src/hooks/use-feature-access.ts");
const permissionHook = read("src/hooks/use-church-permission.ts");
const routeLayout = read("src/routes/WorkspaceRouteLayout.tsx");
const routeMetadata = read("src/lib/workspace-route-permissions.ts");
const workspaceFramework = read("src/components/workspace/framework.tsx");
const page = read("src/pages/church-admin/FeaturesPermissionsPage.tsx");
const superAdminPage = read("src/pages/super-admin/FeatureManagement.tsx");

describe("tenant feature permission security boundary", () => {
  it("is forward-only and provisions explicit rows for churches, features, and roles", () => {
    expect(hardened.replace(/--.*$/gm, "")).not.toMatch(/drop\s+(table|column)\b/i);
    expect(hardened).toContain("provision_church_feature_permissions");
    expect(hardened).toContain("provision_new_platform_feature");
    expect(hardened).toContain("provision_new_church_role");
  });

  it("denies anonymous, unknown, missing-row, and missing-subscription access", () => {
    expect(hardened).toContain("if v_actor is null");
    expect(hardened).toContain("if not found then return false");
    expect(hardened).toContain("join lateral");
    expect(hardened).not.toContain("'free' = any(pf.available_plans)");
    expect(hardened).toContain("coalesce(cf.enabled, false)");
    expect(featureHook).toContain("churchOverride?.enabled === true");
    expect(featureHook).toContain("subscriptionPlan !== null");
  });

  it("does not trust a caller-supplied user id", () => {
    expect(hardened).toContain("_user_id <> v_actor");
    expect(hardened).toContain("public.is_platform_super_admin(v_actor)");
  });

  it("keeps the recovery capability mandatory and protects the last Church Admin", () => {
    expect(hardened).toContain("feature_permissions_admin");
    expect(hardened).toContain("Mandatory recovery feature cannot be disabled");
    expect(hardened).toContain("protect_last_church_admin");
    expect(page).toContain('row.feature_key === "feature_permissions_admin"');
  });

  it("uses lifecycle actions for mutation paths while preserving permissive row ownership", () => {
    expect(migrations).toContain("as restrictive");
    expect(hardened).toContain("enforce_feature_mutation_permission");
    expect(hardened).toContain("v_action := 'publish'");
    expect(hardened).toContain("v_action := 'approve'");
    expect(hardened).toContain("drop policy if exists %I");
  });

  it("restricts SECURITY DEFINER search paths and function grants", () => {
    expect(hardened).toContain("set search_path = pg_catalog, public");
    expect(hardened).toContain("from public, anon, authenticated");
    expect(hardened).toContain("grant execute on function public.has_church_feature_permission");
  });

  it("protects route content until an explicit route permission resolves", () => {
    expect(routeLayout).toContain("getWorkspaceRoutePermission");
    expect(routeLayout).toContain("permission.isLoading");
    expect(routeMetadata).toContain("/portal/contribution-receipt/");
    expect(routeMetadata).toContain("feature_permissions_admin");
  });

  it("uses authoritative route permissions when filtering workspace navigation", () => {
    expect(workspaceFramework).toContain("getWorkspaceRoutePermission");
    expect(workspaceFramework).toContain('supabase.rpc("has_church_feature_permission"');
    expect(workspaceFramework).toContain('queries[index]?.data === true');
  });

  it("invalidates permission decisions across sessions", () => {
    expect(permissionHook).toContain('table: "church_features"');
    expect(permissionHook).toContain('table: "church_role_permissions"');
    expect(hardened).toContain("alter publication supabase_realtime add table");
  });

  it("resets Super Admin overrides to explicit rows instead of deleting them", () => {
    expect(superAdminPage).toContain('from("church_features").upsert');
    expect(superAdminPage).not.toContain('from("church_features").delete()');
  });

  it("exposes accessible controls and explicit plan mappings", () => {
    expect(page).toContain("aria-label");
    expect(page).toContain("Reset to Recommended Defaults");
    expect(hardened).toContain("Explicit plan mapping");
  });
});

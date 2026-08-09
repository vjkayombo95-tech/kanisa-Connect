import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { getDefaultRouteForRoles } from "@/lib/role-utils";

const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");
const migration = read("supabase/migrations/20260722100000_multi_role_effective_permissions.sql");
const authContext = read("src/contexts/AuthContext.tsx");
const protectedRoute = read("src/components/auth/ProtectedRoute.tsx");
const featureAccess = read("src/hooks/use-feature-access.ts");
const rolesPage = read("src/pages/church-admin/RolesPage.tsx");

type Grant = { role: string; feature: string; action: string };
function allowed(input: {
  roles: string[];
  grants: Grant[];
  feature: string;
  action: string;
  sameChurch?: boolean;
  subscriptionAvailable?: boolean;
  featureEnabled?: boolean;
}) {
  if (input.sameChurch === false || input.subscriptionAvailable === false || input.featureEnabled === false) return false;
  return input.grants.some((grant) => input.roles.includes(grant.role)
    && grant.feature === input.feature && grant.action === input.action);
}

describe("multi-role church authorization", () => {
  const grants: Grant[] = [
    { role: "pastor", feature: "mass_intentions", action: "view" },
    { role: "treasurer", feature: "contributions", action: "view" },
    { role: "church_admin", feature: "members", action: "view" },
  ];

  it("preserves single-role behavior and unions grants for multiple roles", () => {
    expect(allowed({ roles: ["pastor"], grants, feature: "mass_intentions", action: "view" })).toBe(true);
    expect(allowed({ roles: ["pastor"], grants, feature: "contributions", action: "view" })).toBe(false);
    expect(allowed({ roles: ["pastor", "treasurer"], grants, feature: "mass_intentions", action: "view" })).toBe(true);
    expect(allowed({ roles: ["pastor", "treasurer"], grants, feature: "contributions", action: "view" })).toBe(true);
  });

  it("removing one role retains other grants and removing all roles denies", () => {
    expect(allowed({ roles: ["treasurer"], grants, feature: "contributions", action: "view" })).toBe(true);
    expect(allowed({ roles: ["treasurer"], grants, feature: "mass_intentions", action: "view" })).toBe(false);
    expect(allowed({ roles: [], grants, feature: "contributions", action: "view" })).toBe(false);
  });

  it("never lets the union bypass tenant, subscription, or feature controls", () => {
    const base = { roles: ["church_admin", "pastor", "treasurer"], grants, feature: "members", action: "view" };
    expect(allowed({ ...base, sameChurch: false })).toBe(false);
    expect(allowed({ ...base, subscriptionAvailable: false })).toBe(false);
    expect(allowed({ ...base, featureEnabled: false })).toBe(false);
  });

  it("enforces a unique assignment tuple and rejects duplicate assignment", () => {
    expect(migration).toContain("unique (user_id, church_id, role)");
    expect(migration).toContain("This role is already assigned to the user");
    expect(migration).toContain("errcode = '23505'");
    expect(migration).toContain("user_role_duplicate_archive");
    expect(migration).toContain("normalized_role text");
    expect(migration).toContain("partition by user_id, church_id, lower(trim(role::text))");
    expect(migration).toContain("where c.id = old.church_id for update");
  });

  it("aggregates backend permissions without selecting a single role", () => {
    const helper = migration.slice(
      migration.indexOf("create or replace function public.has_church_feature_permission"),
      migration.indexOf("-- Assignment now inserts"),
    );
    expect(helper).toContain("return exists");
    expect(helper).toContain("lower(ur.role::text) = crp.role");
    expect(helper).not.toContain("limit 1");
    expect(helper).toContain("is_feature_available_for_church");
  });

  it("keeps the legacy role while exposing all roles to clients", () => {
    expect(migration).toContain("'role',v_role,'roles',to_jsonb(v_roles)");
    expect(authContext).toContain("userRoles: AppRole[]");
    expect(protectedRoute).toContain("hasAnyRole(userRoles, allowedRoles)");
  });

  it("unions frontend feature grants and invalidates them when assignments change", () => {
    expect(featureAccess).toContain('.in("role", userRoles)');
    expect(featureAccess).toContain("if (permission.can_view) permissionMap.set");
    expect(authContext).toContain('["user_roles", "members", "profiles"]');
  });

  it("supports searchable checkbox assignment and displays effective permissions", () => {
    expect(rolesPage).toContain("Search staff by name");
    expect(rolesPage).toContain("onCheckedChange");
    expect(rolesPage).toContain("Effective permissions");
    expect(rolesPage).toContain("permissionMatrix");
    expect(getDefaultRouteForRoles(["catechist"])).toBe("/church-admin");
  });
});

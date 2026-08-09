import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  CHURCHES,
  CREDENTIALS_PATH,
  KNOWN_STAGING_PROJECT_REF,
  PERSONAS,
  assertStagingGuard,
  isManagedEmail,
  permissionSeedFor,
} from "../../scripts/uat/bootstrap-multi-role-uat";

const source = readFileSync(path.resolve("scripts/uat/bootstrap-multi-role-uat.ts"), "utf8");
const gitignore = readFileSync(path.resolve(".gitignore"), "utf8");

const validGuard = {
  branch: "staging",
  supabaseUrl: `https://${KNOWN_STAGING_PROJECT_REF}.supabase.co`,
  linkedProjectRef: KNOWN_STAGING_PROJECT_REF,
  expectedProjectRef: KNOWN_STAGING_PROJECT_REF,
  hasServiceRoleKey: true,
  serviceRoleClaim: "service_role",
  hasAnonKey: true,
  appEnv: "staging",
};

describe("multi-role staging UAT bootstrap", () => {
  it("accepts only the known linked staging project and staging branch", () => {
    expect(() => assertStagingGuard(validGuard)).not.toThrow();
    expect(() => assertStagingGuard({ ...validGuard, branch: "main" })).toThrow(/Git branch must be staging/);
    expect(() => assertStagingGuard({ ...validGuard, linkedProjectRef: "production-ref" })).toThrow(/Linked Supabase project/);
    expect(() => assertStagingGuard({ ...validGuard, serviceRoleClaim: "anon" })).toThrow(/service_role/);
  });

  it("aborts immediately for a production or unknown Supabase URL", () => {
    expect(() => assertStagingGuard({ ...validGuard, supabaseUrl: "https://production-ref.supabase.co" })).toThrow(/not the known Kanisa Connect staging project/);
    expect(() => assertStagingGuard({ ...validGuard, supabaseUrl: "https://example.com" })).toThrow(/not the known Kanisa Connect staging project/);
  });

  it("defines unique controlled personas and preserves multiple role rows", () => {
    expect(new Set(PERSONAS.map((persona) => persona.email)).size).toBe(PERSONAS.length);
    expect(PERSONAS.find((persona) => persona.key === "multi_role")?.roles).toEqual(["church_admin", "pastor", "treasurer"]);
    expect(source).toContain('onConflict: "user_id,church_id,role"');
    expect(source).not.toMatch(/from\("user_roles"\)[\s\S]{0,200}\.single\(\)/);
  });

  it("uses the reviewed permission seed behavior instead of inventing grants", () => {
    const staffFeature = { key: "members", member_available: false, staff_available: true };
    expect(permissionSeedFor("church_admin", staffFeature)).toMatchObject({ can_view: true, can_manage: true });
    expect(permissionSeedFor("secretary", staffFeature)).toMatchObject({ can_view: true, can_create: true, can_edit: true, can_manage: false });
    expect(permissionSeedFor("member", staffFeature)).toMatchObject({ can_view: false, can_create: false });
  });

  it("defines the mutation actions that staging RLS must honor for operational roles", () => {
    const eventPermissions = permissionSeedFor("secretary", { key: "events", member_available: true, staff_available: true });
    expect(eventPermissions).toMatchObject({
      can_create: true,
      can_edit: true,
      can_delete: true,
      can_publish: true,
      can_manage: true,
    });

    const announcementPermissions = permissionSeedFor("secretary", { key: "announcements", member_available: true, staff_available: true });
    expect(announcementPermissions).toMatchObject({
      can_create: true,
      can_edit: true,
      can_delete: true,
      can_publish: true,
    });

    const massIntentionPermissions = permissionSeedFor("pastor", { key: "mass_intentions", member_available: true, staff_available: true });
    expect(massIntentionPermissions).toMatchObject({
      can_create: true,
      can_edit: true,
      can_approve: true,
      can_manage: true,
    });
  });

  it("keeps reset scoped to reserved churches and managed persona emails", () => {
    expect(CHURCHES.map((church) => church.slug)).toEqual(["kanisa-connect-uat", "kanisa-connect-uat-expired", "kanisa-connect-uat-other"]);
    expect(isManagedEmail("uat.admin@kanisaconnect.test")).toBe(true);
    expect(isManagedEmail("unrelated@kanisaconnect.test")).toBe(false);
    expect(source).toContain("Reset refused:");
    expect(source).toContain("preserve the final Church Admin invariant");
    expect(source).toContain("Auth deletion is blocked by non-UAT database references");
    expect(source).not.toContain('for (const table of ["church_role_permissions", "church_features", "subscriptions"]');
  });

  it("keeps credentials local and contains no tracked persona passwords", () => {
    expect(CREDENTIALS_PATH).toBe("evaluation/uat/.uat-credentials.local.json");
    expect(gitignore).toContain(CREDENTIALS_PATH);
    expect(source).toContain("UAT_TEST_PASSWORD");
    expect(source).toContain("randomBytes");
    expect(source).not.toMatch(/password:\s*["']Staging/);
  });

  it("resolves Git context portably without machine-specific safe-directory overrides", () => {
    expect(source).toContain('`safe.directory=${candidate}`');
    expect(source).toContain('"rev-parse", "--show-toplevel"');
    expect(source).toContain("cwd: repositoryRoot");
    expect(source).not.toContain(["C:", "Users"].join("/"));
  });
});

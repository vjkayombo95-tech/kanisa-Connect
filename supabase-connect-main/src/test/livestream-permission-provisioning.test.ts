import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");
const migration = read("supabase/migrations/20260808140000_provision_livestream_permissions.sql");
const superAdminPage = read("src/pages/super-admin/FeatureManagement.tsx");

describe("livestream permission provisioning", () => {
  it("registers only the supported livestream permission actions", () => {
    expect(migration).toContain("'operations','livestream'");
    expect(migration).toContain("'audio_processing','livestream'");
    expect(migration).toContain("'notifications','audio_processing','livestream'");
    expect(migration).toContain(
      "'mass_intentions','sacraments','community_help'\n    )\n    when 'publish'",
    );
  });

  it("repairs and marks only already-enabled livestream churches", () => {
    expect(migration).toMatch(/pf\.key = 'livestream'[\s\S]*?where cf\.enabled/);
    expect(migration).toContain("church_feature_default_provisioning");
    expect(migration).toContain("on conflict (church_id, feature_id) do nothing");
  });

  it("requires platform authority for atomic activation and audits the result", () => {
    expect(migration).toContain("public.is_platform_super_admin(v_actor) or public.is_super_admin(v_actor)");
    expect(migration).toContain("defaults_provisioned");
    expect(migration).toContain("church_feature.super_admin_enabled");
    expect(migration).toContain("grant execute on function public.set_super_admin_church_feature");
  });

  it("keeps the permission save RPC authoritative against self-elevation", () => {
    expect(migration).toContain("not public.has_church_feature_permission(auth.uid(), _church_id, v_key, v_action)");
    expect(migration).toContain("Cannot grant permission above your own authority");
    expect(migration).toContain("You cannot delegate a permission above your own authority.");
    expect(migration).toContain("Permission denied for this church");
  });

  it("routes every Super Admin livestream enable path through the atomic RPC", () => {
    expect(superAdminPage).toContain('supabase.rpc("set_super_admin_church_feature"');
    expect(superAdminPage).toContain('feature.key !== "livestream"');
    expect(superAdminPage).toContain('f.key === "livestream"');
  });
});

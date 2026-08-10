import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { getWorkspaceRoutePermission } from "@/lib/workspace-route-permissions";

const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");
const repair = read("supabase/migrations/20260810130000_repair_radio_feature_activation.sql");
const rollout = read("supabase/migrations/20260810120000_add_church_live_radio.sql");
const provisioning = read("supabase/migrations/20260721130000_harden_tenant_feature_permissions.sql");

describe("Radio feature activation repair", () => {
  it("repairs only disabled Radio feature rows without changing lock or subscription state", () => {
    expect(repair).toContain("update public.church_features cf");
    expect(repair).toContain("pf.key = 'radio'");
    expect(repair).toContain("cf.enabled is distinct from true");
    expect(repair).toContain("enabled_at = coalesce(cf.enabled_at, now())");
    expect(repair).toContain("updated_at = now()");
    expect(repair).not.toMatch(/(?:^|\s)blocked\s*=/i);
    expect(repair).not.toMatch(/(?:^|\s)locked\s*=/i);
    expect(repair).not.toContain("subscriptions");
    expect(repair).not.toContain("church_role_permissions");
  });

  it("leaves the applied rollout unchanged and relies on existing future-church provisioning", () => {
    expect(rollout).toContain("on conflict (church_id, feature_id) do nothing");
    expect(provisioning).toContain("pf.is_mandatory or cardinality(pf.available_plans) > 0");
    expect(repair).not.toContain("create or replace function");
    expect(repair).not.toContain("create trigger");
  });

  it("protects the direct Church Admin Radio route with manage permission", () => {
    expect(getWorkspaceRoutePermission("/church-admin/radio")).toEqual({
      path: "/church-admin/radio",
      featureKey: "radio",
      action: "manage",
    });
  });
});

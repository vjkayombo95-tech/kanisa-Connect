import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import { PermissionControl } from "@/components/permissions/PermissionControl";
import { TooltipProvider } from "@/components/ui/tooltip";
import {
  applyRecommendedPermissions,
  CHURCH_PERMISSION_ACTIONS,
  indexPermissionConstraints,
  PERMISSION_CLASSIFICATIONS,
  resolvePermissionConstraint,
  type PermissionConstraint,
  type PermissionDraft,
} from "@/lib/permission-constraints";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const mounted: Array<{ container: HTMLDivElement; root: Root }> = [];

function constraint(
  featureKey: string,
  action: PermissionConstraint["action"],
  classification: PermissionConstraint["classification"],
  reason = "Test constraint",
): PermissionConstraint {
  return {
    feature_key: featureKey,
    action,
    classification,
    record_scope: classification === PERMISSION_CLASSIFICATIONS.CONFIGURABLE ? "church" : "none",
    reason,
  };
}

function mountControl(rule: PermissionConstraint, onCheckedChange = vi.fn()) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  mounted.push({ container, root });
  act(() => root.render(
    <TooltipProvider>
      <PermissionControl
        checked={false}
        constraint={rule}
        label="Member may delete Members"
        onCheckedChange={onCheckedChange}
      />
    </TooltipProvider>,
  ));
  return { container, onCheckedChange };
}

afterEach(async () => {
  while (mounted.length) {
    const item = mounted.pop();
    if (!item) continue;
    await act(async () => item.root.unmount());
    item.container.remove();
  }
});

describe("role permission constraint UI", () => {
  it.each(["delete", "manage"] as const)("prevents a Member from toggling %s", (action) => {
    const result = mountControl(constraint("members", action, PERMISSION_CLASSIFICATIONS.SYSTEM_PROTECTED));
    const checkbox = result.container.querySelector('[role="checkbox"]') as HTMLButtonElement;
    expect(checkbox.disabled).toBe(true);
    act(() => checkbox.click());
    expect(result.onCheckedChange).not.toHaveBeenCalled();
  });

  it("prevents a Member from managing Role Permissions", () => {
    const result = mountControl(constraint(
      "feature_permissions_admin",
      "manage",
      PERMISSION_CLASSIFICATIONS.SYSTEM_PROTECTED,
      "Only the Church Admin recovery role may hold this permission.",
    ));
    expect(result.container.textContent).toContain("Only the Church Admin recovery role");
    expect((result.container.querySelector('[role="checkbox"]') as HTMLButtonElement).disabled).toBe(true);
  });

  it("shows a lock and accessible Platform Administrator help for restricted cells", () => {
    const result = mountControl(constraint(
      "feature_permissions_admin",
      "manage",
      PERMISSION_CLASSIFICATIONS.RESTRICTED,
    ));
    const checkbox = result.container.querySelector('[role="checkbox"]') as HTMLButtonElement;
    expect(checkbox.disabled).toBe(true);
    expect(checkbox.getAttribute("aria-describedby")).toBeTruthy();
    expect(result.container.querySelector(".lucide-lock-keyhole")).not.toBeNull();
    expect(result.container.textContent).toContain("Only a Platform Administrator can change this permission.");
  });

  it("keeps an authorised configurable cell keyboard and pointer interactive", () => {
    const onCheckedChange = vi.fn();
    const result = mountControl(constraint("events", "create", PERMISSION_CLASSIFICATIONS.CONFIGURABLE), onCheckedChange);
    const checkbox = result.container.querySelector('[role="checkbox"]') as HTMLButtonElement;
    expect(checkbox.disabled).toBe(false);
    act(() => checkbox.click());
    expect(onCheckedChange).toHaveBeenCalledWith(true);
  });

  it("fails secure when the server omits a constraint", () => {
    const resolved = resolvePermissionConstraint(new Map(), "future_feature", "manage");
    expect(resolved.classification).toBe(PERMISSION_CLASSIFICATIONS.SYSTEM_PROTECTED);
  });

  it("recalculates cell states when the selected role changes", () => {
    const member = indexPermissionConstraints([
      constraint("events", "delete", PERMISSION_CLASSIFICATIONS.SYSTEM_PROTECTED),
    ]);
    const churchAdmin = indexPermissionConstraints([
      constraint("events", "delete", PERMISSION_CLASSIFICATIONS.CONFIGURABLE),
    ]);
    expect(resolvePermissionConstraint(member, "events", "delete").classification)
      .toBe(PERMISSION_CLASSIFICATIONS.SYSTEM_PROTECTED);
    expect(resolvePermissionConstraint(churchAdmin, "events", "delete").classification)
      .toBe(PERMISSION_CLASSIFICATIONS.CONFIGURABLE);
  });

  it("safe reset skips restricted and system-protected cells", () => {
    const emptyActions: PermissionDraft[string] = {
      view: false,
      create: false,
      edit: false,
      delete: false,
      approve: false,
      publish: false,
      manage: false,
    };
    const draft: PermissionDraft = { events: emptyActions };
    const constraints = indexPermissionConstraints(CHURCH_PERMISSION_ACTIONS.map((action) => constraint(
      "events",
      action,
      action === "view" ? PERMISSION_CLASSIFICATIONS.CONFIGURABLE : PERMISSION_CLASSIFICATIONS.SYSTEM_PROTECTED,
    )));
    const result = applyRecommendedPermissions(draft, ["events"], constraints, () => true);
    expect(result.draft.events.view).toBe(true);
    expect(result.draft.events.delete).toBe(false);
    expect(result.draft.events.manage).toBe(false);
    expect(result.skipped).toBe(6);
  });
});

describe("database permission constraint contract", () => {
  it("uses one canonical SQL rule in both the read RPC and atomic write RPC", async () => {
    const { readFile } = await import("node:fs/promises");
    const migration = await readFile(
      "supabase/migrations/20260727120000_enforce_role_permission_constraints.sql",
      "utf8",
    );
    expect(migration.match(/church_permission_constraint_rule\(/g)?.length).toBeGreaterThanOrEqual(4);
    expect(migration).toContain("Permission denied for this church");
    expect(migration).toContain("System-protected permission cannot be changed");
    expect(migration).toContain("Only a Platform Administrator can change permission");
    expect(migration).toContain("using errcode = '42501'");
    expect(migration).toContain("using errcode = '22023'");
    expect(migration).toContain("set search_path = pg_catalog, public");
    expect(migration).toContain("revoke all on function public.church_permission_constraint_rule");
  });

  it("keeps the approved realtime scopes and invalidates the new constraint cache", async () => {
    const { readFile } = await import("node:fs/promises");
    const realtime = await readFile("src/lib/authorization-realtime.ts", "utf8");
    const auth = await readFile("src/contexts/AuthContext.tsx", "utf8");
    expect(realtime).toContain('["church-permission-constraints", scope.churchId]');
    expect(auth).toContain('authorization:user:');
    expect(auth).toContain('authorization:church:');
    expect(auth).toContain('authorization:platform');
  });
});

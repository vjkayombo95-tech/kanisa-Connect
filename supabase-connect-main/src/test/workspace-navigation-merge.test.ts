import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, expectTypeOf, it, vi } from "vitest";

import { getWorkspaceConfigForRoles, workspaceRegistry } from "@/components/workspace/registry";
import {
  CANONICAL_FINANCE_ITEM_ORDER,
  CANONICAL_OPERATIONS_ITEM_ORDER,
  filterVisibleNavigationGroups,
  mergeNavigationGroups,
} from "@/components/workspace/navigation-merge";
import {
  findDuplicateNavigationGroupTranslationKeys,
  NavigationGroups,
  type NavigationGroupId,
  warnAboutDuplicateNavigationGroupTranslationKeys,
} from "@/components/workspace/navigation-groups";
import type { WorkspaceNavigationGroup } from "@/components/workspace/framework";
import { getWorkspaceRoutePermission } from "@/lib/workspace-route-permissions";

const frameworkSource = readFileSync(resolve(process.cwd(), "src/components/workspace/framework.tsx"), "utf8");
const registrySource = readFileSync(resolve(process.cwd(), "src/components/workspace/registry.ts"), "utf8");
const en = JSON.parse(readFileSync(resolve(process.cwd(), "src/locales/en.json"), "utf8"));
const sw = JSON.parse(readFileSync(resolve(process.cwd(), "src/locales/sw.json"), "utf8"));

function navigation(workspace: "church_admin" | "finance" | "pastoral", roles: readonly string[]) {
  return getWorkspaceConfigForRoles(workspace, roles).navigation;
}

function financeGroups(groups: WorkspaceNavigationGroup[]) {
  return groups.filter((group) => group.id === NavigationGroups.FINANCE);
}

function operationsGroups(groups: WorkspaceNavigationGroup[]) {
  return groups.filter((group) => group.id === NavigationGroups.OPERATIONS);
}

function itemIds(group: WorkspaceNavigationGroup) {
  return group.items.map((item) => item.id);
}

describe("multi-role workspace navigation merging", () => {
  it("keeps Church Admin finance in one group without Treasurer-only items", () => {
    const groups = financeGroups(navigation("church_admin", ["church_admin"]));
    expect(groups).toHaveLength(1);
    expect(itemIds(groups[0])).toEqual([
      "finance-dashboard", "contributions", "qr-payments", "finance-intelligence", "pledges",
    ]);
    expect(itemIds(groups[0])).not.toEqual(expect.arrayContaining(["receipts", "exports"]));
  });

  it("keeps Treasurer finance in one group without Church Admin-only items", () => {
    const groups = financeGroups(navigation("finance", ["treasurer"]));
    expect(groups).toHaveLength(1);
    expect(itemIds(groups[0])).toEqual([
      "contributions", "receipts", "exports", "finance-intelligence", "pledges", "reports",
    ]);
    expect(itemIds(groups[0])).not.toEqual(expect.arrayContaining(["finance-dashboard", "qr-payments"]));
  });

  it("creates one canonical Finance union for Church Admin and Treasurer", () => {
    const groups = financeGroups(navigation("church_admin", ["church_admin", "treasurer"]));
    expect(groups).toHaveLength(1);
    expect(itemIds(groups[0])).toEqual([
      "finance-dashboard",
      "contributions",
      "qr-payments",
      "receipts",
      "exports",
      "finance-intelligence",
      "pledges",
    ]);
    expect(new Set(itemIds(groups[0])).size).toBe(groups[0].items.length);
  });

  it("is independent of Church Admin and Treasurer role order", () => {
    const forward = navigation("church_admin", ["church_admin", "treasurer"]);
    const reverse = navigation("church_admin", ["treasurer", "church_admin"]);
    expect(reverse.map((group) => [group.id, itemIds(group)])).toEqual(
      forward.map((group) => [group.id, itemIds(group)]),
    );
  });

  it("does not duplicate overlapping groups for Pastor and Church Admin", () => {
    const groups = navigation("church_admin", ["pastor", "church_admin"]);
    expect(new Set(groups.map((group) => group.id)).size).toBe(groups.length);
    const items = groups.flatMap((group) => group.items);
    expect(new Set(items.map((item) => item.id)).size).toBe(items.length);
    expect(new Set(items.map((item) => item.to)).size).toBe(items.length);
  });

  it("keeps one Operations section for each single-role workspace", () => {
    const pastorOperations = operationsGroups(navigation("pastoral", ["pastor"]));
    const adminOperations = operationsGroups(navigation("church_admin", ["church_admin"]));

    expect(pastorOperations).toHaveLength(1);
    expect(itemIds(pastorOperations[0])).toEqual([
      "calendar", "events", "announcements", "finance-summary",
    ]);
    expect(adminOperations).toHaveLength(1);
    expect(itemIds(adminOperations[0])).toEqual(CANONICAL_OPERATIONS_ITEM_ORDER.slice(0, -1));
  });

  it.each([
    ["Pastor + Church Admin", ["pastor", "church_admin"]],
    ["Church Admin + Pastor", ["church_admin", "pastor"]],
    ["Church Admin + Pastor + Treasurer", ["church_admin", "pastor", "treasurer"]],
  ] as const)("creates one canonical Operations union for %s", (_label, roles) => {
    const groups = operationsGroups(navigation("church_admin", roles));
    expect(groups).toHaveLength(1);
    expect(itemIds(groups[0])).toEqual(CANONICAL_OPERATIONS_ITEM_ORDER);
    expect(new Set(itemIds(groups[0])).size).toBe(groups[0].items.length);
    expect(new Set(groups[0].items.map((item) => item.to)).size).toBe(groups[0].items.length);
  });

  it("keeps Operations ordering independent of role order", () => {
    const forward = operationsGroups(navigation("church_admin", ["church_admin", "pastor"]))[0];
    const reverse = operationsGroups(navigation("church_admin", ["pastor", "church_admin"]))[0];
    expect(itemIds(reverse)).toEqual(itemIds(forward));
  });

  it("preserves Operations permission and feature metadata", () => {
    const operations = operationsGroups(navigation("church_admin", ["church_admin", "pastor"]))[0];
    expect(operations.labelKey).toBe("navigation.groups.operations");
    expect(operations.items.find((item) => item.id === "operations")).toMatchObject({
      featureFlag: "operations",
      requireFeatureEnabled: true,
    });
    expect(operations.items.find((item) => item.id === "audio-processing")).toMatchObject({
      featureFlag: "audio_processing",
      requireFeatureEnabled: true,
    });
    expect(operations.items.find((item) => item.id === "finance-summary")).toMatchObject({
      featureFlag: "contributions",
      to: "/pastoral/contributions",
    });
  });

  it("merges Treasurer and Secretary finance while preserving unrelated groups", () => {
    const groups = navigation("finance", ["treasurer", "secretary"]);
    expect(financeGroups(groups)).toHaveLength(1);
    expect(itemIds(financeGroups(groups)[0])).toEqual(CANONICAL_FINANCE_ITEM_ORDER);
    expect(groups.some((group) => group.id === NavigationGroups.FINANCE_ADMINISTRATION)).toBe(true);
    expect(groups.some((group) => group.id === NavigationGroups.ADMIN_ADMINISTRATION)).toBe(true);
  });

  it("deduplicates items by their stable item ID", () => {
    const merged = mergeNavigationGroups([
      [{ id: NavigationGroups.FINANCE, label: "Finance", items: [{ id: "receipts", label: "Receipts", to: "/finance/receipts" }] }],
      [{ id: NavigationGroups.FINANCE, label: "Fedha", items: [{ id: "receipts", label: "Receipt history", to: "/finance/receipt-history" }] }],
    ]);
    expect(merged).toHaveLength(1);
    expect(merged[0].items).toHaveLength(1);
  });

  it("falls back to route deduplication only for legacy items without IDs", () => {
    const legacyItem = { label: "Legacy receipts", to: "/finance/receipts" } as WorkspaceNavigationGroup["items"][number];
    const merged = mergeNavigationGroups([
      [{ id: NavigationGroups.FINANCE, label: "Finance", items: [legacyItem] }],
      [{ id: NavigationGroups.FINANCE, label: "Fedha", items: [{ id: "receipts", label: "Receipts", to: "/finance/receipts" }] }],
    ]);
    expect(merged[0].items).toHaveLength(1);
  });

  it("does not merge unrelated groups that happen to have the same translated label", () => {
    const merged = mergeNavigationGroups([[
      { id: NavigationGroups.FINANCE, label: "Finance", items: [{ id: "contributions", label: "Contributions", to: "/finance/contributions" }] },
      { id: NavigationGroups.PLATFORM_FINANCE, label: "Finance", items: [{ id: "campaigns", label: "Campaigns", to: "/campaigns" }] },
    ]]);
    expect(merged.map((group) => group.id)).toEqual([NavigationGroups.FINANCE, NavigationGroups.PLATFORM_FINANCE]);
  });

  it("hides Finance after permission filtering removes every item", () => {
    const groups: WorkspaceNavigationGroup[] = [{
      id: NavigationGroups.FINANCE,
      label: "Finance",
      items: [{ id: "receipts", label: "Receipts", to: "/finance/receipts", featureFlag: "contributions" }],
    }];
    expect(filterVisibleNavigationGroups(groups, () => false)).toEqual([]);
    expect(filterVisibleNavigationGroups(groups, () => true)).toEqual(groups);
  });

  it("uses the same permission-filtered structure and stable keys on mobile and desktop", () => {
    expect(frameworkSource.match(/useVisibleNavigationGroups\(groups\)/g)).toHaveLength(2);
    expect(frameworkSource).toContain("<div key={group.id}");
    expect(frameworkSource).toContain("key={item.id}");
    expect(frameworkSource).toContain('supabase.rpc("has_church_feature_permission"');
  });

  it("uses a locale key for the shared semantic Finance group", () => {
    expect(en.navigation.groups.finance).toBe("Finance");
    expect(sw.navigation.groups.finance).toBe("Fedha");
    for (const workspace of ["church_admin", "finance"] as const) {
      expect(financeGroups(navigation(workspace, []))[0].labelKey).toBe("navigation.groups.finance");
    }
  });

  it("uses one locale key and central ID for the shared Operations group", () => {
    expect(en.navigation.groups.operations).toBe("Operations");
    expect(sw.navigation.groups.operations).toBe("Uendeshaji");
    expect(registrySource.match(/id: NavigationGroups\.OPERATIONS,/g)).toHaveLength(2);
    expect(registrySource.match(/labelKey: "navigation\.groups\.operations",/g)).toHaveLength(2);
    expect(registrySource).not.toContain("NavigationGroups.ADMIN_OPERATIONS");
    expect(registrySource).not.toContain("NavigationGroups.PASTORAL_OPERATIONS");
  });

  it("registers every Finance navigation section with the central semantic ID", () => {
    expect(registrySource.match(/id: NavigationGroups\.FINANCE,/g)).toHaveLength(2);
    expect(registrySource).not.toMatch(/^ {8}id: "(?:admin-finance|finance-finance|finance)",/m);
  });

  it("defines direct-route permission metadata for every feature-backed navigation item", () => {
    for (const workspace of Object.values(workspaceRegistry)) {
      for (const group of workspace.navigation) {
        for (const item of group.items) {
          if (!("featureFlag" in item) || !item.featureFlag) continue;
          expect(getWorkspaceRoutePermission(item.to), `${workspace.id}:${item.id}`).not.toBeNull();
        }
      }
    }
  });

  it("uses the established feature permission for the three newly covered routes", () => {
    expect(getWorkspaceRoutePermission("/pastoral/dashboard")).toMatchObject({ featureKey: "catholic_content", action: "view" });
    expect(getWorkspaceRoutePermission("/church-admin/finance")).toMatchObject({ featureKey: "contributions", action: "view" });
    expect(getWorkspaceRoutePermission("/church-admin/qr-payments")).toMatchObject({ featureKey: "give", action: "view" });
  });

  it("does not register duplicate item routes within any workspace", () => {
    for (const workspace of Object.values(workspaceRegistry)) {
      const routes = workspace.navigation.flatMap((group) => group.items.map((item) => item.to));
      expect(new Set(routes).size, workspace.id).toBe(routes.length);
    }
  });

  it("keeps draft review inside the Prayer Library instead of duplicating its route", () => {
    const platformItems = workspaceRegistry.super_admin.navigation.flatMap((group) => group.items);
    expect(platformItems.some((item) => item.id === "prayer-draft-review")).toBe(false);
    expect(platformItems.filter((item) => item.to === "/super-admin/catholic-content/prayer-library")).toHaveLength(1);
  });

  it("centrally types every navigation group registration", () => {
    expectTypeOf<WorkspaceNavigationGroup["id"]>().toEqualTypeOf<NavigationGroupId>();
    const validGroupId: NavigationGroupId = NavigationGroups.FINANCE;
    expect(validGroupId).toBe("finance");
  });

  it("detects different group IDs registered with the same translation key", () => {
    expect(findDuplicateNavigationGroupTranslationKeys([
      { id: NavigationGroups.FINANCE, labelKey: "navigation.groups.finance" },
      { id: NavigationGroups.PLATFORM_FINANCE, labelKey: "navigation.groups.finance" },
    ])).toEqual([{
      translationKey: "navigation.groups.finance",
      registeredIds: [NavigationGroups.FINANCE, NavigationGroups.PLATFORM_FINANCE],
    }]);
    expect(findDuplicateNavigationGroupTranslationKeys([
      { id: NavigationGroups.FINANCE, labelKey: "navigation.groups.finance" },
      { id: NavigationGroups.FINANCE, labelKey: "navigation.groups.finance" },
    ])).toEqual([]);
  });

  it("warns about semantic translation-key duplicates during development", () => {
    const warning = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    warnAboutDuplicateNavigationGroupTranslationKeys([
      { id: NavigationGroups.FINANCE, labelKey: "navigation.groups.finance" },
      { id: NavigationGroups.PLATFORM_FINANCE, labelKey: "navigation.groups.finance" },
    ]);
    expect(warning).toHaveBeenCalledOnce();
    expect(warning.mock.calls[0][0]).toContain("This is likely an unintended duplicate semantic group.");
    warning.mockRestore();
  });
});

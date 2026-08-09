import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it } from "vitest";

import {
  AUTHORIZATION_REALTIME_DEPENDENCIES,
  getAuthorizationInvalidationKeys,
  invalidateAuthorizationQueries,
  isAuthorizationEventInScope,
  removeAuthorizationQueries,
} from "@/lib/authorization-realtime";

const scope = { userId: "user-1", churchId: "church-1" };

describe("authorization realtime cache routing", () => {
  it("maps every authorization source to the caches it affects", () => {
    expect(Object.keys(AUTHORIZATION_REALTIME_DEPENDENCIES)).toEqual([
      "user_roles",
      "members",
      "profiles",
      "church_role_permissions",
      "church_features",
      "subscriptions",
      "platform_features",
    ]);
    expect(getAuthorizationInvalidationKeys("church_role_permissions", scope)).toContainEqual([
      "church-role-permissions", "church-1",
    ]);
    expect(getAuthorizationInvalidationKeys("church_role_permissions", scope)).toContainEqual([
      "church-permission-constraints", "church-1",
    ]);
    expect(getAuthorizationInvalidationKeys("subscriptions", scope)).toContainEqual([
      "feature-subscription-plan", "church-1",
    ]);
    expect(getAuthorizationInvalidationKeys("platform_features", scope)).toContainEqual([
      "portal-platform-features",
    ]);
  });

  it("accepts matching INSERT, UPDATE, and DELETE identities", () => {
    expect(isAuthorizationEventInScope("user_roles", { eventType: "INSERT", new: { user_id: "user-1" } }, scope)).toBe(true);
    expect(isAuthorizationEventInScope("profiles", { eventType: "UPDATE", old: { id: "user-1" } }, scope)).toBe(true);
    expect(isAuthorizationEventInScope("church_features", { eventType: "DELETE", old: { church_id: "church-1" } }, scope)).toBe(true);
  });

  it("rejects cross-user, cross-church, and identity-free payloads", () => {
    expect(isAuthorizationEventInScope("user_roles", { new: { user_id: "user-2" } }, scope)).toBe(false);
    expect(isAuthorizationEventInScope("subscriptions", { old: { church_id: "church-2" } }, scope)).toBe(false);
    expect(isAuthorizationEventInScope("members", { eventType: "DELETE", old: {} }, scope)).toBe(false);
  });

  it("invalidates only scoped authorization query families", async () => {
    const queryClient = new QueryClient();
    queryClient.setQueryData(["church-permission", "church-1", "user-1", "events", "view"], true);
    queryClient.setQueryData(["church-permission", "church-2", "user-2", "events", "view"], true);
    queryClient.setQueryData(["unrelated"], "keep");

    await invalidateAuthorizationQueries(queryClient, "church_role_permissions", scope);

    expect(queryClient.getQueryState(["church-permission", "church-1", "user-1", "events", "view"])?.isInvalidated).toBe(true);
    expect(queryClient.getQueryState(["church-permission", "church-2", "user-2", "events", "view"])?.isInvalidated).toBe(false);
    expect(queryClient.getQueryData(["unrelated"])).toBe("keep");
  });

  it("removes privileged cached decisions on synchronization failure", () => {
    const queryClient = new QueryClient();
    queryClient.setQueryData(["church-permission", "church-1", "user-1", "events", "edit"], true);
    queryClient.setQueryData(["portal-platform-features"], [{ key: "events" }]);
    queryClient.setQueryData(["unrelated"], "keep");

    removeAuthorizationQueries(queryClient, scope);

    expect(queryClient.getQueryData(["church-permission", "church-1", "user-1", "events", "edit"])).toBeUndefined();
    expect(queryClient.getQueryData(["portal-platform-features"])).toBeUndefined();
    expect(queryClient.getQueryData(["unrelated"])).toBe("keep");
  });

  it("uses one cleanly removed channel factory instead of overlapping page channels", async () => {
    const { readFile } = await import("node:fs/promises");
    const authSource = await readFile("src/contexts/AuthContext.tsx", "utf8");
    const routeSource = await readFile("src/routes/WorkspaceRouteLayout.tsx", "utf8");
    const broadcastMigration = await readFile("supabase/migrations/20260722230000_broadcast_authorization_changes.sql", "utf8");

    expect(authSource.match(/\.channel\(/g)).toHaveLength(1);
    expect(authSource).toContain("const channels:");
    expect(authSource).toContain("channels.push(channel)");
    expect(authSource).toContain("supabase.removeChannel(channel)");
    expect(routeSource).not.toContain("usePermissionCacheInvalidation");
    expect(broadcastMigration).toContain("after insert or update or delete");
    expect(broadcastMigration).toContain("realtime.send(");
    expect(broadcastMigration).toContain("Scoped authorization broadcasts");
    expect(broadcastMigration).not.toContain("window.location.reload");
  });
});

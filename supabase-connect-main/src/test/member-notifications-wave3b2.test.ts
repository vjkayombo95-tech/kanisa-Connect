import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  fetchRows: [] as unknown[],
  fetchError: null as unknown,
  updateRow: null as unknown,
  updateError: null as unknown,
  calls: [] as Array<[string, ...unknown[]]>,
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (table: string) => {
      state.calls.push(["from", table]);
      const chain = {
        select: (columns: string) => { state.calls.push(["select", columns]); return chain; },
        update: (values: unknown) => { state.calls.push(["update", values]); return chain; },
        eq: (column: string, value: unknown) => { state.calls.push(["eq", column, value]); return chain; },
        order: (column: string, options: unknown) => { state.calls.push(["order", column, options]); return chain; },
        limit: async (count: number) => {
          state.calls.push(["limit", count]);
          return { data: state.fetchRows, error: state.fetchError };
        },
        maybeSingle: async () => ({ data: state.updateRow, error: state.updateError }),
      };
      return chain;
    },
  },
}));

import {
  boundedUnreadLabel,
  fetchMemberNotifications,
  markMemberNotificationRead,
  type MemberNotification,
} from "@/lib/member-notifications";

const notification = (overrides: Partial<MemberNotification> = {}): MemberNotification => ({
  id: "notification-a",
  church_id: "church-a",
  user_id: "user-a",
  title: "Kumbusho",
  message: "Ujumbe salama",
  type: "info",
  is_read: false,
  created_at: "2026-08-24T09:00:00.000Z",
  ...overrides,
});

describe("Wave 3B2 member notification data contract", () => {
  beforeEach(() => {
    state.fetchRows = [];
    state.fetchError = null;
    state.updateRow = null;
    state.updateError = null;
    state.calls = [];
  });

  it("loads a bounded newest-first inbox scoped to the authenticated user and church", async () => {
    state.fetchRows = [notification()];
    await expect(fetchMemberNotifications("user-a", "church-a")).resolves.toEqual(state.fetchRows);
    expect(state.calls).toContainEqual(["eq", "user_id", "user-a"]);
    expect(state.calls).toContainEqual(["eq", "church_id", "church-a"]);
    expect(state.calls).toContainEqual(["order", "created_at", { ascending: false }]);
    expect(state.calls).toContainEqual(["limit", 25]);
  });

  it("fails closed when a returned row does not match both ownership dimensions", async () => {
    state.fetchRows = [notification({ church_id: "church-b" })];
    await expect(fetchMemberNotifications("user-a", "church-a")).rejects.toThrow("ownership");
  });

  it("does not query without both identity dimensions", async () => {
    await expect(fetchMemberNotifications("", "church-a")).resolves.toEqual([]);
    await expect(fetchMemberNotifications("user-a", "")).resolves.toEqual([]);
    expect(state.calls).toEqual([]);
  });

  it("marks only is_read and scopes the mutation by id, user, and church", async () => {
    state.updateRow = { id: "notification-a", user_id: "user-a", church_id: "church-a", is_read: true };
    await expect(markMemberNotificationRead("notification-a", "user-a", "church-a")).resolves.toBe("notification-a");
    expect(state.calls).toContainEqual(["update", { is_read: true }]);
    expect(state.calls).toContainEqual(["eq", "id", "notification-a"]);
    expect(state.calls).toContainEqual(["eq", "user_id", "user-a"]);
    expect(state.calls).toContainEqual(["eq", "church_id", "church-a"]);
  });

  it("treats a zero-row or mismatched update as failure", async () => {
    await expect(markMemberNotificationRead("notification-a", "user-a", "church-a")).rejects.toThrow("not marked");
    state.updateRow = { id: "notification-a", user_id: "user-b", church_id: "church-a", is_read: true };
    await expect(markMemberNotificationRead("notification-a", "user-a", "church-a")).rejects.toThrow("not marked");
  });

  it("bounds the badge and excludes read notifications", () => {
    expect(boundedUnreadLabel([])).toBeNull();
    expect(boundedUnreadLabel([notification(), notification({ id: "read", is_read: true })])).toBe("1");
    expect(boundedUnreadLabel(Array.from({ length: 10 }, (_, index) => notification({ id: String(index) })))).toBe("9+");
  });
});

describe("Wave 3B2 route and presentation contract", () => {
  const read = (relativePath: string) => readFileSync(join(process.cwd(), "src", relativePath), "utf8");

  it("registers a fail-closed ordinary-member route without exposing it in Services", () => {
    const features = read("lib/portal-features.ts");
    const registry = read("lib/member-service-registry.ts");
    const routes = read("routes/MemberRoutes.tsx");
    const layout = read("components/portal/PortalLayout.tsx");
    expect(features).toContain('{ prefix: "/portal/notifications", featureKey: "notifications" }');
    expect(registry).toMatch(/id: "notifications"[\s\S]*ordinaryMemberAllowed: true[\s\S]*showInServices: false[\s\S]*requiresExistingFeature: true/);
    expect(routes).toContain('<Route path="notifications" element={<MemberNotificationsPage />} />');
    expect(layout).toContain('activeFeatureKey === "notifications"');
    expect(layout).toContain("notificationFeatureState.exists && notificationFeatureState.visible");
  });

  it("uses plain React text, an AppLink bell, explicit feature gating, and no realtime subscription", () => {
    const page = read("pages/portal/MemberNotificationsPage.tsx");
    const bell = read("components/portal/MemberNotificationBell.tsx");
    const hook = read("hooks/use-member-notifications.ts");
    expect(page).not.toContain("dangerouslySetInnerHTML");
    expect(page).toContain('featureAccess.isResolved && featureState.exists && featureState.visible');
    expect(bell).toContain('<AppLink');
    expect(bell).toContain('to="/portal/notifications"');
    expect(hook).not.toMatch(/channel\(|postgres_changes|realtime/i);
  });
});

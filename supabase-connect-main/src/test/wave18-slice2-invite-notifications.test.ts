import fs from "node:fs";
import path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  fetchRows: [] as unknown[],
  fetchError: null as unknown,
  updateRows: [] as unknown[],
  updateRow: null as unknown,
  updateError: null as unknown,
  calls: [] as Array<[string, ...unknown[]]>,
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (table: string) => {
      state.calls.push(["from", table]);
      const chain = {
        select: (columns: string) => {
          state.calls.push(["select", columns]);
          return chain;
        },
        update: (values: unknown) => {
          state.calls.push(["update", values]);
          return chain;
        },
        eq: (column: string, value: unknown) => {
          state.calls.push(["eq", column, value]);
          return chain;
        },
        order: (column: string, options: unknown) => {
          state.calls.push(["order", column, options]);
          return chain;
        },
        limit: async (count: number) => {
          state.calls.push(["limit", count]);
          return { data: state.fetchRows, error: state.fetchError };
        },
        maybeSingle: async () => ({ data: state.updateRow, error: state.updateError }),
        then: (resolve: (value: unknown) => void) => {
          resolve({ data: state.updateRows, error: state.updateError });
        },
      };
      return chain;
    },
  },
}));

import {
  buildMemberJoinUrl,
  buildMemberJoinWhatsAppMessage,
  buildTokenInviteUrl,
} from "@/lib/invite-flow";
import {
  fetchScopedNotifications,
  markAllScopedNotificationsRead,
  markScopedNotificationRead,
  type MemberNotification,
} from "@/lib/member-notifications";
import { buildWhatsAppShareUrl } from "@/lib/whatsapp-share";

const root = process.cwd();
const read = (relative: string) => fs.readFileSync(path.join(root, relative), "utf8");

const notification = (overrides: Partial<MemberNotification> = {}): MemberNotification => ({
  id: "notification-a",
  church_id: "church-a",
  user_id: "user-a",
  title: "Reminder",
  message: "Safe message",
  type: "info",
  is_read: false,
  created_at: "2026-09-16T00:00:00.000Z",
  ...overrides,
});

describe("Wave 18 Slice 2 invite link contract", () => {
  it("builds canonical member join and token invite URLs from a supplied origin", () => {
    expect(buildMemberJoinUrl("st joseph/parish", "https://app.example/")).toBe(
      "https://app.example/join/st%20joseph%2Fparish",
    );
    expect(buildTokenInviteUrl("token/with space", "https://app.example/")).toBe(
      "https://app.example/invite/token%2Fwith%20space",
    );
    expect(buildMemberJoinUrl("", "https://app.example")).toBeNull();
    expect(buildTokenInviteUrl("token", "")).toBeNull();
  });

  it("builds WhatsApp messages around the same canonical member join URL", () => {
    const joinUrl = buildMemberJoinUrl("st-joseph", "https://app.example")!;
    const message = buildMemberJoinWhatsAppMessage({ churchName: "St Joseph", joinUrl });
    const shareUrl = buildWhatsAppShareUrl(message);

    expect(message).toContain("St Joseph");
    expect(message).toContain(joinUrl);
    expect(decodeURIComponent(shareUrl)).toContain("https://app.example/join/st-joseph");
  });

  it("keeps /join/:slug routed to RegisterPage and uses the shared join URL for copy, WhatsApp, and QR", () => {
    const app = read("src/App.tsx");
    const inviteMembers = read("src/pages/church-admin/InviteMembersPage.tsx");
    const dashboard = read("src/pages/church-admin/ChurchDashboard.tsx");
    const roles = read("src/pages/church-admin/RolesPage.tsx");

    expect(app).toContain('<Route path="/join/:slug" element={<RegisterPage />} />');
    expect(inviteMembers).toContain("buildMemberJoinUrl(church?.slug)");
    expect(inviteMembers).toContain("openWhatsAppShare(buildMemberJoinWhatsAppMessage");
    expect(inviteMembers).toContain("value={joinLink}");
    expect(dashboard).toContain("buildMemberJoinUrl(data?.churchSlug)");
    expect(dashboard).toContain("openWhatsAppShare(buildMemberJoinWhatsAppMessage");
    expect(dashboard).toContain("value={joinLink}");
    expect(roles).toContain("buildTokenInviteUrl(token)");
  });

  it("keeps debug invite tooling gated to development builds", () => {
    const roles = read("src/pages/church-admin/RolesPage.tsx");
    expect(roles).toContain("import.meta.env.DEV");
    expect(roles).toContain("Create test123 invite");
  });
});

describe("Wave 18 Slice 2 registration failure sanitization", () => {
  it("does not render raw registration mutation errors directly", () => {
    const registerPage = read("src/pages/auth/RegisterPage.tsx");
    expect(registerPage).toContain("formatRegistrationError");
    expect(registerPage).toContain("<AlertDescription>{registrationErrorMessage}</AlertDescription>");
    expect(registerPage).not.toContain("<AlertDescription>{registerMutation.error.message}</AlertDescription>");
    expect(registerPage).toContain("Registration could not be completed. Please try again or contact your church administrator.");
  });
});

describe("Wave 18 Slice 2 admin notification helper contract", () => {
  beforeEach(() => {
    state.fetchRows = [];
    state.fetchError = null;
    state.updateRows = [];
    state.updateRow = null;
    state.updateError = null;
    state.calls = [];
  });

  it("fetches notifications scoped by user and church and rejects mismatched rows", async () => {
    state.fetchRows = [notification()];
    await expect(fetchScopedNotifications("user-a", "church-a", 50)).resolves.toEqual(state.fetchRows);
    expect(state.calls).toContainEqual(["eq", "user_id", "user-a"]);
    expect(state.calls).toContainEqual(["eq", "church_id", "church-a"]);
    expect(state.calls).toContainEqual(["limit", 50]);

    state.calls = [];
    state.fetchRows = [notification({ church_id: "church-b" })];
    await expect(fetchScopedNotifications("user-a", "church-a", 50)).rejects.toThrow("ownership");
  });

  it("marks one notification read with id, user, and church scope", async () => {
    state.updateRow = { id: "notification-a", user_id: "user-a", church_id: "church-a", is_read: true };
    await expect(markScopedNotificationRead("notification-a", "user-a", "church-a")).resolves.toBe("notification-a");
    expect(state.calls).toContainEqual(["eq", "id", "notification-a"]);
    expect(state.calls).toContainEqual(["eq", "user_id", "user-a"]);
    expect(state.calls).toContainEqual(["eq", "church_id", "church-a"]);
  });

  it("marks all unread notifications with user and church scope", async () => {
    state.updateRows = [
      { id: "notification-a", user_id: "user-a", church_id: "church-a", is_read: true },
      { id: "notification-b", user_id: "user-a", church_id: "church-a", is_read: true },
    ];
    await expect(markAllScopedNotificationsRead("user-a", "church-a")).resolves.toEqual(["notification-a", "notification-b"]);
    expect(state.calls).toContainEqual(["update", { is_read: true }]);
    expect(state.calls).toContainEqual(["eq", "user_id", "user-a"]);
    expect(state.calls).toContainEqual(["eq", "church_id", "church-a"]);
    expect(state.calls).toContainEqual(["eq", "is_read", false]);
  });

  it("admin notification UI separates loading, empty, error, and retry states", () => {
    const page = read("src/pages/church-admin/NotificationsPage.tsx");
    expect(page).toContain("notificationsQuery.isLoading");
    expect(page).toContain("notificationsQuery.isError");
    expect(page).toContain("Notifications could not be loaded.");
    expect(page).toContain("notificationsQuery.refetch()");
    expect(page).toContain("notifications.length === 0");
    expect(page).toContain("adminNotificationsKey(userId, churchId)");
  });
});

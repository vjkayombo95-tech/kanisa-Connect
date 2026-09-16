import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import NotificationsPage from "@/pages/church-admin/NotificationsPage";
import type { MemberNotification } from "@/lib/member-notifications";

const state = vi.hoisted(() => ({
  auth: { user: { id: "user-a" }, churchId: "church-a" } as { user: { id: string } | null; churchId: string | null },
  rows: [] as MemberNotification[],
  fetchError: false,
  fetchCalls: [] as Array<[string, string, number]>,
  markOneCalls: [] as Array<[string, string, string]>,
  markAllCalls: [] as Array<[string, string]>,
  toast: vi.fn(),
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => state.auth,
}));

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: state.toast }),
}));

vi.mock("@/lib/member-notifications", () => ({
  adminNotificationsKey: (userId?: string | null, churchId?: string | null) => ["admin-notifications", userId, churchId],
  fetchScopedNotifications: async (userId: string, churchId: string, limit: number) => {
    state.fetchCalls.push([userId, churchId, limit]);
    if (state.fetchError) throw new Error("permission denied for table notifications");
    return state.rows;
  },
  markScopedNotificationRead: async (notificationId: string, userId: string, churchId: string) => {
    state.markOneCalls.push([notificationId, userId, churchId]);
    return notificationId;
  },
  markAllScopedNotificationsRead: async (userId: string, churchId: string) => {
    state.markAllCalls.push([userId, churchId]);
    return ["notification-a", "notification-b"];
  },
}));

const notification = (overrides: Partial<MemberNotification> = {}): MemberNotification => ({
  id: "notification-a",
  church_id: "church-a",
  user_id: "user-a",
  title: "Parish reminder",
  message: "Meeting today",
  type: "info",
  is_read: false,
  created_at: "2026-09-16T00:00:00.000Z",
  ...overrides,
});

const mounts: Array<{ host: HTMLDivElement; root: Root; client: QueryClient }> = [];

function renderPage(ui: ReactNode = <NotificationsPage />) {
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  });

  act(() => {
    root.render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
  });
  mounts.push({ host, root, client });
  return host;
}

async function waitForText(host: HTMLElement, text: string) {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    if (host.textContent?.includes(text)) return;
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 5));
    });
  }
  throw new Error(`Expected "${text}" in rendered output: ${host.textContent}`);
}

beforeEach(() => {
  state.auth = { user: { id: "user-a" }, churchId: "church-a" };
  state.rows = [];
  state.fetchError = false;
  state.fetchCalls = [];
  state.markOneCalls = [];
  state.markAllCalls = [];
  state.toast.mockClear();
});

afterEach(() => {
  for (const { host, root, client } of mounts.splice(0)) {
    act(() => root.unmount());
    client.clear();
    host.remove();
  }
});

describe("Wave 18 Slice 2 admin notification runtime behavior", () => {
  it("renders a true empty state after a scoped successful fetch", async () => {
    const host = renderPage();

    await waitForText(host, "No notifications.");

    expect(state.fetchCalls).toEqual([["user-a", "church-a", 50]]);
    expect(host.textContent).not.toContain("Notifications could not be loaded.");
  });

  it("renders sanitized fetch failure copy and recovers through retry", async () => {
    state.fetchError = true;
    const host = renderPage();

    await waitForText(host, "Notifications could not be loaded.");
    expect(host.textContent).not.toContain("permission denied");

    state.fetchError = false;
    state.rows = [notification({ title: "Recovered reminder" })];
    const retry = Array.from(host.querySelectorAll("button")).find((button) => button.textContent?.includes("Retry"));
    expect(retry).toBeTruthy();
    act(() => retry!.click());

    await waitForText(host, "Recovered reminder");
  });

  it("marks one unread notification with id, user, and church scope", async () => {
    state.rows = [notification()];
    const host = renderPage();

    await waitForText(host, "Parish reminder");
    const markButton = host.querySelector<HTMLButtonElement>('button[aria-label^="Mark notification"]');
    expect(markButton).not.toBeNull();
    act(() => markButton!.click());

    await waitForText(host, "All caught up");
    expect(state.markOneCalls).toEqual([["notification-a", "user-a", "church-a"]]);
  });

  it("marks all unread notifications with user and church scope", async () => {
    state.rows = [notification(), notification({ id: "notification-b", title: "Second reminder" })];
    const host = renderPage();

    await waitForText(host, "2 unread");
    const markAll = Array.from(host.querySelectorAll("button")).find((button) => button.textContent?.includes("Mark All Read"));
    expect(markAll).toBeTruthy();
    act(() => markAll!.click());

    await waitForText(host, "All caught up");
    expect(state.markAllCalls).toEqual([["user-a", "church-a"]]);
  });
});

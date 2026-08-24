import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ auth: { user: { id: "user-a" } as { id: string } | null, churchId: "church-a" as string | null }, mark: vi.fn(), toast: vi.fn() }));
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => state.auth }));
vi.mock("@/hooks/use-feature-access", () => ({ useFeatureAccess: () => ({ isResolved: true, getFeatureState: () => ({ exists: true, visible: true }) }) }));
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: state.toast }) }));
vi.mock("@/lib/member-notifications", async () => { const actual = await vi.importActual<typeof import("@/lib/member-notifications")>("@/lib/member-notifications"); return { ...actual, fetchMemberNotifications: vi.fn(async (userId: string, churchId: string) => userId === "user-a" && churchId === "church-a" ? [{ id: "notification-a", church_id: "church-a", user_id: "user-a", title: "UAT Arifa", message: "Ujumbe wa UAT", type: "info", is_read: false, created_at: "2026-08-24T09:00:00.000Z" }] : []), markMemberNotificationRead: (...args: unknown[]) => state.mark(...args) }; });

import { useMemberNotifications } from "@/hooks/use-member-notifications";
import { MemberNotificationBell } from "@/components/portal/MemberNotificationBell";
import MemberNotificationsPage from "@/pages/portal/MemberNotificationsPage";

const waitFor = async (predicate: () => boolean) => { for (let attempt = 0; attempt < 40; attempt += 1) { if (predicate()) return; await act(async () => { await new Promise((resolve) => setTimeout(resolve, 5)); }); } throw new Error("Timed out waiting for notification state."); };
function BellHarness() { const notifications = useMemberNotifications(); return <MemberNotificationBell notifications={notifications.data ?? []} />; }

describe("Wave 3C notification runtime hardening", () => {
  let host: HTMLDivElement; let root: Root; let client: QueryClient;
  const render = (node: ReactNode) => act(() => root.render(<QueryClientProvider client={client}><MemoryRouter>{node}</MemoryRouter></QueryClientProvider>));
  beforeEach(() => { host = document.createElement("div"); document.body.append(host); root = createRoot(host); client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } }); state.auth = { user: { id: "user-a" }, churchId: "church-a" }; state.mark.mockReset(); state.toast.mockReset(); });
  afterEach(() => { act(() => root.unmount()); host.remove(); client.clear(); });

  it("clears a cached badge after logout and tenant switch", async () => { render(<BellHarness />); await waitFor(() => host.querySelector('[data-testid="member-notification-badge"]')?.textContent === "1"); state.auth = { user: null, churchId: null }; render(<BellHarness />); await waitFor(() => host.querySelector('[data-testid="member-notification-badge"]') === null); state.auth = { user: { id: "user-a" }, churchId: "church-b" }; render(<BellHarness />); await waitFor(() => host.querySelector('[data-testid="member-notification-badge"]') === null); });
  it("deduplicates mark-read clicks while the mutation is pending", async () => { let resolve!: (value: string) => void; state.mark.mockImplementation(() => new Promise<string>((done) => { resolve = done; })); render(<MemberNotificationsPage />); await waitFor(() => host.querySelector<HTMLButtonElement>('button[aria-label^="Weka arifa"]') !== null); const button = host.querySelector<HTMLButtonElement>('button[aria-label^="Weka arifa"]')!; act(() => button.click()); await waitFor(() => state.mark.mock.calls.length === 1); act(() => button.click()); expect(state.mark).toHaveBeenCalledTimes(1); await act(async () => { resolve("notification-a"); await Promise.resolve(); }); await waitFor(() => host.querySelector('button[aria-label^="Weka arifa"]') === null); });
  it("keeps unread state and announces a recoverable mutation failure", async () => { state.mark.mockRejectedValue(new Error("network")); render(<MemberNotificationsPage />); await waitFor(() => host.querySelector<HTMLButtonElement>('button[aria-label^="Weka arifa"]') !== null); act(() => host.querySelector<HTMLButtonElement>('button[aria-label^="Weka arifa"]')!.click()); await waitFor(() => state.toast.mock.calls.length === 1); expect(state.toast).toHaveBeenCalledWith(expect.objectContaining({ title: "Arifa haikuweza kusasishwa" })); expect(host.textContent).toContain("Mpya"); });
});

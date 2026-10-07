import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { changeAppLanguage } from "@/i18n";

const state = vi.hoisted(() => ({
  auth: {
    churchId: "church-a",
    activeChurchId: "church-a",
    availableChurches: [],
    user: { id: "user-a", email: "member@example.test", user_metadata: {} },
    profile: { full_name: null as string | null },
    member: { id: "member-a" },
    userRole: "member",
    userRoles: ["member"],
    staffWorkspace: "member",
    activeView: "member",
    signOut: vi.fn(),
    setActiveView: vi.fn(),
    switchChurch: vi.fn(),
  },
}));

vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => state.auth }));
vi.mock("@/lib/diocese-workspace", () => ({
  getMyDioceseWorkspaces: vi.fn().mockResolvedValue([]),
}));
vi.mock("@/components/auth/ProtectedRoute", () => ({ ProtectedRoute: ({ children }: { children: ReactNode }) => children }));
vi.mock("@/components/portal/BibleVersePopup", () => ({ BibleVersePopup: () => null }));
vi.mock("@/components/portal/MemberChurchSwitcherDialog", () => ({ MemberChurchSwitcherDialog: () => null }));
vi.mock("@/components/portal/MemberMobileBackHeader", () => ({ MemberMobileBackHeader: () => null }));
vi.mock("@/components/portal/MemberNotificationBell", () => ({ MemberNotificationBell: () => null }));
vi.mock("@/components/ui/LanguageSwitcher", () => ({ LanguageSwitcher: () => null }));
vi.mock("@/hooks/use-billing-access", () => ({
  useBillingAccess: () => ({ memberPortalAccess: "full", isLoading: false }),
}));
vi.mock("@/hooks/use-community-leader", () => ({
  useLedCommunities: () => ({ data: [], refetch: vi.fn() }),
}));
vi.mock("@/hooks/use-feature-access", () => ({
  useFeatureAccess: () => ({
    isLoading: false,
    isResolved: true,
    error: null,
    refetch: vi.fn(),
    getFeatureState: (key: string) => ({ key, exists: true, enabled: true, visible: true, locked: false }),
    isFeatureExplicitlyEnabledForChurch: () => true,
  }),
}));
vi.mock("@/hooks/use-member-notifications", () => ({ useMemberNotifications: () => ({ data: [] }) }));

import { PortalLayout } from "@/components/portal/PortalLayout";

function ShellApp() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  return (
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={["/portal"]}>
        <Routes>
          <Route path="/portal" element={<PortalLayout />}>
            <Route index element={<div data-testid="page">Portal page</div>} />
          </Route>
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe("member portal shell localization", () => {
  let host: HTMLDivElement;
  let root: Root;

  beforeEach(async () => {
    await act(async () => {
      await changeAppLanguage("en");
    });
    host = document.createElement("div");
    document.body.append(host);
    root = createRoot(host);
  });

  afterEach(() => {
    act(() => root.unmount());
    host.remove();
  });

  function renderShell() {
    act(() => root.render(<ShellApp />));
  }

  function sidebarText() {
    return host.querySelector('[data-testid="member-desktop-sidebar"]')?.textContent ?? "";
  }

  it("renders English shell copy and updates on an already-mounted language switch", async () => {
    renderShell();

    expect(sidebarText()).toContain("Member");
    expect(sidebarText()).toContain("Primary");
    expect(sidebarText()).toContain("Home");
    expect(sidebarText()).toContain("My Parish");
    expect(sidebarText()).toContain("Services");
    expect(sidebarText()).not.toContain("Mwanachama");

    await act(async () => {
      await changeAppLanguage("sw");
    });

    expect(sidebarText()).toContain("Mwanachama");
    expect(sidebarText()).toContain("Kuu");
    expect(sidebarText()).toContain("Nyumbani");
    expect(sidebarText()).toContain("Parokia Yangu");
    expect(sidebarText()).toContain("Huduma");
    expect(sidebarText()).not.toContain("Primary");

    await act(async () => {
      await changeAppLanguage("en");
    });

    expect(sidebarText()).toContain("Member");
    expect(sidebarText()).toContain("Primary");
    expect(sidebarText()).toContain("Home");
    expect(sidebarText()).toContain("My Parish");
    expect(sidebarText()).not.toContain("Mwanachama");
  });
});

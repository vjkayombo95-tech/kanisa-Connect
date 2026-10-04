import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  signOut: vi.fn(),
  auth: {
    churchId: "church-a",
    activeChurchId: "church-a",
  },
  ledCommunities: [] as Array<{
    community_id: string;
    community_name: string;
    leadership_role: string;
    church_id: string;
  }>,
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({
    signOut: state.signOut,
    profile: { full_name: "Tino Haule" },
    user: { id: "user-a", email: "tino@example.test", user_metadata: {} },
    churchId: state.auth.churchId,
    activeChurchId: state.auth.activeChurchId,
    userRole: "member",
  }),
}));

vi.mock("@/hooks/use-community-leader", () => ({
  useLedCommunities: () => ({
    data: state.ledCommunities.filter((community) => community.church_id === (state.auth.activeChurchId ?? state.auth.churchId)),
    isLoading: false,
  }),
}));

vi.mock("@/components/auth/ProtectedRoute", () => ({
  ProtectedRoute: ({ children }: { children: ReactNode }) => children,
}));

vi.mock("@/hooks/use-feature-access", () => ({
  useFeatureAccess: () => ({
    isLoading: false,
    getFeatureState: (key: string) => ({ key, exists: true, visible: true, locked: false }),
  }),
}));

vi.mock("@/hooks/use-church-livestream", () => ({
  useLivestreamPermission: () => ({ data: true, isLoading: false }),
}));

vi.mock("@/hooks/use-church-radio", () => ({
  useRadioPermission: () => ({ data: true, isLoading: false }),
}));

import { CommunityLeaderLayout } from "@/components/community-leader/CommunityLeaderLayout";

function LocationProbe() {
  const location = useLocation();
  return <output data-testid="location">{location.pathname}</output>;
}

function CommunityLeaderApplication({ initialPath = "/community/community-a/dashboard" }: { initialPath?: string }) {
  return (
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route path="/portal" element={<><div>Member portal</div><LocationProbe /></>} />
        <Route path="/community/:communityId" element={<CommunityLeaderLayout />}>
          <Route path="dashboard" element={<div>Community dashboard</div>} />
        </Route>
      </Routes>
    </MemoryRouter>
  );
}

function render(node: ReactNode) {
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  act(() => root.render(node));
  return { host, root };
}

describe("community leader context switching", () => {
  let mounted: { host: HTMLDivElement; root: Root } | null = null;

  beforeEach(() => {
    mounted = null;
    state.signOut.mockClear();
    state.auth.churchId = "church-a";
    state.auth.activeChurchId = "church-a";
    state.ledCommunities = [
      {
        community_id: "community-a",
        community_name: "Mtakatifu Paulo",
        leadership_role: "Mwenyekiti",
        church_id: "church-a",
      },
    ];
  });

  afterEach(() => {
    if (mounted) {
      act(() => mounted?.root.unmount());
      mounted.host.remove();
    }
  });

  it("exposes a desktop return-to-member action that navigates to /portal without logout", () => {
    mounted = render(<CommunityLeaderApplication />);

    const headerButtons = mounted.host.querySelectorAll<HTMLButtonElement>("header button");
    act(() => headerButtons[headerButtons.length - 1].click());

    const header = mounted.host.querySelector("header");
    const returnLink = [...(header?.querySelectorAll<HTMLAnchorElement>("a") ?? [])]
      .find((link) => link.textContent?.includes("Rudi kama Mwanachama"));
    expect(returnLink).not.toBeUndefined();
    expect(returnLink?.getAttribute("href")).toBe("/portal");

    act(() => returnLink?.click());

    expect(mounted.host.querySelector('[data-testid="location"]')).toHaveTextContent("/portal");
    expect(state.signOut).not.toHaveBeenCalled();
  });

  it("exposes a mobile return-to-member action that navigates to /portal without logout", () => {
    mounted = render(<CommunityLeaderApplication />);

    const mobileHome = mounted.host.querySelector('[data-testid="staff-mobile-home-community"]');
    const returnLink = [...(mobileHome?.querySelectorAll<HTMLAnchorElement>("a") ?? [])]
      .find((link) => link.textContent?.includes("Rudi kama Mwanachama"));
    expect(returnLink).not.toBeUndefined();
    expect(returnLink?.getAttribute("href")).toBe("/portal");

    act(() => returnLink?.click());

    expect(mounted.host.querySelector('[data-testid="location"]')).toHaveTextContent("/portal");
    expect(state.signOut).not.toHaveBeenCalled();
  });

  it("blocks unauthorized community access through the layout leadership check", () => {
    state.ledCommunities = [];
    mounted = render(<CommunityLeaderApplication />);

    expect(mounted.host).toHaveTextContent("Access Denied");
    expect(mounted.host).toHaveTextContent("You are not a leader of this community.");
    expect(state.signOut).not.toHaveBeenCalled();
  });

  it("does not allow direct community workspace access from another active church", () => {
    state.ledCommunities = [
      {
        community_id: "community-b",
        community_name: "Mtakatifu Petro",
        leadership_role: "Mwenyekiti",
        church_id: "church-b",
      },
    ];
    mounted = render(<CommunityLeaderApplication initialPath="/community/community-b/dashboard" />);

    expect(mounted.host).toHaveTextContent("Access Denied");
    expect(mounted.host).toHaveTextContent("You are not a leader of this community.");

    act(() => mounted?.root.unmount());
    mounted.host.remove();
    mounted = null;

    state.auth.churchId = "church-b";
    state.auth.activeChurchId = "church-b";
    mounted = render(<CommunityLeaderApplication initialPath="/community/community-b/dashboard" />);

    expect(mounted.host).not.toHaveTextContent("Access Denied");
    expect(mounted.host).toHaveTextContent("Community dashboard");
  });
});

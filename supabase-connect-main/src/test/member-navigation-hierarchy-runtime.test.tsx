import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({
    churchId: "church-a",
    user: { id: "user-a", email: "member@example.test", user_metadata: {} },
    profile: { full_name: "Member Test" },
    userRole: "member",
    signOut: vi.fn(),
  }),
}));

vi.mock("@/hooks/use-billing-access", () => ({
  useBillingAccess: () => ({ memberPortalAccess: "full", isLoading: false }),
}));

vi.mock("@/hooks/use-community-leader", () => ({ useLedCommunities: () => ({ data: [] }) }));
vi.mock("@/hooks/use-member-notifications", () => ({ useMemberNotifications: () => ({ data: [] }) }));
vi.mock("@/components/auth/ProtectedRoute", () => ({ ProtectedRoute: ({ children }: { children: ReactNode }) => children }));
vi.mock("@/components/portal/BibleVersePopup", () => ({ BibleVersePopup: () => null }));
vi.mock("@/components/portal/MemberMobileBackHeader", () => ({ MemberMobileBackHeader: () => null }));
vi.mock("@/components/portal/MemberNotificationBell", () => ({ MemberNotificationBell: () => null }));
vi.mock("@/components/ui/LanguageSwitcher", () => ({ LanguageSwitcher: () => null }));
vi.mock("@/hooks/use-church-livestream", () => ({
  useChurchLivestream: () => ({
    churchId: "church-a",
    data: null,
    error: null,
    featureEnabled: true,
    featureLoading: false,
    isLoading: false,
  }),
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
vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key, i18n: { language: "sw" } }),
}));

import { PortalLayout } from "@/components/portal/PortalLayout";
import MemberServicesPage from "@/pages/portal/MemberServicesPage";

function PortalApplication({ basePath = "/portal", initialPath = basePath }: { basePath?: "/portal" | "/member"; initialPath?: string }) {
  return (
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route path={basePath} element={<PortalLayout />}>
          <Route index element={<div data-testid="page">Nyumbani page</div>} />
          <Route path="today" element={<div data-testid="page">Leo page</div>} />
          <Route path="my-parish" element={<div data-testid="page">Parokia Yangu page</div>} />
          <Route path="services" element={<div data-testid="page">Zaidi page</div>} />
          <Route path="give" element={<div data-testid="page">Michango page</div>} />
          <Route path="mass-intentions" element={<div data-testid="page">Nia page</div>} />
          <Route path="announcements" element={<div data-testid="page">Matangazo page</div>} />
          <Route path="jumuiya" element={<div data-testid="page">Jumuiya page</div>} />
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

function bottomNav(host: HTMLElement) {
  const nav = host.querySelector("nav.fixed");
  expect(nav).not.toBeNull();
  return nav as HTMLElement;
}

function linksFrom(nav: HTMLElement) {
  return [...nav.querySelectorAll("a")];
}

function activeBottomLabels(host: HTMLElement) {
  return linksFrom(bottomNav(host))
    .filter((link) => link.className.includes("bg-primary/12"))
    .map((link) => link.textContent);
}

describe("Wave 14 member navigation hierarchy runtime", () => {
  let mounted: { host: HTMLDivElement; root: Root } | null = null;

  beforeEach(() => {
    mounted = null;
  });

  afterEach(() => {
    if (mounted) {
      act(() => mounted?.root.unmount());
      mounted.host.remove();
    }
  });

  it("renders exactly the four mobile primary destinations with a working active state", () => {
    mounted = render(<PortalApplication />);
    const nav = bottomNav(mounted.host);
    const links = linksFrom(nav);

    expect((nav.firstElementChild as HTMLElement).style.gridTemplateColumns).toBe("repeat(4, minmax(0, 1fr))");
    expect(links.map((link) => link.getAttribute("href"))).toEqual([
      "/portal",
      "/portal/today",
      "/portal/my-parish",
      "/portal/services",
    ]);
    expect(nav).toHaveTextContent("Nyumbani");
    expect(nav).toHaveTextContent("Leo");
    expect(nav).toHaveTextContent("Parokia Yangu");
    expect(nav).toHaveTextContent("Zaidi");
    expect(nav).not.toHaveTextContent("Toa Mchango");
    expect(nav).not.toHaveTextContent("Nia za Misa");
    expect(nav).not.toHaveTextContent("Matangazo");

    expect(links[0]).toHaveClass("bg-primary/12");
    act(() => links[1].click());
    expect(mounted.host.querySelector('[data-testid="page"]')).toHaveTextContent("Leo page");
    expect(linksFrom(bottomNav(mounted.host))[1]).toHaveClass("bg-primary/12");

    act(() => linksFrom(bottomNav(mounted.host))[2].click());
    expect(mounted.host.querySelector('[data-testid="page"]')).toHaveTextContent("Parokia Yangu page");

    act(() => linksFrom(bottomNav(mounted.host))[3].click());
    expect(mounted.host.querySelector('[data-testid="page"]')).toHaveTextContent("Zaidi page");
  });

  it.each([
    ["/portal", "Nyumbani"],
    ["/portal/today", "Leo"],
    ["/portal/my-parish", "Parokia Yangu"],
    ["/portal/services", "Zaidi"],
    ["/portal/give", "Zaidi"],
    ["/portal/mass-intentions", "Zaidi"],
    ["/portal/announcements", "Zaidi"],
    ["/portal/jumuiya", "Zaidi"],
  ])("marks only %s active in the bottom nav", (path, expectedLabel) => {
    mounted = render(<PortalApplication initialPath={path} />);

    expect(activeBottomLabels(mounted.host)).toEqual([expectedLabel]);
  });

  it.each([
    ["/member", "Nyumbani"],
    ["/member/today", "Leo"],
    ["/member/my-parish", "Parokia Yangu"],
    ["/member/give", "Zaidi"],
  ])("preserves bottom-nav active semantics for %s aliases", (path, expectedLabel) => {
    mounted = render(<PortalApplication basePath="/member" initialPath={path} />);

    expect(activeBottomLabels(mounted.host)).toEqual([expectedLabel]);
  });

  it("keeps removed bottom-nav tasks discoverable in the actual Zaidi services page", () => {
    mounted = render(
      <MemoryRouter initialEntries={["/portal/services"]}>
        <MemberServicesPage />
      </MemoryRouter>,
    );

    expect(mounted.host).toHaveTextContent("Zaidi");
    expect(mounted.host).toHaveTextContent("Toa Mchango");
    expect(mounted.host).toHaveTextContent("Nia za Misa");
    expect(mounted.host).toHaveTextContent("Matangazo");
  });

  it("renders desktop Primary without duplicate Jumuiya and keeps secondary groups intact", () => {
    mounted = render(<PortalApplication />);
    const sidebar = mounted.host.querySelector('[data-testid="member-desktop-sidebar"]');
    expect(sidebar).not.toBeNull();
    const primary = sidebar?.querySelector('section[aria-label="Primary"]');
    const huduma = sidebar?.querySelector('section[aria-label="Huduma"]');
    const kiroho = sidebar?.querySelector('section[aria-label="Kiroho"]');
    const media = sidebar?.querySelector('section[aria-label="Media"]');

    expect(primary).toHaveTextContent("Nyumbani");
    expect(primary).toHaveTextContent("Leo");
    expect(primary).toHaveTextContent("Parokia Yangu");
    expect(primary).not.toHaveTextContent("Jumuiya Yangu");

    act(() => (huduma?.querySelector("button") as HTMLButtonElement).click());
    expect(huduma).toHaveTextContent("Jumuiya Yangu");
    expect(huduma).toHaveTextContent("Michango");
    expect(huduma).toHaveTextContent("Nia za Misa");
    expect(huduma).toHaveTextContent("Matangazo");
    expect(kiroho).toHaveTextContent("Kiroho");
    expect(media).toHaveTextContent("Media");
  });
});

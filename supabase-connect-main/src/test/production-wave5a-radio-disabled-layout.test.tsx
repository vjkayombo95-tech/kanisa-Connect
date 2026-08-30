import { act, type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  featureLoading: false,
  feature: { key: "radio", exists: true, enabled: false, visible: false, locked: false },
  rpc: vi.fn(),
  fetchStations: vi.fn(),
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({
    churchId: "church-a",
    user: { id: "user-a", email: "member@example.test", user_metadata: {} },
    profile: { full_name: "Test Member" },
    userRole: "member",
    signOut: vi.fn(),
  }),
}));
vi.mock("@/hooks/use-feature-access", () => ({
  useFeatureAccess: () => ({
    isLoading: mocks.featureLoading,
    isResolved: !mocks.featureLoading,
    error: null,
    refetch: vi.fn(),
    getFeatureState: () => mocks.feature,
  }),
}));
vi.mock("@/hooks/use-billing-access", () => ({
  useBillingAccess: () => ({ memberPortalAccess: "full", isLoading: false }),
}));
vi.mock("@/hooks/use-community-leader", () => ({ useLedCommunities: () => ({ data: [] }) }));
vi.mock("@/components/auth/ProtectedRoute", () => ({
  ProtectedRoute: ({ children }: { children: ReactNode }) => children,
}));
vi.mock("@/components/portal/BibleVersePopup", () => ({ BibleVersePopup: () => null }));
vi.mock("@/components/portal/MemberMobileBackHeader", () => ({ MemberMobileBackHeader: () => null }));
vi.mock("@/components/ui/LanguageSwitcher", () => ({ LanguageSwitcher: () => null }));
vi.mock("@/components/portal/PersistentLivestreamPlayer", () => ({ PersistentLivestreamPlayer: () => null }));
vi.mock("@/contexts/PersistentLivestreamContext", () => ({
  PersistentLivestreamProvider: ({ children }: { children: ReactNode }) => children,
}));
vi.mock("@/pages/portal/MemberRadioPage", () => ({ default: () => <div>Radio page</div> }));
vi.mock("@/components/portal/MemberDashboard", () => ({ default: () => <div>Member home</div> }));
vi.mock("@/pages/portal/MemberServicesPage", () => ({ default: () => <div>Member services</div> }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { rpc: mocks.rpc } }));
vi.mock("@/lib/church-radio", () => ({ fetchMemberRadioStations: mocks.fetchStations }));
vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key, i18n: { language: "en" } }),
}));

import MemberRoutes from "@/routes/MemberRoutes";

function RouterControls() {
  const navigate = useNavigate();
  const location = useLocation();
  return (
    <>
      <button onClick={() => navigate("/portal/radio")}>Direct Radio</button>
      <button onClick={() => navigate("/portal/services")}>Services</button>
      <output data-testid="route">{location.pathname}</output>
    </>
  );
}

function Application({ initialPath, client }: { initialPath: string; client: QueryClient }) {
  return (
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[initialPath]}>
        <RouterControls />
        <Routes>
          <Route path="/portal/*" element={<MemberRoutes />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

const preloadMemberShell = async () => {
  await Promise.all([
    import("@/components/portal/PortalLayout"),
    import("@/components/portal/MemberDashboard"),
    import("@/pages/portal/MemberServicesPage"),
    import("@/pages/portal/MemberRadioPage"),
  ]);
};

const radioAudioCount = () => document.querySelectorAll('[data-testid="persistent-radio-audio"]').length;
const waitForText = async (host: HTMLElement, text: string) => {
  await vi.waitFor(() => expect(host).toHaveTextContent(text));
};

describe("Wave 5A disabled Radio real member layout", () => {
  beforeAll(async () => {
    await preloadMemberShell();
  });

  beforeEach(() => {
    mocks.featureLoading = false;
    mocks.feature = { key: "radio", exists: true, enabled: false, visible: false, locked: false };
    mocks.rpc.mockReset();
    mocks.fetchStations.mockReset();
    vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => undefined);
    vi.spyOn(HTMLMediaElement.prototype, "load").mockImplementation(() => undefined);
  });

  it("never creates Radio media across direct-route loading, redirect, services, and remount", async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    client.setQueryData(["production-radio-permission", "view", "user-a", "church-a"], true);
    const host = document.createElement("div");
    document.body.append(host);
    let root: Root = createRoot(host);
    const application = (path = "/portal") => <Application initialPath={path} client={client} />;
    await act(async () => root.render(application()));

    await waitForText(host, "Member home");
    expect(radioAudioCount()).toBe(0);

    mocks.featureLoading = true;
    mocks.feature = { key: "radio", exists: false, enabled: true, visible: true, locked: false };
    await act(async () => root.render(application()));
    await act(async () => (host.querySelector("button") as HTMLButtonElement).click());
    expect(host.querySelector('[data-testid="route"]')).toHaveTextContent("/portal/radio");
    expect(radioAudioCount()).toBe(0);

    mocks.featureLoading = false;
    mocks.feature = { key: "radio", exists: true, enabled: false, visible: false, locked: false };
    await act(async () => root.render(application()));
    await waitForText(host.querySelector('[data-testid="route"]') as HTMLElement, "/portal");
    expect(radioAudioCount()).toBe(0);

    await act(async () => (host.querySelectorAll("button")[1] as HTMLButtonElement).click());
    await waitForText(host, "Member services");
    expect(radioAudioCount()).toBe(0);

    await act(async () => root.unmount());
    root = createRoot(host);
    await act(async () => root.render(application("/portal/services")));
    await waitForText(host, "Member services");
    expect(radioAudioCount()).toBe(0);
    expect(mocks.fetchStations).not.toHaveBeenCalled();
    expect(mocks.rpc).not.toHaveBeenCalled();
    await act(async () => root.unmount());
    host.remove();
    vi.restoreAllMocks();
  });
});

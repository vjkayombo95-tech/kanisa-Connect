import { act, type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  resolution: "loading" as "loading" | "enabled" | "disabled" | "error",
  assistantReads: vi.fn(),
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
    isLoading: mocks.resolution === "loading",
    isResolved: mocks.resolution === "enabled" || mocks.resolution === "disabled",
    error: mocks.resolution === "error" ? new Error("feature lookup failed") : null,
    getExplicitChurchFeatureResolution: () => mocks.resolution,
    isFeatureExplicitlyEnabledForChurch: () => mocks.resolution === "enabled",
    getFeatureState: (key: string) => ({
      key,
      exists: true,
      enabled: key === "kanisa_ai" && mocks.resolution === "enabled",
      visible: key === "kanisa_ai" && mocks.resolution === "enabled",
      locked: false,
    }),
  }),
}));
vi.mock("@/hooks/use-billing-access", () => ({
  useBillingAccess: () => ({ memberPortalAccess: "full", isLoading: false }),
}));
vi.mock("@/components/auth/ProtectedRoute", () => ({
  ProtectedRoute: ({ children }: { children: ReactNode }) => children,
}));
vi.mock("@/hooks/use-community-leader", () => ({ useLedCommunities: () => ({ data: [] }) }));
vi.mock("@/components/portal/BibleVersePopup", () => ({ BibleVersePopup: () => null }));
vi.mock("@/components/portal/MemberMobileBackHeader", () => ({ MemberMobileBackHeader: () => null }));
vi.mock("@/components/ui/LanguageSwitcher", () => ({ LanguageSwitcher: () => null }));
vi.mock("@/components/portal/PersistentLivestreamPlayer", () => ({ PersistentLivestreamPlayer: () => null }));
vi.mock("@/contexts/PersistentLivestreamContext", () => ({
  PersistentLivestreamProvider: ({ children }: { children: ReactNode }) => children,
  useOptionalPersistentLivestream: () => null,
  usePersistentLivestream: () => ({ activeStreamId: null, stream: null, featureEnabled: false, churchId: "church-a" }),
}));
vi.mock("@/hooks/use-church-livestream", () => ({
  useChurchLivestream: () => ({ data: null, featureEnabled: false, featureLoading: false, churchId: "church-a" }),
}));
vi.mock("@/pages/portal/KanisaAssistantPage", () => ({
  default: () => { mocks.assistantReads(); return <div data-testid="assistant-content">Uliza content</div>; },
}));
vi.mock("@/pages/portal/MemberDashboard", () => ({ default: () => <div>Member home</div> }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { rpc: mocks.rpc } }));
vi.mock("@/lib/church-radio", () => ({ fetchMemberRadioStations: mocks.fetchStations }));
vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key, i18n: { language: "en" } }),
}));

import MemberRoutes from "@/routes/MemberRoutes";

function RouteProbe() {
  return <output data-testid="route">{useLocation().pathname}</output>;
}

function Application({ client, revision }: { client: QueryClient; revision: string }) {
  return (
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={["/portal/kanisa-ai"]}>
        <div data-revision={revision}><RouteProbe /></div>
        <Routes><Route path="/portal/*" element={<MemberRoutes key={revision} />} /></Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

const flush = async () => {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)); });
  }
};

const waitForAssistant = async (host: HTMLElement) => {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    const element = host.querySelector('[data-testid="assistant-content"], [data-testid="uliza-kanisa-page"]');
    if (element) return element;
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)); });
  }
  throw new Error(`Timed out waiting for assistant: ${host.textContent}`);
};

describe("Wave 5B Uliza cold-load feature gate", () => {
  let host: HTMLDivElement;
  let root: Root;
  let client: QueryClient;

  beforeEach(() => {
    mocks.resolution = "loading";
    mocks.assistantReads.mockReset();
    mocks.rpc.mockReset();
    mocks.fetchStations.mockReset();
    host = document.createElement("div");
    document.body.append(host);
    root = createRoot(host);
    client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  });

  afterEach(async () => {
    if (host.isConnected) {
      await act(async () => root.unmount());
      host.remove();
    }
  });

  it("waits on a cold direct load, then renders only after explicit enablement resolves", async () => {
    await act(async () => root.render(<Application client={client} revision="loading" />));
    await flush();
    expect(host.querySelector('[data-testid="route"]')).toHaveTextContent("/portal/kanisa-ai");
    expect(host).toHaveTextContent("Inapakia");
    expect(mocks.assistantReads).not.toHaveBeenCalled();

    mocks.resolution = "enabled";
    await act(async () => root.render(<Application client={client} revision="enabled" />));
    await flush();
    expect(host.querySelector('[data-testid="route"]')).toHaveTextContent("/portal/kanisa-ai");
    expect(await waitForAssistant(host)).toBeInTheDocument();
    expect(mocks.assistantReads).toHaveBeenCalledTimes(1);
    await act(async () => root.unmount());
    host.remove();
  });

  it.each(["disabled", "error"] as const)("fails closed after a resolved %s result", async (resolution) => {
    await act(async () => root.render(<Application client={client} revision="loading" />));
    await flush();
    mocks.resolution = resolution;
    await act(async () => root.render(<Application client={client} revision={resolution} />));
    await flush();
    expect(host.querySelector('[data-testid="route"]')).toHaveTextContent("/portal");
    expect(mocks.assistantReads).not.toHaveBeenCalled();
    expect(document.querySelectorAll("audio")).toHaveLength(0);
    expect(mocks.fetchStations).not.toHaveBeenCalled();
    await act(async () => root.unmount());
    host.remove();
  });

  it("survives a full remount with a fresh loading state before resolving enabled again", async () => {
    await act(async () => root.render(<Application client={client} revision="loading-initial" />));
    await flush();
    mocks.resolution = "enabled";
    await act(async () => root.render(<Application client={client} revision="enabled-initial" />));
    await flush();
    expect(await waitForAssistant(host)).toBeInTheDocument();

    await act(async () => root.unmount());
    root = createRoot(host);
    client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    mocks.resolution = "loading";
    await act(async () => root.render(<Application client={client} revision="loading-refresh" />));
    await flush();
    expect(host.querySelector('[data-testid="route"]')).toHaveTextContent("/portal/kanisa-ai");
    expect(mocks.assistantReads).toHaveBeenCalledTimes(1);

    mocks.resolution = "enabled";
    await act(async () => root.render(<Application client={client} revision="enabled-refresh" />));
    await flush();
    expect(await waitForAssistant(host)).toBeInTheDocument();
    expect(mocks.assistantReads).toHaveBeenCalledTimes(2);
    await act(async () => root.unmount());
    host.remove();
  });
});

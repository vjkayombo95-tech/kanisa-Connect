import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { ChurchLivestream } from "@/lib/church-livestreams";

const componentState = vi.hoisted(() => ({
  hookResult: {
    data: null as ChurchLivestream | null,
    featureEnabled: true,
    featureLoading: false,
    isLoading: false,
    isError: false,
    error: null as Error | null,
    churchId: "church-a",
    refetch: vi.fn(),
  },
  player: { activeStreamId: null as string | null, open: vi.fn() },
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ churchId: "church-a", user: { id: "user-a" } }),
}));

vi.mock("@/contexts/PersistentLivestreamContext", () => ({
  useOptionalPersistentLivestream: () => componentState.player,
  usePersistentLivestream: () => componentState.player,
}));

vi.mock("@/hooks/use-church-livestream", async (importActual) => {
  const actual = await importActual<typeof import("@/hooks/use-church-livestream")>();
  return {
    ...actual,
    useChurchLivestream: () => componentState.hookResult,
    useMemberLivestream: () => componentState.hookResult,
  };
});

import { ProductionLiveMassCard } from "@/components/portal/ProductionLiveMassCard";
import MemberLivestreamPage from "@/pages/portal/MemberLivestreamPage";

const stream = (overrides: Partial<ChurchLivestream> = {}): ChurchLivestream => ({
  id: "stream-a",
  churchId: "church-a",
  status: "live",
  title: "Misa ya Jumapili",
  provider: "youtube",
  watchUrl: "https://www.youtube.com/watch?v=M7lc1UVf-VE",
  providerExternalId: "M7lc1UVf-VE",
  scheduledStart: "2026-09-09T09:15:00.000Z",
  scheduledEnd: "2026-09-09T10:15:00.000Z",
  actualStartedAt: "2026-09-09T09:00:00.000Z",
  actualEndedAt: null,
  ...overrides,
});

describe("member livestream truthful presentation", () => {
  let host: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-09T09:00:00.000Z"));
    componentState.hookResult = {
      data: stream(),
      featureEnabled: true,
      featureLoading: false,
      isLoading: false,
      isError: false,
      error: null,
      churchId: "church-a",
      refetch: vi.fn(),
    };
    componentState.player = { activeStreamId: null, open: vi.fn() };
    host = document.createElement("div");
    document.body.append(host);
    root = createRoot(host);
  });

  afterEach(() => {
    act(() => root.unmount());
    host.remove();
    vi.useRealTimers();
  });

  const renderCard = () => act(() => root.render(<ProductionLiveMassCard />));
  const renderPage = () => act(() => root.render(
    <MemoryRouter initialEntries={["/portal/live/stream-a"]}>
      <Routes><Route path="/portal/live/:streamId" element={<MemberLivestreamPage />} /></Routes>
    </MemoryRouter>,
  ));

  it("presents a genuinely live stream as live with a live CTA", () => {
    renderCard();
    expect(host.textContent).toContain("LIVE SASA");
    expect(host.textContent).toContain("Tazama Moja kwa Moja");
  });

  it("presents a scheduled stream as upcoming with its scheduled time, not live", () => {
    componentState.hookResult.data = stream({ status: "scheduled", actualStartedAt: null, scheduledStart: "2026-09-09T09:10:00.000Z" });
    renderPage();
    expect(host.textContent).toContain("INAKUJA KARIBUNI");
    expect(host.textContent).toContain("Inaanza");
    expect(host.textContent).toContain("Fungua Misa Ijayo");
    expect(host.textContent).not.toContain("LIVE SASA");
    expect(host.textContent).not.toContain("Tazama Moja kwa Moja");
  });

  it("does not present ended or stale streams as live", () => {
    componentState.hookResult.data = stream({ actualEndedAt: "2026-09-09T09:05:00.000Z" });
    renderPage();
    expect(host.querySelector('[data-testid="livestream-unavailable"]')).not.toBeNull();
    expect(host.textContent).not.toContain("LIVE SASA");
  });

  it("keeps loading, generic error, and retry behavior without exposing raw backend errors", () => {
    componentState.hookResult.isLoading = true;
    componentState.hookResult.data = null;
    renderPage();
    expect(host.getAttribute("aria-busy") ?? host.querySelector("[aria-busy]")?.getAttribute("aria-busy")).toBe("true");

    componentState.hookResult.isLoading = false;
    componentState.hookResult.isError = true;
    componentState.hookResult.error = new Error("permission denied: raw backend detail");
    renderPage();
    expect(host.querySelector('[data-testid="livestream-error"]')).not.toBeNull();
    expect(host.textContent).toContain("Misa Mubashara haikuweza kupakiwa");
    expect(host.textContent).not.toContain("permission denied");
    act(() => host.querySelector<HTMLButtonElement>("button")?.click());
    expect(componentState.hookResult.refetch).toHaveBeenCalledTimes(1);
  });
});

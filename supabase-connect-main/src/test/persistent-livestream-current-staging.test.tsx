import { act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter, Route, Routes, useNavigate } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { PersistentLivestreamPlayer } from "@/components/portal/PersistentLivestreamPlayer";
import { PersistentLivestreamProvider, usePersistentLivestream } from "@/contexts/PersistentLivestreamContext";
import type { ChurchLivestream } from "@/lib/church-livestreams";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const state = vi.hoisted(() => ({
  auth: { churchId: "church-a", user: { id: "user-a" } } as { churchId: string | null; user: { id: string } | null },
  streams: new Map<string, ChurchLivestream>(),
  featureEnabled: true,
}));

vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => state.auth }));
vi.mock("@/hooks/use-church-livestream", () => ({
  useMemberLivestream: (streamId?: string) => ({ data: streamId ? state.streams.get(streamId) ?? null : null, error: null, featureEnabled: state.featureEnabled, featureLoading: false, churchId: state.auth.churchId }),
}));

const stream = (id: string): ChurchLivestream => ({ id, churchId: "church-a", status: "live", title: `Mass ${id}`, provider: "youtube", watchUrl: `https://www.youtube.com/watch?v=${id === "A" ? "abc123DEF45" : "xyz123DEF45"}`, scheduledStart: null, scheduledEnd: null, actualStartedAt: "2026-08-13T08:00:00Z", actualEndedAt: null, recordingUrl: null, thumbnailUrl: null, providerExternalId: id === "A" ? "abc123DEF45" : "xyz123DEF45", providerStatus: "live", providerLastCheckedAt: null, providerLastErrorCategory: null, statusSource: "provider" });

function Controls() {
  const player = usePersistentLivestream();
  const navigate = useNavigate();
  return <><button onClick={() => player.open("A")}>Open A</button><button onClick={() => player.open("B")}>Open B</button><button onClick={() => navigate("/portal")}>Home</button><button onClick={() => navigate("/portal/announcements")}>Announcements</button></>;
}

function App() {
  return <MemoryRouter initialEntries={["/portal"]}><PersistentLivestreamProvider><Controls /><Routes><Route path="*" element={<div>Route</div>} /></Routes><PersistentLivestreamPlayer /></PersistentLivestreamProvider></MemoryRouter>;
}

function mount() {
  const container = document.createElement("div"); document.body.appendChild(container);
  const root = createRoot(container); act(() => root.render(<App />));
  return { container, rerender: () => act(() => root.render(<App />)), unmount: () => { act(() => root.unmount()); container.remove(); } };
}

function click(container: HTMLElement, label: string) {
  const target = [...container.querySelectorAll("button")].find((button) => button.textContent === label || button.getAttribute("aria-label") === label);
  if (!target) throw new Error(`Missing button: ${label}`);
  act(() => target.click());
}

describe("persistent livestream on current staging contracts", () => {
  beforeEach(() => { state.auth = { churchId: "church-a", user: { id: "user-a" } }; state.featureEnabled = true; state.streams = new Map([["A", stream("A")], ["B", stream("B")]]); });

  it("keeps one iframe through full, mini, navigation, and expand", () => {
    const view = mount(); click(view.container, "Open A");
    const iframe = view.container.querySelector('[data-testid="livestream-embed"]');
    expect(iframe).not.toBeNull(); expect(view.container.querySelector('[data-player-mode="full"]')).not.toBeNull();
    click(view.container, "Home"); expect(view.container.querySelector('[data-player-mode="mini"]')).not.toBeNull();
    click(view.container, "Announcements"); expect(view.container.querySelectorAll('[data-testid="livestream-embed"]')).toHaveLength(1); expect(view.container.querySelector('[data-testid="livestream-embed"]')).toBe(iframe);
    click(view.container, "Expand live stream"); expect(view.container.querySelector('[data-player-mode="full"]')).not.toBeNull(); expect(view.container.querySelector('[data-testid="livestream-embed"]')).toBe(iframe); view.unmount();
  });

  it("closes and stays dismissed", () => {
    const view = mount(); click(view.container, "Open A"); click(view.container, "Home"); click(view.container, "Close live stream");
    expect(view.container.querySelector('[data-testid="livestream-embed"]')).toBeNull(); click(view.container, "Announcements"); expect(view.container.querySelector('[data-testid="persistent-livestream-player"]')).toBeNull(); view.unmount();
  });

  it("switches from A to B deterministically with one player", () => {
    const view = mount(); click(view.container, "Open A"); click(view.container, "Home"); click(view.container, "Open B");
    expect(view.container.querySelector('[data-stream-id="B"]')).not.toBeNull(); expect(view.container.querySelectorAll('[data-testid="livestream-embed"]')).toHaveLength(1); expect(view.container.querySelector("iframe")?.getAttribute("src")).toContain("xyz123DEF45"); view.unmount();
  });

  it("clears on logout or tenant change", () => {
    const view = mount(); click(view.container, "Open A"); state.auth = { churchId: null, user: null }; view.rerender(); expect(view.container.querySelector('[data-testid="persistent-livestream-player"]')).toBeNull();
    state.auth = { churchId: "church-a", user: { id: "user-a" } }; view.rerender(); click(view.container, "Open A"); state.auth = { churchId: "church-b", user: { id: "user-a" } }; view.rerender(); expect(view.container.querySelector('[data-testid="persistent-livestream-player"]')).toBeNull(); view.unmount();
  });

  it("updates LIVE to ENDED without adding a player", () => {
    const view = mount(); click(view.container, "Open A"); expect(view.container.textContent).toContain("LIVE"); state.streams.set("A", { ...stream("A"), status: "ended", actualEndedAt: "2026-08-13T09:00:00Z", recordingUrl: "https://www.youtube.com/watch?v=abc123DEF45" }); view.rerender(); expect(view.container.textContent).toContain("ENDED"); expect(view.container.querySelectorAll("iframe")).toHaveLength(1); view.unmount();
  });
});

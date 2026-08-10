import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ churchId: "church-a", stream: null as Record<string, unknown> | null, stations: [] as Record<string, unknown>[], play: vi.fn() }));
vi.mock("@/hooks/use-church-livestream", () => ({ useChurchLivestream: () => ({ data: mocks.stream, error: null, featureEnabled: true, churchId: mocks.churchId }) }));
vi.mock("@/hooks/use-church-radio", () => ({ useChurchRadioStations: () => ({ data: mocks.stations, error: null, featureEnabled: true, churchId: mocks.churchId }) }));
vi.mock("@/contexts/RadioPlayerContext", () => ({ useRadioPlayer: () => ({ play: mocks.play }) }));

import { DesktopLiveMediaAwareness } from "@/components/portal/DesktopLiveMediaAwareness";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const liveStream = (id = "live-1", churchId = "church-a") => ({ id, churchId, status: "live", title: "Holy Mass with a deliberately long parish title", provider: "youtube", watchUrl: "https://www.youtube.com/watch?v=abcdefghijk", providerExternalId: "abcdefghijk", scheduledStart: null, scheduledEnd: null, actualStartedAt: "2026-08-10T10:00:00Z", actualEndedAt: null, recordingUrl: null, thumbnailUrl: null, providerStatus: "live", providerLastCheckedAt: null, providerLastErrorCategory: null, statusSource: "manual" });
const station = (churchId = "church-a") => ({ id: "radio-1", selectionId: "selection-1", churchId, name: "Radio Maria Tanzania", streamUrl: "https://example.com/radio", websiteUrl: null, logoUrl: null, description: null, provider: null, streamFormat: null, isActive: true, isApproved: true, healthStatus: null, lastHealthCheckedAt: null, enabled: true, isFeatured: true, sortOrder: 0 });

let container: HTMLDivElement;
let root: Root;
function paint(disabled = false) { act(() => root.render(<MemoryRouter><DesktopLiveMediaAwareness disabled={disabled} /></MemoryRouter>)); }
function byTestId(id: string) { return container.querySelector(`[data-testid="${id}"]`); }
function click(selector: string) { const element = container.querySelector<HTMLElement>(selector); expect(element).not.toBeNull(); act(() => element!.dispatchEvent(new MouseEvent("click", { bubbles: true }))); }
function clickButtonText(text: string) { const element = [...container.querySelectorAll("button")].find((button) => button.textContent?.includes(text)); expect(element).toBeDefined(); act(() => element!.dispatchEvent(new MouseEvent("click", { bubbles: true }))); }

describe("DesktopLiveMediaAwareness", () => {
  beforeEach(() => { mocks.stream = liveStream(); mocks.stations = [station()]; mocks.play.mockReset(); container = document.createElement("div"); document.body.appendChild(container); root = createRoot(container); });
  afterEach(() => { act(() => root.unmount()); container.remove(); });

  it("shows one panel with an internal viewer and gesture-driven singleton radio", () => {
    paint();
    expect(byTestId("desktop-live-media-awareness")).not.toBeNull();
    expect(container.querySelector<HTMLAnchorElement>('a[href="/church-live/live-1"]')).not.toBeNull();
    clickButtonText("Listen Now");
    expect(mocks.play).toHaveBeenCalledWith(expect.objectContaining({ id: "radio-1", churchId: "church-a" }));
    expect(container.innerHTML).not.toContain("autoplay");
    expect(container.innerHTML).not.toContain("metadata_url");
  });

  it("dismisses, retains the indicator, and reopens from it", () => {
    paint();
    click('button[aria-label="Funga taarifa ya Live Media"]');
    expect(byTestId("desktop-live-media-awareness")).toBeNull();
    expect(byTestId("desktop-live-indicator")).not.toBeNull();
    click('[data-testid="desktop-live-indicator"]');
    expect(byTestId("desktop-live-media-awareness")).not.toBeNull();
  });

  it("does not reopen dismissed media on rerender but surfaces a new livestream", () => {
    paint();
    click('button[aria-label="Funga taarifa ya Live Media"]');
    paint();
    expect(byTestId("desktop-live-media-awareness")).toBeNull();
    mocks.stream = liveStream("live-2");
    paint();
    expect(byTestId("desktop-live-media-awareness")).not.toBeNull();
  });

  it("fails closed for cross-church or absent media and excludes Super Admin", () => {
    mocks.stream = liveStream("live-1", "church-b"); mocks.stations = [station("church-b")]; paint();
    expect(byTestId("desktop-live-indicator")).toBeNull();
    mocks.stream = null; mocks.stations = []; paint();
    expect(byTestId("desktop-live-indicator")).toBeNull();
    mocks.stream = liveStream(); mocks.stations = [station()]; paint(true);
    expect(byTestId("desktop-live-indicator")).toBeNull();
  });
});

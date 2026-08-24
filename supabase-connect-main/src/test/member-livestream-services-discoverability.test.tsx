import { act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter, useLocation } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  churchId: "church-a",
  featureEnabled: true,
  featureLoading: false,
  isLoading: false,
  error: null as Error | null,
  stream: null as null | {
    id: string; churchId: string; status: "live" | "scheduled"; title: string; provider: "youtube" | "custom";
    watchUrl: string; providerExternalId: string | null; scheduledStart: string | null; scheduledEnd: string | null;
    actualStartedAt: string | null; actualEndedAt: string | null; recordingUrl: string | null; thumbnailUrl: string | null;
    providerStatus: "live" | "scheduled" | null; providerLastCheckedAt: string | null; providerLastErrorCategory: string | null;
    statusSource: "manual";
  },
}));

vi.mock("@/hooks/use-feature-access", () => ({
  useFeatureAccess: () => ({
    getFeatureState: (key: string) => ({ key, exists: true, visible: true, enabled: true, locked: false }),
    isFeatureExplicitlyEnabledForChurch: () => true,
  }),
}));
vi.mock("@/hooks/use-church-livestream", () => ({
  useChurchLivestream: () => ({
    data: state.featureEnabled ? state.stream : null,
    featureEnabled: state.featureEnabled,
    featureLoading: state.featureLoading,
    isLoading: state.isLoading,
    error: state.error,
    churchId: state.churchId,
  }),
}));

import MemberServicesPage from "@/pages/portal/MemberServicesPage";
import { getPortalFeatureForPath } from "@/lib/portal-features";

const liveStream = () => ({
  id: "stream-a", churchId: "church-a", status: "live" as const, title: "UAT Live Mass", provider: "youtube" as const,
  watchUrl: "https://www.youtube.com/live/03pYP2Nmreo", providerExternalId: "03pYP2Nmreo", scheduledStart: null,
  scheduledEnd: null, actualStartedAt: "2026-08-23T08:00:00Z", actualEndedAt: null, recordingUrl: null,
  thumbnailUrl: null, providerStatus: "live" as const, providerLastCheckedAt: null, providerLastErrorCategory: null,
  statusSource: "manual" as const,
});

function LocationProbe() {
  return <output data-testid="location">{useLocation().pathname}</output>;
}

describe("member Livestream Services discoverability", () => {
  let host: HTMLDivElement;
  let root: ReturnType<typeof createRoot>;

  const render = () => act(() => root.render(
    <MemoryRouter initialEntries={["/portal/services"]}>
      <MemberServicesPage />
      <LocationProbe />
    </MemoryRouter>,
  ));
  const expandWorship = () => {
    const button = [...host.querySelectorAll("button")].find((item) => item.textContent?.includes("Ibada"));
    act(() => button?.click());
  };
  const livestreamLink = () => host.querySelector<HTMLAnchorElement>('a[href="/portal/live/stream-a"]');

  beforeEach(() => {
    state.churchId = "church-a";
    state.featureEnabled = true;
    state.featureLoading = false;
    state.isLoading = false;
    state.error = null;
    state.stream = liveStream();
    host = document.createElement("div");
    document.body.append(host);
    root = createRoot(host);
  });
  afterEach(() => {
    act(() => root.unmount());
    host.remove();
  });

  it("shows an eligible live stream and routes directly to its detail page", () => {
    render();
    expandWorship();
    expect(livestreamLink()?.textContent).toContain("Misa Mubashara");
    act(() => livestreamLink()?.click());
    expect(host.querySelector('[data-testid="location"]')?.textContent).toBe("/portal/live/stream-a");
  });

  it("shows an eligible near-term scheduled stream", () => {
    state.stream = { ...liveStream(), status: "scheduled", scheduledStart: new Date(Date.now() + 10 * 60 * 1000).toISOString(), actualStartedAt: null, providerStatus: "scheduled" };
    render();
    expandWorship();
    expect(livestreamLink()?.textContent).toContain("Misa inaanza hivi karibuni");
  });

  it.each([
    ["no stream", () => { state.stream = null; }],
    ["feature disabled", () => { state.featureEnabled = false; }],
    ["permission denied", () => { state.featureEnabled = false; }],
    ["invalid provider", () => { state.stream = { ...liveStream(), provider: "custom", providerExternalId: null }; }],
    ["invalid watch URL", () => { state.stream = { ...liveStream(), watchUrl: "https://example.test/not-youtube" }; }],
    ["cross-tenant stream", () => { state.stream = { ...liveStream(), churchId: "church-b" }; }],
  ])("hides the service for %s", (_label, arrange) => {
    arrange();
    render();
    expandWorship();
    expect(livestreamLink()).toBeNull();
    expect(host.textContent).not.toContain("Misa Mubashara");
  });

  it("maps Livestream detail paths to the fail-closed portal feature gate", () => {
    expect(getPortalFeatureForPath("/portal/live/stream-a")).toBe("livestream");
  });
});

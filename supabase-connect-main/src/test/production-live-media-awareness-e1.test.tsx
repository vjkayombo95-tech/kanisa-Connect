import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ChurchAdminLiveMediaAwareness } from "@/components/church-admin/ChurchAdminLiveMediaAwareness";

const state = vi.hoisted(() => ({
  workspace: "admin" as string | null,
  livestream: { featureEnabled: true, featureLoading: false, isLoading: false, isError: false, data: null as null | { status: "live" | "scheduled"; title: string; scheduledStart: string | null } },
  radio: { featureEnabled: true, featureLoading: false, isLoading: false, isError: false, data: [] as Array<{ name: string; isDefault: boolean }> },
}));

vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ staffWorkspace: state.workspace }) }));
vi.mock("@/hooks/use-church-livestream", () => ({ useChurchLivestream: () => state.livestream }));
vi.mock("@/hooks/use-church-radio", () => ({ useChurchRadioStations: () => state.radio }));

describe("Release E1 Church Admin Live Media awareness", () => {
  let host: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    state.workspace = "admin";
    state.livestream = { featureEnabled: true, featureLoading: false, isLoading: false, isError: false, data: null };
    state.radio = { featureEnabled: true, featureLoading: false, isLoading: false, isError: false, data: [] };
    host = document.createElement("div");
    document.body.append(host);
    root = createRoot(host);
  });

  afterEach(() => {
    act(() => root.unmount());
    host.remove();
  });

  const render = () => act(() => root.render(<MemoryRouter><ChurchAdminLiveMediaAwareness /></MemoryRouter>));

  it("shows authorized live and scheduled states without mounting playback", () => {
    state.livestream.data = { status: "live", title: "Sunday Mass", scheduledStart: null };
    render();
    expect(host.textContent).toContain("LIVE NOW");
    expect(host.textContent).toContain("Sunday Mass");
    expect(host.querySelectorAll("audio, iframe")).toHaveLength(0);

    state.livestream.data = { status: "scheduled", title: "Evening Mass", scheduledStart: "2026-08-23T15:00:00Z" };
    render();
    expect(host.textContent).toContain("Scheduled");
  });

  it("fails closed when both features are disabled or the role is unknown", () => {
    state.livestream.featureEnabled = false;
    state.radio.featureEnabled = false;
    render();
    expect(host.querySelector('[data-testid="church-admin-live-media"]')).toBeNull();

    state.livestream.featureEnabled = true;
    state.workspace = null;
    render();
    expect(host.querySelector('[data-testid="church-admin-live-media"]')).toBeNull();
  });

  it("does not expose an unauthorized individual service", () => {
    state.livestream.featureEnabled = false;
    state.radio.data = [{ name: "Parish Radio", isDefault: true }];
    render();
    expect(host.querySelector('[data-testid="church-admin-livestream-awareness"]')).toBeNull();
    expect(host.textContent).toContain("Parish Radio");
  });

  it("preserves the production role registry for pastoral and finance workspaces", () => {
    state.workspace = "pastoral";
    render();
    expect(host.querySelector('[data-testid="church-admin-livestream-awareness"]')).not.toBeNull();
    expect(host.querySelector('[data-testid="church-admin-radio-awareness"]')).toBeNull();

    state.workspace = "finance";
    render();
    expect(host.querySelector('[data-testid="church-admin-live-media"]')).toBeNull();
  });

  it("reports query failures without fabricating an inactive state", () => {
    state.livestream.isError = true;
    state.radio.isError = true;
    render();
    expect(host.textContent).toContain("Status is temporarily unavailable.");
    expect(host.textContent).toContain("Station status is temporarily unavailable.");
    expect(host.textContent).not.toContain("No active or scheduled broadcast");
    expect(host.textContent).not.toContain("No approved station");
  });

  it("creates zero audio elements when radio is disabled", () => {
    state.livestream.featureEnabled = false;
    state.radio.featureEnabled = false;
    render();
    expect(host.querySelectorAll("audio")).toHaveLength(0);
  });
});

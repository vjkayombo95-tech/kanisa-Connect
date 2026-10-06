import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import i18n, { changeAppLanguage } from "@/i18n";

const state = vi.hoisted(() => ({
  auth: { churchId: "church-a", user: { id: "user-a" } },
  stations: [
    {
      id: "radio-maria-tz",
      name: "Radio Maria Tanzania",
      streamUrl: "https://radio.example/live.mp3",
      websiteUrl: "https://radio.example",
      logoUrl: null,
      description: "Parish-approved station",
      isActive: true,
      isApproved: true,
      selectionId: "selection-a",
      churchId: "church-a",
      enabled: true,
      isDefault: true,
      sortOrder: 0,
    },
    {
      id: "radio-second",
      name: "Radio Second",
      streamUrl: "https://radio.example/second.mp3",
      websiteUrl: null,
      logoUrl: null,
      description: "Second dynamic description",
      isActive: true,
      isApproved: true,
      selectionId: "selection-b",
      churchId: "church-a",
      enabled: true,
      isDefault: false,
      sortOrder: 1,
    },
  ],
  featureEnabled: true,
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => state.auth,
}));

vi.mock("@/hooks/use-church-radio", () => ({
  useChurchRadioStations: () => ({
    data: state.featureEnabled ? state.stations : [],
    featureEnabled: state.featureEnabled,
    featureLoading: false,
    isLoading: false,
    isError: false,
    churchId: state.auth.churchId,
    refetch: vi.fn(),
  }),
}));

vi.mock("@/lib/church-radio", async (importActual) => {
  const actual = await importActual<typeof import("@/lib/church-radio")>();
  return { ...actual, setChurchRadioSelection: vi.fn() };
});

vi.mock("@/lib/error-logger", () => ({ logWarning: vi.fn() }));

import { PersistentRadioPlayer } from "@/components/portal/PersistentRadioPlayer";
import { LiveMediaCoordinatorProvider } from "@/contexts/LiveMediaCoordinator";
import { RadioPlayerProvider, useRadioPlayer } from "@/contexts/RadioPlayerContext";
import { setChurchRadioSelection } from "@/lib/church-radio";
import MemberRadioPage from "@/pages/portal/MemberRadioPage";

function Probe() {
  const player = useRadioPlayer();
  return (
    <output data-testid="radio-state">
      {player.state}:{player.station?.id ?? "none"}:{player.station?.streamUrl ?? "none"}:{player.volume}:{state.auth.churchId}
    </output>
  );
}

function Application() {
  return (
    <LiveMediaCoordinatorProvider>
      <RadioPlayerProvider>
        <MemberRadioPage />
        <PersistentRadioPlayer />
        <Probe />
      </RadioPlayerProvider>
    </LiveMediaCoordinatorProvider>
  );
}

describe("Slice E1 member Radio localization", () => {
  let host: HTMLDivElement;
  let root: Root;

  const render = () => act(() => root.render(<Application />));

  beforeEach(async () => {
    state.auth = { churchId: "church-a", user: { id: "user-a" } };
    state.featureEnabled = true;
    host = document.createElement("div");
    document.body.append(host);
    root = createRoot(host);
    await act(async () => { await changeAppLanguage("en"); });
    vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue();
    vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => undefined);
    vi.spyOn(HTMLMediaElement.prototype, "load").mockImplementation(() => undefined);
  });

  afterEach(() => {
    act(() => root.unmount());
    host.remove();
    vi.restoreAllMocks();
  });

  it("renders English and Swahili app copy while preserving dynamic station content", async () => {
    render();

    expect(host.textContent).toContain("Radio Maria Tanzania");
    expect(host.textContent).toContain("Parish-approved station");
    expect(host.textContent).toContain("Ready to listen");
    expect(host.textContent).toContain("Listen");
    expect(host.textContent).toContain("Open radio website");
    expect(host.textContent).toContain("Choose a station");
    expect(host.querySelector('input[aria-label="Volume"]')).not.toBeNull();

    await act(async () => { await changeAppLanguage("sw"); });

    expect(host.textContent).toContain("Radio Maria Tanzania");
    expect(host.textContent).toContain("Parish-approved station");
    expect(host.textContent).toContain("Tayari kusikiliza");
    expect(host.textContent).toContain("Sikiliza");
    expect(host.textContent).toContain("Fungua tovuti ya radio");
    expect(host.textContent).toContain("Chagua radio");
    expect(host.querySelector('input[aria-label="Sauti"]')).not.toBeNull();
    expect(host.querySelector<HTMLButtonElement>('button[aria-label="Jaribu tena radio"]')).toBeNull();
    expect(i18n.language).toBe("sw");
  });

  it("keeps canonical state, selected station, stream URL, volume, church scope, and audio element across language changes", async () => {
    render();
    const listen = Array.from(host.querySelectorAll("button")).find((button) => button.textContent?.includes("Listen"));
    await act(async () => { listen?.click(); });

    const audio = host.querySelector<HTMLAudioElement>('[data-testid="persistent-radio-audio"]');
    expect(audio).not.toBeNull();
    expect(host.querySelector('[data-testid="radio-state"]')?.textContent).toBe("playing:radio-maria-tz:https://radio.example/live.mp3:0.8:church-a");
    expect(audio?.src).toBe("https://radio.example/live.mp3");

    await act(async () => { await changeAppLanguage("sw"); });

    expect(host.querySelector<HTMLAudioElement>('[data-testid="persistent-radio-audio"]')).toBe(audio);
    expect(host.querySelector('[data-testid="radio-state"]')?.textContent).toBe("playing:radio-maria-tz:https://radio.example/live.mp3:0.8:church-a");
    expect(audio?.src).toBe("https://radio.example/live.mp3");
    expect(host.querySelector('[data-testid="persistent-radio-player"]')?.textContent).toContain("Inacheza sasa");
    expect(host.querySelector('button[aria-label="Sitisha radio"]')).not.toBeNull();
    expect(setChurchRadioSelection).not.toHaveBeenCalled();
  });

  it("preserves the fail-closed radio feature gate presentation", () => {
    state.featureEnabled = false;
    render();

    expect(host.querySelector('[data-testid="radio-unavailable"]')).not.toBeNull();
    expect(host.querySelector('[data-testid="persistent-radio-audio"]')).toBeNull();
    expect(host.querySelector('[data-testid="radio-state"]')?.textContent).toContain("closed:none");
  });
});

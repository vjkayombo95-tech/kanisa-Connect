import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type React from "react";

import { UniversalAudioPlayer } from "@/components/audio";
import { formatAudioTime, sourceFromTrack } from "@/components/audio/audio-player-types";
import type { UniversalAudioTrack } from "@/types/universal-audio";

const TEST_SOURCE = {
  id: "track-1",
  title: "Morning Reflection",
  subtitle: "Daily spoken content",
  src: "https://example.com/audio/morning-reflection.mp3",
  durationSeconds: 125,
  mimeType: "audio/mpeg",
};

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const mountedRoots: Array<{ root: Root; container: HTMLElement }> = [];

async function renderWithQueryClient(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  mountedRoots.push({ root, container });

  await act(async () => {
    root.render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
  });

  return container;
}

function getByLabel(container: HTMLElement, label: string) {
  const element = container.querySelector(`[aria-label="${label}"]`);
  if (!element) throw new Error(`Unable to find aria-label: ${label}`);
  return element as HTMLElement;
}

function click(element: HTMLElement) {
  act(() => {
    element.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
}

function keyDown(element: HTMLElement, key: string) {
  act(() => {
    element.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true }));
  });
}

function change(element: HTMLElement, value: string) {
  act(() => {
    Object.defineProperty(element, "value", { configurable: true, value });
    element.dispatchEvent(new Event("change", { bubbles: true }));
  });
}

describe("RC-AUDIO-02 Universal Audio Player", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    class ResizeObserverMock {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
    Object.defineProperty(globalThis, "ResizeObserver", {
      configurable: true,
      value: ResizeObserverMock,
    });
    Object.defineProperty(HTMLMediaElement.prototype, "play", {
      configurable: true,
      value: vi.fn().mockResolvedValue(undefined),
    });
    Object.defineProperty(HTMLMediaElement.prototype, "pause", {
      configurable: true,
      value: vi.fn(),
    });
  });

  afterEach(async () => {
    for (const { root, container } of mountedRoots.splice(0)) {
      await act(async () => {
        root.unmount();
      });
      container.remove();
    }
  });

  it("formats audio time and maps universal tracks without domain-specific assumptions", () => {
    expect(formatAudioTime(65)).toBe("1:05");
    expect(formatAudioTime(3661)).toBe("1:01:01");

    const source = sourceFromTrack({
      id: "track-2",
      title: "Homily",
      subtitle: "Sunday",
      stream_url: "https://example.com/homily.mp3",
      duration_seconds: 360,
      mime_type: "audio/mpeg",
    } as UniversalAudioTrack);

    expect(source).toMatchObject({
      id: "track-2",
      title: "Homily",
      src: "https://example.com/homily.mp3",
      durationSeconds: 360,
    });
  });

  it("renders the expanded player controls with accessible labels", async () => {
    const container = await renderWithQueryClient(<UniversalAudioPlayer source={TEST_SOURCE} variant="expanded" />);

    expect(container.querySelector('[data-testid="universal-audio-expanded-player"]')).toBeTruthy();
    expect(container.textContent).toContain("Morning Reflection");
    expect(getByLabel(container, "Play audio")).toBeTruthy();
    expect(getByLabel(container, "Seek audio")).toBeTruthy();
    expect(getByLabel(container, "Playback speed")).toBeTruthy();
    expect(getByLabel(container, "Volume")).toBeTruthy();
    expect(getByLabel(container, "Skip back 10 seconds")).toBeTruthy();
    expect(getByLabel(container, "Skip forward 10 seconds")).toBeTruthy();
  });

  it("renders the mini player variant", async () => {
    const container = await renderWithQueryClient(<UniversalAudioPlayer source={TEST_SOURCE} variant="mini" />);

    expect(container.querySelector('[data-testid="universal-audio-mini-player"]')).toBeTruthy();
    expect(container.textContent).toContain("Morning Reflection");
    expect(getByLabel(container, "Play audio")).toBeTruthy();
  });

  it("exposes play, speed, and keyboard shortcut interactions", async () => {
    const onSpeedChanged = vi.fn();
    const container = await renderWithQueryClient(<UniversalAudioPlayer source={TEST_SOURCE} variant="expanded" onSpeedChanged={onSpeedChanged} />);

    act(() => {
      container.querySelector("audio")?.dispatchEvent(new Event("canplay", { bubbles: true }));
    });
    click(getByLabel(container, "Play audio"));
    expect(HTMLMediaElement.prototype.play).toHaveBeenCalled();

    change(getByLabel(container, "Playback speed"), "1.5");
    expect(onSpeedChanged).toHaveBeenCalledWith(1.5);

    keyDown(container.querySelector('[data-testid="universal-audio-expanded-player"]') as HTMLElement, "k");
    expect(HTMLMediaElement.prototype.play).toHaveBeenCalledTimes(2);
  });

  it("keeps the player generic and wired to the universal audio foundation", () => {
    const root = process.cwd();
    const universalPlayer = readFileSync(join(root, "src/components/audio/UniversalAudioPlayer.tsx"), "utf8");
    const miniPlayer = readFileSync(join(root, "src/components/audio/MiniAudioPlayer.tsx"), "utf8");
    const expandedPlayer = readFileSync(join(root, "src/components/audio/ExpandedAudioPlayer.tsx"), "utf8");
    const indexSource = readFileSync(join(root, "src/components/audio/index.ts"), "utf8");

    expect(universalPlayer).toContain("useAudioTracks");
    expect(universalPlayer).toContain("useSaveAudioProgress");
    expect(universalPlayer).toContain("useRecordAudioHistory");
    expect(indexSource).toContain("UniversalAudioPlayer");
    expect(indexSource).toContain("MiniAudioPlayer");
    expect(indexSource).toContain("ExpandedAudioPlayer");

    const combined = `${universalPlayer}\n${miniPlayer}\n${expandedPlayer}`;
    expect(combined).not.toMatch(/Bible|bible|chapter|verse|scripture/);
  });
});

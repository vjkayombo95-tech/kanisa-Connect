import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { describe, expect, it, vi, afterEach, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type React from "react";

import { UniversalAudioPlayer } from "@/components/audio";
import { BibleSynchronizedAudioText } from "@/components/bible";
import { useAutoScroll, useSearchSegments } from "@/hooks/use-synchronization";
import {
  BibleIndexAdapter,
  BibleSegmentRenderer,
  HomilyIndexAdapter,
  IndexedContentSynchronizationProvider,
  PrayerIndexAdapter,
  StaticSynchronizationProvider,
  SynchronizationEngine,
  createBibleSynchronizationIndex,
} from "@/lib/synchronization";
import type { SynchronizationIndex } from "@/types/synchronization";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const baseIndex: SynchronizationIndex = {
  contentId: "content-1",
  trackId: "track-1",
  duration: 30,
  metadata: {},
  segments: [
    { id: "verse-1", type: "verse", start: 0, end: 10, text: "First verse text", confidence: 0.95, metadata: { verseNumber: 1 } },
    { id: "verse-2", type: "verse", start: 10, end: 20, text: "Second verse text", confidence: 0.9, metadata: { verseNumber: 2 } },
    { id: "verse-3", type: "verse", start: 20, end: 30, text: "Third verse text", confidence: 0.88, metadata: { verseNumber: 3 } },
    { id: "verse-1:word:1", type: "word", start: 0, end: 1, text: "First", confidence: 0.95, parentId: "verse-1", metadata: {} },
    { id: "verse-1:word:2", type: "word", start: 1, end: 2, text: "verse", confidence: 0.95, parentId: "verse-1", metadata: {} },
    { id: "verse-2:word:1", type: "word", start: 10, end: 11, text: "Second", confidence: 0.9, parentId: "verse-2", metadata: {} },
  ],
};

const mountedRoots: Array<{ root: Root; container: HTMLElement }> = [];

async function renderWithQueryClient(ui: React.ReactElement) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  mountedRoots.push({ root, container });

  await act(async () => {
    root.render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
  });

  return container;
}

describe("RC-AUDIO-03 Universal Synchronization Engine", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    class ResizeObserverMock {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
    Object.defineProperty(globalThis, "ResizeObserver", { configurable: true, value: ResizeObserverMock });
    Object.defineProperty(HTMLMediaElement.prototype, "play", { configurable: true, value: vi.fn().mockResolvedValue(undefined) });
    Object.defineProperty(HTMLMediaElement.prototype, "pause", { configurable: true, value: vi.fn() });
  });

  afterEach(async () => {
    for (const { root, container } of mountedRoots.splice(0)) {
      await act(async () => root.unmount());
      container.remove();
    }
  });

  it("uses binary search for current verse, current word, next, and previous lookups", () => {
    const engine = new SynchronizationEngine(baseIndex);

    expect(engine.currentSegment(12, "verse")?.id).toBe("verse-2");
    expect(engine.currentWord(1.5)?.id).toBe("verse-1:word:2");
    expect(engine.next(12, "verse")?.id).toBe("verse-3");
    expect(engine.previous(12, "verse")?.id).toBe("verse-1");
    expect(engine.seekToSegment("verse-2")).toBe(10);
    expect(engine.seekToTimestamp(9.5)).toBe(9.5);
    expect(engine.progress(15).percent).toBe(50);
  });

  it("keeps lookup implementation O(log n) and supports large indexes", () => {
    const largeIndex: SynchronizationIndex = {
      contentId: "large",
      trackId: "track-large",
      duration: 10000,
      metadata: {},
      segments: Array.from({ length: 10000 }, (_, index) => ({
        id: `section-${index}`,
        type: "section",
        start: index,
        end: index + 0.9,
        text: `Section ${index}`,
        confidence: 1,
        metadata: {},
      })),
    };

    const engine = new SynchronizationEngine(largeIndex);
    expect(engine.segmentAt(9876.2, "section")?.id).toBe("section-9876");

    const source = readFileSync(join(process.cwd(), "src/lib/synchronization/engine.ts"), "utf8");
    expect(source).toContain("while (low <= high)");
    expect(source).not.toMatch(/Bible|bible|verseNumber/);
  });

  it("loads through the provider abstraction", async () => {
    const provider = new StaticSynchronizationProvider(baseIndex);
    await provider.load();

    expect(provider.currentSegment(2, "verse")?.id).toBe("verse-1");
    expect(provider.timestampFor("verse-3")).toBe(20);
    expect(provider.search("second", "verse")[0]?.segment.id).toBe("verse-2");
  });

  it("adapts existing Bible timing data through the adapter layer", async () => {
    const provider = IndexedContentSynchronizationProvider.fromAdapter(new BibleIndexAdapter(), {
      contentId: "bible-content",
      trackId: "bible-track",
      verses: [
        { verse: 1, text: "Basi palikuwa na mtu", start: 2, end: 6, duration: 4, confidence: 0.8 },
        { verse: 2, text: "Huyu alimjia Yesu", start: 6, end: 12, duration: 6, confidence: 0.82 },
      ],
    });

    const index = await provider.load();
    expect(index.contentId).toBe("bible-content");
    expect(index.segments.some((segment) => segment.type === "word")).toBe(true);
    expect(provider.currentSegment(7, "verse")?.metadata.verseNumber).toBe(2);
    expect(provider.currentWord(2.5)?.text).toBe("Basi");
  });

  it("supports homily and prayer adapters without modifying the synchronization engine", async () => {
    const homilyProvider = IndexedContentSynchronizationProvider.fromAdapter(new HomilyIndexAdapter(), {
      contentId: "homily-1",
      segments: [{ id: "intro", type: "section", start: 0, end: 30, text: "Opening reflection", confidence: 1, metadata: {} }],
    });
    const prayerProvider = IndexedContentSynchronizationProvider.fromAdapter(new PrayerIndexAdapter(), {
      contentId: "prayer-1",
      segments: [{ id: "line-1", type: "sentence", start: 0, end: 8, text: "Lord hear our prayer", confidence: 1, metadata: {} }],
    });

    await homilyProvider.load();
    await prayerProvider.load();

    expect(homilyProvider.currentSegment(5, "section")?.text).toBe("Opening reflection");
    expect(prayerProvider.search("prayer", "sentence")[0]?.segment.id).toBe("line-1");
  });

  it("exposes renderer abstraction for Bible segments", () => {
    const renderer = new BibleSegmentRenderer();
    const rendered = renderer.renderSegment(baseIndex.segments[0], { active: true, words: [], onSeek: vi.fn() });
    expect(rendered).toBeTruthy();
  });

  it("search hook consumes a generic synchronization provider", async () => {
    const provider = new StaticSynchronizationProvider(baseIndex);
    await provider.load();

    function SearchHarness() {
      const results = useSearchSegments({ provider, query: "third", type: "verse" });
      return <span>{results[0]?.segment.id ?? "none"}</span>;
    }

    const container = await renderWithQueryClient(<SearchHarness />);

    expect(container.textContent).toContain("verse-3");
  });

  it("renders Bible highlighting and tap-to-seek as a provider consumer", async () => {
    const onSeek = vi.fn();
    const index = createBibleSynchronizationIndex({
      contentId: "bible-content",
      verses: [{ verse: 1, text: "Basi palikuwa", start: 2, end: 6, duration: 4, confidence: 0.8 }],
    });
    const container = await renderWithQueryClient(<BibleSynchronizedAudioText index={index} currentTime={2.5} onSeek={onSeek} autoScroll={false} />);

    expect(container.textContent).toContain("Current verse 1");
    const wordButton = [...container.querySelectorAll("button")].find((button) => button.textContent === "Basi") as HTMLButtonElement;
    expect(wordButton).toBeTruthy();

    act(() => {
      wordButton.click();
    });
    expect(onSeek).toHaveBeenCalledWith(2, expect.objectContaining({ type: "word", text: "Basi" }));
  });

  it("pauses auto-scroll after manual user scrolling", async () => {
    const scrollIntoView = vi.fn();
    const target = document.createElement("div");
    target.id = "active-sync-segment";
    target.scrollIntoView = scrollIntoView;
    document.body.appendChild(target);

    function AutoScrollHarness() {
      const state = useAutoScroll({ activeId: "active-sync-segment", pauseMs: 100 });
      return <span>{state.following ? "following" : "paused"}</span>;
    }

    const container = await renderWithQueryClient(<AutoScrollHarness />);
    expect(scrollIntoView).toHaveBeenCalled();

    act(() => {
      window.dispatchEvent(new WheelEvent("wheel"));
    });
    expect(container.textContent).toContain("paused");
    target.remove();
  });

  it("lets the UniversalAudioPlayer emit current time without knowing synchronization details", async () => {
    const onTimeUpdate = vi.fn();
    const container = await renderWithQueryClient(
      <UniversalAudioPlayer
        source={{ id: "track-1", title: "Generic indexed audio", src: "https://example.com/audio.mp3" }}
        onTimeUpdate={onTimeUpdate}
      />,
    );

    const audio = container.querySelector("audio") as HTMLAudioElement;
    act(() => {
      Object.defineProperty(audio, "currentTime", { configurable: true, value: 12 });
      Object.defineProperty(audio, "duration", { configurable: true, value: 30 });
      audio.dispatchEvent(new Event("timeupdate", { bubbles: true }));
    });

    expect(onTimeUpdate).toHaveBeenCalledWith(expect.objectContaining({ currentTime: 12, duration: 30 }));

    const playerSource = readFileSync(join(process.cwd(), "src/components/audio/UniversalAudioPlayer.tsx"), "utf8");
    expect(playerSource).not.toContain("SynchronizationProvider");
    expect(playerSource).not.toContain("BibleSynchronizationProvider");
  });
});

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { BibleIndexAdapter } from "@/lib/synchronization/adapters";
import { IndexedContentSynchronizationProvider } from "@/lib/synchronization/provider";

const root = process.cwd();

describe("RC-BIBLE-02 Synchronized Bible Reader", () => {
  it("loads Bible synchronization through the provider and BibleIndexAdapter", async () => {
    const provider = IndexedContentSynchronizationProvider.fromAdapter(new BibleIndexAdapter(), {
      contentId: "john-3",
      trackId: "track-john-3",
      duration: 12,
      verses: [
        { verse: 16, text: "For God so loved the world", start: 1, end: 6, duration: 5, confidence: 0.99 },
        { verse: 17, text: "For God did not send his Son", start: 6, end: 12, duration: 6, confidence: 0.98 },
      ],
    });

    const index = await provider.load();

    expect(index.contentId).toBe("john-3");
    expect(provider.currentSegment(2, "verse")?.metadata.verseNumber).toBe(16);
    expect(provider.currentWord(2)).toBeTruthy();
    expect(provider.timestampFor("verse-17")).toBe(6);
    expect(provider.progress(6).percent).toBe(50);
  });

  it("wires BibleReaderPage to synchronization without modifying platform engines", () => {
    const pageSource = readFileSync(join(root, "src/pages/portal/BibleReaderPage.tsx"), "utf8");
    const verseCardSource = readFileSync(join(root, "src/components/bible/reader/VerseCard.tsx"), "utf8");
    const verseListSource = readFileSync(join(root, "src/components/bible/reader/VerseList.tsx"), "utf8");
    const bottomMiniPlayerSource = readFileSync(join(root, "src/components/bible/reader/BottomMiniPlayer.tsx"), "utf8");
    const syncEngineSource = readFileSync(join(root, "src/lib/synchronization/engine.ts"), "utf8");
    const providerSource = readFileSync(join(root, "src/lib/synchronization/provider.ts"), "utf8");

    expect(pageSource).toContain("IndexedContentSynchronizationProvider");
    expect(pageSource).toContain("BibleIndexAdapter");
    expect(pageSource).toContain("useSynchronization");
    expect(pageSource).toContain("useAutoScroll");
    expect(pageSource).toContain("timestampFor");
    expect(pageSource).toContain("currentSegment(playbackTime, \"verse\")");
    expect(pageSource).toContain("currentWord(playbackTime)");
    expect(verseCardSource).toContain("BibleSegmentRenderer");
    expect(verseListSource).toContain("activeWordId");
    expect(bottomMiniPlayerSource).toContain("seekRequest");
    expect(bottomMiniPlayerSource).toContain("setInterval");
    expect(syncEngineSource).toContain("while (low <= high)");
    expect(providerSource).toContain("Synchronization provider must be loaded before use.");
  });

  it("documents the synchronization lifecycle", () => {
    const docs = readFileSync(join(root, "docs/PREMIUM_BIBLE_SYNCHRONIZATION.md"), "utf8");

    expect(docs).toContain("Synchronization Lifecycle");
    expect(docs).toContain("BibleIndexAdapter");
    expect(docs).toContain("BibleSegmentRenderer");
    expect(docs).toContain("timestampFor");
    expect(docs).toContain("Future Content");
  });
});

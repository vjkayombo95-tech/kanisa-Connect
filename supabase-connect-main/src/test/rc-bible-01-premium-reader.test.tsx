import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type React from "react";

import { BibleHeader, BibleToolbar, ContinueReadingCard, VerseCard, VerseList } from "@/components/bible/reader";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const mountedRoots: Array<{ root: Root; container: HTMLElement }> = [];

async function render(ui: React.ReactElement) {
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
    root.render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>{ui}</MemoryRouter>
      </QueryClientProvider>,
    );
  });

  return container;
}

describe("RC-BIBLE-01 Premium Bible Reader", () => {
  afterEach(async () => {
    for (const { root, container } of mountedRoots.splice(0)) {
      await act(async () => root.unmount());
      container.remove();
    }
  });

  it("renders the reusable header with navigation, translation, share, bookmark, and menu controls", async () => {
    const container = await render(
      <BibleHeader
        bookName="John"
        chapterNumber={3}
        translation={{ id: "t1", code: "sw-open-bible", name: "Open Bible", language_code: "sw", canon_type: null, publisher: null, copyright_notice: null, license_name: null, license_url: null, source_url: null, attribution_text: null, audio_generation_allowed: true, ai_processing_allowed: true, active: true, default_translation: true }}
        translations={[]}
        previousPath="/portal/bible/john/chapter/2"
        nextPath="/portal/bible/john/chapter/4"
        bookmarked={false}
        onTranslationChange={() => undefined}
        onShare={() => undefined}
        onBookmarkToggle={() => undefined}
      />,
    );

    expect(container.textContent).toContain("John");
    expect(container.textContent).toContain("Chapter 3");
    expect(container.querySelector('[aria-label="Previous chapter"]')).toBeTruthy();
    expect(container.querySelector('[aria-label="Next chapter"]')).toBeTruthy();
    expect(container.querySelector('[aria-label="Select Bible translation"]')).toBeTruthy();
    expect(container.querySelector('[aria-label="Share chapter"]')).toBeTruthy();
    expect(container.querySelector('[aria-label="Bookmark chapter"]')).toBeTruthy();
    expect(container.querySelector('[aria-label="More Bible options"]')).toBeTruthy();
  });

  it("renders the reading toolbar controls", async () => {
    const container = await render(
      <BibleToolbar
        fontScale={1.1}
        theme="system"
        mode="read"
        search=""
        onFontScaleChange={() => undefined}
        onThemeChange={() => undefined}
        onModeChange={() => undefined}
        onSearchChange={() => undefined}
      />,
    );

    expect(container.querySelector('[aria-label="Decrease font size"]')).toBeTruthy();
    expect(container.querySelector('[aria-label="Increase font size"]')).toBeTruthy();
    expect(container.querySelector('[aria-label="Reading theme"]')).toBeTruthy();
    expect(container.querySelector('[aria-label="Search this chapter"]')).toBeTruthy();
    expect(container.querySelector('[aria-label="Reader settings"]')).toBeTruthy();
    expect(container.textContent).toContain("Read + Listen");
  });

  it("renders memoized verse cards with keyboard focus and accessible labels", async () => {
    const container = await render(
      <VerseList
        fontScale={1.1}
        search=""
        verses={[
          { id: "v1", verse_number: 16, verse_text: "For God so loved the world", text: null },
          { id: "v2", verse_number: 17, verse_text: "For God did not send his Son", text: null },
        ]}
      />,
    );

    expect(container.querySelectorAll('[data-testid="verse-card"]')).toHaveLength(2);
    expect(container.querySelector('[aria-label^="Verse 16"]')).toBeTruthy();
    expect(container.querySelector('[tabindex="0"]')).toBeTruthy();
  });

  it("renders continue reading progress", async () => {
    const container = await render(<ContinueReadingCard bookName="John" chapterNumber={3} path="/portal/bible/john/chapter/3" readingProgress={42} listeningProgress={12} />);

    expect(container.querySelector('[data-testid="continue-reading-card"]')).toBeTruthy();
    expect(container.textContent).toContain("John 3");
    expect(container.textContent).toContain("42%");
    expect(container.textContent).toContain("12%");
  });

  it("keeps RC-BIBLE-01 as UI over existing services without synchronization", () => {
    const root = process.cwd();
    const pageSource = readFileSync(join(root, "src/pages/portal/BibleReaderPage.tsx"), "utf8");
    const memberRouteSource = readFileSync(join(root, "src/pages/portal/MemberBibleChapterPage.tsx"), "utf8");
    const bottomPlayerSource = readFileSync(join(root, "src/components/bible/reader/BottomMiniPlayer.tsx"), "utf8");
    const verseListSource = readFileSync(join(root, "src/components/bible/reader/VerseList.tsx"), "utf8");
    const docs = readFileSync(join(root, "docs/PREMIUM_BIBLE_READER.md"), "utf8");

    expect(memberRouteSource).toContain("BibleReaderPage");
    expect(pageSource).toContain("BibleHeader");
    expect(pageSource).toContain("BibleToolbar");
    expect(pageSource).toContain("BibleReadingLayout");
    expect(pageSource).toContain("ContinueReadingCard");
    expect(bottomPlayerSource).toContain("MiniAudioPlayer");
    expect(bottomPlayerSource).toContain("bottom-mini-player");
    expect(verseListSource).not.toContain("useSynchronization");
    expect(pageSource).not.toContain("SyncedBibleAudioPlayer");
    expect(docs).toContain("Future Synchronization");
  });
});

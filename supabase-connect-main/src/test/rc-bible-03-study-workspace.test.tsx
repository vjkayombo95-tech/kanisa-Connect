import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type React from "react";

import { BookmarkPanel, HighlightsPanel } from "@/components/content-study";
import type { ContentBookmark, ContentHighlight } from "@/lib/content-study";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const rootPath = process.cwd();
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
    root.render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
  });

  return container;
}

describe("RC-BIBLE-03 Study Workspace", () => {
  afterEach(async () => {
    for (const { root, container } of mountedRoots.splice(0)) {
      await act(async () => root.unmount());
      container.remove();
    }
  });

  it("creates reusable content study tables instead of Bible-only tables", () => {
    const migration = readFileSync(join(rootPath, "supabase/migrations/20260709120000_rc_bible_03_content_study_workspace.sql"), "utf8");

    expect(migration).toContain("content_bookmarks");
    expect(migration).toContain("content_highlights");
    expect(migration).toContain("content_notes");
    expect(migration).toContain("content_favorites");
    expect(migration).toContain("content_type text not null");
    expect(migration).toContain("content_id text not null");
    expect(migration).toContain("segment_id text");
    expect(migration).toContain("auth.uid() = user_id");
    expect(migration).not.toContain("bible_bookmarks");
    expect(migration).not.toContain("verse_notes");
  });

  it("exports generic services and hooks for future content workspaces", () => {
    const services = readFileSync(join(rootPath, "src/lib/content-study.ts"), "utf8");
    const hooks = readFileSync(join(rootPath, "src/hooks/use-content-study.ts"), "utf8");

    expect(services).toContain("BookmarkService");
    expect(services).toContain("HighlightService");
    expect(services).toContain("NotesService");
    expect(services).toContain("FavoritesService");
    expect(services).toContain("ContentStudyTarget");
    expect(hooks).toContain("useBookmarks");
    expect(hooks).toContain("useHighlights");
    expect(hooks).toContain("useNotes");
    expect(hooks).toContain("useFavorites");
    expect(hooks).toContain("useShareContent");
    expect(hooks).toContain("onMutate");
  });

  it("renders reusable bookmark and highlight panels", async () => {
    const bookmark: ContentBookmark = {
      id: "b1",
      contentType: "bible",
      contentId: "john-3",
      segmentId: "verse-16",
      userId: "user-1",
      churchId: null,
      label: "John 3:16",
      reference: "John 3:16",
      excerpt: "For God so loved the world",
      metadata: {},
      createdAt: "2026-07-09T00:00:00Z",
      updatedAt: "2026-07-09T00:00:00Z",
    };
    const highlight: ContentHighlight = {
      id: "h1",
      contentType: "bible",
      contentId: "john-3",
      segmentId: "verse-17",
      userId: "user-1",
      churchId: null,
      color: "yellow",
      reference: "John 3:17",
      excerpt: "For God did not send his Son",
      metadata: {},
      createdAt: "2026-07-09T00:00:00Z",
      updatedAt: "2026-07-09T00:00:00Z",
    };

    const container = await render(
      <div>
        <BookmarkPanel bookmarks={[bookmark]} />
        <HighlightsPanel highlights={[highlight]} />
      </div>,
    );

    expect(container.textContent).toContain("Bookmarks");
    expect(container.textContent).toContain("John 3:16");
    expect(container.textContent).toContain("Highlights");
    expect(container.textContent).toContain("John 3:17");
  });

  it("integrates the Bible reader with study state without changing synchronization engines", () => {
    const page = readFileSync(join(rootPath, "src/pages/portal/BibleReaderPage.tsx"), "utf8");
    const verseList = readFileSync(join(rootPath, "src/components/bible/reader/VerseList.tsx"), "utf8");
    const verseCard = readFileSync(join(rootPath, "src/components/bible/reader/VerseCard.tsx"), "utf8");
    const syncEngine = readFileSync(join(rootPath, "src/lib/synchronization/engine.ts"), "utf8");

    expect(page).toContain("useBookmarks");
    expect(page).toContain("useHighlights");
    expect(page).toContain("useNotes");
    expect(page).toContain("useFavorites");
    expect(page).toContain("BookmarkPanel");
    expect(page).toContain("NotesDrawer");
    expect(page).toContain("ShareDialog");
    expect(verseList).toContain("studyStateByVerse");
    expect(verseCard).toContain("VerseActionMenu");
    expect(verseCard).toContain("BibleSegmentRenderer");
    expect(syncEngine).toContain("while (low <= high)");
  });

  it("documents architecture, lifecycle, renderer use, performance, and extension", () => {
    const docs = readFileSync(join(rootPath, "docs/BIBLE_STUDY_WORKSPACE.md"), "utf8");

    expect(docs).toContain("Architecture");
    expect(docs).toContain("Data Flow");
    expect(docs).toContain("Synchronization Lifecycle");
    expect(docs).toContain("Renderer Usage");
    expect(docs).toContain("Performance");
    expect(docs).toContain("Extension");
  });
});

# Premium Bible Study Workspace

RC-BIBLE-03 turns the Premium Bible Reader into a reusable personal study workspace without changing the Speech Engine, Universal Audio Player, Synchronization Engine, Universal Audio Foundation, or Bible Index Engine.

## Architecture

The study layer is content-agnostic:

- `content_bookmarks`
- `content_highlights`
- `content_notes`
- `content_favorites`

Every record is addressed through `content_type`, `content_id`, and `segment_id`. The Bible reader uses `content_type = "bible"`, chapter-level `content_id`, and verse-level segment ids such as `verse-3`. The same schema can support daily readings, prayers, saints, homilies, catechism content, and other future segmented content.

The shared client API lives in `src/lib/content-study.ts`:

- `BookmarkService`
- `HighlightService`
- `NotesService`
- `FavoritesService`

The React layer lives in `src/hooks/use-content-study.ts`:

- `useBookmarks`
- `useHighlights`
- `useNotes`
- `useFavorites`
- `useShareContent`

## Data Flow

`BibleReaderPage` builds one generic study target for the current chapter:

```ts
{
  contentType: "bible",
  contentId: "<translation>:<book>:<chapter>",
  userId,
  churchId
}
```

Each verse action derives a segment target with `segmentId = "verse-<number>"`, plus display metadata such as reference and excerpt. The hooks fetch all study rows for the chapter, then the page memoizes a `Map<number, ContentStudySegmentState>` for `VerseList` and `VerseCard`.

## Synchronization Lifecycle

Synchronization remains owned by the completed Universal Synchronization Engine:

1. Approved Bible audio is loaded through existing RC-AUDIO services.
2. `BibleIndexAdapter` feeds `IndexedContentSynchronizationProvider`.
3. `useSynchronizationEngine` resolves the active verse and active word from playback time.
4. `VerseCard` renders synchronized text through `BibleSegmentRenderer`.
5. Word taps continue to call `onSeekSegment`, which uses `SynchronizationProvider.timestampFor()`.

The study layer never parses timing JSON and never performs custom timing lookup.

## Renderer Usage

Verse and word highlighting still use renderer abstractions:

- Active verse state comes from the sync engine and is passed as renderer context.
- Active word state comes from `currentWord()` and is passed to `BibleSegmentRenderer`.
- Study highlights are a visual wrapper around a verse card and do not alter synchronization data.

## Interaction

The reader supports:

- Bookmark a verse.
- Highlight a verse in six colors.
- Add notes in a drawer.
- Favorite a verse.
- Share or copy the current reference.
- Tap a verse to seek audio when a sync segment exists.
- Tap a highlighted word to seek through the existing renderer path.

## Progress

RC-AUDIO progress remains active:

- Reading position is saved locally by scroll progress.
- Listening position is saved locally by playback timestamp.
- Current verse and timestamp are persisted in the existing sync progress payload.
- Study records are persisted in Supabase and use a local fallback for offline-ready optimistic behavior.

## Performance

Playback updates remain page-level state updates at the existing 100-250ms cadence. Expensive lookups are memoized:

- Sync segments by verse.
- Sync words by verse.
- Verse study state by verse.
- `VerseList` and `VerseCard` remain memoized.
- Word spans continue to come from the existing renderer.
- Binary search remains inside the synchronization engine.

## Accessibility

The workspace preserves and extends accessibility:

- Verse cards are keyboard-focusable.
- Action menus have accessible labels.
- Notes and sharing surfaces use dialog/drawer semantics.
- Active verse announcements use `aria-live`.
- Focus rings are visible.
- Existing smooth-scroll behavior is used and can respect browser reduced-motion preferences.

## Extension

Future content types should not create new Bible-specific tables. Instead:

1. Choose a stable `content_type`.
2. Choose a stable `content_id` for the content unit.
3. Use `segment_id` for addressable pieces.
4. Pass the same target shape into the generic services and hooks.
5. Render with a content-specific component that consumes `ContentStudySegmentState`.

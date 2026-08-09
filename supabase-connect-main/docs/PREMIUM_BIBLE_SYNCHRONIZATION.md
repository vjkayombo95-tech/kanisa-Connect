# Premium Bible Synchronization

RC-BIBLE-02 connects the Premium Bible Reader to the existing Universal Synchronization Engine. It does not modify the Speech Engine, Universal Audio Player, Synchronization Engine, Universal Audio Foundation, or Bible Index Engine.

## Architecture

`BibleReaderPage` creates an `IndexedContentSynchronizationProvider` from `BibleIndexAdapter` after approved chapter audio is loaded. The page consumes the loaded index through synchronization hooks, while `VerseList` and `VerseCard` remain rendering components.

```text
Approved Bible audio
-> BibleIndexAdapter
-> IndexedContentSynchronizationProvider
-> useSynchronization
-> SynchronizationEngine
-> BibleSegmentRenderer
-> VerseCard
```

## Data Flow

Playback time is emitted by `BottomMiniPlayer` every 200ms while audio is playing. `BibleReaderPage` sends that timestamp to the loaded synchronization engine. The engine resolves the active verse with `currentSegment(time, "verse")` and the active word with `currentWord(time)`.

Verse and word seek actions call `SynchronizationProvider.timestampFor(segment.id)`. The resulting timestamp is sent back to `BottomMiniPlayer` as a seek request, so playback remains the source of truth.

## Synchronization Lifecycle

1. The chapter data and approved audio are loaded.
2. `BibleIndexAdapter` adapts approved audio timings into a universal synchronization index.
3. `IndexedContentSynchronizationProvider.load()` initializes the engine.
4. Playback updates the current timestamp at 100-250ms cadence.
5. The active verse, active word, listening progress, and timestamp are persisted.
6. On restore, the reader seeks to the saved timestamp without autoplay.

## Renderer Usage

`VerseCard` delegates synchronized rendering to `BibleSegmentRenderer`. This keeps verse highlighting, word highlighting, and word seek buttons aligned with the shared renderer abstraction instead of custom page-specific markup.

## Auto Scroll

`useAutoScroll` keeps the active verse centered during playback. Wheel, touch, and keyboard scrolling temporarily pause following, then following resumes after inactivity.

## Performance

The synchronization engine uses its existing binary search for segment lookup. `VerseCard` remains memoized, word spans come from the renderer, and playback updates are throttled to a 200ms interval while audio is active.

## Extension For Future Content

The same lifecycle can be reused by Daily Readings, Prayer Library, Saints, homilies, and study content by swapping the adapter and renderer while keeping the provider-driven data flow unchanged.

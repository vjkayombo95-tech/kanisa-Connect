# Universal Synchronization Engine

RC-AUDIO-03 adds the reusable synchronization layer that connects indexed spoken content to the Universal Audio Player. The engine is generic and does not know about Bible chapters, readings, homilies, prayer content, saints, podcasts, or any future content type.

## Architecture

```text
UniversalAudioPlayer
  emits currentTime
    |
    v
SynchronizationEngine
  performs O(log n) time lookups
    |
    v
IndexedContentSynchronizationProvider
  exposes generic lookup methods
    |
    v
SynchronizationIndex
  generic indexed spoken content
    ^
    |
Adapters
  BibleIndexAdapter | HomilyIndexAdapter | PrayerIndexAdapter | SaintsIndexAdapter | future adapters
```

The player remains generic. It emits `onTimeUpdate`, `onSeek`, `onProgress`, and other playback events. A synchronization provider interprets the current timestamp and decides which segment or word is active.

## Schema

`SynchronizationIndex`:

- `contentId`
- `trackId`
- `duration`
- `segments`
- `metadata`

`SynchronizationSegment`:

- `id`
- `type`
- `start`
- `end`
- `text`
- `confidence`
- `parentId`
- `metadata`

Supported segment types include `word`, `verse`, `sentence`, `paragraph`, `section`, `chapter`, `heading`, and `custom`. The type is intentionally extensible.

## Provider Interface

Every provider implements:

- `load()`
- `currentSegment(time, type?)`
- `currentWord(time)`
- `segmentAt(time, type?)`
- `timestampFor(segmentId)`
- `next(time, type?)`
- `previous(time, type?)`
- `search(query, type?)`
- `progress(time)`

The built-in `IndexedContentSynchronizationProvider` is content-agnostic. It loads a `SynchronizationIndex` directly or from an adapter and then delegates lookup to `SynchronizationEngine`.

## Lookup Algorithm

`SynchronizationEngine` sorts segments by start time and maintains per-type segment arrays. Playback lookup uses binary search:

- Current segment: latest segment whose `start <= currentTime`, then verify `currentTime <= end`.
- Current word: same lookup against `word` segments.
- Next segment: first segment whose `start > currentTime`.
- Previous segment: latest segment whose `end < currentTime`.

Playback lookup is `O(log n)`, so chapters or talks with thousands of indexed words do not require full scans during playback.

## Bible Adapter

`BibleIndexAdapter` adapts existing Bible timing/index outputs into the generic schema. It does not change the indexing engine or the produced index files.

It accepts:

- Existing member playback verse timings.
- Existing imported index JSON.
- Existing index JSON text.

If word-level timings are unavailable, it generates approximate word segments inside each verse segment so the UI contract can still support tap-to-word and current-word behavior. Richer imported word indexes can replace those generated word segments later without changing the player.

## Other Adapters

The current adapter layer includes:

- `BibleIndexAdapter`
- `HomilyIndexAdapter`
- `PrayerIndexAdapter`
- `SaintsIndexAdapter`

Homily, prayer, and saint adapters currently accept generic timed segments and pass them through with adapter metadata. Future specialized source formats should be translated in those adapter classes without changing `SynchronizationEngine`.

## Renderer Architecture

Rendering is separate from synchronization lookup. A `SegmentRenderer` implements:

- `renderSegment()`
- `renderActive()`
- `renderInactive()`

Provided renderers:

- `BibleSegmentRenderer`
- `PrayerSegmentRenderer`
- `HomilySegmentRenderer`
- `SaintSegmentRenderer`

Content-specific display behavior belongs in renderers. The engine never renders UI and never contains content-specific rules.

## Hooks

- `useSynchronization(provider)`
- `useCurrentSegment({ provider, currentTime, type })`
- `useCurrentWord({ provider, currentTime })`
- `useSeekToSegment({ provider, onSeek })`
- `useAutoScroll({ activeId })`
- `useSearchSegments({ provider, query, type })`

`useAutoScroll` follows the active segment while playback advances and pauses after manual wheel, touch, or keyboard scrolling.

## Bible Experience

`BibleSynchronizedAudioText` is a Bible-specific consumer of the generic synchronization provider and `BibleSegmentRenderer`. It provides verse highlighting, word highlighting, tap verse to seek, tap word to seek, a current verse indicator, and auto-scroll pause behavior.

This logic intentionally lives outside `UniversalAudioPlayer`.

## Adding Future Providers

To add a provider for homilies, saints, prayer audio, daily readings, podcasts, or retreat talks:

1. Load the provider-specific index source.
2. Convert it into `SynchronizationIndex`.
3. Implement or reuse a `SegmentRenderer`.
4. Return an `IndexedContentSynchronizationProvider`.
5. Use the existing hooks and player events.

No Universal Audio Player changes should be required.

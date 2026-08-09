# Universal Audio Platform

RC-AUDIO-01 introduces the reusable audio foundation for Kanisa Connect. It is
generic by design and supports Bible audio, Daily Readings, Homilies, Prayer
Library, Saints, reflections, catechesis, and future spoken content.

This foundation does not include a player UI and does not modify the Python
indexing engine.

## Database Tables

- `audio_content`: catalog item for any spoken content.
- `audio_tracks`: one or more playable tracks for a content item.
- `audio_progress`: per-user playback progress.
- `audio_bookmarks`: per-user saved positions.
- `audio_history`: append-only listening events.

All tables are church-scoped and content-type agnostic.

## Security Model

- Workspace managers can manage content and tracks for their church.
- Active members can read published member-visible content and tracks.
- Users can manage only their own progress and bookmarks.
- Users can append their own listening history.
- Workspace managers can read church listening history for operational support.

The migration reuses existing workspace and active-member authorization helpers.

## TypeScript Surface

Shared types live in:

```text
src/types/universal-audio.ts
```

The generic service layer lives in:

```text
src/lib/universal-audio.ts
```

React Query hooks live in:

```text
src/hooks/use-universal-audio.ts
```

## Service APIs

- `loadAudioContent`
- `loadAudioContentById`
- `loadAudioTracks`
- `loadAudioProgress`
- `saveAudioProgress`
- `loadAudioBookmarks`
- `createAudioBookmark`
- `deleteAudioBookmark`
- `loadAudioHistory`
- `recordAudioHistory`

These APIs accept generic content IDs and track IDs. They do not know about
Bible books, readings, homilies, prayers, or saints.

## John 3 Seed

The migration seeds the first universal audio content item from an existing
published John 3 `audio_versions` row when one is present. If no published John
3 version exists in an environment yet, the seed safely inserts nothing.

## Usage Example

```ts
const content = await loadAudioContent({
  churchId,
  contentType: "bible_chapter",
  status: "published",
});

const tracks = await loadAudioTracks(content[0].id);

await saveAudioProgress({
  userId,
  churchId,
  contentId: content[0].id,
  trackId: tracks[0]?.id,
  positionSeconds: 42,
});
```

## Future UI

Player UI should consume this foundation through the hooks and service layer.
It should not query the universal audio tables directly.

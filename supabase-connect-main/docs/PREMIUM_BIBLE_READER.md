# Premium Bible Reader

RC-BIBLE-01 introduces the first user-facing Bible reading experience on top of the Universal Audio Platform. The release is intentionally focused on the reading interface and does not integrate verse synchronization.

## Architecture

The routed chapter page remains `MemberBibleChapterPage` for URL compatibility, and it now renders `BibleReaderPage`.

Component hierarchy:

```text
BibleReaderPage
|-- BibleHeader
|-- BibleToolbar
|-- BibleReadingLayout
|   |-- VerseList
|   |   `-- VerseCard
|   `-- future Study Panel slot
|-- ContinueReadingCard
`-- BottomMiniPlayer
```

## Responsive Behavior

The reader is mobile first. The header sticks to the top, controls use 44px touch targets, and the mini player docks to the bottom with safe-area padding. Desktop keeps the reading column centered and adds a right-side area reserved for future study tools.

## Accessibility

Verse cards are keyboard focusable, expose verse-specific labels, and support Enter or Space selection. Header actions have explicit labels, the toolbar uses native inputs and Radix controls, and loading, error, empty, and player states expose semantic regions.

The UI respects reduced motion by relying on CSS transitions only and platform scrolling behavior. High contrast benefits from existing design tokens and strong focus rings.

## Audio Integration

`BottomMiniPlayer` hosts the existing `UniversalAudioPlayer` in `mini` mode, which reuses `MiniAudioPlayer`. The Bible reader does not duplicate player logic and does not modify the Universal Audio Foundation.

Approved chapter audio is loaded through the existing member audio service. RC-BIBLE-01 does not bind audio progress to verse highlighting or the Synchronization Engine.

## Progress

The Continue Reading card displays local reading progress and session listening progress. The component is deliberately isolated so server-backed reading progress can replace the local storage adapter without changing the reader layout.

## Future Synchronization

RC-BIBLE-02 can integrate the completed Synchronization Engine by adding an adapter between `BottomMiniPlayer` player events and `VerseList` active verse state. The expected extension points are:

- `VerseCard.highlighted`
- `VerseList.highlightedRange`
- `BottomMiniPlayer.onProgress`
- `BibleReaderPage` audio source construction

No synchronization behavior is implemented in RC-BIBLE-01.

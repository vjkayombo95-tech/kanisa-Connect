# Universal Audio Player

RC-AUDIO-02 adds the reusable player UI for Kanisa Connect audio. The player is intentionally generic and contains no Bible-specific synchronization, verse logic, or content assumptions.

## Components

- `UniversalAudioPlayer` is the main entry point.
- `MiniAudioPlayer` renders a compact player for persistent or inline surfaces.
- `ExpandedAudioPlayer` renders the full control surface.
- `UniversalAudioPlayerDemo` is a lightweight demo component because this repository does not currently include Storybook.

## Features

- Play and pause.
- Seek bar with current time and duration.
- Skip back 10 seconds and skip forward 10 seconds.
- Playback speed selection.
- Volume and mute controls.
- Loading and error states.
- Keyboard shortcuts:
  - `Space` or `K`: play or pause.
  - `ArrowLeft`: skip back 10 seconds.
  - `ArrowRight`: skip forward 10 seconds.
  - `M`: mute or unmute.
- Responsive mini and expanded layouts.
- ARIA labels, keyboard focus, and screen-reader friendly status text.

## Data Integration

The player can be used directly with a generic source:

```tsx
<UniversalAudioPlayer
  source={{
    id: "track-id",
    title: "Morning Reflection",
    subtitle: "Daily spoken content",
    src: "https://example.com/audio.mp3",
    durationSeconds: 300,
    mimeType: "audio/mpeg",
  }}
  variant="expanded"
/>
```

It can also load the first published track for a universal audio content item:

```tsx
<UniversalAudioPlayer contentId={content.id} variant="mini" />
```

When `persistence` is provided, the player uses the RC-AUDIO-01 hooks to save progress and record history:

```tsx
<UniversalAudioPlayer
  contentId={content.id}
  persistence={{
    userId,
    churchId,
    contentId: content.id,
  }}
/>
```

## Events

`UniversalAudioPlayer` exposes these callbacks:

- `onPlay`
- `onPause`
- `onSeek`
- `onProgress`
- `onEnded`
- `onSpeedChanged`

Playback callbacks receive `{ currentTime, duration, source }`. Speed changes receive the selected numeric speed.

## Non-Goals

RC-AUDIO-02 does not add Bible synchronization, verse highlighting, or specialized playback behavior. Those features should be composed on top of the generic player in later work.

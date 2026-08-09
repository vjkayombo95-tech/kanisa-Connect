import type React from "react";

import { cn } from "@/lib/utils";
import type { SynchronizationSegment } from "@/types/synchronization";

export type SegmentRendererContext = {
  active: boolean;
  activeWordId?: string | null;
  words?: SynchronizationSegment[];
  onSeek?: (time: number, segment: SynchronizationSegment) => void;
};

export type SegmentRenderer = {
  renderSegment(segment: SynchronizationSegment, context: SegmentRendererContext): React.ReactNode;
  renderActive(segment: SynchronizationSegment, context: SegmentRendererContext): React.ReactNode;
  renderInactive(segment: SynchronizationSegment, context: SegmentRendererContext): React.ReactNode;
};

function renderWords(words: SynchronizationSegment[] | undefined, context: SegmentRendererContext) {
  return words?.map((word) => (
    <button
      key={word.id}
      type="button"
      className={cn(
        "mr-1 rounded px-0.5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        context.activeWordId === word.id && "bg-primary text-primary-foreground",
      )}
      onClick={() => context.onSeek?.(word.start, word)}
      aria-label={`Seek to word ${word.text}`}
    >
      {word.text}
    </button>
  ));
}

export class BibleSegmentRenderer implements SegmentRenderer {
  renderSegment(segment: SynchronizationSegment, context: SegmentRendererContext) {
    return context.active ? this.renderActive(segment, context) : this.renderInactive(segment, context);
  }

  renderActive(segment: SynchronizationSegment, context: SegmentRendererContext) {
    return this.renderShell(segment, context, true);
  }

  renderInactive(segment: SynchronizationSegment, context: SegmentRendererContext) {
    return this.renderShell(segment, context, false);
  }

  private renderShell(segment: SynchronizationSegment, context: SegmentRendererContext, active: boolean) {
    const verseLabel = String(segment.metadata.verseNumber ?? "");
    return (
      <p
        key={segment.id}
        id={`sync-segment-${segment.id}`}
        className={cn(
          "scroll-mt-28 rounded-lg border border-transparent px-3 py-2 text-lg leading-8 transition-colors",
          active && "border-primary/30 bg-primary/10 text-foreground shadow-sm",
        )}
      >
        <button
          type="button"
          className="mr-2 align-baseline text-sm font-semibold text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          onClick={() => context.onSeek?.(segment.start, segment)}
          aria-label={`Seek to verse ${segment.metadata.verseNumber ?? segment.id}`}
        >
          {verseLabel}
        </button>
        {context.words?.length ? renderWords(context.words, context) : (
          <button
            type="button"
            className="rounded text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            onClick={() => context.onSeek?.(segment.start, segment)}
          >
            {segment.text}
          </button>
        )}
      </p>
    );
  }
}

class PlainSegmentRenderer implements SegmentRenderer {
  constructor(private readonly activeClassName: string) {}

  renderSegment(segment: SynchronizationSegment, context: SegmentRendererContext) {
    return context.active ? this.renderActive(segment, context) : this.renderInactive(segment, context);
  }

  renderActive(segment: SynchronizationSegment, context: SegmentRendererContext) {
    return this.renderShell(segment, context, true);
  }

  renderInactive(segment: SynchronizationSegment, context: SegmentRendererContext) {
    return this.renderShell(segment, context, false);
  }

  private renderShell(segment: SynchronizationSegment, context: SegmentRendererContext, active: boolean) {
    return (
      <button
        key={segment.id}
        id={`sync-segment-${segment.id}`}
        type="button"
        className={cn(
          "block w-full scroll-mt-28 rounded-lg border border-transparent px-3 py-2 text-left transition-colors",
          active && this.activeClassName,
        )}
        onClick={() => context.onSeek?.(segment.start, segment)}
      >
        {segment.text}
      </button>
    );
  }
}

export class PrayerSegmentRenderer extends PlainSegmentRenderer {
  constructor() {
    super("border-primary/30 bg-primary/10");
  }
}

export class HomilySegmentRenderer extends PlainSegmentRenderer {
  constructor() {
    super("border-primary/30 bg-muted");
  }
}

export class SaintSegmentRenderer extends PlainSegmentRenderer {
  constructor() {
    super("border-primary/30 bg-accent");
  }
}

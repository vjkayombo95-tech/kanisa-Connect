import { useMemo } from "react";

import { useAutoScroll, useCurrentSegment, useCurrentWord, useSeekToSegment } from "@/hooks/use-synchronization";
import { BibleSegmentRenderer, SynchronizationEngine } from "@/lib/synchronization";
import { cn } from "@/lib/utils";
import type { SynchronizationIndex, SynchronizationSegment } from "@/types/synchronization";

type BibleSynchronizedAudioTextProps = {
  index: SynchronizationIndex;
  currentTime: number;
  onSeek: (time: number, segment: SynchronizationSegment) => void;
  autoScroll?: boolean;
  className?: string;
};

function wordsForSegment(engine: SynchronizationEngine, segment: SynchronizationSegment) {
  return engine
    .getSegments("word")
    .filter((word) => word.parentId === segment.id || word.metadata.parentSegmentId === segment.id || (word.start >= segment.start && word.end <= segment.end));
}

export function BibleSynchronizedAudioText({
  index,
  currentTime,
  onSeek,
  autoScroll = true,
  className,
}: BibleSynchronizedAudioTextProps) {
  const engine = useMemo(() => new SynchronizationEngine(index), [index]);
  const renderer = useMemo(() => new BibleSegmentRenderer(), []);
  const currentVerse = useCurrentSegment({ index, currentTime, type: "verse" });
  const currentWord = useCurrentWord({ index, currentTime });
  const seekToSegment = useSeekToSegment({ index, onSeek });

  useAutoScroll({
    activeId: currentVerse ? `sync-segment-${currentVerse.id}` : null,
    enabled: autoScroll,
  });

  const verses = engine.getSegments("verse");

  return (
    <article className={cn("space-y-4", className)} aria-label="Synchronized audio text">
      <div className="rounded-lg border border-border bg-muted/40 px-4 py-3 text-sm text-muted-foreground" aria-live="polite">
        {currentVerse ? `Current verse ${currentVerse.metadata.verseNumber ?? currentVerse.id}` : "No current verse"}
      </div>

      <div className="space-y-3">
        {verses.map((verse) => {
          return renderer.renderSegment(verse, {
            active: currentVerse?.id === verse.id,
            activeWordId: currentWord?.id,
            words: wordsForSegment(engine, verse),
            onSeek: (time, segment) => {
              if (segment.id === verse.id) {
                seekToSegment(segment.id);
                return;
              }
              onSeek(time, segment);
            },
          });
        })}
      </div>
    </article>
  );
}

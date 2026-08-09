import { memo, useRef } from "react";

import { VerseActionMenu } from "@/components/content-study";
import { BibleSegmentRenderer } from "@/lib/synchronization/renderers";
import type { ContentStudySegmentState, HighlightColor } from "@/lib/content-study";
import { cn } from "@/lib/utils";
import type { SynchronizationSegment } from "@/types/synchronization";
import type { BibleVerseRow } from "./types";
import { getVerseText } from "./types";

type VerseCardProps = {
  verse: BibleVerseRow;
  highlighted?: boolean;
  dimmed?: boolean;
  fontScale: number;
  syncSegment?: SynchronizationSegment | null;
  syncWords?: SynchronizationSegment[];
  activeWordId?: string | null;
  studyState?: ContentStudySegmentState;
  onSelectVerse?: (verseNumber: number) => void;
  onLongPressVerse?: (verseNumber: number) => void;
  onSeekSegment?: (segment: SynchronizationSegment) => void;
  onBookmarkVerse?: (verseNumber: number) => void;
  onHighlightVerse?: (verseNumber: number, color: HighlightColor) => void;
  onClearHighlightVerse?: (verseNumber: number) => void;
  onNoteVerse?: (verseNumber: number) => void;
  onFavoriteVerse?: (verseNumber: number) => void;
  onShareVerse?: (verseNumber: number) => void;
  onCopyVerse?: (verseNumber: number) => void;
};

const bibleSegmentRenderer = new BibleSegmentRenderer();

const highlightClass: Record<HighlightColor, string> = {
  yellow: "bg-yellow-100/80 dark:bg-yellow-300/20",
  green: "bg-emerald-100/80 dark:bg-emerald-300/20",
  blue: "bg-sky-100/80 dark:bg-sky-300/20",
  purple: "bg-violet-100/80 dark:bg-violet-300/20",
  pink: "bg-rose-100/80 dark:bg-rose-300/20",
  orange: "bg-orange-100/80 dark:bg-orange-300/20",
};

function VerseCardComponent({
  verse,
  highlighted,
  dimmed,
  fontScale,
  syncSegment,
  syncWords,
  activeWordId,
  studyState,
  onSelectVerse,
  onLongPressVerse,
  onSeekSegment,
  onBookmarkVerse,
  onHighlightVerse,
  onClearHighlightVerse,
  onNoteVerse,
  onFavoriteVerse,
  onShareVerse,
  onCopyVerse,
}: VerseCardProps) {
  const timerRef = useRef<ReturnType<typeof window.setTimeout> | null>(null);
  const text = getVerseText(verse);
  const reference = `Verse ${verse.verse_number}`;
  const hasStudyState = !!studyState?.bookmarked || !!studyState?.favorite || !!studyState?.highlightColor || !!studyState?.noteCount;
  const actionMenu = (
    <VerseActionMenu
      reference={reference}
      excerpt={text}
      state={studyState}
      onBookmark={() => onBookmarkVerse?.(verse.verse_number)}
      onHighlight={(color) => onHighlightVerse?.(verse.verse_number, color)}
      onClearHighlight={() => onClearHighlightVerse?.(verse.verse_number)}
      onNote={() => onNoteVerse?.(verse.verse_number)}
      onFavorite={() => onFavoriteVerse?.(verse.verse_number)}
      onShare={() => onShareVerse?.(verse.verse_number)}
      onCopy={() => onCopyVerse?.(verse.verse_number)}
      onPlayFromHere={() => (syncSegment ? onSeekSegment?.(syncSegment) : onSelectVerse?.(verse.verse_number))}
    />
  );

  const clearLongPress = () => {
    if (!timerRef.current) return;
    window.clearTimeout(timerRef.current);
    timerRef.current = null;
  };

  const startLongPress = () => {
    clearLongPress();
    timerRef.current = window.setTimeout(() => {
      onLongPressVerse?.(verse.verse_number);
      timerRef.current = null;
    }, 500);
  };

  if (syncSegment) {
    return (
      <div
        id={`verse-${verse.verse_number}`}
        className={cn(
          "group relative scroll-mt-36 rounded-lg pr-10 transition-colors",
          studyState?.highlightColor && highlightClass[studyState.highlightColor],
          highlighted && "ring-1 ring-primary/25",
          dimmed && "opacity-35",
        )}
        style={{ fontSize: `${fontScale}rem` }}
        data-testid="verse-card"
      >
        {bibleSegmentRenderer.renderSegment(syncSegment, {
          active: !!highlighted,
          activeWordId,
          words: syncWords,
          onSeek: (_time, segment) => onSeekSegment?.(segment),
        })}
        <div className="absolute right-1 top-1 opacity-100 sm:opacity-0 sm:transition-opacity sm:group-hover:opacity-100 sm:group-focus-within:opacity-100">{actionMenu}</div>
        {hasStudyState ? <span className="sr-only">This verse has saved study items.</span> : null}
      </div>
    );
  }

  return (
    <div
      id={`verse-${verse.verse_number}`}
      tabIndex={0}
      role="button"
      aria-label={`Verse ${verse.verse_number}. ${text}`}
      onClick={() => onSelectVerse?.(verse.verse_number)}
      onPointerDown={startLongPress}
      onPointerUp={clearLongPress}
      onPointerLeave={clearLongPress}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onSelectVerse?.(verse.verse_number);
        }
      }}
      className={cn(
        "group relative scroll-mt-36 rounded-lg px-3 py-2 pr-12 leading-[1.85] text-foreground outline-none transition-colors",
        "hover:bg-muted/70 focus-visible:bg-muted focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
        studyState?.highlightColor && highlightClass[studyState.highlightColor],
        highlighted && "border border-primary/20 bg-primary/10",
        dimmed && "opacity-35",
      )}
      style={{ fontSize: `${fontScale}rem` }}
      data-testid="verse-card"
    >
      <sup className="mr-2 align-super text-[0.65em] font-bold leading-none text-primary/85">{verse.verse_number}</sup>
      <span>{text}</span>
      <span className="absolute right-1 top-1 opacity-100 sm:opacity-0 sm:transition-opacity sm:group-hover:opacity-100 sm:group-focus-within:opacity-100">{actionMenu}</span>
      {hasStudyState ? <span className="sr-only">This verse has saved study items.</span> : null}
    </div>
  );
}

export const VerseCard = memo(VerseCardComponent);

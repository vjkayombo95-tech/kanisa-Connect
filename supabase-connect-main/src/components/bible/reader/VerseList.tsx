import { memo, useMemo } from "react";

import { Card, CardContent } from "@/components/ui/card";
import type { ContentStudySegmentState, HighlightColor } from "@/lib/content-study";
import type { SynchronizationSegment } from "@/types/synchronization";
import type { BibleVerseRow } from "./types";
import { getVerseText } from "./types";
import { VerseCard } from "./VerseCard";

type VerseListProps = {
  verses: BibleVerseRow[];
  fontScale: number;
  search: string;
  highlightedRange?: { start: number; end: number } | null;
  activeVerseNumber?: number | null;
  activeWordId?: string | null;
  syncSegmentsByVerse?: Map<number, SynchronizationSegment>;
  syncWordsByVerse?: Map<number, SynchronizationSegment[]>;
  studyStateByVerse?: Map<number, ContentStudySegmentState>;
  onSelectVerse?: (verseNumber: number) => void;
  onSeekSegment?: (segment: SynchronizationSegment) => void;
  onBookmarkVerse?: (verseNumber: number) => void;
  onHighlightVerse?: (verseNumber: number, color: HighlightColor) => void;
  onClearHighlightVerse?: (verseNumber: number) => void;
  onNoteVerse?: (verseNumber: number) => void;
  onFavoriteVerse?: (verseNumber: number) => void;
  onShareVerse?: (verseNumber: number) => void;
  onCopyVerse?: (verseNumber: number) => void;
};

function VerseListComponent({
  verses,
  fontScale,
  search,
  highlightedRange,
  activeVerseNumber,
  activeWordId,
  syncSegmentsByVerse,
  syncWordsByVerse,
  studyStateByVerse,
  onSelectVerse,
  onSeekSegment,
  onBookmarkVerse,
  onHighlightVerse,
  onClearHighlightVerse,
  onNoteVerse,
  onFavoriteVerse,
  onShareVerse,
  onCopyVerse,
}: VerseListProps) {
  const normalizedSearch = search.trim().toLowerCase();
  const matchingVerseNumbers = useMemo(() => {
    if (!normalizedSearch) return null;
    return new Set(
      verses
        .filter((verse) => getVerseText(verse).toLowerCase().includes(normalizedSearch) || String(verse.verse_number) === normalizedSearch)
        .map((verse) => verse.verse_number),
    );
  }, [normalizedSearch, verses]);

  return (
    <article className="mx-auto max-w-3xl" aria-label="Bible chapter text" data-testid="verse-list">
      <div className="space-y-1 rounded-lg border border-border/70 bg-card px-2 py-5 shadow-sm sm:px-5 sm:py-7">
        {verses.map((verse) => {
          const inRange = highlightedRange ? verse.verse_number >= highlightedRange.start && verse.verse_number <= highlightedRange.end : false;
          const searchMatch = matchingVerseNumbers?.has(verse.verse_number) ?? false;
          const activeSyncVerse = activeVerseNumber === verse.verse_number;

          return (
            <VerseCard
              key={verse.id}
              verse={verse}
              fontScale={fontScale}
              highlighted={inRange || searchMatch || activeSyncVerse}
              dimmed={!!matchingVerseNumbers && !searchMatch}
              syncSegment={syncSegmentsByVerse?.get(verse.verse_number) ?? null}
              syncWords={syncWordsByVerse?.get(verse.verse_number)}
              activeWordId={activeWordId}
              studyState={studyStateByVerse?.get(verse.verse_number)}
              onSelectVerse={onSelectVerse}
              onLongPressVerse={onSelectVerse}
              onSeekSegment={onSeekSegment}
              onBookmarkVerse={onBookmarkVerse}
              onHighlightVerse={onHighlightVerse}
              onClearHighlightVerse={onClearHighlightVerse}
              onNoteVerse={onNoteVerse}
              onFavoriteVerse={onFavoriteVerse}
              onShareVerse={onShareVerse}
              onCopyVerse={onCopyVerse}
            />
          );
        })}
      </div>
    </article>
  );
}

export const VerseList = memo(VerseListComponent);

export function VerseListEmptyState() {
  return (
    <Card className="rounded-lg border-border/70 bg-card/95">
      <CardContent className="flex flex-col items-center justify-center px-6 py-16 text-center">
        <h2 className="text-lg font-semibold">No verses available</h2>
        <p className="mt-2 max-w-md text-sm text-muted-foreground">This chapter is not available in the selected translation yet.</p>
      </CardContent>
    </Card>
  );
}

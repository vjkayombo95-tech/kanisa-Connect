import { useState } from "react";
import { BookOpen, ChevronDown } from "lucide-react";
import { Link } from "react-router-dom";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { type DailyReadingBibleReference, type DailyReadingSection } from "@/lib/daily-readings";

type ReadingCardProps = {
  reading: DailyReadingSection;
  reflection?: string;
  defaultOpen?: boolean;
};

const READING_TITLES: Record<DailyReadingSection["id"], string> = {
  first: "Somo la Kwanza",
  psalm: "Zaburi ya Kujibu",
  second: "Somo la Pili",
  gospel_acclamation: "Shangilio la Injili",
  gospel: "Injili",
};

function buildReadInBiblePath(reference: DailyReadingBibleReference) {
  const params = new URLSearchParams({
    startVerse: String(reference.verse_start),
  });

  if (reference.verse_end !== reference.verse_start || reference.chapter_end !== reference.chapter_start) {
    params.set("endVerse", String(reference.verse_end));
  }

  return `/portal/bible/${reference.book_id}/chapter/${reference.chapter_start}?${params.toString()}`;
}

export function ReadingCard({ reading, reflection, defaultOpen = false }: ReadingCardProps) {
  const [open, setOpen] = useState(defaultOpen);
  const readInBiblePath = reading.bibleReference ? buildReadInBiblePath(reading.bibleReference) : null;
  const readingText = reading.text?.trim();
  const title = READING_TITLES[reading.id] ?? reading.title;
  const contentId = `daily-reading-${reading.id}-content`;

  return (
    <Card className="overflow-hidden rounded-[28px] border-border/70 bg-card/85 shadow-sm">
      <button
        type="button"
        className="flex w-full items-center justify-between gap-4 p-5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
        aria-controls={contentId}
      >
        <span className="flex min-w-0 items-center gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <BookOpen className="h-5 w-5" aria-hidden="true" />
          </span>
          <span className="min-w-0">
            <span className="block text-lg font-bold text-foreground">{title}</span>
            {reading.reference ? <span className="mt-1 block break-words text-sm leading-6 text-muted-foreground">{reading.reference}</span> : null}
          </span>
        </span>
        <ChevronDown className={cn("h-5 w-5 shrink-0 text-muted-foreground transition-transform", open && "rotate-180")} />
      </button>

      {open ? (
        <CardContent id={contentId} className="space-y-4 border-t border-border/60 p-5 pt-4">
          {reading.reference ? (
            <Badge variant="outline" className="max-w-full whitespace-normal rounded-full break-words text-left leading-5">
              {reading.reference}
            </Badge>
          ) : null}
          {readInBiblePath ? (
            <Button asChild variant="outline" className="h-10 w-full justify-center rounded-2xl sm:w-fit">
              <Link to={readInBiblePath}>Soma kwenye Biblia</Link>
            </Button>
          ) : null}
          {readingText ? (
            <p className="whitespace-pre-wrap text-sm leading-7 text-muted-foreground">
              {readingText}
            </p>
          ) : null}
          {reflection ? (
            <div className="rounded-2xl bg-primary/5 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-primary">Tafakari</p>
              <p className="mt-2 text-sm leading-7 text-muted-foreground">{reflection}</p>
            </div>
          ) : null}
        </CardContent>
      ) : null}
    </Card>
  );
}

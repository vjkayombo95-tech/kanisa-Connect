import { useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertCircle, ArrowLeft, ArrowRight, BookOpen, RotateCcw } from "lucide-react";
import { Link, useParams, useSearchParams } from "react-router-dom";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

type BibleBookRow = {
  id: string;
  book_number: number;
  name: string;
  abbreviation: string | null;
  testament: "old" | "new" | "deuterocanonical";
};

type BibleChapterRow = {
  id: string;
  chapter_number: number;
};

type BibleVerseRow = {
  id: string;
  verse_number: number;
  verse_text: string | null;
  text: string | null;
};

type ChapterReaderData = {
  book: BibleBookRow;
  chapters: BibleChapterRow[];
  selectedChapter: BibleChapterRow | null;
  verses: BibleVerseRow[];
};

const TESTAMENT_LABELS: Record<BibleBookRow["testament"], string> = {
  old: "Old Testament",
  new: "New Testament",
  deuterocanonical: "Deuterocanonical",
};

async function fetchChapterReaderData(bookId: string, chapterNumber: number): Promise<ChapterReaderData> {
  const [bookResult, chaptersResult, versesResult] = await Promise.all([
    supabase
      .from("bible_books" as never)
      .select("id, book_number, name, abbreviation, testament")
      .eq("id", bookId)
      .single(),
    supabase
      .from("bible_chapters" as never)
      .select("id, chapter_number")
      .eq("book_id", bookId)
      .order("chapter_number", { ascending: true }),
    supabase
      .from("bible_verses" as never)
      .select("id, verse_number, verse_text, text")
      .eq("book_id", bookId)
      .eq("chapter_number", chapterNumber)
      .order("verse_number", { ascending: true }),
  ]);

  if (bookResult.error) throw bookResult.error;
  if (chaptersResult.error) throw chaptersResult.error;
  if (versesResult.error) throw versesResult.error;

  const chapters = (chaptersResult.data ?? []) as unknown as BibleChapterRow[];

  return {
    book: bookResult.data as unknown as BibleBookRow,
    chapters,
    selectedChapter: chapters.find((chapter) => chapter.chapter_number === chapterNumber) ?? null,
    verses: (versesResult.data ?? []) as unknown as BibleVerseRow[],
  };
}

function ReaderSkeleton() {
  return (
    <div className="space-y-7">
      <Card className="rounded-lg border-border/70 bg-card/90">
        <CardContent className="space-y-4 p-6">
          <Skeleton className="h-5 w-32 rounded-md" />
          <Skeleton className="h-10 w-56 rounded-md" />
          <Skeleton className="h-6 w-36 rounded-md" />
        </CardContent>
      </Card>
      <div className="mx-auto max-w-3xl space-y-5">
        {Array.from({ length: 10 }).map((_, index) => (
          <div key={index} className="flex gap-3">
            <Skeleton className="mt-1 h-4 w-5 rounded-sm" />
            <Skeleton className="h-7 flex-1 rounded-md" />
          </div>
        ))}
      </div>
    </div>
  );
}

function getVerseText(verse: BibleVerseRow) {
  return verse.verse_text ?? verse.text ?? "";
}

function parseVerseQueryParam(value: string | null) {
  if (!value) return null;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

export default function MemberBibleChapterPage() {
  const { bookId, chapterNumber } = useParams();
  const [searchParams] = useSearchParams();
  const parsedChapterNumber = Number(chapterNumber);
  const canQuery = Boolean(bookId) && Number.isInteger(parsedChapterNumber) && parsedChapterNumber > 0;
  const startVerse = parseVerseQueryParam(searchParams.get("startVerse"));
  const endVerse = parseVerseQueryParam(searchParams.get("endVerse")) ?? startVerse;
  const highlightedVerseRange =
    startVerse && endVerse ? { start: Math.min(startVerse, endVerse), end: Math.max(startVerse, endVerse) } : null;

  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ["member-bible-chapter-reader", bookId, parsedChapterNumber],
    queryFn: () => fetchChapterReaderData(bookId!, parsedChapterNumber),
    enabled: canQuery,
    staleTime: 10 * 60 * 1000,
  });

  useEffect(() => {
    if (!data) return;

    if (!startVerse) {
      window.scrollTo({ top: 0, left: 0, behavior: "smooth" });
      return;
    }

    window.setTimeout(() => {
      document.getElementById(`verse-${startVerse}`)?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    }, 0);
  }, [data, bookId, parsedChapterNumber, startVerse]);

  const navigation = useMemo(() => {
    if (!data) return { previous: null as number | null, next: null as number | null };
    const chapterNumbers = data.chapters.map((chapter) => chapter.chapter_number);
    const currentIndex = chapterNumbers.indexOf(parsedChapterNumber);

    return {
      previous: currentIndex > 0 ? chapterNumbers[currentIndex - 1] : null,
      next: currentIndex >= 0 && currentIndex < chapterNumbers.length - 1 ? chapterNumbers[currentIndex + 1] : null,
    };
  }, [data, parsedChapterNumber]);

  const backToChaptersPath = bookId ? `/portal/bible/${bookId}` : "/portal/bible";

  return (
    <main className="min-h-full bg-[linear-gradient(180deg,hsl(var(--background)),hsl(var(--muted)/0.35))] px-4 py-6 pb-28 lg:px-8 lg:pb-10">
      <div className="mx-auto max-w-6xl space-y-6">
        <Button asChild variant="ghost" className="h-10 rounded-lg px-3">
          <Link to={backToChaptersPath}>
            <ArrowLeft className="mr-2 h-4 w-4" aria-hidden="true" />
            Back to Chapters
          </Link>
        </Button>

        {!canQuery ? (
          <Alert variant="destructive" className="rounded-lg">
            <AlertCircle className="h-4 w-4" aria-hidden="true" />
            <AlertTitle>Unable to load chapter</AlertTitle>
            <AlertDescription>The chapter link is invalid.</AlertDescription>
          </Alert>
        ) : null}

        {isLoading ? <ReaderSkeleton /> : null}

        {isError ? (
          <Alert variant="destructive" className="rounded-lg">
            <AlertCircle className="h-4 w-4" aria-hidden="true" />
            <AlertTitle>Unable to load chapter</AlertTitle>
            <AlertDescription className="space-y-4">
              <span className="block">{error instanceof Error ? error.message : "Please try again."}</span>
              <Button type="button" variant="outline" size="sm" onClick={() => void refetch()} disabled={isFetching}>
                <RotateCcw className="mr-2 h-4 w-4" aria-hidden="true" />
                Retry
              </Button>
            </AlertDescription>
          </Alert>
        ) : null}

        {!isLoading && !isError && data ? (
          <>
            <Card className="rounded-lg border-primary/15 bg-card/90 shadow-sm">
              <CardContent className="flex items-start gap-4 p-5 sm:p-6">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border border-primary/20 bg-primary/10 text-primary">
                  <BookOpen className="h-6 w-6" aria-hidden="true" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-primary">{TESTAMENT_LABELS[data.book.testament]}</p>
                  <h1 className="mt-2 text-3xl font-bold tracking-tight text-foreground sm:text-4xl">{data.book.name}</h1>
                  <p className="mt-2 text-lg font-semibold text-muted-foreground">Chapter {parsedChapterNumber}</p>
                </div>
              </CardContent>
            </Card>

            {!data.selectedChapter || data.verses.length === 0 ? (
              <Card className="rounded-lg border-border/70 bg-card/90">
                <CardContent className="flex flex-col items-center justify-center px-6 py-16 text-center">
                  <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                    <BookOpen className="h-7 w-7" aria-hidden="true" />
                  </div>
                  <h2 className="text-lg font-semibold">No verses found for this chapter.</h2>
                </CardContent>
              </Card>
            ) : (
              <article className="mx-auto max-w-3xl rounded-lg border border-border/60 bg-card/80 px-5 py-7 shadow-sm sm:px-8 sm:py-9 lg:px-10">
                <div className="space-y-5 font-serif text-lg leading-8 text-foreground sm:text-xl sm:leading-9">
                  {data.verses.map((verse) => {
                    const isHighlighted = highlightedVerseRange
                      ? verse.verse_number >= highlightedVerseRange.start && verse.verse_number <= highlightedVerseRange.end
                      : false;

                    return (
                      <p
                        key={verse.id}
                        id={`verse-${verse.verse_number}`}
                        className={cn(
                          "scroll-mt-24 whitespace-pre-wrap rounded-md px-2 py-1 transition-colors",
                          isHighlighted && "border border-primary/15 bg-primary/10",
                        )}
                      >
                        <sup className="mr-1.5 align-super text-xs font-bold leading-none text-primary sm:text-sm">{verse.verse_number}</sup>
                        {getVerseText(verse)}
                      </p>
                    );
                  })}
                </div>
              </article>
            )}

            <nav className="mx-auto flex max-w-3xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between" aria-label="Chapter navigation">
              {navigation.previous ? (
                <Button asChild variant="outline" className="h-11 justify-center rounded-lg">
                  <Link to={`/portal/bible/${data.book.id}/chapter/${navigation.previous}`}>
                    <ArrowLeft className="mr-2 h-4 w-4" aria-hidden="true" />
                    Previous Chapter
                  </Link>
                </Button>
              ) : (
                <Button variant="outline" className="h-11 justify-center rounded-lg" disabled>
                  <ArrowLeft className="mr-2 h-4 w-4" aria-hidden="true" />
                  Previous Chapter
                </Button>
              )}

              {navigation.next ? (
                <Button asChild className="h-11 justify-center rounded-lg">
                  <Link to={`/portal/bible/${data.book.id}/chapter/${navigation.next}`}>
                    Next Chapter
                    <ArrowRight className="ml-2 h-4 w-4" aria-hidden="true" />
                  </Link>
                </Button>
              ) : (
                <Button className="h-11 justify-center rounded-lg" disabled>
                  Next Chapter
                  <ArrowRight className="ml-2 h-4 w-4" aria-hidden="true" />
                </Button>
              )}
            </nav>
          </>
        ) : null}
      </div>
    </main>
  );
}

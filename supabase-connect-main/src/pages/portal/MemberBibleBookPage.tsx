import { useQuery } from "@tanstack/react-query";
import { AlertCircle, ArrowLeft, ArrowRight, BookOpen } from "lucide-react";
import { Link, useParams } from "react-router-dom";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";

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

const TESTAMENT_LABELS: Record<BibleBookRow["testament"], string> = {
  old: "Old Testament",
  new: "New Testament",
  deuterocanonical: "Deuterocanonical",
};

function ChapterGridSkeleton() {
  return (
    <div className="space-y-5">
      <Card className="rounded-lg border-border/70 bg-card/90">
        <CardContent className="space-y-4 p-6">
          <Skeleton className="h-5 w-32 rounded-md" />
          <Skeleton className="h-10 w-64 max-w-full rounded-md" />
          <Skeleton className="h-5 w-44 rounded-md" />
        </CardContent>
      </Card>
      <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4">
        {Array.from({ length: 12 }).map((_, index) => (
          <Skeleton key={index} className="h-20 rounded-lg" />
        ))}
      </div>
    </div>
  );
}

function ChapterCard({ bookId, chapter }: { bookId: string; chapter: BibleChapterRow }) {
  return (
    <Link to={`/portal/bible/${bookId}/chapter/${chapter.chapter_number}`} className="group block">
      <Card className="h-full rounded-lg border-border/70 bg-card/90 shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-md">
        <CardContent className="flex h-full items-center justify-between gap-4 p-4">
          <div className="min-w-0">
            <p className="text-base font-semibold text-foreground">Chapter {chapter.chapter_number}</p>
            <p className="mt-1 text-sm text-muted-foreground">Open chapter</p>
          </div>
          <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary" aria-hidden="true" />
        </CardContent>
      </Card>
    </Link>
  );
}

export default function MemberBibleBookPage() {
  const { bookId } = useParams();

  const {
    data: book,
    isLoading: isBookLoading,
    isError: isBookError,
    error: bookError,
  } = useQuery({
    queryKey: ["member-bible-book", bookId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bible_books" as never)
        .select("id, book_number, name, abbreviation, testament")
        .eq("id", bookId)
        .single();

      if (error) throw error;
      return data as unknown as BibleBookRow;
    },
    enabled: !!bookId,
    staleTime: 10 * 60 * 1000,
  });

  const {
    data: chapters = [],
    isLoading: areChaptersLoading,
    isError: areChaptersError,
    error: chaptersError,
  } = useQuery({
    queryKey: ["member-bible-chapters", bookId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bible_chapters" as never)
        .select("id, chapter_number")
        .eq("book_id", bookId)
        .order("chapter_number", { ascending: true });

      if (error) throw error;
      return (data ?? []) as unknown as BibleChapterRow[];
    },
    enabled: !!bookId,
    staleTime: 10 * 60 * 1000,
  });

  const isLoading = isBookLoading || areChaptersLoading;
  const isError = isBookError || areChaptersError;
  const error = bookError ?? chaptersError;

  return (
    <main className="min-h-full bg-[linear-gradient(180deg,hsl(var(--background)),hsl(var(--muted)/0.35))] px-4 py-6 pb-28 lg:px-8 lg:pb-10">
      <div className="mx-auto max-w-7xl space-y-5">
        <Button asChild variant="ghost" className="h-10 rounded-lg px-3">
          <Link to="/portal/bible">
            <ArrowLeft className="mr-2 h-4 w-4" aria-hidden="true" />
            Bible
          </Link>
        </Button>

        {isLoading ? <ChapterGridSkeleton /> : null}

        {isError ? (
          <Alert variant="destructive" className="rounded-lg">
            <AlertCircle className="h-4 w-4" aria-hidden="true" />
            <AlertTitle>Unable to load chapters</AlertTitle>
            <AlertDescription>{error instanceof Error ? error.message : "Please try again."}</AlertDescription>
          </Alert>
        ) : null}

        {!isLoading && !isError && book ? (
          <>
            <Card className="rounded-lg border-primary/15 bg-card/90 shadow-sm">
              <CardContent className="flex flex-col gap-5 p-5 sm:flex-row sm:items-start sm:justify-between sm:p-6">
                <div className="flex min-w-0 items-start gap-4">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border border-primary/20 bg-primary/10 text-primary">
                    <BookOpen className="h-6 w-6" aria-hidden="true" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-primary">{TESTAMENT_LABELS[book.testament]}</p>
                    <h1 className="mt-2 text-3xl font-bold tracking-tight text-foreground sm:text-4xl">{book.name}</h1>
                    <p className="mt-2 text-sm text-muted-foreground">
                      {book.abbreviation ? `${book.abbreviation} • ` : ""}
                      Book {book.book_number}
                    </p>
                  </div>
                </div>
                <div className="rounded-lg border border-border/70 bg-background/60 px-4 py-3 text-left sm:text-right">
                  <p className="text-2xl font-bold text-foreground">{chapters.length}</p>
                  <p className="text-sm text-muted-foreground">chapters</p>
                </div>
              </CardContent>
            </Card>

            {chapters.length === 0 ? (
              <Card className="rounded-lg border-border/70 bg-card/90">
                <CardContent className="flex flex-col items-center justify-center px-6 py-16 text-center">
                  <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                    <BookOpen className="h-7 w-7" aria-hidden="true" />
                  </div>
                  <h2 className="text-lg font-semibold">No chapters found</h2>
                  <p className="mt-2 max-w-md text-sm text-muted-foreground">Chapters are not available for this book yet.</p>
                </CardContent>
              </Card>
            ) : (
              <section className="space-y-3">
                <div className="flex items-end justify-between gap-3">
                  <h2 className="text-xl font-bold tracking-tight text-foreground">Chapters</h2>
                  <p className="text-sm text-muted-foreground">Ordered by chapter number</p>
                </div>
                <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4">
                  {chapters.map((chapter) => (
                    <ChapterCard key={chapter.id} bookId={book.id} chapter={chapter} />
                  ))}
                </div>
              </section>
            )}
          </>
        ) : null}
      </div>
    </main>
  );
}

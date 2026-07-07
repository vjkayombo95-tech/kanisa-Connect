import { useQuery } from "@tanstack/react-query";
import { AlertCircle, ArrowLeft, ArrowRight, BookOpen } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Link, useParams } from "react-router-dom";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useWorkspacePage } from "@/components/workspace";
import { parseStaticBookRouteId } from "@/hooks/useScriptureLinks";
import { supabase } from "@/integrations/supabase/client";
import { getBibleBookDisplayName } from "@/lib/bible-display";
import { PRIMARY_BIBLE_TRANSLATION_CODE } from "@/lib/bible-translation";
import { bibleQueryOptions } from "@/lib/portal-performance";

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

function getWorkspaceBibleRoot(workspaceId: string) {
  if (workspaceId === "pastoral") return "/pastoral/bible";
  if (workspaceId === "church_admin") return "/church-admin/bible";
  if (workspaceId === "finance") return "/finance/bible";
  return "/portal/bible";
}

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
  const page = useWorkspacePage();
  const { t } = useTranslation();

  return (
    <Link to={`${getWorkspaceBibleRoot(page.workspaceId)}/${bookId}/chapter/${chapter.chapter_number}`} className="group block">
      <Card className="h-full rounded-lg border-border/70 bg-card/90 shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-md">
        <CardContent className="flex h-full items-center justify-between gap-4 p-4">
          <div className="min-w-0">
            <p className="text-base font-semibold text-foreground">{t("member_portal.bible.chapter_number", { number: chapter.chapter_number })}</p>
            <p className="mt-1 text-sm text-muted-foreground">{t("member_portal.bible.open_chapter")}</p>
          </div>
          <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary" aria-hidden="true" />
        </CardContent>
      </Card>
    </Link>
  );
}

export default function MemberBibleBookPage() {
  const page = useWorkspacePage();
  const { t, i18n } = useTranslation();
  const { bookId } = useParams();
  const bibleRoot = getWorkspaceBibleRoot(page.workspaceId);

  const {
    data: book,
    isLoading: isBookLoading,
    isError: isBookError,
    error: bookError,
  } = useQuery({
    queryKey: ["member-bible-book", bookId],
    queryFn: async () => {
      const routeBookNumber = parseStaticBookRouteId(bookId);
      let query = supabase
        .from("bible_books" as never)
        .select("id, book_number, name, abbreviation, testament");

      if (routeBookNumber) {
        const translationResult = await supabase
          .from("bible_translations" as never)
          .select("id")
          .eq("code", PRIMARY_BIBLE_TRANSLATION_CODE)
          .maybeSingle();

        if (!translationResult.error && translationResult.data) {
          query = query.eq("translation_id", (translationResult.data as { id: string }).id);
        }
      }

      query = routeBookNumber ? query.eq("book_number", routeBookNumber) : query.eq("id", bookId);

      const { data, error } = await query.single();

      if (error) throw error;
      return data as unknown as BibleBookRow;
    },
    enabled: !!bookId,
    ...bibleQueryOptions,
  });

  const {
    data: chapters = [],
    isLoading: areChaptersLoading,
    isError: areChaptersError,
    error: chaptersError,
  } = useQuery({
    queryKey: ["member-bible-chapters", book?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bible_chapters" as never)
        .select("id, chapter_number")
        .eq("book_id", book!.id)
        .order("chapter_number", { ascending: true });

      if (error) throw error;
      return (data ?? []) as unknown as BibleChapterRow[];
    },
    enabled: !!book?.id,
    ...bibleQueryOptions,
  });

  const isLoading = isBookLoading || (!!book?.id && areChaptersLoading);
  const isError = isBookError || areChaptersError;
  const error = bookError ?? chaptersError;

  return (
    <main className="min-h-full bg-[linear-gradient(180deg,hsl(var(--background)),hsl(var(--muted)/0.35))] px-4 py-6 pb-28 lg:px-8 lg:pb-10">
      <div className="mx-auto max-w-7xl space-y-5">
        <Button asChild variant="ghost" className="h-10 rounded-lg px-3">
          <Link to={bibleRoot}>
            <ArrowLeft className="mr-2 h-4 w-4" aria-hidden="true" />
            {t("member_portal.bible.title")}
          </Link>
        </Button>

        {isLoading ? <ChapterGridSkeleton /> : null}

        {isError ? (
          <Alert variant="destructive" className="rounded-lg">
            <AlertCircle className="h-4 w-4" aria-hidden="true" />
            <AlertTitle>{t("member_portal.bible.unable_chapters")}</AlertTitle>
            <AlertDescription>{error instanceof Error ? error.message : t("member_portal.common.please_try_again")}</AlertDescription>
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
                    <p className="text-sm font-medium text-primary">{t(`member_portal.bible.testaments.${book.testament}`)}</p>
                    <h1 className="mt-2 text-3xl font-bold tracking-tight text-foreground sm:text-4xl">{getBibleBookDisplayName(book, i18n.language)}</h1>
                    <p className="mt-2 text-sm text-muted-foreground">
                      {book.abbreviation ? `${book.abbreviation} • ` : ""}
                      {t("member_portal.bible.book_number", { number: book.book_number })}
                    </p>
                  </div>
                </div>
                <div className="rounded-lg border border-border/70 bg-background/60 px-4 py-3 text-left sm:text-right">
                  <p className="text-2xl font-bold text-foreground">{chapters.length}</p>
                  <p className="text-sm text-muted-foreground">{t("member_portal.bible.chapters_count", { count: chapters.length })}</p>
                </div>
              </CardContent>
            </Card>

            {chapters.length === 0 ? (
              <Card className="rounded-lg border-border/70 bg-card/90">
                <CardContent className="flex flex-col items-center justify-center px-6 py-16 text-center">
                  <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                    <BookOpen className="h-7 w-7" aria-hidden="true" />
                  </div>
                  <h2 className="text-lg font-semibold">{t("member_portal.bible.no_chapters")}</h2>
                  <p className="mt-2 max-w-md text-sm text-muted-foreground">{t("member_portal.bible.no_chapters_description")}</p>
                </CardContent>
              </Card>
            ) : (
              <section className="space-y-3">
                <div className="flex items-end justify-between gap-3">
                  <h2 className="text-xl font-bold tracking-tight text-foreground">{t("member_portal.bible.chapters")}</h2>
                  <p className="text-sm text-muted-foreground">{t("member_portal.bible.ordered_by_chapter")}</p>
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

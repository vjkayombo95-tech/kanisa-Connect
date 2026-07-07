import { useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertCircle, ArrowLeft, ArrowRight, BookOpen, RotateCcw } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Link, useParams, useSearchParams } from "react-router-dom";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { BibleAudioPlayer, TranslationInformationDialog } from "@/components/bible";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useWorkspacePage } from "@/components/workspace";
import { parseStaticBookRouteId } from "@/hooks/useScriptureLinks";
import { useFeatureAccess } from "@/hooks/use-feature-access";
import { supabase } from "@/integrations/supabase/client";
import { getBibleBookDisplayName } from "@/lib/bible-display";
import { BIBLE_AUDIO_FEATURE_KEY, isBibleAudioVisible } from "@/lib/bible-audio";
import { PRIMARY_BIBLE_TRANSLATION_CODE, isMissingBibleTranslationMetadataColumn } from "@/lib/bible-translation";
import { bibleQueryOptions } from "@/lib/portal-performance";
import { cn } from "@/lib/utils";

type BibleBookRow = {
  id: string;
  translation_id: string;
  book_number: number;
  name: string;
  abbreviation: string | null;
  testament: "old" | "new" | "deuterocanonical";
};

type BibleTranslationRow = {
  id: string;
  code: string;
  name: string;
  language_code: string;
  canon_type: string | null;
  publisher: string | null;
  copyright_notice: string | null;
  license_name: string | null;
  license_url: string | null;
  source_url: string | null;
  attribution_text: string | null;
  audio_generation_allowed: boolean | null;
  ai_processing_allowed: boolean | null;
  active: boolean | null;
  default_translation: boolean | null;
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
  translation: BibleTranslationRow | null;
  book: BibleBookRow;
  chapters: BibleChapterRow[];
  selectedChapter: BibleChapterRow | null;
  verses: BibleVerseRow[];
};

function isMissingAudioEligibilityColumn(error: { message?: string; details?: string; hint?: string; code?: string }) {
  const text = [error.message, error.details, error.hint, error.code].filter(Boolean).join(" ").toLowerCase();
  return text.includes("audio_generation_allowed") && (text.includes("column") || text.includes("schema cache") || text.includes("pgrst204"));
}

function getWorkspaceBibleRoot(workspaceId: string) {
  if (workspaceId === "pastoral") return "/pastoral/bible";
  if (workspaceId === "church_admin") return "/church-admin/bible";
  if (workspaceId === "finance") return "/finance/bible";
  return "/portal/bible";
}

async function fetchTranslationWithAudioState(translationId: string): Promise<BibleTranslationRow | null> {
  const translationResult = await supabase
    .from("bible_translations" as never)
    .select("id, code, name, language_code, canon_type, publisher, copyright_notice, license_name, license_url, source_url, attribution_text, audio_generation_allowed, ai_processing_allowed, active, default_translation")
    .eq("id", translationId)
    .maybeSingle();

  if (!translationResult.error) return translationResult.data as unknown as BibleTranslationRow | null;
  if (!isMissingAudioEligibilityColumn(translationResult.error) && !isMissingBibleTranslationMetadataColumn(translationResult.error)) throw translationResult.error;

  const fallbackResult = await supabase
    .from("bible_translations" as never)
    .select("id, code, name, language_code")
    .eq("id", translationId)
    .maybeSingle();

  if (fallbackResult.error) throw fallbackResult.error;
  const fallbackTranslation = fallbackResult.data as unknown as Omit<BibleTranslationRow, "canon_type" | "publisher" | "copyright_notice" | "license_name" | "license_url" | "source_url" | "attribution_text" | "audio_generation_allowed" | "ai_processing_allowed" | "active" | "default_translation"> | null;
  return fallbackTranslation
    ? {
        ...fallbackTranslation,
        canon_type: null,
        publisher: null,
        copyright_notice: null,
        license_name: null,
        license_url: null,
        source_url: null,
        attribution_text: null,
        audio_generation_allowed: false,
        ai_processing_allowed: false,
        active: true,
        default_translation: false,
      }
    : null;
}

async function fetchChapterReaderData(bookId: string, chapterNumber: number): Promise<ChapterReaderData> {
  const routeBookNumber = parseStaticBookRouteId(bookId);
  let bookQuery = supabase
    .from("bible_books" as never)
    .select("id, translation_id, book_number, name, abbreviation, testament");

  if (routeBookNumber) {
    const translationResult = await supabase
      .from("bible_translations" as never)
      .select("id")
      .eq("code", PRIMARY_BIBLE_TRANSLATION_CODE)
      .maybeSingle();

    if (!translationResult.error && translationResult.data) {
      bookQuery = bookQuery.eq("translation_id", (translationResult.data as { id: string }).id);
    }
  }

  bookQuery = routeBookNumber ? bookQuery.eq("book_number", routeBookNumber) : bookQuery.eq("id", bookId);

  const bookResult = await bookQuery.single();
  if (bookResult.error) throw bookResult.error;

  const book = bookResult.data as unknown as BibleBookRow;

  const [translationResult, chaptersResult, versesResult] = await Promise.all([
    fetchTranslationWithAudioState(book.translation_id),
    supabase
      .from("bible_chapters" as never)
      .select("id, chapter_number")
      .eq("book_id", book.id)
      .order("chapter_number", { ascending: true }),
    supabase
      .from("bible_verses" as never)
      .select("id, verse_number, verse_text, text")
      .eq("book_id", book.id)
      .eq("chapter_number", chapterNumber)
      .order("verse_number", { ascending: true }),
  ]);

  if (chaptersResult.error) throw chaptersResult.error;
  if (versesResult.error) throw versesResult.error;

  const chapters = (chaptersResult.data ?? []) as unknown as BibleChapterRow[];

  return {
    translation: translationResult,
    book,
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
  const page = useWorkspacePage();
  const { t, i18n } = useTranslation();
  const featureAccess = useFeatureAccess();
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
    ...bibleQueryOptions,
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

  const bibleRoot = getWorkspaceBibleRoot(page.workspaceId);
  const backToChaptersPath = bookId ? `${bibleRoot}/${bookId}` : bibleRoot;
  const bibleAudioFeature = featureAccess.getFeatureState(BIBLE_AUDIO_FEATURE_KEY);

  return (
    <main className="min-h-full bg-[linear-gradient(180deg,hsl(var(--background)),hsl(var(--muted)/0.35))] px-4 py-6 pb-28 lg:px-8 lg:pb-10">
      <div className="mx-auto max-w-6xl space-y-6">
        <Button asChild variant="ghost" className="h-10 rounded-lg px-3">
          <Link to={backToChaptersPath}>
            <ArrowLeft className="mr-2 h-4 w-4" aria-hidden="true" />
            {t("member_portal.bible.back_to_chapters")}
          </Link>
        </Button>

        {!canQuery ? (
          <Alert variant="destructive" className="rounded-lg">
            <AlertCircle className="h-4 w-4" aria-hidden="true" />
            <AlertTitle>{t("member_portal.bible.unable_chapter")}</AlertTitle>
            <AlertDescription>{t("member_portal.bible.invalid_chapter_link")}</AlertDescription>
          </Alert>
        ) : null}

        {isLoading ? <ReaderSkeleton /> : null}

        {isError ? (
          <Alert variant="destructive" className="rounded-lg">
            <AlertCircle className="h-4 w-4" aria-hidden="true" />
            <AlertTitle>{t("member_portal.bible.unable_chapter")}</AlertTitle>
            <AlertDescription className="space-y-4">
              <span className="block">{error instanceof Error ? error.message : t("member_portal.common.please_try_again")}</span>
              <Button type="button" variant="outline" size="sm" onClick={() => void refetch()} disabled={isFetching}>
                <RotateCcw className="mr-2 h-4 w-4" aria-hidden="true" />
                {t("member_portal.common.retry")}
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
                  <p className="text-sm font-medium text-primary">{t(`member_portal.bible.testaments.${data.book.testament}`)}</p>
                  <h1 className="mt-2 text-3xl font-bold tracking-tight text-foreground sm:text-4xl">{getBibleBookDisplayName(data.book, i18n.language)}</h1>
                  <p className="mt-2 text-lg font-semibold text-muted-foreground">{t("member_portal.bible.chapter_number", { number: parsedChapterNumber })}</p>
                </div>
                <div className="ml-auto hidden shrink-0 sm:block">
                  <TranslationInformationDialog translation={data.translation} />
                </div>
              </CardContent>
            </Card>
            <div className="sm:hidden">
              <TranslationInformationDialog translation={data.translation} />
            </div>

            {data.translation && data.selectedChapter && data.verses.length > 0 && isBibleAudioVisible(bibleAudioFeature, data.translation) ? (
              <BibleAudioPlayer
                request={{
                  translationId: data.translation.id,
                  bookId: data.book.id,
                  chapterNumber: parsedChapterNumber,
                  languageCode: data.translation.language_code,
                }}
                previousPath={navigation.previous ? `${bibleRoot}/${data.book.id}/chapter/${navigation.previous}` : null}
                nextPath={navigation.next ? `${bibleRoot}/${data.book.id}/chapter/${navigation.next}` : null}
              />
            ) : null}

            {!data.selectedChapter || data.verses.length === 0 ? (
              <Card className="rounded-lg border-border/70 bg-card/90">
                <CardContent className="flex flex-col items-center justify-center px-6 py-16 text-center">
                  <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                    <BookOpen className="h-7 w-7" aria-hidden="true" />
                  </div>
                  <h2 className="text-lg font-semibold">{t("member_portal.bible.no_verses")}</h2>
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

            <nav className="mx-auto flex max-w-3xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between" aria-label={t("member_portal.bible.chapter_navigation")}>
              {navigation.previous ? (
                <Button asChild variant="outline" className="h-11 justify-center rounded-lg">
                  <Link to={`${bibleRoot}/${data.book.id}/chapter/${navigation.previous}`}>
                    <ArrowLeft className="mr-2 h-4 w-4" aria-hidden="true" />
                    {t("member_portal.bible.previous_chapter")}
                  </Link>
                </Button>
              ) : (
                <Button variant="outline" className="h-11 justify-center rounded-lg" disabled>
                  <ArrowLeft className="mr-2 h-4 w-4" aria-hidden="true" />
                  {t("member_portal.bible.previous_chapter")}
                </Button>
              )}

              {navigation.next ? (
                <Button asChild className="h-11 justify-center rounded-lg">
                  <Link to={`${bibleRoot}/${data.book.id}/chapter/${navigation.next}`}>
                    {t("member_portal.bible.next_chapter")}
                    <ArrowRight className="ml-2 h-4 w-4" aria-hidden="true" />
                  </Link>
                </Button>
              ) : (
                <Button className="h-11 justify-center rounded-lg" disabled>
                  {t("member_portal.bible.next_chapter")}
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

import { useCallback, useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertCircle, ArrowLeft, BookOpen, RotateCcw } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Link, useParams, useSearchParams } from "react-router-dom";

import { TranslationInformationDialog } from "@/components/bible";
import {
  BookmarkPanel,
  HighlightsPanel,
  NotesDrawer,
  ShareDialog,
} from "@/components/content-study";
import {
  BibleHeader,
  BibleReadingLayout,
  BibleToolbar,
  BottomMiniPlayer,
  ContinueReadingCard,
  VerseList,
  VerseListEmptyState,
  type BibleTranslationRow,
  type ChapterReaderData,
  type ReaderTheme,
  type ReadingMode,
} from "@/components/bible/reader";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useWorkspacePage } from "@/components/workspace";
import { useAuth } from "@/contexts/AuthContext";
import { useBookmarks, useFavorites, useHighlights, useNotes, useShareContent } from "@/hooks/use-content-study";
import { parseStaticBookRouteId, resolveStaticBookRouteId } from "@/hooks/useScriptureLinks";
import { useAutoScroll, useSynchronization, useSynchronizationEngine } from "@/hooks/use-synchronization";
import { supabase } from "@/integrations/supabase/client";
import { getBibleBookDisplayName } from "@/lib/bible-display";
import { PRIMARY_BIBLE_TRANSLATION_CODE, isMissingBibleTranslationMetadataColumn } from "@/lib/bible-translation";
import type { ContentStudySegmentState, ContentStudyTarget, HighlightColor } from "@/lib/content-study";
import { getApprovedBibleChapterAudio } from "@/lib/member-audio";
import { bibleQueryOptions } from "@/lib/portal-performance";
import { BibleIndexAdapter } from "@/lib/synchronization/adapters";
import { IndexedContentSynchronizationProvider } from "@/lib/synchronization/provider";
import { cn } from "@/lib/utils";
import type { SynchronizationSegment } from "@/types/synchronization";

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
  const fallbackTranslation = fallbackResult.data as unknown as Pick<BibleTranslationRow, "id" | "code" | "name" | "language_code"> | null;
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
  const resolvedBookId = resolveStaticBookRouteId(bookId) ?? bookId;
  const routeBookNumber = parseStaticBookRouteId(resolvedBookId);
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

  bookQuery = routeBookNumber ? bookQuery.eq("book_number", routeBookNumber) : bookQuery.eq("id", resolvedBookId);

  const bookResult = await bookQuery.single();
  if (bookResult.error) throw bookResult.error;

  const book = bookResult.data as unknown as ChapterReaderData["book"];

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

  const chapters = (chaptersResult.data ?? []) as unknown as ChapterReaderData["chapters"];

  return {
    translation: translationResult,
    book,
    chapters,
    selectedChapter: chapters.find((chapter) => chapter.chapter_number === chapterNumber) ?? null,
    verses: (versesResult.data ?? []) as unknown as ChapterReaderData["verses"],
  };
}

async function fetchActiveTranslations() {
  const result = await supabase
    .from("bible_translations" as never)
    .select("id, code, name, language_code, canon_type, publisher, copyright_notice, license_name, license_url, source_url, attribution_text, audio_generation_allowed, ai_processing_allowed, active, default_translation")
    .eq("active", true)
    .order("default_translation", { ascending: false })
    .order("name", { ascending: true });

  if (result.error) {
    if (isMissingAudioEligibilityColumn(result.error) || isMissingBibleTranslationMetadataColumn(result.error)) return [];
    throw result.error;
  }

  return (result.data ?? []) as unknown as BibleTranslationRow[];
}

function ReaderSkeleton() {
  return (
    <div className="space-y-5" data-testid="bible-reader-loading">
      <Card className="rounded-lg border-border/70 bg-card/90">
        <CardContent className="space-y-4 p-5">
          <Skeleton className="h-5 w-32 rounded-md" />
          <Skeleton className="h-10 w-60 rounded-md" />
          <Skeleton className="h-6 w-40 rounded-md" />
        </CardContent>
      </Card>
      <div className="mx-auto max-w-3xl space-y-4 rounded-lg border border-border/70 bg-card p-6">
        {Array.from({ length: 12 }).map((_, index) => (
          <div key={index} className="flex gap-3">
            <Skeleton className="mt-2 h-4 w-5 rounded-sm" />
            <Skeleton className="h-7 flex-1 rounded-md" />
          </div>
        ))}
      </div>
    </div>
  );
}

function parseVerseQueryParam(value: string | null) {
  if (!value) return null;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function getStoredReadingProgress(key: string) {
  if (typeof window === "undefined") return 0;
  const stored = Number(window.localStorage.getItem(key));
  return Number.isFinite(stored) ? Math.min(100, Math.max(0, stored)) : 0;
}

function getVerseNumberFromSegment(segment: SynchronizationSegment | null | undefined) {
  if (!segment) return null;
  const metadataVerse = Number(segment.metadata.verseNumber);
  if (Number.isInteger(metadataVerse) && metadataVerse > 0) return metadataVerse;
  const idVerse = Number(String(segment.id).replace(/[^0-9]/g, ""));
  return Number.isInteger(idVerse) && idVerse > 0 ? idVerse : null;
}

function getStoredSyncProgress(key: string) {
  if (typeof window === "undefined") return null;
  const stored = window.localStorage.getItem(key);
  if (!stored) return null;
  try {
    const parsed = JSON.parse(stored) as { timestamp?: number; listeningProgress?: number };
    return {
      timestamp: typeof parsed.timestamp === "number" ? parsed.timestamp : 0,
      listeningProgress: typeof parsed.listeningProgress === "number" ? parsed.listeningProgress : 0,
    };
  } catch {
    window.localStorage.removeItem(key);
    return null;
  }
}

export default function BibleReaderPage() {
  const page = useWorkspacePage();
  const { churchId, user } = useAuth();
  const { t, i18n } = useTranslation();
  const { bookId, chapterNumber } = useParams();
  const [searchParams] = useSearchParams();
  const [fontScale, setFontScale] = useState(1.1);
  const [theme, setTheme] = useState<ReaderTheme>("system");
  const [mode, setMode] = useState<ReadingMode>("read-listen");
  const [search, setSearch] = useState("");
  const [bookmarked, setBookmarked] = useState(false);
  const [readingProgress, setReadingProgress] = useState(0);
  const [listeningProgress, setListeningProgress] = useState(0);
  const [playbackTime, setPlaybackTime] = useState(0);
  const [audioPlaying, setAudioPlaying] = useState(false);
  const [seekRequest, setSeekRequest] = useState<{ time: number; nonce: number; autoplay?: boolean } | null>(null);
  const [notesOpen, setNotesOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [selectedStudyVerse, setSelectedStudyVerse] = useState<number | null>(null);
  const parsedChapterNumber = Number(chapterNumber);
  const canQuery = Boolean(bookId) && Number.isInteger(parsedChapterNumber) && parsedChapterNumber > 0;
  const startVerse = parseVerseQueryParam(searchParams.get("startVerse"));
  const endVerse = parseVerseQueryParam(searchParams.get("endVerse")) ?? startVerse;
  const highlightedVerseRange = startVerse && endVerse ? { start: Math.min(startVerse, endVerse), end: Math.max(startVerse, endVerse) } : null;
  const bibleRoot = getWorkspaceBibleRoot(page.workspaceId);

  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ["premium-bible-reader", bookId, parsedChapterNumber],
    queryFn: () => fetchChapterReaderData(bookId!, parsedChapterNumber),
    enabled: canQuery,
    ...bibleQueryOptions,
  });

  const { data: translations = [] } = useQuery({
    queryKey: ["premium-bible-reader-translations"],
    queryFn: fetchActiveTranslations,
    ...bibleQueryOptions,
  });

  const navigation = useMemo(() => {
    if (!data) return { previous: null as number | null, next: null as number | null };
    const chapterNumbers = data.chapters.map((chapter) => chapter.chapter_number);
    const currentIndex = chapterNumbers.indexOf(parsedChapterNumber);

    return {
      previous: currentIndex > 0 ? chapterNumbers[currentIndex - 1] : null,
      next: currentIndex >= 0 && currentIndex < chapterNumbers.length - 1 ? chapterNumbers[currentIndex + 1] : null,
    };
  }, [data, parsedChapterNumber]);

  const bookName = data ? getBibleBookDisplayName(data.book, i18n.language) : "";
  const currentPath = data ? `${bibleRoot}/${data.book.id}/chapter/${parsedChapterNumber}` : bibleRoot;
  const previousPath = data && navigation.previous ? `${bibleRoot}/${data.book.id}/chapter/${navigation.previous}` : null;
  const nextPath = data && navigation.next ? `${bibleRoot}/${data.book.id}/chapter/${navigation.next}` : null;
  const backToChaptersPath = bookId ? `${bibleRoot}/${bookId}` : bibleRoot;
  const readingProgressKey = data ? `kanisa:bible-reading-progress:${data.book.id}:${parsedChapterNumber}` : "";
  const syncProgressKey = data ? `kanisa:bible-sync-progress:${data.book.id}:${parsedChapterNumber}` : "";
  const studyContentId = data ? `${data.translation?.code ?? data.book.translation_id}:${data.book.id}:${parsedChapterNumber}` : "";
  const baseStudyTarget = useMemo<ContentStudyTarget>(
    () => ({
      contentType: "bible",
      contentId: studyContentId,
      userId: user?.id ?? null,
      churchId,
      metadata: data
        ? {
            bookId: data.book.id,
            bookName: data.book.name,
            chapter: parsedChapterNumber,
            translationId: data.book.translation_id,
          }
        : {},
    }),
    [churchId, data, parsedChapterNumber, studyContentId, user?.id],
  );

  const bookmarks = useBookmarks(baseStudyTarget, !!data);
  const highlights = useHighlights(baseStudyTarget, !!data);
  const notes = useNotes(baseStudyTarget, !!data);
  const favorites = useFavorites(baseStudyTarget, !!data);
  const share = useShareContent();

  const { data: approvedAudio = null } = useQuery({
    queryKey: ["approved-bible-audio", churchId, data?.book.name, data?.book.abbreviation, parsedChapterNumber],
    queryFn: () =>
      data && churchId
        ? getApprovedBibleChapterAudio({
            churchId,
            bookName: data.book.name,
            abbreviation: data.book.abbreviation,
            chapter: parsedChapterNumber,
          })
        : Promise.resolve(null),
    enabled: !!churchId && !!data?.book && !!data.selectedChapter && data.verses.length > 0,
    staleTime: 60_000,
  });

  const audioSource = useMemo(
    () =>
      approvedAudio
        ? {
            id: approvedAudio.versionId,
            title: `${bookName} ${parsedChapterNumber}`,
            subtitle: "Approved Bible audio",
            src: approvedAudio.audioUrl,
            durationSeconds: approvedAudio.verses.at(-1)?.end ?? null,
            mimeType: "audio/mpeg",
          }
        : null,
    [approvedAudio, bookName, parsedChapterNumber],
  );

  const synchronizationProvider = useMemo(() => {
    if (!approvedAudio || !audioSource) return null;
    return IndexedContentSynchronizationProvider.fromAdapter(new BibleIndexAdapter(), {
      contentId: approvedAudio.versionId,
      trackId: approvedAudio.jobId,
      duration: audioSource.durationSeconds,
      verses: approvedAudio.verses,
      metadata: {
        book: data?.book.name,
        chapter: parsedChapterNumber,
        source: "approved_bible_audio",
      },
    });
  }, [approvedAudio, audioSource, data?.book.name, parsedChapterNumber]);

  const synchronization = useSynchronization(synchronizationProvider);
  const synchronizationEngine = useSynchronizationEngine(synchronization.data);
  const activeVerseSegment = useMemo(() => synchronizationEngine?.currentSegment(playbackTime, "verse") ?? null, [playbackTime, synchronizationEngine]);
  const activeWordSegment = useMemo(() => synchronizationEngine?.currentWord(playbackTime) ?? null, [playbackTime, synchronizationEngine]);
  const activeVerseNumber = getVerseNumberFromSegment(activeVerseSegment);
  const activeVerseAnnouncement = activeVerseNumber ? `${bookName} ${parsedChapterNumber}, verse ${activeVerseNumber}` : "";

  const verseByNumber = useMemo(() => {
    const map = new Map<number, ChapterReaderData["verses"][number]>();
    for (const verse of data?.verses ?? []) map.set(verse.verse_number, verse);
    return map;
  }, [data?.verses]);

  const getVerseStudyTarget = useCallback(
    (verseNumber: number): ContentStudyTarget => {
      const verse = verseByNumber.get(verseNumber);
      const excerpt = verse ? ("verse_text" in verse ? verse.verse_text : verse.text) : null;
      return {
        ...baseStudyTarget,
        segmentId: `verse-${verseNumber}`,
        reference: `${bookName} ${parsedChapterNumber}:${verseNumber}`,
        excerpt: typeof excerpt === "string" ? excerpt : null,
      };
    },
    [baseStudyTarget, bookName, parsedChapterNumber, verseByNumber],
  );

  const studyStateByVerse = useMemo(() => {
    const map = new Map<number, ContentStudySegmentState>();
    const ensure = (segmentId: string | null | undefined) => {
      const verseNumber = Number(String(segmentId ?? "").replace("verse-", ""));
      if (!Number.isInteger(verseNumber) || verseNumber <= 0) return null;
      const state = map.get(verseNumber) ?? {};
      map.set(verseNumber, state);
      return state;
    };
    for (const bookmark of bookmarks.data ?? []) {
      const state = ensure(bookmark.segmentId);
      if (state) state.bookmarked = true;
    }
    for (const highlight of highlights.data ?? []) {
      const state = ensure(highlight.segmentId);
      if (state) state.highlightColor = highlight.color;
    }
    for (const note of notes.data ?? []) {
      const state = ensure(note.segmentId);
      if (state) state.noteCount = (state.noteCount ?? 0) + 1;
    }
    for (const favorite of favorites.data ?? []) {
      const state = ensure(favorite.segmentId);
      if (state) state.favorite = true;
    }
    return map;
  }, [bookmarks.data, favorites.data, highlights.data, notes.data]);

  const syncSegmentsByVerse = useMemo(() => {
    const map = new Map<number, SynchronizationSegment>();
    for (const segment of synchronizationEngine?.index.segments ?? []) {
      if (segment.type !== "verse") continue;
      const verseNumber = getVerseNumberFromSegment(segment);
      if (verseNumber) map.set(verseNumber, segment);
    }
    return map;
  }, [synchronizationEngine]);

  const syncWordsByVerse = useMemo(() => {
    const map = new Map<number, SynchronizationSegment[]>();
    for (const word of synchronizationEngine?.index.segments ?? []) {
      if (word.type !== "word" || !word.parentId) continue;
      const parent = synchronizationEngine.index.segments.find((segment) => segment.id === word.parentId);
      const verseNumber = getVerseNumberFromSegment(parent);
      if (!verseNumber) continue;
      const words = map.get(verseNumber) ?? [];
      words.push(word);
      map.set(verseNumber, words);
    }
    return map;
  }, [synchronizationEngine]);

  useAutoScroll({
    activeId: activeVerseNumber ? `verse-${activeVerseNumber}` : null,
    enabled: audioPlaying && mode === "read-listen",
    pauseMs: 3500,
    behavior: "smooth",
  });

  useEffect(() => {
    if (!data) return;
    const bookmarkKey = `kanisa:bible-bookmark:${data.book.id}:${parsedChapterNumber}`;
    setBookmarked(window.localStorage.getItem(bookmarkKey) === "true");
    setReadingProgress(getStoredReadingProgress(readingProgressKey));
    const storedSync = getStoredSyncProgress(syncProgressKey);
    setListeningProgress(storedSync?.listeningProgress ?? 0);
    setPlaybackTime(storedSync?.timestamp ?? 0);

    if (!startVerse) {
      window.scrollTo({ top: 0, left: 0, behavior: "smooth" });
      return;
    }

    window.setTimeout(() => {
      document.getElementById(`verse-${startVerse}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 0);
  }, [data, parsedChapterNumber, readingProgressKey, startVerse, syncProgressKey]);

  useEffect(() => {
    if (!data || !readingProgressKey) return;

    const updateProgress = () => {
      const documentHeight = document.documentElement.scrollHeight - window.innerHeight;
      const progress = documentHeight <= 0 ? 100 : Math.min(100, Math.max(0, (window.scrollY / documentHeight) * 100));
      setReadingProgress(progress);
      window.localStorage.setItem(readingProgressKey, String(Math.round(progress)));
    };

    updateProgress();
    window.addEventListener("scroll", updateProgress, { passive: true });
    return () => window.removeEventListener("scroll", updateProgress);
  }, [data, readingProgressKey]);

  useEffect(() => {
    if (!data || !syncProgressKey) return;
    const progress = synchronizationEngine ? synchronizationEngine.progress(playbackTime) : null;
    const nextListeningProgress = progress?.percent ?? listeningProgress;
    const activeVerse = getVerseNumberFromSegment(activeVerseSegment);
    window.localStorage.setItem(
      syncProgressKey,
      JSON.stringify({
        book: data.book.name,
        chapter: parsedChapterNumber,
        timestamp: playbackTime,
        currentVerse: activeVerse,
        listeningProgress: nextListeningProgress,
        updatedAt: new Date().toISOString(),
      }),
    );
    if (progress) setListeningProgress(progress.percent);
  }, [activeVerseSegment, data, listeningProgress, parsedChapterNumber, playbackTime, syncProgressKey, synchronizationEngine]);

  useEffect(() => {
    const storedSync = getStoredSyncProgress(syncProgressKey);
    if (!audioSource || !storedSync?.timestamp || seekRequest) return;
    setSeekRequest({ time: storedSync.timestamp, nonce: Date.now(), autoplay: false });
  }, [audioSource, seekRequest, syncProgressKey]);

  const handleShare = useCallback(() => {
    const shareTitle = data ? `${bookName} ${parsedChapterNumber}` : "Bible";
    const url = typeof window !== "undefined" ? window.location.href : "";
    if (navigator.share) {
      void navigator.share({ title: shareTitle, url });
      return;
    }
    if (navigator.clipboard && url) void navigator.clipboard.writeText(url);
  }, [bookName, data, parsedChapterNumber]);

  const toggleBookmark = useCallback(() => {
    if (!data) return;
    const bookmarkKey = `kanisa:bible-bookmark:${data.book.id}:${parsedChapterNumber}`;
    setBookmarked((current) => {
      const next = !current;
      window.localStorage.setItem(bookmarkKey, String(next));
      return next;
    });
  }, [data, parsedChapterNumber]);

  const handleStudyBookmark = useCallback(
    async (verseNumber: number) => {
      await bookmarks.toggleBookmark({
        segmentId: `verse-${verseNumber}`,
        current: !!studyStateByVerse.get(verseNumber)?.bookmarked,
      });
    },
    [bookmarks, studyStateByVerse],
  );

  const handleStudyHighlight = useCallback(
    async (verseNumber: number, color: HighlightColor) => {
      await highlights.setHighlight({ segmentId: `verse-${verseNumber}`, color });
    },
    [highlights],
  );

  const handleClearStudyHighlight = useCallback(
    async (verseNumber: number) => {
      await highlights.clearHighlight({ segmentId: `verse-${verseNumber}` });
    },
    [highlights],
  );

  const handleStudyFavorite = useCallback(
    async (verseNumber: number) => {
      await favorites.toggleFavorite({
        segmentId: `verse-${verseNumber}`,
        current: !!studyStateByVerse.get(verseNumber)?.favorite,
      });
    },
    [favorites, studyStateByVerse],
  );

  const handleStudyNote = useCallback((verseNumber: number) => {
    setSelectedStudyVerse(verseNumber);
    setNotesOpen(true);
  }, []);

  const handleStudyShare = useCallback((verseNumber: number) => {
    setSelectedStudyVerse(verseNumber);
    setShareOpen(true);
  }, []);

  const handleCopyVerse = useCallback(
    async (verseNumber: number) => {
      const target = getVerseStudyTarget(verseNumber);
      await share.copyReference([target.reference, target.excerpt].filter(Boolean).join("\n"));
    },
    [getVerseStudyTarget, share],
  );

  const seekToSegment = useCallback(
    (segment: SynchronizationSegment) => {
      if (!synchronizationProvider) return;
      const timestamp = synchronizationProvider.timestampFor(segment.id);
      if (timestamp === null) return;
      setSeekRequest({ time: timestamp, nonce: Date.now(), autoplay: true });
      setPlaybackTime(timestamp);
      if (mode === "read") setMode("read-listen");
    },
    [mode, synchronizationProvider],
  );

  const handleVerseSelect = useCallback(
    (verseNumber: number) => {
      const segment = syncSegmentsByVerse.get(verseNumber);
      if (segment) {
        seekToSegment(segment);
        return;
      }
      document.getElementById(`verse-${verseNumber}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
    },
    [seekToSegment, syncSegmentsByVerse],
  );

  const selectedStudyTarget = selectedStudyVerse ? getVerseStudyTarget(selectedStudyVerse) : null;
  const selectedStudyNotes = useMemo(
    () => (selectedStudyTarget ? (notes.data ?? []).filter((note) => note.segmentId === selectedStudyTarget.segmentId) : []),
    [notes.data, selectedStudyTarget],
  );

  const handleSelectStudySegment = useCallback((segmentId: string | null) => {
    const verseNumber = Number(String(segmentId ?? "").replace("verse-", ""));
    if (!Number.isInteger(verseNumber) || verseNumber <= 0) return;
    document.getElementById(`verse-${verseNumber}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
    setSelectedStudyVerse(verseNumber);
  }, []);

  const aside = data ? (
    <div className="space-y-4">
      <ContinueReadingCard bookName={bookName} chapterNumber={parsedChapterNumber} path={currentPath} readingProgress={readingProgress} listeningProgress={listeningProgress} />
      <TranslationInformationDialog translation={data.translation} />
      <BookmarkPanel bookmarks={bookmarks.data ?? []} onSelect={handleSelectStudySegment} />
      <HighlightsPanel highlights={highlights.data ?? []} onSelect={handleSelectStudySegment} />
    </div>
  ) : null;

  return (
    <main
      className={cn(
        "min-h-full px-4 pb-32 pt-4 lg:px-8 lg:pt-6",
        theme === "dark" && "bg-slate-950 text-slate-50",
        theme !== "dark" && "bg-[linear-gradient(180deg,hsl(var(--background)),hsl(var(--muted)/0.35))]",
      )}
      data-testid="bible-reader-page"
    >
      <div className="mx-auto max-w-6xl space-y-5">
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
          <Alert variant="destructive" className="rounded-lg" data-testid="bible-reader-error">
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
            <BibleHeader
              bookName={bookName}
              chapterNumber={parsedChapterNumber}
              translation={data.translation}
              translations={translations.length ? translations : data.translation ? [data.translation] : []}
              previousPath={previousPath}
              nextPath={nextPath}
              bookmarked={bookmarked}
              onTranslationChange={() => undefined}
              onShare={handleShare}
              onBookmarkToggle={toggleBookmark}
            />

            <Card className="rounded-lg border-primary/15 bg-card/95 shadow-sm">
              <CardContent className="flex items-start gap-4 p-5 sm:p-6">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border border-primary/20 bg-primary/10 text-primary">
                  <BookOpen className="h-6 w-6" aria-hidden="true" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-primary">{t(`member_portal.bible.testaments.${data.book.testament}`)}</p>
                  <h1 className="mt-2 text-3xl font-bold tracking-normal text-foreground sm:text-4xl">{bookName}</h1>
                  <p className="mt-2 text-lg font-semibold text-muted-foreground">Chapter {parsedChapterNumber}</p>
                </div>
              </CardContent>
            </Card>

            <BibleToolbar
              fontScale={fontScale}
              theme={theme}
              mode={mode}
              search={search}
              onFontScaleChange={setFontScale}
              onThemeChange={setTheme}
              onModeChange={setMode}
              onSearchChange={setSearch}
            />

            <div className="xl:hidden">
              <ContinueReadingCard bookName={bookName} chapterNumber={parsedChapterNumber} path={currentPath} readingProgress={readingProgress} listeningProgress={listeningProgress} />
            </div>

            <BibleReadingLayout aside={aside}>
              {!data.selectedChapter || data.verses.length === 0 ? (
                <VerseListEmptyState />
              ) : mode === "listen" && audioSource ? (
                <div className="mx-auto max-w-3xl rounded-lg border border-border/70 bg-card p-8 text-center shadow-sm">
                  <h2 className="text-xl font-semibold">Listening mode</h2>
                  <p className="mt-2 text-sm text-muted-foreground">Use the mini player below to listen to this chapter. Synchronization continues in the background.</p>
                </div>
              ) : (
                <VerseList
                  verses={data.verses}
                  fontScale={fontScale}
                  search={search}
                  highlightedRange={highlightedVerseRange}
                  activeVerseNumber={activeVerseNumber}
                  activeWordId={activeWordSegment?.id ?? null}
                  syncSegmentsByVerse={syncSegmentsByVerse}
                  syncWordsByVerse={syncWordsByVerse}
                  studyStateByVerse={studyStateByVerse}
                  onSelectVerse={handleVerseSelect}
                  onSeekSegment={seekToSegment}
                  onBookmarkVerse={handleStudyBookmark}
                  onHighlightVerse={handleStudyHighlight}
                  onClearHighlightVerse={handleClearStudyHighlight}
                  onNoteVerse={handleStudyNote}
                  onFavoriteVerse={handleStudyFavorite}
                  onShareVerse={handleStudyShare}
                  onCopyVerse={handleCopyVerse}
                />
              )}
            </BibleReadingLayout>
            <p className="sr-only" aria-live="polite">{activeVerseAnnouncement}</p>
            <NotesDrawer
              open={notesOpen}
              reference={selectedStudyTarget?.reference ?? undefined}
              notes={selectedStudyNotes}
              onOpenChange={setNotesOpen}
              onAddNote={(body) => (selectedStudyTarget ? notes.addNote({ segmentId: selectedStudyTarget.segmentId, body }) : undefined)}
            />
            <ShareDialog
              open={shareOpen}
              reference={selectedStudyTarget?.reference ?? `${bookName} ${parsedChapterNumber}`}
              excerpt={selectedStudyTarget?.excerpt ?? ""}
              url={typeof window !== "undefined" ? window.location.href : currentPath}
              onOpenChange={setShareOpen}
              onCopy={share.copyText}
              onShare={() =>
                share.shareContent({
                  title: selectedStudyTarget?.reference ?? `${bookName} ${parsedChapterNumber}`,
                  text: selectedStudyTarget?.excerpt ?? undefined,
                  url: typeof window !== "undefined" ? window.location.href : currentPath,
                })
              }
            />
          </>
        ) : null}
      </div>

      <BottomMiniPlayer
        source={audioSource}
        title={`${bookName} ${parsedChapterNumber}`}
        subtitle={data?.translation?.name ?? "Bible audio"}
        visible={!!audioSource && (mode === "listen" || mode === "read-listen")}
        seekRequest={seekRequest}
        onProgress={setListeningProgress}
        onTimeUpdate={(time) => setPlaybackTime(time)}
        onPlayingChange={setAudioPlaying}
      />
    </main>
  );
}

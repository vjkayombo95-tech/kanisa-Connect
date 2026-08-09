import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertCircle, ArrowRight, BookOpen, Search, TriangleAlert } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Link, useNavigate } from "react-router-dom";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { TranslationInformationDialog } from "@/components/bible";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { PageToolbar, getWorkspacePageActions, useWorkspacePage } from "@/components/workspace";
import { supabase } from "@/integrations/supabase/client";
import {
  bibleReferenceToPath,
  getBibleBookAliases,
  normalizeBibleLookup,
  parseBibleReference,
  type ParsedBibleReference,
} from "@/lib/bible-reference-parser";
import { getBibleBookDisplayName } from "@/lib/bible-display";
import {
  PRIMARY_BIBLE_TRANSLATION_CODE,
  fetchBibleTranslationMetadata,
  type BibleTranslationAttribution,
} from "@/lib/bible-translation";
import { bibleQueryOptions } from "@/lib/portal-performance";

type BibleBookRow = {
  id: string;
  book_number: number;
  name: string;
  abbreviation: string | null;
  testament: "old" | "new" | "deuterocanonical";
};

type BibleVerseSearchRow = {
  id: string;
  book_id: string;
  chapter_number: number;
  verse_number: number;
  verse_text: string | null;
  text: string | null;
  reference: string | null;
  bible_books: {
    id: string;
    name: string;
  } | null;
};

type BibleChapterRow = {
  id: string;
  chapter_number: number;
};

type BibleVerseNumberRow = {
  id: string;
  verse_number: number;
};

type BibleReferenceValidationData = {
  chapters: BibleChapterRow[];
  verses: BibleVerseNumberRow[];
};

type InvalidReferenceState =
  | {
      reason: "chapter";
      requestedChapter: number;
      nearestChapter: number | null;
      maxChapter: number | null;
    }
  | {
      reason: "verse";
      requestedVerse: number;
      maxVerse: number | null;
    };

type UnknownBookState = {
  candidate: string;
  suggestions: BibleBookRow[];
  looksLikeReference: boolean;
};

const TESTAMENT_ORDER: BibleBookRow["testament"][] = ["old", "new", "deuterocanonical"];

function getWorkspaceBibleRoot(workspaceId: string) {
  if (workspaceId === "pastoral") return "/pastoral/bible";
  if (workspaceId === "church_admin") return "/church-admin/bible";
  if (workspaceId === "finance") return "/finance/bible";
  return "/portal/bible";
}

function toWorkspaceBiblePath(path: string, workspaceId: string) {
  return path.replace(/^\/portal\/bible/, getWorkspaceBibleRoot(workspaceId));
}

function useDebouncedValue(value: string, delayMs: number) {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => setDebouncedValue(value), delayMs);
    return () => window.clearTimeout(timeoutId);
  }, [delayMs, value]);

  return debouncedValue;
}

function normalizeSearchTerm(value: string) {
  return value.replace(/[,()%]/g, " ").replace(/\s+/g, " ").trim();
}

async function fetchPrimaryBibleTranslation(): Promise<BibleTranslationAttribution | null> {
  const translations = await fetchBibleTranslationMetadata();
  return translations.find((translation) => translation.default_translation) ?? translations.find((translation) => translation.code === PRIMARY_BIBLE_TRANSLATION_CODE) ?? translations[0] ?? null;
}

function levenshteinDistance(left: string, right: string) {
  const rows = left.length + 1;
  const columns = right.length + 1;
  const distances = Array.from({ length: rows }, () => Array<number>(columns).fill(0));

  for (let row = 0; row < rows; row += 1) distances[row][0] = row;
  for (let column = 0; column < columns; column += 1) distances[0][column] = column;

  for (let row = 1; row < rows; row += 1) {
    for (let column = 1; column < columns; column += 1) {
      const cost = left[row - 1] === right[column - 1] ? 0 : 1;
      distances[row][column] = Math.min(
        distances[row - 1][column] + 1,
        distances[row][column - 1] + 1,
        distances[row - 1][column - 1] + cost,
      );
    }
  }

  return distances[left.length][right.length];
}

function getReferenceBookCandidate(value: string) {
  return normalizeBibleLookup(value).replace(/\s+\d.*$/, "").trim();
}

function getClosestBookSuggestions(candidate: string, books: BibleBookRow[]) {
  const normalizedCandidate = normalizeBibleLookup(candidate);
  if (!normalizedCandidate) return [];

  const scored = books.map((book) => {
    const aliases = getBibleBookAliases(book);
    const bestDistance = Math.min(...aliases.map((alias) => levenshteinDistance(normalizedCandidate, normalizeBibleLookup(alias))));
    return { book, distance: bestDistance };
  });

  return scored
    .filter(({ distance }) => distance <= Math.max(1, Math.min(3, Math.floor(normalizedCandidate.length / 3))))
    .sort((left, right) => left.distance - right.distance || left.book.book_number - right.book.book_number)
    .map(({ book }) => book)
    .slice(0, 4);
}

function getNearestChapter(chapterNumbers: number[], requestedChapter: number) {
  if (chapterNumbers.length === 0) return null;
  return chapterNumbers.reduce((nearest, chapter) =>
    Math.abs(chapter - requestedChapter) < Math.abs(nearest - requestedChapter) ? chapter : nearest,
  );
}

function isReferenceLikeInput(value: string) {
  const query = normalizeBibleLookup(value);
  return /\d|:|-/.test(query);
}

function BookGridSkeleton() {
  return (
    <div className="space-y-8">
      {Array.from({ length: 2 }).map((_, sectionIndex) => (
        <section key={sectionIndex} className="space-y-3">
          <Skeleton className="h-7 w-44 rounded-md" />
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {Array.from({ length: sectionIndex === 0 ? 8 : 6 }).map((__, index) => (
              <Skeleton key={index} className="h-24 rounded-lg" />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function SearchResultsSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 8 }).map((_, index) => (
        <Skeleton key={index} className="h-28 rounded-lg" />
      ))}
    </div>
  );
}

function BookCard({ book }: { book: BibleBookRow }) {
  const page = useWorkspacePage();
  const { t, i18n } = useTranslation();

  return (
    <Link to={`${getWorkspaceBibleRoot(page.workspaceId)}/${book.id}`} className="group block">
      <Card className="h-full rounded-lg border-border/70 bg-card/90 shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-md">
        <CardContent className="flex h-full items-center gap-4 p-4">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-primary/20 bg-primary/10 text-primary">
            <BookOpen className="h-5 w-5" aria-hidden="true" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-base font-semibold text-foreground">{getBibleBookDisplayName(book, i18n.language)}</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {book.abbreviation ? `${book.abbreviation} • ` : ""}
              {t("member_portal.bible.book_number", { number: book.book_number })}
            </p>
          </div>
          <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary" aria-hidden="true" />
        </CardContent>
      </Card>
    </Link>
  );
}

function getVerseText(verse: BibleVerseSearchRow) {
  return verse.verse_text ?? verse.text ?? "";
}

function getBookName(verse: BibleVerseSearchRow) {
  return verse.bible_books?.name ?? verse.reference?.replace(/\s+\d+:\d+.*$/, "") ?? "Bible";
}

function SearchResultCard({ verse }: { verse: BibleVerseSearchRow }) {
  const page = useWorkspacePage();
  const { t, i18n } = useTranslation();
  const bookName = getBookName(verse);

  return (
    <Link to={`${getWorkspaceBibleRoot(page.workspaceId)}/${verse.book_id}/chapter/${verse.chapter_number}`} className="group block">
      <Card className="rounded-lg border-border/70 bg-card/90 shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-md">
        <CardContent className="space-y-3 p-4 sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-primary">{getBibleBookDisplayName({ name: bookName }, i18n.language)}</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {t("member_portal.bible.chapter_verse", { chapter: verse.chapter_number, verse: verse.verse_number })}
              </p>
            </div>
            <ArrowRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary" aria-hidden="true" />
          </div>
          <p className="line-clamp-3 text-base leading-7 text-foreground">
            <sup className="mr-1 align-super text-xs font-bold text-primary">{verse.verse_number}</sup>
            {getVerseText(verse)}
          </p>
        </CardContent>
      </Card>
    </Link>
  );
}

function getReferenceLabel(reference: ParsedBibleReference, language: string) {
  const bookName = getBibleBookDisplayName(reference.book, language);
  if (reference.kind === "book") return bookName;
  if (reference.kind === "chapter") return `${bookName} ${reference.chapter}`;

  return `${bookName} ${reference.chapter}:${reference.startVerse}${
    reference.endVerse && reference.endVerse !== reference.startVerse ? `-${reference.endVerse}` : ""
  }`;
}

function ReferenceResultCard({ reference }: { reference: ParsedBibleReference }) {
  const page = useWorkspacePage();
  const { t, i18n } = useTranslation();
  const path = toWorkspaceBiblePath(bibleReferenceToPath(reference), page.workspaceId);
  const label = getReferenceLabel(reference, i18n.language);

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-xl font-bold tracking-tight text-foreground">{t("member_portal.bible.reference_found")}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{t("member_portal.bible.reference_found_description")}</p>
      </div>
      <Card className="rounded-lg border-primary/20 bg-card/90 shadow-sm">
        <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-4">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-primary/20 bg-primary/10 text-primary">
              <BookOpen className="h-5 w-5" aria-hidden="true" />
            </div>
            <div>
              <p className="text-sm font-medium text-primary">{t("member_portal.bible.bible_reference")}</p>
              <h2 className="mt-1 text-xl font-semibold text-foreground">{label}</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {reference.kind === "book"
                  ? t("member_portal.bible.open_book_description")
                  : reference.kind === "chapter"
                    ? t("member_portal.bible.open_chapter_description")
                    : t("member_portal.bible.open_verse_description")}
              </p>
            </div>
          </div>
          <Button asChild className="h-11 justify-center rounded-lg">
            <Link to={path}>
              {t("member_portal.bible.open_reference")}
              <ArrowRight className="ml-2 h-4 w-4" aria-hidden="true" />
            </Link>
          </Button>
        </CardContent>
      </Card>
    </section>
  );
}

function ReferenceValidationSkeleton() {
  return (
    <Card className="rounded-lg border-border/70 bg-card/90">
      <CardContent className="space-y-4 p-5">
        <Skeleton className="h-5 w-36 rounded-md" />
        <Skeleton className="h-7 w-64 rounded-md" />
        <Skeleton className="h-10 w-40 rounded-md" />
      </CardContent>
    </Card>
  );
}

function InvalidReferenceAlert({ reference, invalid }: { reference: ParsedBibleReference; invalid: InvalidReferenceState }) {
  const page = useWorkspacePage();
  const { t, i18n } = useTranslation();
  const bookName = getBibleBookDisplayName(reference.book, i18n.language);
  const chapterPath =
    reference.kind === "book"
      ? `${getWorkspaceBibleRoot(page.workspaceId)}/${reference.book.id}`
      : `${getWorkspaceBibleRoot(page.workspaceId)}/${reference.book.id}/chapter/${
          invalid.reason === "chapter" ? invalid.nearestChapter ?? 1 : reference.chapter
        }`;

  return (
    <Alert className="rounded-lg border-amber-500/40 bg-amber-500/10 text-amber-950 dark:text-amber-100">
      <TriangleAlert className="h-4 w-4 text-amber-600 dark:text-amber-300" aria-hidden="true" />
      <AlertTitle>{t("member_portal.bible.reference_missing")}</AlertTitle>
      <AlertDescription className="space-y-4">
        <p>
          {invalid.reason === "chapter"
            ? t("member_portal.bible.invalid_chapter", {
                book: bookName,
                chapter: invalid.requestedChapter,
                max: invalid.maxChapter ?? t("member_portal.bible.no_available_chapters"),
              })
            : t("member_portal.bible.invalid_verse", {
                reference: getReferenceLabel(reference, i18n.language),
                book: bookName,
                chapter: reference.kind === "verse" ? reference.chapter : "",
                max: invalid.maxVerse ?? t("member_portal.bible.no_available_verses"),
              })}
        </p>
        {(invalid.reason === "verse" || invalid.nearestChapter) && (
          <Button asChild variant="outline" className="h-10 rounded-lg border-amber-500/50 bg-background/70">
            <Link to={chapterPath}>
              {invalid.reason === "chapter" ? t("member_portal.bible.open_chapter_number", { number: invalid.nearestChapter }) : t("member_portal.bible.open_chapter")}
              <ArrowRight className="ml-2 h-4 w-4" aria-hidden="true" />
            </Link>
          </Button>
        )}
      </AlertDescription>
    </Alert>
  );
}

function UnknownBookAlert({ unknownBook }: { unknownBook: UnknownBookState }) {
  const page = useWorkspacePage();
  const { t, i18n } = useTranslation();

  return (
    <Alert variant="destructive" className="rounded-lg">
      <AlertCircle className="h-4 w-4" aria-hidden="true" />
      <AlertTitle>{t("member_portal.bible.unknown_book")}</AlertTitle>
      <AlertDescription className="space-y-4">
        <p>
          {t("member_portal.bible.unknown_book_prefix")} <span className="font-medium">{unknownBook.candidate}</span> {t("member_portal.bible.unknown_book_suffix")}
          {unknownBook.looksLikeReference ? ` ${t("member_portal.bible.check_spelling")}` : ` ${t("member_portal.bible.did_you_mean")}`}
        </p>
        {unknownBook.suggestions.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {unknownBook.suggestions.map((book) => (
              <Button key={book.id} asChild variant="outline" size="sm" className="rounded-lg">
                <Link to={`${getWorkspaceBibleRoot(page.workspaceId)}/${book.id}`}>{getBibleBookDisplayName(book, i18n.language)}</Link>
              </Button>
            ))}
          </div>
        ) : null}
      </AlertDescription>
    </Alert>
  );
}

export default function MemberBibleHomePage() {
  const page = useWorkspacePage();
  const { t, i18n } = useTranslation();
  const [search, setSearch] = useState("");
  const navigate = useNavigate();
  const debouncedSearch = useDebouncedValue(search, 300);
  const normalizedSearch = normalizeSearchTerm(debouncedSearch);

  const { data: primaryTranslation = null } = useQuery({
    queryKey: ["member-bible-primary-translation"],
    queryFn: fetchPrimaryBibleTranslation,
    ...bibleQueryOptions,
  });

  const { data: books = [], isLoading, isError, error } = useQuery({
    queryKey: ["member-bible-books", primaryTranslation?.id ?? "fallback"],
    queryFn: async () => {
      let query = supabase
        .from("bible_books" as never)
        .select("id, book_number, name, abbreviation, testament")
        .order("testament", { ascending: false })
        .order("book_number", { ascending: true });

      if (primaryTranslation?.id) query = query.eq("translation_id", primaryTranslation.id);

      const { data, error } = await query;

      if (error) throw error;
      return (data ?? []) as unknown as BibleBookRow[];
    },
    ...bibleQueryOptions,
  });

  const parsedReference = useMemo<ParsedBibleReference | null>(() => {
    return parseBibleReference(search, books);
  }, [books, search]);
  const debouncedReference = useMemo<ParsedBibleReference | null>(() => {
    return parseBibleReference(normalizedSearch, books);
  }, [books, normalizedSearch]);

  const unknownBook = useMemo<UnknownBookState | null>(() => {
    if (!normalizedSearch || debouncedReference || books.length === 0) return null;

    const candidate = getReferenceBookCandidate(normalizedSearch);
    if (!candidate || /^\d/.test(candidate)) return null;

    const suggestions = getClosestBookSuggestions(candidate, books);
    const looksLikeReference = isReferenceLikeInput(normalizedSearch);

    if (!looksLikeReference && suggestions.length === 0) return null;
    if (!looksLikeReference && candidate.length < 4) return null;

    return { candidate, suggestions, looksLikeReference };
  }, [books, debouncedReference, normalizedSearch]);

  const shouldValidateReference = Boolean(debouncedReference && debouncedReference.kind !== "book");

  const {
    data: referenceValidationData,
    isLoading: isReferenceValidationLoading,
    isError: isReferenceValidationError,
    error: referenceValidationError,
  } = useQuery({
    queryKey: [
      "member-bible-reference-validation",
      debouncedReference?.kind === "book" ? debouncedReference.book.id : debouncedReference?.book.id,
      debouncedReference?.kind === "book" ? null : debouncedReference?.chapter,
    ],
    queryFn: async (): Promise<BibleReferenceValidationData> => {
      const reference = debouncedReference!;
      const chapterNumber = reference.kind === "book" ? null : reference.chapter;

      const { data: chaptersData, error: chaptersError } = await supabase
        .from("bible_chapters" as never)
        .select("id, chapter_number")
        .eq("book_id", reference.book.id)
        .order("chapter_number", { ascending: true });

      if (chaptersError) throw chaptersError;

      const chapters = (chaptersData ?? []) as unknown as BibleChapterRow[];
      const hasChapter = chapterNumber ? chapters.some((chapter) => chapter.chapter_number === chapterNumber) : false;

      if (!chapterNumber || !hasChapter) {
        return { chapters, verses: [] };
      }

      const { data: versesData, error: versesError } = await supabase
        .from("bible_verses" as never)
        .select("id, verse_number")
        .eq("book_id", reference.book.id)
        .eq("chapter_number", chapterNumber)
        .order("verse_number", { ascending: true });

      if (versesError) throw versesError;

      return {
        chapters,
        verses: (versesData ?? []) as unknown as BibleVerseNumberRow[],
      };
    },
    enabled: shouldValidateReference,
    staleTime: 30 * 60 * 1000,
    gcTime: 2 * 60 * 60 * 1000,
    refetchOnWindowFocus: false,
    retry: 1,
  });

  const invalidReference = useMemo<InvalidReferenceState | null>(() => {
    if (!debouncedReference || debouncedReference.kind === "book" || !referenceValidationData) return null;

    const chapterNumbers = referenceValidationData.chapters.map((chapter) => chapter.chapter_number);
    const maxChapter = chapterNumbers.length ? Math.max(...chapterNumbers) : null;
    const hasChapter = chapterNumbers.includes(debouncedReference.chapter);

    if (!hasChapter) {
      return {
        reason: "chapter",
        requestedChapter: debouncedReference.chapter,
        nearestChapter: getNearestChapter(chapterNumbers, debouncedReference.chapter),
        maxChapter,
      };
    }

    if (debouncedReference.kind === "verse") {
      const verseNumbers = referenceValidationData.verses.map((verse) => verse.verse_number);
      const maxVerse = verseNumbers.length ? Math.max(...verseNumbers) : null;
      const requestedVerse = Math.max(debouncedReference.startVerse, debouncedReference.endVerse ?? debouncedReference.startVerse);

      if (!maxVerse || requestedVerse > maxVerse) {
        return {
          reason: "verse",
          requestedVerse,
          maxVerse,
        };
      }
    }

    return null;
  }, [debouncedReference, referenceValidationData]);

  const isValidatedReference =
    Boolean(debouncedReference) &&
    !invalidReference &&
    !isReferenceValidationError &&
    (!shouldValidateReference || (!isReferenceValidationLoading && Boolean(referenceValidationData)));
  const isSearching = normalizedSearch.length > 0 && !debouncedReference && !unknownBook;

  const {
    data: searchResults = [],
    isLoading: isSearchLoading,
    isError: isSearchError,
    error: searchError,
  } = useQuery({
    queryKey: ["member-bible-search", primaryTranslation?.id ?? "fallback", normalizedSearch],
    queryFn: async () => {
      const pattern = `%${normalizedSearch}%`;
      let query = supabase
        .from("bible_verses" as never)
        .select("id, book_id, chapter_number, verse_number, verse_text, text, reference, bible_books(id, name)")
        .or(`verse_text.ilike.${pattern},text.ilike.${pattern},reference.ilike.${pattern}`);

      if (primaryTranslation?.id) query = query.eq("translation_id", primaryTranslation.id);

      const { data, error } = await query
        .order("chapter_number", { ascending: true })
        .order("verse_number", { ascending: true })
        .limit(50);

      if (error) throw error;
      return (data ?? []) as unknown as BibleVerseSearchRow[];
    },
    enabled: isSearching,
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    refetchOnWindowFocus: false,
    retry: 1,
  });

  const searchSuggestions = useMemo(() => {
    const query = normalizeBibleLookup(search);
    const values: string[] = [];

    books.forEach((book) => {
      const aliases = getBibleBookAliases(book);
      aliases.slice(0, 5).forEach((alias) => values.push(alias));
      values.push(`${book.name} 1`);
      values.push(`${book.name} 1:1`);
      if (book.abbreviation) {
        values.push(`${book.abbreviation} 1`);
        values.push(`${book.abbreviation} 1:1`);
      }
    });

    return Array.from(new Set(values))
      .filter((value) => !query || normalizeBibleLookup(value).includes(query))
      .slice(0, 24);
  }, [books, search]);

  const booksByTestament = useMemo(() => {
    return TESTAMENT_ORDER.map((testament) => ({
      testament,
      books: books.filter((book) => book.testament === testament),
    })).filter((section) => section.books.length > 0);
  }, [books]);
  const toolbarActions = useMemo(() => getWorkspacePageActions("bible", page), [page]);

  const handleSearchSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const reference = parseBibleReference(search, books);
    if (reference?.kind === "book" || (reference && isValidatedReference)) {
      navigate(toWorkspaceBiblePath(bibleReferenceToPath(reference), page.workspaceId));
    }
  };

  return (
    <main className="min-h-full bg-[linear-gradient(180deg,hsl(var(--background)),hsl(var(--muted)/0.35))] px-4 py-6 pb-28 lg:px-8 lg:pb-10">
      <div className="mx-auto max-w-7xl space-y-6">
        <PageToolbar title={t("member_portal.bible.title")} description={t("member_portal.bible.description")} actions={toolbarActions} />
        <section className="rounded-lg border border-primary/15 bg-card/90 p-5 shadow-sm sm:p-7">
          <div className="max-w-3xl">
            <p className="flex items-center gap-2 text-sm font-medium text-primary">
              <BookOpen className="h-4 w-4" aria-hidden="true" />
              {primaryTranslation?.name ?? t("member_portal.bible.title")}
            </p>
            <h1 className="mt-3 text-3xl font-bold tracking-tight text-foreground sm:text-4xl">Biblia Takatifu</h1>
            <div className="mt-4">
              <TranslationInformationDialog translation={primaryTranslation} />
            </div>
          </div>
          <form className="mt-5 max-w-2xl" onSubmit={handleSearchSubmit}>
            <label htmlFor="bible-search" className="sr-only">
              {t("member_portal.bible.search_label")}
            </label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
              <Input
                id="bible-search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder={t("member_portal.bible.search_placeholder")}
                list="bible-search-suggestions"
                className="h-12 rounded-lg border-border/70 bg-background/70 pl-12 text-base"
              />
              <datalist id="bible-search-suggestions">
                {searchSuggestions.map((suggestion) => (
                  <option key={suggestion} value={suggestion} />
                ))}
              </datalist>
            </div>
            {parsedReference ? (
              <p className="mt-2 text-sm text-muted-foreground">
                {t("member_portal.bible.press_enter")}{" "}
                <span className="font-medium text-foreground">
                  {parsedReference.kind === "book"
                    ? getBibleBookDisplayName(parsedReference.book, i18n.language)
                    : `${getBibleBookDisplayName(parsedReference.book, i18n.language)} ${parsedReference.chapter}${
                        parsedReference.kind === "verse" ? `:${parsedReference.startVerse}` : ""
                      }`}
                </span>
                .
              </p>
            ) : null}
          </form>
        </section>

        {debouncedReference && isReferenceValidationLoading ? (
          <ReferenceValidationSkeleton />
        ) : debouncedReference && isReferenceValidationError ? (
          <Alert variant="destructive" className="rounded-lg">
            <AlertCircle className="h-4 w-4" aria-hidden="true" />
            <AlertTitle>{t("member_portal.bible.unable_validate_reference")}</AlertTitle>
            <AlertDescription>
              {referenceValidationError instanceof Error ? referenceValidationError.message : t("member_portal.bible.try_reference_again")}
            </AlertDescription>
          </Alert>
        ) : debouncedReference && invalidReference ? (
          <InvalidReferenceAlert reference={debouncedReference} invalid={invalidReference} />
        ) : debouncedReference && isValidatedReference ? (
          <ReferenceResultCard reference={debouncedReference} />
        ) : unknownBook ? (
          <UnknownBookAlert unknownBook={unknownBook} />
        ) : isSearching ? (
          <section className="space-y-4">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 className="text-xl font-bold tracking-tight text-foreground">{t("member_portal.bible.search_results")}</h2>
                <p className="mt-1 text-sm text-muted-foreground">{t("member_portal.bible.search_results_description")}</p>
              </div>
              {!isSearchLoading && !isSearchError ? <p className="text-sm text-muted-foreground">{t("member_portal.bible.results_found", { count: searchResults.length })}</p> : null}
            </div>

            {isSearchLoading ? <SearchResultsSkeleton /> : null}

            {isSearchError ? (
              <Alert variant="destructive" className="rounded-lg">
                <AlertCircle className="h-4 w-4" aria-hidden="true" />
                <AlertTitle>{t("member_portal.bible.unable_search")}</AlertTitle>
                <AlertDescription>{searchError instanceof Error ? searchError.message : t("member_portal.common.please_try_again")}</AlertDescription>
              </Alert>
            ) : null}

            {!isSearchLoading && !isSearchError && searchResults.length === 0 ? (
              <Card className="rounded-lg border-border/70 bg-card/90">
                <CardContent className="flex flex-col items-center justify-center px-6 py-16 text-center">
                  <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                    <Search className="h-7 w-7" aria-hidden="true" />
                  </div>
                  <h2 className="text-lg font-semibold">{t("member_portal.bible.no_verses")}</h2>
                  <p className="mt-2 max-w-md text-sm text-muted-foreground">{t("member_portal.bible.no_verses_description")}</p>
                </CardContent>
              </Card>
            ) : null}

            {!isSearchLoading && !isSearchError && searchResults.length > 0 ? (
              <div className="space-y-3">
                {searchResults.map((verse) => (
                  <SearchResultCard key={verse.id} verse={verse} />
                ))}
              </div>
            ) : null}
          </section>
        ) : (
          <>
            {isLoading ? <BookGridSkeleton /> : null}

            {isError ? (
              <Alert variant="destructive" className="rounded-lg">
                <AlertCircle className="h-4 w-4" aria-hidden="true" />
                <AlertTitle>{t("member_portal.bible.unable_books")}</AlertTitle>
                <AlertDescription>{error instanceof Error ? error.message : t("member_portal.common.please_try_again")}</AlertDescription>
              </Alert>
            ) : null}

            {!isLoading && !isError && books.length === 0 ? (
              <Card className="rounded-lg border-border/70 bg-card/90">
                <CardContent className="flex flex-col items-center justify-center px-6 py-16 text-center">
                  <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                    <BookOpen className="h-7 w-7" aria-hidden="true" />
                  </div>
                  <h2 className="text-lg font-semibold">{t("member_portal.bible.no_books")}</h2>
                  <p className="mt-2 max-w-md text-sm text-muted-foreground">{t("member_portal.bible.no_books_description")}</p>
                </CardContent>
              </Card>
            ) : null}

            {!isLoading && !isError && booksByTestament.length > 0 ? (
              <div className="space-y-8">
                {booksByTestament.map((section) => (
                  <section key={section.testament} className="space-y-3">
                    <div className="flex items-end justify-between gap-3">
                      <h2 className="text-xl font-bold tracking-tight text-foreground">{t(`member_portal.bible.testaments.${section.testament}`)}</h2>
                      <p className="text-sm text-muted-foreground">{t("member_portal.bible.books_count", { count: section.books.length })}</p>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                      {section.books.map((book) => (
                        <BookCard key={book.id} book={book} />
                      ))}
                    </div>
                  </section>
                ))}
              </div>
            ) : null}
          </>
        )}
      </div>
    </main>
  );
}

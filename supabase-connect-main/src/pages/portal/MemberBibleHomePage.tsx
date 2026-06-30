import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertCircle, ArrowRight, BookOpen, Search } from "lucide-react";
import { Link } from "react-router-dom";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";

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

const TESTAMENT_LABELS: Record<BibleBookRow["testament"], string> = {
  old: "Old Testament",
  new: "New Testament",
  deuterocanonical: "Deuterocanonical",
};

const TESTAMENT_ORDER: BibleBookRow["testament"][] = ["old", "new", "deuterocanonical"];

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
  return (
    <Link to={`/portal/bible/${book.id}`} className="group block">
      <Card className="h-full rounded-lg border-border/70 bg-card/90 shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-md">
        <CardContent className="flex h-full items-center gap-4 p-4">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-primary/20 bg-primary/10 text-primary">
            <BookOpen className="h-5 w-5" aria-hidden="true" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-base font-semibold text-foreground">{book.name}</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {book.abbreviation ? `${book.abbreviation} • ` : ""}
              {book.book_number}
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
  const bookName = getBookName(verse);

  return (
    <Link to={`/portal/bible/${verse.book_id}/chapter/${verse.chapter_number}`} className="group block">
      <Card className="rounded-lg border-border/70 bg-card/90 shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-md">
        <CardContent className="space-y-3 p-4 sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-primary">{bookName}</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Chapter {verse.chapter_number}, Verse {verse.verse_number}
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

export default function MemberBibleHomePage() {
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search, 300);
  const normalizedSearch = normalizeSearchTerm(debouncedSearch);
  const isSearching = normalizedSearch.length > 0;

  const { data: books = [], isLoading, isError, error } = useQuery({
    queryKey: ["member-bible-books"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bible_books" as never)
        .select("id, book_number, name, abbreviation, testament")
        .order("testament", { ascending: false })
        .order("book_number", { ascending: true });

      if (error) throw error;
      return (data ?? []) as unknown as BibleBookRow[];
    },
    staleTime: 10 * 60 * 1000,
  });

  const {
    data: searchResults = [],
    isLoading: isSearchLoading,
    isError: isSearchError,
    error: searchError,
  } = useQuery({
    queryKey: ["member-bible-search", normalizedSearch],
    queryFn: async () => {
      const pattern = `%${normalizedSearch}%`;
      const { data, error } = await supabase
        .from("bible_verses" as never)
        .select("id, book_id, chapter_number, verse_number, verse_text, text, reference, bible_books(id, name)")
        .or(`verse_text.ilike.${pattern},text.ilike.${pattern},reference.ilike.${pattern}`)
        .order("chapter_number", { ascending: true })
        .order("verse_number", { ascending: true })
        .limit(50);

      if (error) throw error;
      return (data ?? []) as unknown as BibleVerseSearchRow[];
    },
    enabled: isSearching,
    staleTime: 60 * 1000,
  });

  const booksByTestament = useMemo(() => {
    return TESTAMENT_ORDER.map((testament) => ({
      testament,
      books: books.filter((book) => book.testament === testament),
    })).filter((section) => section.books.length > 0);
  }, [books]);

  return (
    <main className="min-h-full bg-[linear-gradient(180deg,hsl(var(--background)),hsl(var(--muted)/0.35))] px-4 py-6 pb-28 lg:px-8 lg:pb-10">
      <div className="mx-auto max-w-7xl space-y-6">
        <section className="rounded-lg border border-primary/15 bg-card/90 p-5 shadow-sm sm:p-7">
          <div className="max-w-3xl">
            <p className="flex items-center gap-2 text-sm font-medium text-primary">
              <BookOpen className="h-4 w-4" aria-hidden="true" />
              Bible
            </p>
            <h1 className="mt-3 text-3xl font-bold tracking-tight text-foreground sm:text-4xl">Biblia Takatifu</h1>
          </div>
          <div className="mt-5 max-w-2xl">
            <label htmlFor="bible-search" className="sr-only">
              Search Bible
            </label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
              <Input
                id="bible-search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search words, phrases, or references"
                className="h-12 rounded-lg border-border/70 bg-background/70 pl-12 text-base"
              />
            </div>
          </div>
        </section>

        {isSearching ? (
          <section className="space-y-4">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 className="text-xl font-bold tracking-tight text-foreground">Search Results</h2>
                <p className="mt-1 text-sm text-muted-foreground">Showing up to 50 matching verses.</p>
              </div>
              {!isSearchLoading && !isSearchError ? <p className="text-sm text-muted-foreground">{searchResults.length} found</p> : null}
            </div>

            {isSearchLoading ? <SearchResultsSkeleton /> : null}

            {isSearchError ? (
              <Alert variant="destructive" className="rounded-lg">
                <AlertCircle className="h-4 w-4" aria-hidden="true" />
                <AlertTitle>Unable to search Bible</AlertTitle>
                <AlertDescription>{searchError instanceof Error ? searchError.message : "Please try again."}</AlertDescription>
              </Alert>
            ) : null}

            {!isSearchLoading && !isSearchError && searchResults.length === 0 ? (
              <Card className="rounded-lg border-border/70 bg-card/90">
                <CardContent className="flex flex-col items-center justify-center px-6 py-16 text-center">
                  <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                    <Search className="h-7 w-7" aria-hidden="true" />
                  </div>
                  <h2 className="text-lg font-semibold">No verses found</h2>
                  <p className="mt-2 max-w-md text-sm text-muted-foreground">Try another word, phrase, or reference.</p>
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
                <AlertTitle>Unable to load books</AlertTitle>
                <AlertDescription>{error instanceof Error ? error.message : "Please try again."}</AlertDescription>
              </Alert>
            ) : null}

            {!isLoading && !isError && books.length === 0 ? (
              <Card className="rounded-lg border-border/70 bg-card/90">
                <CardContent className="flex flex-col items-center justify-center px-6 py-16 text-center">
                  <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                    <BookOpen className="h-7 w-7" aria-hidden="true" />
                  </div>
                  <h2 className="text-lg font-semibold">No books found</h2>
                  <p className="mt-2 max-w-md text-sm text-muted-foreground">Bible books are not available yet.</p>
                </CardContent>
              </Card>
            ) : null}

            {!isLoading && !isError && booksByTestament.length > 0 ? (
              <div className="space-y-8">
                {booksByTestament.map((section) => (
                  <section key={section.testament} className="space-y-3">
                    <div className="flex items-end justify-between gap-3">
                      <h2 className="text-xl font-bold tracking-tight text-foreground">{TESTAMENT_LABELS[section.testament]}</h2>
                      <p className="text-sm text-muted-foreground">{section.books.length} books</p>
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

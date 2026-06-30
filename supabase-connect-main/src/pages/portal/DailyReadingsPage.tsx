import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, BookOpen, CalendarDays, Search, Sparkles } from "lucide-react";
import { Link } from "react-router-dom";

import { ReadingCard } from "@/components/portal/daily-readings/ReadingCard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import {
  getReadableReadingDate,
  getTodayReadingEntry,
  readingEntryMatchesSearch,
  type DailyReadingKind,
  type DailyReadingEntry,
  type DailyReadingPassageRecord,
  type DailyReadingRecord,
  type DailyReadingSection,
} from "@/lib/daily-readings";
import { SAINT_SELECT, getSaintImageAlt, type LibrarySaint } from "@/lib/catholic-library";

const READING_SECTION_META: Record<DailyReadingKind, Pick<DailyReadingSection, "id" | "title" | "reference">> = {
  first: {
    id: "first",
    title: "First Reading",
    reference: "Daily reading reference pending",
  },
  psalm: {
    id: "psalm",
    title: "Responsorial Psalm",
    reference: "Psalm reference pending",
  },
  second: {
    id: "second",
    title: "Second Reading",
    reference: "Optional reading reference pending",
  },
  gospel: {
    id: "gospel",
    title: "Gospel",
    reference: "Gospel reference pending",
  },
};

function getTodayParts() {
  const today = new Date();
  return {
    month: today.getMonth() + 1,
    day: today.getDate(),
  };
}

function getLegacyReadingText(record: DailyReadingRecord, kind: DailyReadingKind) {
  if (kind === "first") return record.first_reading;
  if (kind === "psalm") return record.psalm;
  if (kind === "second") return record.second_reading;
  return record.gospel;
}

function getPassageBibleReference(passage: DailyReadingPassageRecord | undefined) {
  if (
    !passage?.book_id ||
    !passage.chapter_start ||
    !passage.verse_start ||
    !passage.chapter_end ||
    !passage.verse_end
  ) {
    return null;
  }

  return {
    book_id: passage.book_id,
    chapter_start: passage.chapter_start,
    verse_start: passage.verse_start,
    chapter_end: passage.chapter_end,
    verse_end: passage.verse_end,
  };
}

function mapDailyReadingRecordToEntry(
  record: DailyReadingRecord,
  passages: DailyReadingPassageRecord[],
  fallback: DailyReadingEntry,
): DailyReadingEntry {
  const passagesByKind = new Map(passages.map((passage) => [passage.reading_kind, passage]));
  const readings = fallback.readings.map((fallbackReading) => {
    const passage = passagesByKind.get(fallbackReading.id);
    const sectionMeta = READING_SECTION_META[fallbackReading.id];

    return {
      id: fallbackReading.id,
      title: passage?.title ?? sectionMeta.title,
      reference: passage?.reference ?? fallbackReading.reference,
      text: passage?.text ?? getLegacyReadingText(record, fallbackReading.id) ?? fallbackReading.text,
      bibleReference: getPassageBibleReference(passage),
    };
  });

  return {
    id: record.id,
    date: record.reading_date,
    liturgicalSeason: record.liturgical_season,
    reflection: record.reflection ?? fallback.reflection,
    prayer: record.prayer ?? fallback.prayer,
    readings,
  };
}

async function fetchPublishedDailyReading(date: string, fallback: DailyReadingEntry) {
  const { data, error } = await supabase
    .from("daily_readings" as never)
    .select(
      "id, reading_date, liturgical_season, first_reading, psalm, second_reading, gospel, reflection, prayer, is_published",
    )
    .eq("reading_date", date)
    .eq("is_published", true)
    .maybeSingle();

  if (error || !data) return null;

  const record = data as unknown as DailyReadingRecord;
  const passagesResult = await supabase
    .from("daily_reading_passages" as never)
    .select(
      "id, daily_reading_id, reading_kind, title, reference, text, book_id, chapter_start, verse_start, chapter_end, verse_end, sort_order",
    )
    .eq("daily_reading_id", record.id)
    .order("sort_order", { ascending: true });

  const passages = passagesResult.error ? [] : ((passagesResult.data ?? []) as unknown as DailyReadingPassageRecord[]);
  return mapDailyReadingRecordToEntry(record, passages, fallback);
}

function TodaySaintCard({ saints, isLoading }: { saints: LibrarySaint[]; isLoading: boolean }) {
  if (isLoading) return <Skeleton className="h-48 rounded-[28px]" />;

  const saint = saints[0];

  if (!saint) {
    return (
      <Card className="rounded-[28px] border-border/70 bg-card/85">
        <CardContent className="flex items-start gap-4 p-5">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <Sparkles className="h-6 w-6" aria-hidden="true" />
          </div>
          <div>
            <p className="font-semibold">Today's Saint</p>
            <p className="mt-1 text-sm text-muted-foreground">No saint is linked to today's feast yet.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden rounded-[28px] border-primary/20 bg-card/85">
      <CardContent className="p-0">
        <div className="grid sm:grid-cols-[148px_1fr]">
          {saint.image_url ? (
            <img
              src={saint.image_url}
              alt={getSaintImageAlt(saint)}
              loading="lazy"
              className="h-48 w-full object-cover sm:h-full"
            />
          ) : (
            <div className="flex h-48 w-full items-center justify-center bg-primary/10 text-primary sm:h-full">
              <Sparkles className="h-12 w-12" aria-hidden="true" />
            </div>
          )}
          <div className="space-y-3 p-5">
            <p className="text-sm font-medium text-primary">Today's Saint</p>
            <div>
              <h2 className="text-2xl font-bold">{saint.name}</h2>
              {saint.title ? <p className="mt-1 text-sm text-muted-foreground">{saint.title}</p> : null}
            </div>
            <p className="line-clamp-3 text-sm leading-6 text-muted-foreground">{saint.biography_short}</p>
            <Button asChild variant="outline" className="rounded-2xl">
              <Link to={`/portal/library/${saint.slug}`}>
                Read Saint
                <ArrowRight className="ml-2 h-4 w-4" aria-hidden="true" />
              </Link>
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function ReadingSearchResults({ entries }: { entries: DailyReadingEntry[] }) {
  if (entries.length === 0) {
    return (
      <Card className="rounded-[28px] border-border/70 bg-card/85">
        <CardContent className="flex flex-col items-center justify-center px-6 py-12 text-center">
          <Search className="h-12 w-12 text-muted-foreground" aria-hidden="true" />
          <p className="mt-4 text-lg font-semibold">No readings match your search.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {entries.map((entry) => (
        <Card key={entry.date} className="rounded-[24px] border-border/70 bg-card/85">
          <CardContent className="p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-semibold">{getReadableReadingDate(entry)}</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {entry.readings.map((reading) => reading.reference).join(" | ")}
                </p>
              </div>
              <Badge variant="outline" className="w-fit rounded-full">
                {entry.liturgicalSeason || "Season pending"}
              </Badge>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export default function DailyReadingsPage() {
  const [search, setSearch] = useState("");
  const today = useMemo(() => getTodayParts(), []);
  const fallbackTodayReading = useMemo(() => getTodayReadingEntry(), []);
  const { data: publishedTodayReading } = useQuery({
    queryKey: ["daily-readings-published-today", fallbackTodayReading.date],
    queryFn: () => fetchPublishedDailyReading(fallbackTodayReading.date, fallbackTodayReading),
    staleTime: 10 * 60 * 1000,
    retry: false,
  });
  const todayReading = publishedTodayReading ?? fallbackTodayReading;
  const readingHistory = useMemo(() => [todayReading], [todayReading]);

  const { data: todaySaints = [], isLoading: saintLoading } = useQuery({
    queryKey: ["daily-readings-today-saints", today.month, today.day],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("saints" as never)
        .select(SAINT_SELECT)
        .eq("is_active", true)
        .eq("feast_month", today.month)
        .eq("feast_day", today.day)
        .order("is_featured", { ascending: false })
        .order("name", { ascending: true });

      if (error) throw error;
      return (data ?? []) as unknown as LibrarySaint[];
    },
    staleTime: 10 * 60 * 1000,
  });

  const filteredReadings = useMemo(
    () => readingHistory.filter((entry) => readingEntryMatchesSearch(entry, search)),
    [readingHistory, search],
  );

  const requiredReadings = todayReading.readings.filter((reading) => reading.id !== "second");
  const secondReading = todayReading.readings.find((reading) => reading.id === "second");

  return (
    <main className="min-h-full bg-[linear-gradient(180deg,hsl(var(--background)),hsl(var(--muted)/0.35))] px-4 py-6 pb-28 lg:px-8 lg:pb-10">
      <div className="mx-auto max-w-7xl space-y-6">
        <section className="rounded-[32px] border border-primary/15 bg-[linear-gradient(135deg,hsl(var(--primary)/0.14),hsl(var(--card))_55%,hsl(var(--card)))] p-5 shadow-sm sm:p-8">
          <div className="max-w-3xl">
            <p className="flex items-center gap-2 text-sm font-medium text-primary">
              <BookOpen className="h-4 w-4" aria-hidden="true" />
              Daily Readings
            </p>
            <h1 className="mt-3 text-4xl font-bold tracking-tight text-foreground sm:text-5xl">Today's Readings</h1>
            <p className="mt-3 text-base text-muted-foreground">The Word of God for today.</p>
          </div>
        </section>

        <div className="grid gap-5 lg:grid-cols-[1fr_360px]">
          <section className="space-y-5" aria-labelledby="readings-title">
            <Card className="rounded-[28px] border-border/70 bg-card/85">
              <CardContent className="p-5">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                      <CalendarDays className="h-4 w-4" aria-hidden="true" />
                      {getReadableReadingDate(todayReading)}
                    </p>
                    <h2 id="readings-title" className="mt-1 text-2xl font-bold">
                      {todayReading.liturgicalSeason || "Liturgical season pending"}
                    </h2>
                  </div>
                  <Badge className="w-fit rounded-full">Today</Badge>
                </div>
              </CardContent>
            </Card>

            <div className="grid gap-4 xl:grid-cols-2">
              {requiredReadings.map((reading, index) => (
                <ReadingCard
                  key={reading.id}
                  reading={reading}
                  reflection={reading.id === "gospel" ? todayReading.reflection : undefined}
                  defaultOpen={index === 0}
                />
              ))}
              {secondReading ? <ReadingCard reading={secondReading} reflection={todayReading.reflection} /> : null}
            </div>

            <Card className="rounded-[28px] border-primary/20 bg-primary/5">
              <CardContent className="space-y-3 p-5">
                <h2 className="text-xl font-bold">Reflection</h2>
                <p className="text-sm leading-7 text-muted-foreground">{todayReading.reflection}</p>
              </CardContent>
            </Card>

            <Card className="rounded-[28px] border-border/70 bg-card/85">
              <CardContent className="space-y-3 p-5">
                <h2 className="text-xl font-bold">Prayer</h2>
                <p className="text-sm leading-7 text-muted-foreground">{todayReading.prayer}</p>
              </CardContent>
            </Card>
          </section>

          <aside className="space-y-5">
            <TodaySaintCard saints={todaySaints} isLoading={saintLoading} />

            <Card className="rounded-[28px] border-border/70 bg-card/85">
              <CardContent className="space-y-4 p-5">
                <div>
                  <h2 className="text-xl font-bold">Search Readings</h2>
                  <p className="mt-1 text-sm text-muted-foreground">Search by date, scripture reference, book, or keywords.</p>
                </div>
                <label htmlFor="daily-reading-search" className="sr-only">
                  Search previous readings
                </label>
                <div className="relative">
                  <Search
                    className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground"
                    aria-hidden="true"
                  />
                  <Input
                    id="daily-reading-search"
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Date, book, reference, keyword..."
                    className="h-12 rounded-2xl border-border/70 bg-background/70 pl-12"
                  />
                </div>
                <ReadingSearchResults entries={filteredReadings} />
              </CardContent>
            </Card>
          </aside>
        </div>
      </div>
    </main>
  );
}

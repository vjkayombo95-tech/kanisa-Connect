import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, BookOpen, Search, Sparkles } from "lucide-react";
import { Link } from "react-router-dom";

import {
  DailyReadingEmptyState,
  DailyReadingErrorState,
  DailyReadingLiturgicalHeader,
  DailyReadingLoadingState,
  DailyReadingReferenceList,
  DailyReadingSourceAttribution,
} from "@/components/portal/daily-readings/DailyReadingPresentation";
import { ReadingCard } from "@/components/portal/daily-readings/ReadingCard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import {
  getReadableReadingDate,
  fetchPublishedDailyReading,
  isDailyReadingSectionActionable,
  publishedDailyReadingKey,
  readingEntryMatchesSearch,
  useTanzaniaMemberDate,
  type DailyReadingEntry,
} from "@/lib/daily-readings";
import { SAINT_SELECT, getSaintImageAlt, type LibrarySaint } from "@/lib/catholic-library";

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
            <p className="font-semibold">Mtakatifu wa Leo</p>
            <p className="mt-1 text-sm text-muted-foreground">Hakuna mtakatifu aliyeunganishwa na sikukuu ya leo bado.</p>
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
            <p className="text-sm font-medium text-primary">Mtakatifu wa Leo</p>
            <div>
              <h2 className="text-2xl font-bold">{saint.name}</h2>
              {saint.title ? <p className="mt-1 text-sm text-muted-foreground">{saint.title}</p> : null}
            </div>
            <p className="line-clamp-3 text-sm leading-6 text-muted-foreground">{saint.biography_short}</p>
            <Button asChild variant="outline" className="rounded-2xl">
              <Link to={`/portal/library/${saint.slug}`}>
                Soma Mtakatifu
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
          <p className="mt-4 text-lg font-semibold">Hakuna masomo yanayolingana na utafutaji wako.</p>
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
                  {entry.readings.map((reading) => reading.reference).filter(Boolean).join(" | ")}
                </p>
              </div>
              {entry.liturgicalSeason ? (
                <Badge variant="outline" className="w-fit rounded-full">
                  {entry.liturgicalSeason}
                </Badge>
              ) : null}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export default function DailyReadingsPage() {
  const [search, setSearch] = useState("");
  const today = useTanzaniaMemberDate();
  const { data: publishedTodayReading, isLoading: readingLoading, isError: readingError, refetch: refetchReading } = useQuery({
    queryKey: publishedDailyReadingKey(today.dateKey),
    queryFn: () => fetchPublishedDailyReading(today.dateKey),
    staleTime: 10 * 60 * 1000,
    retry: false,
  });
  const readingHistory = useMemo(() => publishedTodayReading ? [publishedTodayReading] : [], [publishedTodayReading]);

  const { data: todaySaints = [], isLoading: saintLoading } = useQuery({
    queryKey: ["daily-readings-today-saints", today.dateKey, today.month, today.day],
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

  if (readingLoading) return <main className="px-4 py-6"><DailyReadingLoadingState /></main>;
  if (readingError) return <main className="px-4 py-10"><DailyReadingErrorState onRetry={() => void refetchReading()} /></main>;
  if (!publishedTodayReading) return <main className="px-4 py-10"><DailyReadingEmptyState /></main>;

  const todayReading = publishedTodayReading;
  const actionableReadings = todayReading.readings.filter(isDailyReadingSectionActionable);
  const referenceReadings = todayReading.readings.filter((reading) => !isDailyReadingSectionActionable(reading));

  return (
    <main className="min-h-full bg-[linear-gradient(180deg,hsl(var(--background)),hsl(var(--muted)/0.35))] px-4 py-6 pb-28 lg:px-8 lg:pb-10">
      <div className="mx-auto max-w-7xl space-y-6">
        <section className="rounded-[32px] border border-primary/15 bg-[linear-gradient(135deg,hsl(var(--primary)/0.14),hsl(var(--card))_55%,hsl(var(--card)))] p-5 shadow-sm sm:p-8">
          <div className="max-w-3xl">
            <p className="flex items-center gap-2 text-sm font-medium text-primary">
              <BookOpen className="h-4 w-4" aria-hidden="true" />
              Masomo ya Leo
            </p>
            <h1 className="mt-3 text-4xl font-bold tracking-tight text-foreground sm:text-5xl">Masomo ya Leo</h1>
            <p className="mt-3 text-base text-muted-foreground">Neno la Mungu kwa siku ya leo.</p>
          </div>
        </section>

        <div className="grid gap-5 lg:grid-cols-[1fr_360px]">
          <section className="space-y-5" aria-labelledby="readings-title">
            <DailyReadingLiturgicalHeader reading={todayReading} titleId="readings-title" />

            <div className="grid gap-4 xl:grid-cols-2">
              {referenceReadings.length ? (
                <div className="xl:col-span-2">
                  <DailyReadingReferenceList readings={referenceReadings} />
                </div>
              ) : null}
              {actionableReadings.map((reading, index) => (
                <ReadingCard
                  key={reading.id}
                  reading={reading}
                  reflection={reading.id === "gospel" ? todayReading.reflection ?? undefined : undefined}
                  defaultOpen={index === 0}
                />
              ))}
            </div>

            {todayReading.reflection ? (
              <Card className="rounded-[28px] border-primary/20 bg-primary/5">
                <CardContent className="space-y-3 p-5">
                  <h2 className="text-xl font-bold">Tafakari</h2>
                  <p className="text-sm leading-7 text-muted-foreground">{todayReading.reflection}</p>
                </CardContent>
              </Card>
            ) : null}

            {todayReading.prayer ? (
              <Card className="rounded-[28px] border-border/70 bg-card/85">
                <CardContent className="space-y-3 p-5">
                  <h2 className="text-xl font-bold">Sala</h2>
                  <p className="text-sm leading-7 text-muted-foreground">{todayReading.prayer}</p>
                </CardContent>
              </Card>
            ) : null}

            <DailyReadingSourceAttribution reading={todayReading} />
          </section>

          <aside className="space-y-5">
            <TodaySaintCard saints={todaySaints} isLoading={saintLoading} />

            <Card className="rounded-[28px] border-border/70 bg-card/85">
              <CardContent className="space-y-4 p-5">
                <div>
                  <h2 className="text-xl font-bold">Tafuta Masomo</h2>
                  <p className="mt-1 text-sm text-muted-foreground">Tafuta kwa tarehe, rejea ya Biblia, kitabu, au neno.</p>
                </div>
                <label htmlFor="daily-reading-search" className="sr-only">
                  Tafuta masomo yaliyotangulia
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
                    placeholder="Tarehe, kitabu, rejea, neno..."
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

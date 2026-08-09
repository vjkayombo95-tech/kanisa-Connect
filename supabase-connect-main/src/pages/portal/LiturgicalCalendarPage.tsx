import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, CalendarDays, ChevronLeft, ChevronRight, Search, Sparkles } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import {
  SAINT_SELECT,
  formatFeastDay,
  getSaintImageAlt,
  normalizeTags,
  saintMatchesSearch,
  type LibrarySaint,
} from "@/lib/catholic-library";
import { formatLocalizedDate, localeForLanguage, normalizeAppLanguage, type AppLanguage } from "@/lib/localization";
import { dailyCatholicQueryOptions } from "@/lib/portal-performance";

const MONTH_NUMBERS = Array.from({ length: 12 }, (_, index) => index + 1);

function getCurrentMonth() {
  return new Date().getMonth() + 1;
}

function getTodayParts() {
  const today = new Date();
  return {
    month: today.getMonth() + 1,
    day: today.getDate(),
  };
}

function saintDetailPath(slug: string) {
  return `/portal/library/${slug}`;
}

function saintMatchesCalendarSearch(saint: LibrarySaint, search: string, monthLabel: string) {
  const term = search.trim().toLowerCase();
  if (!term) return true;

  const tags = normalizeTags(saint.tags).join(" ");
  const monthMatches = monthLabel.toLowerCase().includes(term);

  return (
    monthMatches ||
    saintMatchesSearch(saint, search) ||
    [saint.patron_of, saint.country, tags].filter(Boolean).some((value) => String(value).toLowerCase().includes(term))
  );
}

function getMonthLabel(month: number, language: AppLanguage) {
  return new Intl.DateTimeFormat(localeForLanguage(language), { month: "long" }).format(new Date(2026, month - 1, 1));
}

function getWeekdayLabels(language: AppLanguage) {
  const formatter = new Intl.DateTimeFormat(localeForLanguage(language), { weekday: "short" });
  return Array.from({ length: 7 }, (_, index) => formatter.format(new Date(2026, 1, index + 1)));
}

function SaintImage({ saint, className = "h-16 w-16" }: { saint: LibrarySaint; className?: string }) {
  if (saint.image_url) {
    return (
      <img
        src={saint.image_url}
        alt={getSaintImageAlt(saint)}
        loading="lazy"
        decoding="async"
        sizes="80px"
        className={`${className} rounded-2xl object-cover`}
      />
    );
  }

  return (
    <div className={`${className} flex items-center justify-center rounded-2xl bg-primary/10 text-primary`}>
      <Sparkles className="h-6 w-6" aria-hidden="true" />
    </div>
  );
}

function TodayFeast({ saints, isLoading }: { saints: LibrarySaint[]; isLoading: boolean }) {
  const { t } = useTranslation();

  if (isLoading) {
    return <Skeleton className="h-44 rounded-[28px]" />;
  }

  const primarySaint = saints[0];

  return (
    <section aria-labelledby="today-feast-title">
      <Card className="overflow-hidden rounded-[28px] border-primary/20 bg-[linear-gradient(135deg,hsl(var(--primary)/0.12),hsl(var(--card))_60%)]">
        <CardContent className="p-5 sm:p-6">
          <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
            <div className="space-y-2">
              <p className="flex items-center gap-2 text-sm font-medium text-primary">
                <CalendarDays className="h-4 w-4" aria-hidden="true" />
                {t("member_portal.catholic_content.todays_feast")}
              </p>
              <h2 id="today-feast-title" className="text-2xl font-bold tracking-tight">
                {primarySaint ? primarySaint.name : t("member_portal.catholic_content.no_feast_today")}
              </h2>
              {primarySaint?.quote ? (
                <p className="max-w-2xl text-sm italic leading-6 text-muted-foreground">"{primarySaint.quote}"</p>
              ) : primarySaint ? (
                <p className="max-w-2xl text-sm leading-6 text-muted-foreground">{primarySaint.biography_short}</p>
              ) : (
                <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
                  {t("member_portal.catholic_content.explore_month_feasts")}
                </p>
              )}
            </div>

            {primarySaint ? (
              <div className="flex items-center gap-4">
                <SaintImage saint={primarySaint} className="h-20 w-20" />
                <Button asChild className="rounded-2xl">
                  <Link to={saintDetailPath(primarySaint.slug)}>
                    {t("member_portal.catholic_content.view_saint")}
                    <ArrowRight className="ml-2 h-4 w-4" aria-hidden="true" />
                  </Link>
                </Button>
              </div>
            ) : null}
          </div>

          {saints.length > 1 ? (
            <div className="mt-4 flex flex-wrap gap-2" aria-label={t("member_portal.catholic_content.other_feasts_today")}>
              {saints.slice(1).map((saint) => (
                <Button key={saint.id} asChild variant="outline" size="sm" className="rounded-full">
                  <Link to={saintDetailPath(saint.slug)}>{saint.name}</Link>
                </Button>
              ))}
            </div>
          ) : null}
        </CardContent>
      </Card>
    </section>
  );
}

function MonthSelector({
  selectedMonth,
  onMonthChange,
  language,
}: {
  selectedMonth: number;
  onMonthChange: (month: number) => void;
  language: AppLanguage;
}) {
  const { t } = useTranslation();
  const goToPrevious = () => onMonthChange(selectedMonth === 1 ? 12 : selectedMonth - 1);
  const goToNext = () => onMonthChange(selectedMonth === 12 ? 1 : selectedMonth + 1);

  return (
    <section aria-label={t("member_portal.catholic_content.select_month")} className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <Button type="button" variant="outline" size="icon" className="rounded-2xl" onClick={goToPrevious} aria-label={t("member_portal.catholic_content.previous_month")}>
          <ChevronLeft className="h-4 w-4" aria-hidden="true" />
        </Button>
        <p className="text-lg font-semibold">{getMonthLabel(selectedMonth, language)}</p>
        <Button type="button" variant="outline" size="icon" className="rounded-2xl" onClick={goToNext} aria-label={t("member_portal.catholic_content.next_month")}>
          <ChevronRight className="h-4 w-4" aria-hidden="true" />
        </Button>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1">
        {MONTH_NUMBERS.map((monthNumber) => {
          return (
            <Button
              key={monthNumber}
              type="button"
              variant={selectedMonth === monthNumber ? "default" : "outline"}
              className="h-10 shrink-0 rounded-full"
              onClick={() => onMonthChange(monthNumber)}
            >
              {getMonthLabel(monthNumber, language)}
            </Button>
          );
        })}
      </div>
    </section>
  );
}

function FeastAgenda({ saints, isLoading, language }: { saints: LibrarySaint[]; isLoading: boolean; language: AppLanguage }) {
  const { t } = useTranslation();

  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, index) => (
          <Skeleton key={index} className="h-28 rounded-[24px]" />
        ))}
      </div>
    );
  }

  if (saints.length === 0) {
    return (
      <Card className="rounded-[28px] border-border/70 bg-card/85">
        <CardContent className="flex flex-col items-center justify-center px-6 py-14 text-center">
          <CalendarDays className="h-12 w-12 text-muted-foreground" aria-hidden="true" />
          <p className="mt-4 text-lg font-semibold">{t("member_portal.catholic_content.no_saints_match")}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <section aria-label={t("member_portal.catholic_content.feast_day_list")} className="space-y-3">
      {saints.map((saint) => (
        <Card key={saint.id} className="rounded-[24px] border-border/70 bg-card/85 transition-colors hover:border-primary/25">
          <CardContent className="p-4">
            <div className="grid gap-4 sm:grid-cols-[84px_1fr_auto] sm:items-center">
              <div className="text-sm font-semibold text-primary">
                {formatFeastDay(saint.feast_month, saint.feast_day, language) ?? t("member_portal.catholic_content.feast_day_not_set")}
              </div>
              <div className="flex min-w-0 gap-4">
                <SaintImage saint={saint} className="h-16 w-16 shrink-0" />
                <div className="min-w-0">
                  <h2 className="truncate text-lg font-bold">{saint.name}</h2>
                  {saint.title ? <p className="text-sm text-muted-foreground">{saint.title}</p> : null}
                  <p className="mt-2 line-clamp-2 text-sm leading-6 text-muted-foreground">{saint.biography_short}</p>
                </div>
              </div>
              <Button asChild variant="outline" className="rounded-2xl">
                <Link to={saintDetailPath(saint.slug)}>
                  {t("member_portal.catholic_content.view_saint")}
                  <ArrowRight className="ml-2 h-4 w-4" aria-hidden="true" />
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}
    </section>
  );
}

function MonthlyCalendar({ saints, selectedMonth, language }: { saints: LibrarySaint[]; selectedMonth: number; language: AppLanguage }) {
  const { t } = useTranslation();
  const year = new Date().getFullYear();
  const daysInMonth = new Date(year, selectedMonth, 0).getDate();
  const firstWeekday = new Date(year, selectedMonth - 1, 1).getDay();
  const saintsByDay = saints.reduce<Record<number, LibrarySaint[]>>((groups, saint) => {
    const day = saint.feast_day;
    groups[day] = [...(groups[day] ?? []), saint];
    return groups;
  }, {});

  const cells = [
    ...Array.from({ length: firstWeekday }, (_, index) => ({ key: `empty-${index}`, day: null })),
    ...Array.from({ length: daysInMonth }, (_, index) => ({ key: `day-${index + 1}`, day: index + 1 })),
  ];

  return (
    <section aria-label={t("member_portal.catholic_content.month_calendar", { month: getMonthLabel(selectedMonth, language) })}>
      <Card className="rounded-[28px] border-border/70 bg-card/85">
        <CardContent className="p-4 sm:p-5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-bold">{t("member_portal.catholic_content.month_calendar", { month: getMonthLabel(selectedMonth, language) })}</h2>
              <p className="text-sm text-muted-foreground">{t("member_portal.catholic_content.linked_saint_days")}</p>
            </div>
            <Badge variant="outline" className="rounded-full">
              {t("member_portal.catholic_content.feasts_count", { count: saints.length })}
            </Badge>
          </div>

          <div className="grid grid-cols-7 gap-1 text-center text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {getWeekdayLabels(language).map((day) => (
              <div key={day} className="py-2">
                {day}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1">
            {cells.map((cell) => {
              const daySaints = cell.day ? saintsByDay[cell.day] ?? [] : [];
              return (
                <div
                  key={cell.key}
                  className="min-h-24 rounded-2xl border border-border/50 bg-background/45 p-2 text-left sm:min-h-32"
                >
                  {cell.day ? (
                    <>
                      <div className="text-sm font-semibold">{cell.day}</div>
                      <div className="mt-2 space-y-1">
                        {daySaints.slice(0, 3).map((saint) => (
                          <Link
                            key={saint.id}
                            to={saintDetailPath(saint.slug)}
                            className="block truncate rounded-lg px-1.5 py-1 text-[11px] text-primary transition-colors hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                            aria-label={t("member_portal.catholic_content.open_saint", { name: saint.name })}
                          >
                            &bull; {saint.name}
                          </Link>
                        ))}
                        {daySaints.length > 3 ? (
                          <span className="block px-1.5 text-[11px] text-muted-foreground">{t("member_portal.catholic_content.more_count", { count: daySaints.length - 3 })}</span>
                        ) : null}
                      </div>
                    </>
                  ) : null}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </section>
  );
}

export default function LiturgicalCalendarPage() {
  const { t, i18n } = useTranslation();
  const appLanguage = (normalizeAppLanguage(i18n.language) ?? "en") as AppLanguage;
  const [selectedMonth, setSelectedMonth] = useState(getCurrentMonth);
  const [search, setSearch] = useState("");
  const today = useMemo(() => getTodayParts(), []);
  const selectedMonthLabel = getMonthLabel(selectedMonth, appLanguage);

  const {
    data: monthSaints = [],
    isLoading,
    isError,
    error,
  } = useQuery({
    queryKey: ["member-liturgical-calendar-saints", selectedMonth],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("saints" as never)
        .select(SAINT_SELECT)
        .eq("is_active", true)
        .eq("feast_month", selectedMonth)
        .order("feast_day", { ascending: true })
        .order("name", { ascending: true });

      if (error) throw error;
      return (data ?? []) as unknown as LibrarySaint[];
    },
    ...dailyCatholicQueryOptions,
  });

  const { data: todaySaints = [], isLoading: todayLoading } = useQuery({
    queryKey: ["member-liturgical-calendar-today", today.month, today.day],
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
    ...dailyCatholicQueryOptions,
  });

  const filteredSaints = useMemo(() => {
    return monthSaints.filter((saint) => saintMatchesCalendarSearch(saint, search, selectedMonthLabel));
  }, [monthSaints, search, selectedMonthLabel]);

  return (
    <main className="min-h-full bg-[linear-gradient(180deg,hsl(var(--background)),hsl(var(--muted)/0.35))] px-4 py-6 pb-28 lg:px-8 lg:pb-10">
      <div className="mx-auto max-w-7xl space-y-6">
        <section className="rounded-[32px] border border-primary/15 bg-[linear-gradient(135deg,hsl(var(--primary)/0.14),hsl(var(--card))_55%,hsl(var(--card)))] p-5 shadow-sm sm:p-8">
          <div className="max-w-3xl">
            <p className="flex items-center gap-2 text-sm font-medium text-primary">
              <CalendarDays className="h-4 w-4" aria-hidden="true" />
              {t("member_portal.catholic_content.library_title")}
            </p>
            <h1 className="mt-3 text-4xl font-bold tracking-tight text-foreground sm:text-5xl">{t("member_portal.catholic_content.liturgical_calendar")}</h1>
            <p className="mt-3 text-base text-muted-foreground">
              {t("member_portal.catholic_content.liturgical_calendar_description")}
            </p>
            <p className="mt-2 text-sm text-muted-foreground">
              {t("member_portal.catholic_content.today")}: {formatLocalizedDate(new Date(), appLanguage, { dateStyle: "full" })}
            </p>
          </div>
        </section>

        <TodayFeast saints={todaySaints} isLoading={todayLoading} />

        <div className="grid gap-5 lg:grid-cols-[320px_1fr]">
          <aside className="space-y-5">
            <Card className="rounded-[28px] border-border/70 bg-card/85">
              <CardContent className="space-y-5 p-5">
                <MonthSelector selectedMonth={selectedMonth} onMonthChange={setSelectedMonth} language={appLanguage} />

                <div>
                  <label htmlFor="feast-search" className="sr-only">
                    {t("member_portal.catholic_content.search_feast_days")}
                  </label>
                  <div className="relative">
                    <Search
                      className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground"
                      aria-hidden="true"
                    />
                    <Input
                      id="feast-search"
                      value={search}
                      onChange={(event) => setSearch(event.target.value)}
                      placeholder={t("member_portal.catholic_content.search_feast_placeholder")}
                      className="h-12 rounded-2xl border-border/70 bg-background/70 pl-12"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between gap-3 text-sm text-muted-foreground" aria-live="polite">
                  <span>
                    {t("member_portal.catholic_content.results_count", { count: filteredSaints.length })}
                  </span>
                  {search ? (
                    <Button type="button" variant="ghost" size="sm" className="rounded-xl" onClick={() => setSearch("")}>
                      {t("member_portal.catholic_content.clear_filters")}
                    </Button>
                  ) : null}
                </div>
              </CardContent>
            </Card>
          </aside>

          <div className="space-y-5">
            {isError ? (
              <Card className="rounded-[28px] border-destructive/25 bg-destructive/5">
                <CardContent className="p-6 text-sm text-destructive">
                  {t("member_portal.catholic_content.unable_liturgical_calendar", { message: (error as Error)?.message || t("member_portal.common.please_try_again") })}
                </CardContent>
              </Card>
            ) : (
              <>
                <div className="grid gap-5 xl:grid-cols-[1fr_420px]">
                  <MonthlyCalendar saints={filteredSaints} selectedMonth={selectedMonth} language={appLanguage} />
                  <div className="xl:hidden">
                    <FeastAgenda saints={filteredSaints} isLoading={isLoading} language={appLanguage} />
                  </div>
                  <div className="hidden xl:block">
                    <FeastAgenda saints={filteredSaints} isLoading={isLoading} language={appLanguage} />
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}

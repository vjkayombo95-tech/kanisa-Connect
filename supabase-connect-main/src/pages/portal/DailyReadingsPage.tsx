import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertCircle, BookOpen, CalendarDays, ChevronLeft, ChevronRight, Palette } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";

import { PageToolbar, getWorkspacePageActions, useWorkspacePage } from "@/components/workspace";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ScriptureLink } from "@/components/bible";
import { bibleReferenceToPath, parseBibleReference } from "@/lib/bible-reference-parser";
import {
  fetchTodayLiturgicalReadings,
  getTodayDateKey,
  getTodayLiturgicalReadingsQueryKey,
  type BibleBookRow,
  type DailyReadingRow,
} from "@/lib/liturgy";
import { dailyCatholicQueryOptions } from "@/lib/portal-performance";
import { fetchMemberCmsDailyReadingByDate, type CmsDailyReading } from "@/lib/super-admin/daily-readings-service";
import { formatLocalizedDate, type AppLanguage } from "@/lib/localization";

type ReadingItem = {
  key: string;
  titleKey: string;
  reference: string | null;
  detail?: string | null;
  detailLabelKey?: string;
};

type ResolvedReference = {
  bookId: string;
  chapter: number;
  startVerse: number;
  endVerse?: number;
};

const ENGLISH_BOOK_ALIASES: Record<string, string[]> = {
  Mwanzo: ["Genesis", "Gen", "Gn"],
  Kutoka: ["Exodus", "Exod", "Ex"],
  Walawi: ["Leviticus", "Lev", "Lv"],
  Hesabu: ["Numbers", "Num", "Nm"],
  "Kumbukumbu la Torati": ["Deuteronomy", "Deut", "Dt"],
  Yoshua: ["Joshua", "Josh", "Jos"],
  Waamuzi: ["Judges", "Judg", "Jgs"],
  Ruthu: ["Ruth", "Ru"],
  "1 Samweli": ["1 Samuel", "1 Sam", "1 Sm"],
  "2 Samweli": ["2 Samuel", "2 Sam", "2 Sm"],
  "1 Wafalme": ["1 Kings", "1 Kgs", "1 Ki"],
  "2 Wafalme": ["2 Kings", "2 Kgs", "2 Ki"],
  "1 Nyakati": ["1 Chronicles", "1 Chr"],
  "2 Nyakati": ["2 Chronicles", "2 Chr"],
  Ezra: ["Ezra"],
  Nehemia: ["Nehemiah", "Neh"],
  Esta: ["Esther", "Est"],
  Ayubu: ["Job", "Jb"],
  Zaburi: ["Psalm", "Psalms", "Ps"],
  Mithali: ["Proverbs", "Prov", "Prv"],
  Mhubiri: ["Ecclesiastes", "Eccl", "Qoh"],
  "Wimbo Ulio Bora": ["Song of Songs", "Song", "Songs", "Song of Solomon"],
  Isaya: ["Isaiah", "Isa"],
  Yeremia: ["Jeremiah", "Jer"],
  Maombolezo: ["Lamentations", "Lam"],
  Ezekieli: ["Ezekiel", "Ezek", "Ez"],
  Danieli: ["Daniel", "Dan", "Dn"],
  Hosea: ["Hosea", "Hos"],
  Yoeli: ["Joel", "Jl"],
  Amosi: ["Amos", "Am"],
  Obadia: ["Obadiah", "Obad"],
  Yona: ["Jonah", "Jon"],
  Mika: ["Micah", "Mic"],
  Nahumu: ["Nahum", "Nah"],
  Habakuki: ["Habakkuk", "Hab"],
  Sefania: ["Zephaniah", "Zeph", "Zep"],
  Hagai: ["Haggai", "Hag"],
  Zekaria: ["Zechariah", "Zech", "Zec"],
  Malaki: ["Malachi", "Mal"],
  Mathayo: ["Matthew", "Matt", "Mt"],
  Marko: ["Mark", "Mk"],
  Luka: ["Luke", "Lk"],
  Yohana: ["John", "Jn"],
  Matendo: ["Acts", "Acts of the Apostles"],
  Warumi: ["Romans", "Rom"],
  "1 Wakorintho": ["1 Corinthians", "1 Cor"],
  "2 Wakorintho": ["2 Corinthians", "2 Cor"],
  Wagalatia: ["Galatians", "Gal"],
  Waefeso: ["Ephesians", "Eph"],
  Wafilipi: ["Philippians", "Phil"],
  Wakolosai: ["Colossians", "Col"],
  "1 Wathesalonike": ["1 Thessalonians", "1 Thess", "1 Thes"],
  "2 Wathesalonike": ["2 Thessalonians", "2 Thess", "2 Thes"],
  "1 Timotheo": ["1 Timothy", "1 Tim", "1 Tm"],
  "2 Timotheo": ["2 Timothy", "2 Tim", "2 Tm"],
  Tito: ["Titus", "Tit"],
  Filemoni: ["Philemon", "Phlm", "Phmn"],
  Waebrania: ["Hebrews", "Heb"],
  Yakobo: ["James", "Jas"],
  "1 Petro": ["1 Peter", "1 Pet", "1 Pt"],
  "2 Petro": ["2 Peter", "2 Pet", "2 Pt"],
  "1 Yohana": ["1 John", "1 Jn"],
  "2 Yohana": ["2 John", "2 Jn"],
  "3 Yohana": ["3 John", "3 Jn"],
  Yuda: ["Jude"],
  Ufunuo: ["Revelation", "Rev", "Rv", "Apocalypse"],
};

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function getBookAliases(book: BibleBookRow) {
  return [book.name, book.abbreviation, ...(ENGLISH_BOOK_ALIASES[book.name] ?? [])].filter(Boolean) as string[];
}

function resolveReadingReference(reference: string | null, books: BibleBookRow[]): ResolvedReference | null {
  if (!reference) return null;

  const normalizedReference = reference.replace(/\s+/g, " ").trim();
  const matchedBook = [...books]
    .sort((left, right) => Math.max(...getBookAliases(right).map((alias) => alias.length)) - Math.max(...getBookAliases(left).map((alias) => alias.length)))
    .find((book) =>
      getBookAliases(book).some((alias) => new RegExp(`^${escapeRegExp(alias)}\\s+`, "i").test(normalizedReference)),
    );

  if (!matchedBook) return null;

  const aliasPattern = getBookAliases(matchedBook).map(escapeRegExp).join("|");
  const withoutBook = normalizedReference.replace(new RegExp(`^(?:${aliasPattern})\\s+`, "i"), "");
  const match = withoutBook.match(/^(\d+):(\d+)(?:\s*[-–—]\s*(?:(\d+):)?(\d+))?/);
  if (!match) return null;

  const chapter = Number(match[1]);
  const startVerse = Number(match[2]);
  const endChapter = match[3] ? Number(match[3]) : chapter;
  const endVerse = match[4] ? Number(match[4]) : startVerse;
  if (![chapter, startVerse, endChapter, endVerse].every((value) => Number.isInteger(value) && value > 0)) {
    return null;
  }

  return {
    bookId: matchedBook.id,
    chapter,
    startVerse,
    endVerse: endChapter === chapter && endVerse !== startVerse ? endVerse : undefined,
  };
}

function getLongestAliasLength(book: BibleBookRow) {
  return Math.max(...getBookAliases(book).map((alias) => alias.length));
}

function parseChapterVerseReference(value: string) {
  const match = value.match(/^(\d+):(.+)$/);
  if (!match) return null;

  const chapter = Number(match[1]);
  const verseRanges = match[2]
    .split(",")
    .map((segment) => segment.trim())
    .filter(Boolean);

  if (!Number.isInteger(chapter) || chapter <= 0 || !verseRanges.length) return null;

  const parsedRanges = verseRanges
    .map((segment) => {
      const rangeMatch = segment.match(/^(\d+)(?:\s*[-\u2013\u2014]\s*(?:(\d+):)?(\d+))?$/);
      if (!rangeMatch) return null;

      const start = Number(rangeMatch[1]);
      const endChapter = rangeMatch[2] ? Number(rangeMatch[2]) : chapter;
      const end = rangeMatch[3] ? Number(rangeMatch[3]) : start;
      if (![start, endChapter, end].every((number) => Number.isInteger(number) && number > 0)) return null;

      return { start, endChapter, end };
    })
    .filter((range): range is { start: number; endChapter: number; end: number } => Boolean(range));

  if (!parsedRanges.length) return null;

  const sameChapterRanges = parsedRanges.filter((range) => range.endChapter === chapter);
  const rangesToHighlight = sameChapterRanges.length ? sameChapterRanges : parsedRanges;

  return {
    chapter,
    startVerse: rangesToHighlight[0].start,
    endVerse: Math.max(...rangesToHighlight.map((range) => range.end)),
  };
}

function resolveBibleReaderReference(reference: string | null, books: BibleBookRow[]): ResolvedReference | null {
  if (!reference) return null;

  const normalizedReference = reference.replace(/\s+/g, " ").trim();
  const matchedBook = [...books]
    .sort((left, right) => getLongestAliasLength(right) - getLongestAliasLength(left))
    .find((book) =>
      getBookAliases(book).some((alias) => new RegExp(`^${escapeRegExp(alias)}\\s+`, "i").test(normalizedReference)),
    );

  if (!matchedBook) return null;

  const aliasPattern = getBookAliases(matchedBook).map(escapeRegExp).join("|");
  const withoutBook = normalizedReference.replace(new RegExp(`^(?:${aliasPattern})\\s+`, "i"), "");
  const parsedReference = parseChapterVerseReference(withoutBook);
  if (!parsedReference) return null;

  return {
    bookId: matchedBook.id,
    chapter: parsedReference.chapter,
    startVerse: parsedReference.startVerse,
    endVerse: parsedReference.endVerse !== parsedReference.startVerse ? parsedReference.endVerse : undefined,
  };
}

function getWorkspaceBibleRoot(workspaceId: string) {
  if (workspaceId === "pastoral") return "/pastoral/bible";
  if (workspaceId === "church_admin") return "/church-admin/bible";
  if (workspaceId === "finance") return "/finance/bible";
  return "/portal/bible";
}

function getReadings(row: DailyReadingRow): ReadingItem[] {
  return [
    {
      key: "first",
      titleKey: "member_portal.daily_readings.first_reading",
      reference: row.first_reading_reference,
    },
    {
      key: "psalm",
      titleKey: "member_portal.daily_readings.responsorial_psalm",
      reference: row.responsorial_psalm_reference,
      detail: row.psalm_response,
      detailLabelKey: row.psalm_response ? "member_portal.daily_readings.response" : undefined,
    },
    {
      key: "second",
      titleKey: "member_portal.daily_readings.second_reading",
      reference: row.second_reading_reference,
    },
    {
      key: "gospel",
      titleKey: "member_portal.daily_readings.gospel",
      reference: row.gospel_reference,
      detail: row.gospel_acclamation,
      detailLabelKey: row.gospel_acclamation ? "member_portal.daily_readings.acclamation" : undefined,
    },
  ].filter((reading) => Boolean(reading.reference));
}

function getCmsReadings(row: CmsDailyReading): ReadingItem[] {
  return [
    {
      key: "first",
      titleKey: "member_portal.daily_readings.first_reading",
      reference: row.first_reading_reference,
    },
    {
      key: "psalm",
      titleKey: "member_portal.daily_readings.responsorial_psalm",
      reference: row.responsorial_psalm_reference,
    },
    {
      key: "second",
      titleKey: "member_portal.daily_readings.second_reading",
      reference: row.second_reading_reference,
    },
    {
      key: "acclamation",
      titleKey: "member_portal.daily_readings.gospel_acclamation",
      reference: row.gospel_acclamation_reference,
    },
    {
      key: "gospel",
      titleKey: "member_portal.daily_readings.gospel",
      reference: row.gospel_reference,
    },
  ].filter((reading) => Boolean(reading.reference));
}

function ReadingSkeleton() {
  return (
    <div className="space-y-5">
      <Skeleton className="h-40 rounded-lg" />
      <div className="grid gap-4 md:grid-cols-2">
        {Array.from({ length: 4 }).map((_, index) => (
          <Skeleton key={index} className="h-36 rounded-2xl" />
        ))}
      </div>
    </div>
  );
}

function ReadingReferenceCard({ reading, books }: { reading: ReadingItem; books: BibleBookRow[] }) {
  const { t } = useTranslation();
  const page = useWorkspacePage();
  const resolvedReference = reading.reference ? parseBibleReference(reading.reference, books) : null;
  const bibleRoot = getWorkspaceBibleRoot(page.workspaceId);
  const readPath = resolvedReference ? bibleReferenceToPath(resolvedReference).replace(/^\/portal\/bible/, bibleRoot) : bibleRoot;

  return (
    <Card className="h-full rounded-2xl border-border/70 bg-card/95 shadow-sm">
      <CardContent className="flex h-full flex-col gap-4 p-5">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <BookOpen className="h-5 w-5" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <h2 className="text-lg font-semibold text-foreground">{t(reading.titleKey)}</h2>
            <p className="mt-1 text-base font-medium">
              <ScriptureLink reference={reading.reference ?? ""} books={books} />
            </p>
          </div>
        </div>
        {reading.detail ? (
          <p className="text-sm leading-6 text-muted-foreground">
            {reading.detailLabelKey ? <span className="font-medium text-foreground">{t(reading.detailLabelKey)}: </span> : null}
            {reading.detail}
          </p>
        ) : null}
        <div className="mt-auto">
          <Button asChild variant="outline" className="h-10 w-full rounded-xl sm:w-fit">
            <Link to={readPath}>{t("member_portal.daily_readings.read_passage")}</Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export default function DailyReadingsPage() {
  const { t, i18n } = useTranslation();
  const page = useWorkspacePage();
  const language: AppLanguage = i18n.language === "sw" ? "sw" : "en";
  const todayDate = useMemo(() => getTodayDateKey(), []);
  const [selectedDate, setSelectedDate] = useState(todayDate);

  const {
    data,
    isLoading,
    isError,
    error,
  } = useQuery({
    queryKey: getTodayLiturgicalReadingsQueryKey(selectedDate),
    queryFn: () => fetchTodayLiturgicalReadings(selectedDate),
    ...dailyCatholicQueryOptions,
  });

  const cmsReadingQuery = useQuery({
    queryKey: ["member-cms-daily-reading", selectedDate, language],
    queryFn: () => fetchMemberCmsDailyReadingByDate(selectedDate, language),
    ...dailyCatholicQueryOptions,
  });

  const cmsReading = cmsReadingQuery.data ?? null;
  const dailyReading = data?.day?.daily_readings?.[0] ?? null;
  const readingItems = cmsReading ? getCmsReadings(cmsReading) : dailyReading ? getReadings(dailyReading) : [];
  const toolbarActions = useMemo(() => getWorkspacePageActions("daily_readings", page), [page]);
  const isPageLoading = isLoading || cmsReadingQuery.isLoading;
  const pageError = error || cmsReadingQuery.error;
  const hasError = isError || cmsReadingQuery.isError;
  const selectedDateLabel = formatLocalizedDate(`${selectedDate}T00:00:00`, language, {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const cmsLanguageCode = cmsReading?.language?.code;
  const cmsLanguageLabel = cmsLanguageCode === "sw"
    ? t("member_portal.content_language.swahili_content")
    : cmsLanguageCode === "en"
      ? t("member_portal.content_language.english_fallback")
      : null;

  const shiftDate = (days: number) => {
    const date = new Date(`${selectedDate}T00:00:00Z`);
    date.setUTCDate(date.getUTCDate() + days);
    setSelectedDate(date.toISOString().slice(0, 10));
  };

  return (
    <main className="min-h-full bg-[linear-gradient(180deg,hsl(var(--background)),hsl(var(--muted)/0.35))] px-4 py-6 pb-28 lg:px-8 lg:pb-10">
      <div className="mx-auto max-w-6xl space-y-6">
        <PageToolbar
          title={t("member_portal.daily_readings.title")}
          description={t("member_portal.daily_readings.description")}
          actions={toolbarActions}
        />
        <section className="rounded-2xl border border-primary/15 bg-card/95 p-5 shadow-sm sm:p-7">
          <p className="flex items-center gap-2 text-sm font-medium text-primary">
            <BookOpen className="h-4 w-4" aria-hidden="true" />
            {t("member_portal.daily_readings.section_label")}
          </p>
          <div className="mt-3 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">{t("member_portal.daily_readings.title")}</h1>
              <p className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
                <CalendarDays className="h-4 w-4" aria-hidden="true" />
                {selectedDateLabel}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button type="button" variant="outline" size="sm" onClick={() => shiftDate(-1)} aria-label={t("member_portal.common.previous_day")}>
                <ChevronLeft className="h-4 w-4" aria-hidden="true" />
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={() => setSelectedDate(todayDate)}>{t("member_portal.common.today")}</Button>
              <Button type="button" variant="outline" size="sm" onClick={() => shiftDate(1)} aria-label={t("member_portal.common.next_day")}>
                <ChevronRight className="h-4 w-4" aria-hidden="true" />
              </Button>
              <Badge variant="outline" className="w-fit rounded-full">
                {cmsReading ? t("member_portal.daily_readings.cms_source") : t("member_portal.daily_readings.legacy_source")}
              </Badge>
              {cmsLanguageLabel ? <Badge variant="secondary" className="w-fit rounded-full">{cmsLanguageLabel}</Badge> : null}
            </div>
          </div>
        </section>

        {isPageLoading ? <ReadingSkeleton /> : null}

        {hasError ? (
          <Alert variant="destructive" className="rounded-2xl">
            <AlertCircle className="h-4 w-4" aria-hidden="true" />
            <AlertTitle>{t("member_portal.daily_readings.unable_title")}</AlertTitle>
            <AlertDescription>{pageError instanceof Error ? pageError.message : t("member_portal.common.please_try_again")}</AlertDescription>
          </Alert>
        ) : null}

        {!isPageLoading && !hasError && !cmsReading && (!data?.day || !dailyReading) ? (
          <Card className="rounded-2xl border-border/70 bg-card/95 shadow-sm">
            <CardContent className="flex flex-col items-center justify-center px-6 py-16 text-center">
              <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                <BookOpen className="h-7 w-7" aria-hidden="true" />
              </div>
              <h2 className="text-lg font-semibold">{t("member_portal.daily_readings.empty_title")}</h2>
              <p className="mt-2 max-w-md text-sm text-muted-foreground">
                {t("member_portal.daily_readings.empty_description")}
              </p>
            </CardContent>
          </Card>
        ) : null}

        {!isPageLoading && !hasError && cmsReading ? (
          <>
            <Card className="rounded-2xl border-border/70 bg-card/95 shadow-sm">
              <CardContent className="p-5 sm:p-6">
                <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <p className="text-sm font-medium text-primary">{t("member_portal.daily_readings.celebration")}</p>
                    <h2 className="mt-1 text-2xl font-bold text-foreground">{cmsReading.celebration || t("member_portal.daily_readings.daily_readings")}</h2>
                    {cmsReading.source_attribution ? <p className="mt-2 text-sm text-muted-foreground">{cmsReading.source_attribution}</p> : null}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {cmsReading.liturgical_season ? <Badge variant="secondary" className="rounded-full">{cmsReading.liturgical_season}</Badge> : null}
                    {cmsReading.liturgical_color ? (
                      <Badge variant="outline" className="rounded-full">
                        <Palette className="mr-1 h-3.5 w-3.5" aria-hidden="true" />
                        {cmsReading.liturgical_color}
                      </Badge>
                    ) : null}
                  </div>
                </div>
              </CardContent>
            </Card>

            <section className="grid gap-4 md:grid-cols-2" aria-label={t("member_portal.daily_readings.references_label")}>
              {readingItems.map((reading) => (
                <ReadingReferenceCard key={reading.key} reading={reading} books={data?.books ?? []} />
              ))}
            </section>

            {cmsReading.reflection || cmsReading.prayer || cmsReading.meditation_questions || cmsReading.daily_challenge ? (
              <section className="grid gap-4 lg:grid-cols-2">
                {cmsReading.reflection ? (
                  <Card className="rounded-2xl border-border/70 bg-card/95 shadow-sm">
                    <CardContent className="p-5">
                      <h2 className="text-lg font-semibold">{t("member_portal.daily_readings.reflection")}</h2>
                      <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-muted-foreground">{cmsReading.reflection}</p>
                    </CardContent>
                  </Card>
                ) : null}
                {cmsReading.prayer ? (
                  <Card className="rounded-2xl border-border/70 bg-card/95 shadow-sm">
                    <CardContent className="p-5">
                      <h2 className="text-lg font-semibold">{t("member_portal.daily_readings.prayer")}</h2>
                      <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-muted-foreground">{cmsReading.prayer}</p>
                    </CardContent>
                  </Card>
                ) : null}
                {cmsReading.meditation_questions ? (
                  <Card className="rounded-2xl border-border/70 bg-card/95 shadow-sm">
                    <CardContent className="p-5">
                      <h2 className="text-lg font-semibold">{t("member_portal.daily_readings.meditation_questions")}</h2>
                      <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-muted-foreground">{cmsReading.meditation_questions}</p>
                    </CardContent>
                  </Card>
                ) : null}
                {cmsReading.daily_challenge ? (
                  <Card className="rounded-2xl border-border/70 bg-card/95 shadow-sm">
                    <CardContent className="p-5">
                      <h2 className="text-lg font-semibold">{t("member_portal.daily_readings.daily_challenge")}</h2>
                      <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-muted-foreground">{cmsReading.daily_challenge}</p>
                    </CardContent>
                  </Card>
                ) : null}
              </section>
            ) : null}
          </>
        ) : null}

        {!isPageLoading && !hasError && !cmsReading && data?.day && dailyReading ? (
          <>
            <Card className="rounded-2xl border-border/70 bg-card/95 shadow-sm">
              <CardContent className="p-5 sm:p-6">
                <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <p className="text-sm font-medium text-primary">{t("member_portal.daily_readings.celebration")}</p>
                    <h2 className="mt-1 text-2xl font-bold text-foreground">{data.day.celebration}</h2>
                    <p className="mt-2 text-sm text-muted-foreground">{data.day.rank.replace(/_/g, " ")}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="secondary" className="rounded-full">
                      {data.day.season}
                    </Badge>
                    <Badge variant="outline" className="rounded-full">
                      <Palette className="mr-1 h-3.5 w-3.5" aria-hidden="true" />
                      {data.day.liturgical_color}
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>

            <section className="grid gap-4 md:grid-cols-2" aria-label={t("member_portal.daily_readings.todays_references_label")}>
              {readingItems.map((reading) => (
                <ReadingReferenceCard key={reading.key} reading={reading} books={data.books} />
              ))}
            </section>
          </>
        ) : null}
      </div>
    </main>
  );
}

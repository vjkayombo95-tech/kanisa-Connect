import { AlertCircle, BookOpen, CalendarDays, RotateCw, Sparkles } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { formatAppDate } from "@/lib/localization";
import { cn } from "@/lib/utils";
import { type DailyReadingEntry, type DailyReadingKind, type DailyReadingSection } from "@/lib/daily-readings";

const READING_LABEL_KEYS: Record<DailyReadingKind, string> = {
  first: "member_daily_readings.reading_labels.first",
  psalm: "member_daily_readings.reading_labels.psalm",
  second: "member_daily_readings.reading_labels.second",
  gospel_acclamation: "member_daily_readings.reading_labels.gospel_acclamation",
  gospel: "member_daily_readings.reading_labels.gospel",
};

function cleanText(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed || null;
}

function joinParts(parts: Array<string | number | null | undefined>) {
  return parts.map((part) => cleanText(part == null ? null : String(part))).filter(Boolean).join(" - ");
}

export function DailyReadingLiturgicalHeader({
  reading,
  className,
  titleId = "daily-reading-liturgical-title",
}: {
  reading: DailyReadingEntry;
  className?: string;
  titleId?: string;
}) {
  const { t, i18n } = useTranslation();
  const dateLabel = formatAppDate(reading.date, i18n.language, { dateStyle: "full" });
  const title = cleanText(reading.celebration) ?? t("member_daily_readings.hero.title");
  const details = [
    cleanText(reading.liturgicalSeason),
    cleanText(reading.liturgicalColor),
    cleanText(reading.rank),
  ].filter(Boolean);

  return (
    <header
      aria-labelledby={titleId}
      className={cn(
        "rounded-[28px] border border-primary/15 bg-[linear-gradient(135deg,hsl(var(--primary)/0.13),hsl(var(--card))_58%,hsl(var(--card)))] p-5 shadow-sm sm:p-6",
        className,
      )}
      data-testid="daily-reading-liturgical-header"
    >
      <p className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
        <CalendarDays className="h-4 w-4" aria-hidden="true" />
        <span>{dateLabel}</span>
      </p>
      <h2 id={titleId} className="mt-2 break-words text-2xl font-bold tracking-tight text-foreground">
        {title}
      </h2>
      {details.length ? (
        <dl className="mt-4 flex flex-wrap gap-2 text-xs font-semibold text-muted-foreground">
          {details.map((detail) => (
            <div key={detail} className="rounded-full border border-primary/15 bg-primary/8 px-3 py-1 text-primary/90">
              <dt className="sr-only">{t("member_daily_readings.sections.liturgical_detail")}</dt>
              <dd>{detail}</dd>
            </div>
          ))}
        </dl>
      ) : null}
    </header>
  );
}

export function DailyReadingReferenceList({
  readings,
  className,
  headingId = "daily-reading-reference-list-title",
}: {
  readings: DailyReadingSection[];
  className?: string;
  headingId?: string;
}) {
  const { t } = useTranslation();
  const visibleReadings = readings
    .map((reading) => ({ ...reading, reference: cleanText(reading.reference) }))
    .filter((reading) => reading.reference);

  if (!visibleReadings.length) return null;

  return (
    <section aria-labelledby={headingId} className={cn("space-y-3", className)} data-testid="daily-reading-reference-list">
      <h2 id={headingId} className="text-lg font-bold tracking-tight text-foreground">
        {t("member_daily_readings.sections.readings")}
      </h2>
      <ol className="space-y-3">
        {visibleReadings.map((reading) => (
          <li
            key={reading.id}
            className="rounded-[20px] border border-border/60 bg-card/70 px-4 py-3"
            data-reading-kind={reading.id}
          >
            <p className="flex items-center gap-2 text-sm font-semibold text-primary">
              <BookOpen className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span>{t(READING_LABEL_KEYS[reading.id])}</span>
            </p>
            <p className="mt-1 break-words text-base leading-7 text-foreground">{reading.reference}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}

export function DailyReadingEmptyState({ className }: { className?: string }) {
  const { t } = useTranslation();

  return (
    <section
      aria-labelledby="daily-reading-empty-title"
      className={cn("mx-auto max-w-2xl rounded-[28px] border border-primary/15 bg-card/75 px-6 py-10 text-center shadow-sm", className)}
      data-testid="daily-reading-empty-state"
    >
      <Sparkles className="mx-auto h-9 w-9 text-primary" aria-hidden="true" />
      <h1 id="daily-reading-empty-title" className="mt-4 text-2xl font-bold tracking-tight">
        {t("member_daily_readings.states.empty_title")}
      </h1>
      <p className="mt-3 text-sm leading-6 text-muted-foreground">
        {t("member_daily_readings.states.empty_description")}
      </p>
    </section>
  );
}

export function DailyReadingErrorState({
  onRetry,
  className,
}: {
  onRetry?: () => void;
  className?: string;
}) {
  const { t } = useTranslation();

  return (
    <section
      aria-labelledby="daily-reading-error-title"
      className={cn("mx-auto max-w-2xl rounded-[28px] border border-destructive/20 bg-card/80 px-6 py-10 text-center shadow-sm", className)}
      data-testid="daily-reading-error-state"
    >
      <AlertCircle className="mx-auto h-9 w-9 text-destructive" aria-hidden="true" />
      <h1 id="daily-reading-error-title" className="mt-4 text-2xl font-bold tracking-tight">
        {t("member_daily_readings.states.error_title")}
      </h1>
      <p className="mt-3 text-sm leading-6 text-muted-foreground">{t("member_daily_readings.states.error_description")}</p>
      {onRetry ? (
        <Button type="button" onClick={onRetry} variant="outline" className="mt-5 rounded-2xl" aria-label={t("member_daily_readings.states.retry_aria")}>
          <RotateCw className="mr-2 h-4 w-4" aria-hidden="true" />
          {t("member_daily_readings.states.retry")}
        </Button>
      ) : null}
    </section>
  );
}

export function DailyReadingLoadingState({ className }: { className?: string }) {
  const { t } = useTranslation();

  return (
    <section
      aria-busy="true"
      aria-live="polite"
      aria-label={t("member_daily_readings.states.loading_label")}
      className={cn("mx-auto w-full max-w-3xl space-y-4", className)}
      data-testid="daily-reading-loading-state"
    >
      <div className="rounded-[28px] border border-primary/10 bg-card/70 p-5">
        <Skeleton className="h-4 w-44 rounded-full" />
        <Skeleton className="mt-3 h-8 w-3/4 rounded-full" />
        <div className="mt-4 flex flex-wrap gap-2">
          <Skeleton className="h-7 w-24 rounded-full" />
          <Skeleton className="h-7 w-28 rounded-full" />
        </div>
      </div>
      <div className="space-y-3">
        {[0, 1, 2, 3].map((item) => (
          <div key={item} className="rounded-[20px] border border-border/60 bg-card/60 px-4 py-3">
            <Skeleton className="h-4 w-32 rounded-full" />
            <Skeleton className="mt-3 h-5 w-full max-w-xl rounded-full" />
          </div>
        ))}
      </div>
    </section>
  );
}

export function DailyReadingSourceAttribution({
  reading,
  className,
}: {
  reading: DailyReadingEntry;
  className?: string;
}) {
  const { t } = useTranslation();
  const attribution = cleanText(reading.sourceAttribution);
  if (!attribution) return null;

  const supporting = joinParts([
    reading.sourceOrganization,
    reading.sourcePublication,
    reading.sourceYear,
    reading.sourceEdition,
  ]);

  return (
    <aside className={cn("text-xs leading-5 text-muted-foreground", className)} data-testid="daily-reading-source-attribution">
      <p>
        <span className="font-semibold text-foreground">{t("member_daily_readings.sections.source")}</span> {attribution}
      </p>
      {supporting ? <p className="mt-1">{supporting}</p> : null}
    </aside>
  );
}

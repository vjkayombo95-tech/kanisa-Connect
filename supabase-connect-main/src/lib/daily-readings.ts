import { useEffect, useState } from "react";
import type { DailyReadingBibleReference } from "./daily-reading-references";
import { supabase } from "@/integrations/supabase/client";

export { formatReference, resolveReference, toReferenceValues } from "./daily-reading-references";
export type {
  DailyReadingBibleReference,
  DailyReadingReferenceBook,
  DailyReadingReferenceValues,
} from "./daily-reading-references";

export type DailyReadingKind = "first" | "psalm" | "second" | "gospel_acclamation" | "gospel";

export type DailyReadingSection = {
  id: DailyReadingKind;
  title: string;
  reference: string | null;
  text: string | null;
  bibleReference?: DailyReadingBibleReference | null;
};

export type DailyReadingSource = "cms" | "legacy";

export type DailyReadingEntry = {
  id?: string;
  date: string;
  source: DailyReadingSource;
  languageCode: string | null;
  status: string | null;
  liturgicalDayId: string | null;
  celebration: string | null;
  liturgicalSeason: string | null;
  liturgicalYear: string | null;
  weekdayCycle: string | null;
  liturgicalColor: string | null;
  rank: string | null;
  lectionaryNumber: string | null;
  reflection: string | null;
  prayer: string | null;
  isReferenceOnly: boolean | null;
  sourceAttribution: string | null;
  sourceOrganization: string | null;
  sourcePublication: string | null;
  sourceYear: number | null;
  sourceEdition: string | null;
  readings: DailyReadingSection[];
};

export type TanzaniaMemberDate = {
  dateKey: string;
  year: number;
  month: number;
  day: number;
  nextMidnightAt: Date;
};

export const DAILY_READINGS_MEMBER_CONTENT_CONTRACT = {
  date: "tanzania-date",
  source: "canonical-cms-read-boundary",
  language: "sw-first-deterministic-fallback",
  liturgicalIdentity: "resolved-by-liturgical-days",
  publication: "member-publishable-only",
  readings: "reference-only-is-explicit-no-placeholder-scripture",
  provenance: "source-and-translation-metadata-required",
  legacy: "temporary-explicit-compatibility-only",
  saint: "same-tanzania-date-identity",
  missingContent: "explicit-empty-state-no-invented-scripture-no-wrong-day-fallback",
} as const;

export type DailyReadingPassageRecord = {
  id: string;
  daily_reading_id: string;
  reading_kind: DailyReadingKind;
  title: string | null;
  reference: string | null;
  text: string | null;
  book_id: string | null;
  chapter_start: number | null;
  verse_start: number | null;
  chapter_end: number | null;
  verse_end: number | null;
  sort_order: number;
};

export type DailyReadingRecord = {
  id: string;
  reading_date: string;
  liturgical_season: string | null;
  first_reading: string | null;
  psalm: string | null;
  second_reading: string | null;
  gospel: string | null;
  reflection: string | null;
  prayer: string | null;
  is_published: boolean;
  passages?: DailyReadingPassageRecord[];
};

type CanonicalMemberDailyReadingRecord = {
  id: string;
  reading_date: string;
  source: "cms" | "legacy";
  language_code: string | null;
  status: string;
  liturgical_day_id: string | null;
  celebration: string | null;
  liturgical_season: string | null;
  liturgical_year: string | null;
  weekday_cycle: string | null;
  liturgical_color: string | null;
  rank: string | null;
  lectionary_number: string | null;
  first_reading_reference: string | null;
  responsorial_psalm_reference: string | null;
  second_reading_reference: string | null;
  gospel_acclamation_reference: string | null;
  gospel_reference: string | null;
  reflection: string | null;
  prayer: string | null;
  is_reference_only: boolean;
  source_attribution: string | null;
  source_organization: string | null;
  source_publication: string | null;
  source_year: number | null;
  source_edition: string | null;
};

const READING_SECTION_META: Record<DailyReadingKind, Pick<DailyReadingSection, "id" | "title" | "reference">> = {
  first: { id: "first", title: "First Reading", reference: null },
  psalm: { id: "psalm", title: "Responsorial Psalm", reference: null },
  second: { id: "second", title: "Second Reading", reference: null },
  gospel_acclamation: { id: "gospel_acclamation", title: "Gospel Acclamation", reference: null },
  gospel: { id: "gospel", title: "Gospel", reference: null },
};

const SYNTHETIC_REFERENCE_VALUES = new Set([
  "daily reading reference pending",
  "psalm reference pending",
  "optional reading reference pending",
  "gospel reference pending",
]);

export const publishedDailyReadingKey = (date: string) => ["member-daily-readings", "published", date] as const;

const TANZANIA_TIME_ZONE = "Africa/Dar_es_Salaam";

const TANZANIA_DATE_TIME_FORMAT = new Intl.DateTimeFormat("en-CA", {
  timeZone: TANZANIA_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: false,
  hourCycle: "h23",
});

function getTanzaniaDateTimeParts(date: Date) {
  const parts = TANZANIA_DATE_TIME_FORMAT.formatToParts(date);
  const value = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((part) => part.type === type)?.value);
  return {
    year: value("year"),
    month: value("month"),
    day: value("day"),
    hour: value("hour"),
    minute: value("minute"),
    second: value("second"),
  };
}

function localTanzaniaTimeToUtc(year: number, month: number, day: number, hour = 0, minute = 0, second = 0) {
  const targetAsUtc = Date.UTC(year, month - 1, day, hour, minute, second);
  let guess = targetAsUtc;

  for (let attempt = 0; attempt < 4; attempt += 1) {
    const parts = getTanzaniaDateTimeParts(new Date(guess));
    const actualAsUtc = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
    const delta = targetAsUtc - actualAsUtc;
    if (delta === 0) break;
    guess += delta;
  }

  return new Date(guess);
}

function addCalendarDays(year: number, month: number, day: number, days: number) {
  const next = new Date(Date.UTC(year, month - 1, day + days, 12, 0, 0));
  return {
    year: next.getUTCFullYear(),
    month: next.getUTCMonth() + 1,
    day: next.getUTCDate(),
  };
}

export function getTanzaniaMemberDate(date: Date = new Date()): TanzaniaMemberDate {
  const { year, month, day } = getTanzaniaDateTimeParts(date);
  const nextDay = addCalendarDays(year, month, day, 1);
  const dateKey = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

  return {
    dateKey,
    year,
    month,
    day,
    nextMidnightAt: localTanzaniaTimeToUtc(nextDay.year, nextDay.month, nextDay.day),
  };
}

export function useTanzaniaMemberDate() {
  const [memberDate, setMemberDate] = useState(() => getTanzaniaMemberDate());

  useEffect(() => {
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    let cancelled = false;

    const scheduleNextRollover = () => {
      const current = getTanzaniaMemberDate();
      setMemberDate(current);

      const delay = Math.max(1_000, current.nextMidnightAt.getTime() - Date.now() + 1_000);
      timeoutId = setTimeout(() => {
        if (!cancelled) scheduleNextRollover();
      }, delay);
    };

    scheduleNextRollover();

    return () => {
      cancelled = true;
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, []);

  return memberDate;
}

function getLegacyReadingText(record: DailyReadingRecord, kind: DailyReadingKind) {
  if (kind === "first") return record.first_reading;
  if (kind === "psalm") return record.psalm;
  if (kind === "second") return record.second_reading;
  if (kind === "gospel_acclamation") return null;
  return record.gospel;
}

function getPassageBibleReference(passage: DailyReadingPassageRecord | undefined) {
  if (!passage?.book_id || !passage.chapter_start || !passage.verse_start || !passage.chapter_end || !passage.verse_end) return null;
  return {
    book_id: passage.book_id,
    chapter_start: passage.chapter_start,
    verse_start: passage.verse_start,
    chapter_end: passage.chapter_end,
    verse_end: passage.verse_end,
  };
}

function normalizeOptionalText(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed || null;
}

function normalizeReference(value: string | null | undefined) {
  const reference = normalizeOptionalText(value);
  if (!reference) return null;
  return SYNTHETIC_REFERENCE_VALUES.has(reference.toLowerCase()) ? null : reference;
}

function hasSectionContent(section: DailyReadingSection) {
  return Boolean(section.reference || section.text?.trim() || section.bibleReference);
}

function createReadingSection(
  kind: DailyReadingKind,
  reference: string | null | undefined,
  text: string | null | undefined = null,
  bibleReference: DailyReadingBibleReference | null = null,
) {
  const section: DailyReadingSection = {
    id: kind,
    title: READING_SECTION_META[kind].title,
    reference: normalizeReference(reference),
    text: normalizeOptionalText(text),
    bibleReference,
  };

  return hasSectionContent(section) ? section : null;
}

function getCanonicalEntryMetadata(record: CanonicalMemberDailyReadingRecord) {
  return {
    id: record.id,
    date: record.reading_date,
    source: record.source,
    languageCode: normalizeOptionalText(record.language_code),
    status: normalizeOptionalText(record.status),
    liturgicalDayId: normalizeOptionalText(record.liturgical_day_id),
    celebration: normalizeOptionalText(record.celebration),
    liturgicalSeason: normalizeOptionalText(record.liturgical_season),
    liturgicalYear: normalizeOptionalText(record.liturgical_year),
    weekdayCycle: normalizeOptionalText(record.weekday_cycle),
    liturgicalColor: normalizeOptionalText(record.liturgical_color),
    rank: normalizeOptionalText(record.rank),
    lectionaryNumber: normalizeOptionalText(record.lectionary_number),
    reflection: normalizeOptionalText(record.reflection),
    prayer: normalizeOptionalText(record.prayer),
    isReferenceOnly: record.is_reference_only,
    sourceAttribution: normalizeOptionalText(record.source_attribution),
    sourceOrganization: normalizeOptionalText(record.source_organization),
    sourcePublication: normalizeOptionalText(record.source_publication),
    sourceYear: record.source_year,
    sourceEdition: normalizeOptionalText(record.source_edition),
  } satisfies Omit<DailyReadingEntry, "readings">;
}

function mapCmsDailyReading(record: CanonicalMemberDailyReadingRecord): DailyReadingEntry {
  const readings = [
    createReadingSection("first", record.first_reading_reference),
    createReadingSection("psalm", record.responsorial_psalm_reference),
    createReadingSection("second", record.second_reading_reference),
    createReadingSection("gospel_acclamation", record.gospel_acclamation_reference),
    createReadingSection("gospel", record.gospel_reference),
  ].filter((section): section is DailyReadingSection => Boolean(section));

  return {
    ...getCanonicalEntryMetadata(record),
    readings,
  };
}

export async function fetchPublishedDailyReading(date: string): Promise<DailyReadingEntry | null> {
  const canonicalResult = await supabase.rpc("get_member_daily_reading" as never, { p_reading_date: date } as never);
  if (canonicalResult.error) throw canonicalResult.error;

  const canonicalRows = (canonicalResult.data ?? []) as unknown as CanonicalMemberDailyReadingRecord[];
  const canonicalRecord = canonicalRows[0];
  if (!canonicalRecord) return null;
  if (canonicalRecord.source === "cms") return mapCmsDailyReading(canonicalRecord);

  const { data, error } = await supabase
    .from("daily_readings" as never)
    .select("id, reading_date, liturgical_season, first_reading, psalm, second_reading, gospel, reflection, prayer, is_published")
    .eq("id", canonicalRecord.id)
    .eq("reading_date", canonicalRecord.reading_date)
    .eq("is_published", true)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;

  const record = data as unknown as DailyReadingRecord;
  const passagesResult = await supabase
    .from("daily_reading_passages" as never)
    .select("id, daily_reading_id, reading_kind, title, reference, text, book_id, chapter_start, verse_start, chapter_end, verse_end, sort_order")
    .eq("daily_reading_id", record.id)
    .order("sort_order", { ascending: true });
  const passages = (passagesResult.error ? [] : passagesResult.data ?? []) as unknown as DailyReadingPassageRecord[];
  const passagesByKind = new Map(passages.map((passage) => [passage.reading_kind, passage]));
  const canonicalReferences: Record<DailyReadingKind, string | null> = {
    first: canonicalRecord.first_reading_reference,
    psalm: canonicalRecord.responsorial_psalm_reference,
    second: canonicalRecord.second_reading_reference,
    gospel_acclamation: canonicalRecord.gospel_acclamation_reference,
    gospel: canonicalRecord.gospel_reference,
  };
  const readings = (["first", "psalm", "second", "gospel_acclamation", "gospel"] as DailyReadingKind[]).map((kind) => {
    const passage = passagesByKind.get(kind);
    const section = createReadingSection(
      kind,
      passage?.reference ?? canonicalReferences[kind],
      passage?.text ?? getLegacyReadingText(record, kind),
      getPassageBibleReference(passage),
    );

    return section ? { ...section, title: passage?.title?.trim() || section.title } : null;
  }).filter((section): section is DailyReadingSection => Boolean(section));

  return {
    ...getCanonicalEntryMetadata({
      ...canonicalRecord,
      language_code: null,
      source_attribution: null,
      source_organization: null,
      source_publication: null,
      source_year: null,
      source_edition: null,
      reflection: record.reflection ?? canonicalRecord.reflection,
      prayer: record.prayer ?? canonicalRecord.prayer,
      is_reference_only: canonicalRecord.is_reference_only,
    }),
    readings,
  };
}

export function getDarEsSalaamDateKey(date: Date = new Date()) {
  return getTanzaniaMemberDate(date).dateKey;
}

function formatReadableDate(date: Date) {
  return new Intl.DateTimeFormat("en-TZ", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

export function getReadableReadingDate(entry: Pick<DailyReadingEntry, "date">) {
  return formatReadableDate(new Date(`${entry.date}T12:00:00`));
}

export function readingEntryMatchesSearch(entry: DailyReadingEntry, search: string) {
  const term = search.trim().toLowerCase();
  if (!term) return true;

  return [
    entry.date,
    getReadableReadingDate(entry),
    entry.liturgicalSeason,
    entry.reflection,
    entry.prayer,
    ...entry.readings.flatMap((reading) => [reading.title, reading.reference, reading.text]),
  ]
    .filter(Boolean)
    .some((value) => String(value).toLowerCase().includes(term));
}

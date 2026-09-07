import { useEffect, useState } from "react";
import type { DailyReadingBibleReference } from "./daily-reading-references";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export { formatReference, resolveReference, toReferenceValues } from "./daily-reading-references";
export type {
  DailyReadingBibleReference,
  DailyReadingReferenceBook,
  DailyReadingReferenceValues,
} from "./daily-reading-references";

export type DailyReadingKind = "first" | "psalm" | "second" | "gospel";

export type DailyReadingSection = {
  id: DailyReadingKind;
  title: string;
  reference: string;
  text: string | null;
  bibleReference?: DailyReadingBibleReference | null;
};

export type DailyReadingEntry = {
  id?: string;
  date: string;
  liturgicalSeason: string | null;
  reflection: string;
  prayer: string;
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

type CmsDailyReadingRecord = Pick<
  Database["public"]["Tables"]["content_daily_readings"]["Row"],
  | "id"
  | "reading_date"
  | "liturgical_season"
  | "first_reading_reference"
  | "responsorial_psalm_reference"
  | "second_reading_reference"
  | "gospel_reference"
  | "reflection"
  | "prayer"
>;

export const READING_PLACEHOLDER =
  "Reading text has not been populated yet. This section is ready for the approved daily readings source.";

const READING_SECTION_META: Record<DailyReadingKind, Pick<DailyReadingSection, "id" | "title" | "reference">> = {
  first: { id: "first", title: "First Reading", reference: "Daily reading reference pending" },
  psalm: { id: "psalm", title: "Responsorial Psalm", reference: "Psalm reference pending" },
  second: { id: "second", title: "Second Reading", reference: "Optional reading reference pending" },
  gospel: { id: "gospel", title: "Gospel", reference: "Gospel reference pending" },
};

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

function getCmsReference(value: string | null | undefined, kind: DailyReadingKind) {
  const reference = value?.trim();
  return reference || READING_SECTION_META[kind].reference;
}

function mapCmsDailyReading(record: CmsDailyReadingRecord): DailyReadingEntry {
  const readings: DailyReadingSection[] = [
    {
      id: "first",
      title: READING_SECTION_META.first.title,
      reference: getCmsReference(record.first_reading_reference, "first"),
      text: null,
    },
    {
      id: "psalm",
      title: READING_SECTION_META.psalm.title,
      reference: getCmsReference(record.responsorial_psalm_reference, "psalm"),
      text: null,
    },
  ];

  if (record.second_reading_reference?.trim()) {
    readings.push({
      id: "second",
      title: READING_SECTION_META.second.title,
      reference: record.second_reading_reference.trim(),
      text: null,
    });
  }

  readings.push({
    id: "gospel",
    title: READING_SECTION_META.gospel.title,
    reference: getCmsReference(record.gospel_reference, "gospel"),
    text: null,
  });

  return {
    id: record.id,
    date: record.reading_date,
    liturgicalSeason: record.liturgical_season || null,
    reflection: record.reflection ?? "",
    prayer: record.prayer ?? "",
    readings,
  };
}

export async function fetchPublishedDailyReading(date: string): Promise<DailyReadingEntry | null> {
  const cmsResult = await supabase
    .from("content_daily_readings")
    .select("id, reading_date, liturgical_season, first_reading_reference, responsorial_psalm_reference, second_reading_reference, gospel_reference, reflection, prayer, status, updated_at, created_at")
    .eq("reading_date", date)
    .in("status", ["featured", "published"])
    .order("status", { ascending: true })
    .order("updated_at", { ascending: false })
    .order("created_at", { ascending: false })
    .order("id", { ascending: true })
    .limit(1);
  if (cmsResult.error) throw cmsResult.error;

  const cmsRecord = cmsResult.data?.[0];
  if (cmsRecord) return mapCmsDailyReading(cmsRecord);

  const { data, error } = await supabase
    .from("daily_readings" as never)
    .select("id, reading_date, liturgical_season, first_reading, psalm, second_reading, gospel, reflection, prayer, is_published")
    .eq("reading_date", date)
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
  const readings = (["first", "psalm", "second", "gospel"] as DailyReadingKind[]).map((kind) => {
    const passage = passagesByKind.get(kind);
    const meta = READING_SECTION_META[kind];
    return {
      id: kind,
      title: passage?.title ?? meta.title,
      reference: passage?.reference ?? meta.reference,
      text: passage?.text ?? getLegacyReadingText(record, kind) ?? null,
      bibleReference: getPassageBibleReference(passage),
    };
  });

  return {
    id: record.id,
    date: record.reading_date,
    liturgicalSeason: record.liturgical_season,
    reflection: record.reflection ?? "",
    prayer: record.prayer ?? "",
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

export function getTodayReadingEntry(dateKey = getDarEsSalaamDateKey()): DailyReadingEntry {
  return {
    date: dateKey,
    liturgicalSeason: null,
    reflection:
      "Let the Word of God shape the day before the day shapes you. Read slowly, listen for one phrase that draws your attention, and carry it into prayer, work, family life, and service.",
    prayer:
      "Lord Jesus, open our hearts to your Word today. Teach us to listen with faith, receive with humility, and respond with love. May the Scriptures guide our choices, strengthen our hope, and lead us closer to you. Amen.",
    readings: [
      {
        id: "first",
        title: "First Reading",
        reference: "Daily reading reference pending",
        text: null,
      },
      {
        id: "psalm",
        title: "Responsorial Psalm",
        reference: "Psalm reference pending",
        text: null,
      },
      {
        id: "second",
        title: "Second Reading",
        reference: "Optional reading reference pending",
        text: null,
      },
      {
        id: "gospel",
        title: "Gospel",
        reference: "Gospel reference pending",
        text: null,
      },
    ],
  };
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

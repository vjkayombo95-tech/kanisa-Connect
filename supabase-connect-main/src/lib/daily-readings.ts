import type { DailyReadingBibleReference } from "./daily-reading-references";
import { supabase } from "@/integrations/supabase/client";

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

export const READING_PLACEHOLDER =
  "Reading text has not been populated yet. This section is ready for the approved daily readings source.";

const READING_SECTION_META: Record<DailyReadingKind, Pick<DailyReadingSection, "id" | "title" | "reference">> = {
  first: { id: "first", title: "First Reading", reference: "Daily reading reference pending" },
  psalm: { id: "psalm", title: "Responsorial Psalm", reference: "Psalm reference pending" },
  second: { id: "second", title: "Second Reading", reference: "Optional reading reference pending" },
  gospel: { id: "gospel", title: "Gospel", reference: "Gospel reference pending" },
};

export const publishedDailyReadingKey = (date: string) => ["member-daily-readings", "published", date] as const;

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

export async function fetchPublishedDailyReading(date: string): Promise<DailyReadingEntry | null> {
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
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Dar_es_Salaam",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const value = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value;
  return `${value("year")}-${value("month")}-${value("day")}`;
}

function formatReadableDate(date: Date) {
  return new Intl.DateTimeFormat("en-TZ", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

export function getTodayReadingEntry(): DailyReadingEntry {
  const today = new Date();

  return {
    date: getDarEsSalaamDateKey(today),
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

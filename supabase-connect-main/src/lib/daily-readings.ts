import type { DailyReadingBibleReference } from "./daily-reading-references";

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

function toDateKey(date: Date) {
  return date.toISOString().slice(0, 10);
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
    date: toDateKey(today),
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

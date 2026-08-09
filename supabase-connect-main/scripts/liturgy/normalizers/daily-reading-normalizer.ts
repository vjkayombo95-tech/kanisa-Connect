import type { DailyReading, RawReading } from "../models/daily-reading.ts";
import type { CanonicalDailyReading, DailyReadings } from "../models/daily-readings.ts";
import type {
  LiturgicalColor,
  LiturgicalDay,
  LiturgicalRank,
  LiturgicalYear,
  WeekdayCycle,
} from "../models/liturgical-day.ts";

const BOOK_ABBREVIATIONS: Record<string, string> = {
  "1 Cor": "1 Corinthians",
  "1 Jn": "1 John",
  "1 Pt": "1 Peter",
  "1 Sm": "1 Samuel",
  "1 Thes": "1 Thessalonians",
  "1 Thess": "1 Thessalonians",
  "2 Cor": "2 Corinthians",
  "2 Jn": "2 John",
  "2 Pt": "2 Peter",
  "2 Sm": "2 Samuel",
  "2 Thes": "2 Thessalonians",
  "2 Thess": "2 Thessalonians",
  Acts: "Acts",
  Am: "Amos",
  Bar: "Baruch",
  Col: "Colossians",
  Dn: "Daniel",
  Dt: "Deuteronomy",
  Eph: "Ephesians",
  Ex: "Exodus",
  Gal: "Galatians",
  Gn: "Genesis",
  Heb: "Hebrews",
  Hos: "Hosea",
  Is: "Isaiah",
  Jas: "James",
  Jer: "Jeremiah",
  Jl: "Joel",
  Jn: "John",
  Jon: "Jonah",
  Jos: "Joshua",
  Jude: "Jude",
  Lk: "Luke",
  Lv: "Leviticus",
  Mal: "Malachi",
  Mk: "Mark",
  Mt: "Matthew",
  Nm: "Numbers",
  Phil: "Philippians",
  Prv: "Proverbs",
  Ps: "Psalm",
  Rev: "Revelation",
  Rom: "Romans",
  Rv: "Revelation",
  Sir: "Sirach",
  Tb: "Tobit",
  Ti: "Titus",
  Wis: "Wisdom",
  Zec: "Zechariah",
  Zep: "Zephaniah",
};

const BOOK_NAMES = [
  ...Object.values(BOOK_ABBREVIATIONS),
  "Song of Songs",
  "1 Chronicles",
  "2 Chronicles",
  "1 Kings",
  "2 Kings",
  "1 Maccabees",
  "2 Maccabees",
  "1 Timothy",
  "2 Timothy",
  "Philemon",
];

export function normalizeDailyReading(rawReading: RawReading): CanonicalDailyReading {
  const liturgicalDay: LiturgicalDay = {
    date: normalizeWhitespace(rawReading.date),
    celebration: normalizeWhitespace(rawReading.celebration),
    season: normalizeWhitespace(rawReading.liturgicalSeason),
    week: normalizeWhitespace(rawReading.liturgicalWeek),
    liturgicalYear: normalizeLiturgicalYear(rawReading.liturgicalYear),
    weekdayCycle: normalizeWeekdayCycle(rawReading.weekdayCycle),
    liturgicalColor: normalizeLiturgicalColor(rawReading.liturgicalColor),
    rank: normalizeLiturgicalRank(rawReading.rank),
    holyDayOfObligation: normalizeBoolean(rawReading.holyDayOfObligation),
    saint: normalizeNullableText(rawReading.saint),
    lectionaryNumber: normalizeWhitespace(rawReading.lectionaryNumber),
    notes: normalizeNullableText(rawReading.notes),
  };

  const dailyReadings: DailyReadings = {
    firstReadingReference: normalizeScriptureReference(rawReading.firstReadingReference),
    responsorialPsalmReference: normalizeScriptureReference(rawReading.responsorialPsalmReference),
    psalmResponse: normalizeWhitespace(rawReading.psalmResponse),
    secondReadingReference: normalizeNullableReference(rawReading.secondReadingReference),
    gospelAcclamation: normalizeNullableText(rawReading.gospelAcclamation),
    gospelReference: normalizeScriptureReference(rawReading.gospelReference),
  };

  return { liturgicalDay, dailyReadings };
}

export function toDailyReadingCompatibility(entry: CanonicalDailyReading): DailyReading {
  return {
    date: entry.liturgicalDay.date,
    celebration: entry.liturgicalDay.celebration,
    liturgicalSeason: entry.liturgicalDay.season,
    liturgicalWeek: entry.liturgicalDay.week,
    liturgicalYear: entry.liturgicalDay.liturgicalYear,
    weekdayCycle: entry.liturgicalDay.weekdayCycle,
    liturgicalColor: entry.liturgicalDay.liturgicalColor,
    rank: entry.liturgicalDay.rank,
    firstReadingReference: entry.dailyReadings.firstReadingReference,
    responsorialPsalmReference: entry.dailyReadings.responsorialPsalmReference,
    psalmResponse: entry.dailyReadings.psalmResponse,
    secondReadingReference: entry.dailyReadings.secondReadingReference,
    gospelAcclamation: entry.dailyReadings.gospelAcclamation,
    gospelReference: entry.dailyReadings.gospelReference,
    lectionaryNumber: entry.liturgicalDay.lectionaryNumber,
    notes: entry.liturgicalDay.notes,
  };
}

export function normalizeScriptureReference(reference: string): string {
  const normalized = normalizeWhitespace(normalizeDashes(reference));
  const bookName = findReferenceBookName(normalized);
  if (!bookName) return normalized;

  const canonicalBookName = BOOK_ABBREVIATIONS[bookName] ?? bookName;
  return `${canonicalBookName}${normalized.slice(bookName.length)}`.trim();
}

function normalizeNullableReference(value: string | null): string | null {
  const normalized = normalizeNullableText(value);
  return normalized ? normalizeScriptureReference(normalized) : null;
}

function normalizeNullableText(value: string | null): string | null {
  if (value === null) return null;
  const normalized = normalizeWhitespace(value);
  return normalized || null;
}

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function normalizeDashes(value: string): string {
  return value.replace(/[\u2010-\u2015]/g, "-");
}

function findReferenceBookName(reference: string): string | null {
  const candidates = [...BOOK_NAMES, ...Object.keys(BOOK_ABBREVIATIONS)].sort((left, right) => right.length - left.length);
  return candidates.find((bookName) => reference === bookName || reference.startsWith(`${bookName} `)) ?? null;
}

function normalizeLiturgicalYear(value: string): LiturgicalYear {
  const normalized = normalizeWhitespace(value).toUpperCase();
  return normalized === "B" || normalized === "C" ? normalized : "A";
}

function normalizeWeekdayCycle(value: string): WeekdayCycle {
  const normalized = normalizeWhitespace(value).toUpperCase();
  return normalized === "II" || normalized === "2" ? "II" : "I";
}

function normalizeLiturgicalColor(value: string): LiturgicalColor {
  const normalized = normalizeWhitespace(value).toLowerCase();
  if (isLiturgicalColor(normalized)) return normalized;
  return "green";
}

function isLiturgicalColor(value: string): value is LiturgicalColor {
  return ["green", "purple", "white", "red", "rose", "gold"].includes(value);
}

function normalizeLiturgicalRank(value: string): LiturgicalRank {
  const normalized = normalizeWhitespace(value).toLowerCase().replace(/[\s-]+/g, "_");
  if (isLiturgicalRank(normalized)) return normalized;
  return "weekday";
}

function isLiturgicalRank(value: string): value is LiturgicalRank {
  return ["weekday", "optional_memorial", "memorial", "feast", "solemnity", "sunday", "holy_day"].includes(value);
}

function normalizeBoolean(value: boolean | string | null): boolean {
  if (typeof value === "boolean") return value;
  if (value === null) return false;
  const normalized = normalizeWhitespace(value).toLowerCase();
  return normalized === "true" || normalized === "yes" || normalized === "1";
}

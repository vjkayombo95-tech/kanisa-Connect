import type { CanonicalDailyReading, DailyReadings } from "../models/daily-readings.ts";
import type {
  LiturgicalColor,
  LiturgicalDay,
  LiturgicalRank,
  LiturgicalYear,
  WeekdayCycle,
} from "../models/liturgical-day.ts";
import { validateCanonicalDailyReading } from "../validation/daily-reading-validator.ts";
import XLSX from "xlsx";

const LITURGICAL_CALENDAR_SHEET = "Liturgical Calendar";
const DAILY_READINGS_SHEET = "Daily Readings";

const LITURGICAL_CALENDAR_HEADERS = [
  "Date",
  "Celebration",
  "Season",
  "Week",
  "Liturgical Year",
  "Weekday Cycle",
  "Liturgical Color",
  "Rank",
  "Holy Day of Obligation",
  "Saint",
  "Lectionary Number",
  "Notes",
];

const DAILY_READINGS_HEADERS = [
  "Date",
  "Celebration",
  "First Reading Reference",
  "Responsorial Psalm Reference",
  "Psalm Response",
  "Second Reading Reference",
  "Gospel Acclamation",
  "Gospel Reference",
];

export type WorkbookReadResult = {
  readings: CanonicalDailyReading[];
  errors: string[];
};

type WorkbookRow = Record<string, string | boolean | number | null>;

export function readLiturgicalWorkbook(inputPath: string): WorkbookReadResult {
  const workbook = XLSX.readFile(inputPath);
  const errors: string[] = [];

  const calendarRows = readWorksheet(workbook, LITURGICAL_CALENDAR_SHEET, LITURGICAL_CALENDAR_HEADERS, errors);
  const readingRows = readWorksheet(workbook, DAILY_READINGS_SHEET, DAILY_READINGS_HEADERS, errors);

  if (errors.length) return { readings: [], errors };

  const readingsByDate = new Map<string, WorkbookRow>();
  for (const row of readingRows) {
    const date = readString(row, "Date");
    if (!date) {
      errors.push(`Daily Readings row is missing Date.`);
      continue;
    }

    if (readingsByDate.has(date)) {
      errors.push(`Duplicate Daily Readings row for date ${date}.`);
      continue;
    }

    readingsByDate.set(date, row);
  }

  const entries: CanonicalDailyReading[] = [];
  const seenDates = new Set<string>();

  for (const row of calendarRows) {
    const date = readString(row, "Date");
    if (!date) {
      errors.push("Liturgical Calendar row is missing Date.");
      continue;
    }

    if (seenDates.has(date)) {
      errors.push(`Duplicate Liturgical Calendar row for date ${date}.`);
      continue;
    }
    seenDates.add(date);

    const readingRow = readingsByDate.get(date);
    if (!readingRow) {
      errors.push(`Missing Daily Readings row for date ${date}.`);
      continue;
    }

    try {
      const entry = {
        liturgicalDay: toLiturgicalDay(row),
        dailyReadings: toDailyReadings(readingRow),
      };
      validateCanonicalDailyReading(entry);
      entries.push(entry);
    } catch (error) {
      errors.push(`${date}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  for (const date of readingsByDate.keys()) {
    if (!seenDates.has(date)) {
      errors.push(`Daily Readings row has no matching Liturgical Calendar row for date ${date}.`);
    }
  }

  return {
    readings: errors.length ? [] : entries,
    errors,
  };
}

function readWorksheet(
  workbook: XLSX.WorkBook,
  sheetName: string,
  expectedHeaders: string[],
  errors: string[],
): WorkbookRow[] {
  const worksheet = workbook.Sheets[sheetName];
  if (!worksheet) {
    errors.push(`Missing worksheet: ${sheetName}.`);
    return [];
  }

  const rows = XLSX.utils.sheet_to_json<Array<string | boolean | number | null>>(worksheet, {
    header: 1,
    defval: null,
  });
  const [headerRow, ...dataRows] = rows;
  const headers = (headerRow ?? []).map((value) => String(value ?? "").trim());
  const headerErrors = validateHeaders(sheetName, headers, expectedHeaders);
  errors.push(...headerErrors);
  if (headerErrors.length) return [];

  return dataRows
    .filter((row) => row.some((value) => value !== null && String(value).trim() !== ""))
    .map((row) => {
      const record: WorkbookRow = {};
      for (let index = 0; index < expectedHeaders.length; index += 1) {
        record[expectedHeaders[index]] = normalizeCellValue(row[index] ?? null);
      }
      return record;
    });
}

function validateHeaders(sheetName: string, headers: string[], expectedHeaders: string[]): string[] {
  const errors: string[] = [];
  for (let index = 0; index < expectedHeaders.length; index += 1) {
    if (headers[index] !== expectedHeaders[index]) {
      errors.push(
        `${sheetName} header ${index + 1} expected "${expectedHeaders[index]}" but found "${headers[index] ?? ""}".`,
      );
    }
  }
  return errors;
}

function toLiturgicalDay(row: WorkbookRow): LiturgicalDay {
  return {
    date: readString(row, "Date"),
    celebration: readString(row, "Celebration"),
    season: readString(row, "Season"),
    week: readString(row, "Week"),
    liturgicalYear: readString(row, "Liturgical Year") as LiturgicalYear,
    weekdayCycle: readString(row, "Weekday Cycle") as WeekdayCycle,
    liturgicalColor: readString(row, "Liturgical Color") as LiturgicalColor,
    rank: readString(row, "Rank") as LiturgicalRank,
    holyDayOfObligation: readBoolean(row, "Holy Day of Obligation"),
    saint: readNullableString(row, "Saint"),
    lectionaryNumber: readString(row, "Lectionary Number"),
    notes: readNullableString(row, "Notes"),
  };
}

function toDailyReadings(row: WorkbookRow): DailyReadings {
  return {
    firstReadingReference: readString(row, "First Reading Reference"),
    responsorialPsalmReference: readString(row, "Responsorial Psalm Reference"),
    psalmResponse: readString(row, "Psalm Response"),
    secondReadingReference: readNullableString(row, "Second Reading Reference"),
    gospelAcclamation: readNullableString(row, "Gospel Acclamation"),
    gospelReference: readString(row, "Gospel Reference"),
  };
}

function readString(row: WorkbookRow, header: string): string {
  const value = row[header];
  if (value === null) return "";
  return String(value).trim();
}

function readNullableString(row: WorkbookRow, header: string): string | null {
  const value = readString(row, header);
  return value ? value : null;
}

function readBoolean(row: WorkbookRow, header: string): boolean {
  const value = row[header];
  if (typeof value === "boolean") return value;
  return /^(true|yes|1)$/i.test(String(value ?? "").trim());
}

function normalizeCellValue(value: string | boolean | number | null): string | boolean | number | null {
  if (typeof value !== "string") return value;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

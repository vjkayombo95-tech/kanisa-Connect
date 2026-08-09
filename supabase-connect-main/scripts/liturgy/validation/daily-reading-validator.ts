import type { DailyReading } from "../models/daily-reading.ts";
import type { CanonicalDailyReading, DailyReadings } from "../models/daily-readings.ts";
import type { LiturgicalDay } from "../models/liturgical-day.ts";
import { toDailyReadingCompatibility } from "../normalizers/daily-reading-normalizer.ts";
import { isValidScriptureReference } from "../parsers/reference-parser.ts";

export type DailyReadingValidationResult = {
  valid: boolean;
  errors: string[];
};

export function validateCanonicalDailyReading(entry: CanonicalDailyReading): DailyReadingValidationResult {
  const errors = [
    ...collectLiturgicalDayErrors(entry.liturgicalDay),
    ...collectDailyReadingsErrors(entry.dailyReadings),
  ];

  if (errors.length) {
    throw new Error(`CanonicalDailyReading validation failed: ${errors.join("; ")}`);
  }

  return { valid: true, errors };
}

export function validateLiturgicalDay(liturgicalDay: LiturgicalDay): DailyReadingValidationResult {
  const errors = collectLiturgicalDayErrors(liturgicalDay);

  if (errors.length) {
    throw new Error(`LiturgicalDay validation failed: ${errors.join("; ")}`);
  }

  return { valid: true, errors };
}

export function validateDailyReadings(dailyReadings: DailyReadings): DailyReadingValidationResult {
  const errors = collectDailyReadingsErrors(dailyReadings);

  if (errors.length) {
    throw new Error(`DailyReadings validation failed: ${errors.join("; ")}`);
  }

  return { valid: true, errors };
}

export function validateDailyReading(reading: DailyReading | CanonicalDailyReading): DailyReadingValidationResult {
  if ("liturgicalDay" in reading) return validateCanonicalDailyReading(reading);

  return validateCanonicalDailyReading({
    liturgicalDay: {
      date: reading.date,
      celebration: reading.celebration,
      season: reading.liturgicalSeason,
      week: reading.liturgicalWeek,
      liturgicalYear: reading.liturgicalYear,
      weekdayCycle: reading.weekdayCycle,
      liturgicalColor: reading.liturgicalColor,
      rank: reading.rank,
      holyDayOfObligation: false,
      saint: null,
      lectionaryNumber: reading.lectionaryNumber,
      notes: reading.notes,
    },
    dailyReadings: {
      firstReadingReference: reading.firstReadingReference,
      responsorialPsalmReference: reading.responsorialPsalmReference,
      psalmResponse: reading.psalmResponse,
      secondReadingReference: reading.secondReadingReference,
      gospelAcclamation: reading.gospelAcclamation,
      gospelReference: reading.gospelReference,
    },
  });
}

export function toCompatibleDailyReading(entry: CanonicalDailyReading): DailyReading {
  return toDailyReadingCompatibility(entry);
}

function collectLiturgicalDayErrors(liturgicalDay: LiturgicalDay): string[] {
  const errors: string[] = [];

  if (!isValidIsoDate(liturgicalDay.date)) {
    errors.push(`Invalid date: ${liturgicalDay.date}`);
  }

  if (!liturgicalDay.celebration.trim()) {
    errors.push("celebration is required");
  }

  return errors;
}

function collectDailyReadingsErrors(dailyReadings: DailyReadings): string[] {
  const errors: string[] = [];

  requireReference(errors, "firstReadingReference", dailyReadings.firstReadingReference);
  requireReference(errors, "responsorialPsalmReference", dailyReadings.responsorialPsalmReference);
  requireReference(errors, "gospelReference", dailyReadings.gospelReference);

  validateOptionalReference(errors, "secondReadingReference", dailyReadings.secondReadingReference);

  return errors;
}

function requireReference(errors: string[], field: string, value: string) {
  if (!value.trim()) {
    errors.push(`${field} is required`);
    return;
  }

  if (!isValidScriptureReference(value)) {
    errors.push(`${field} is not a valid Scripture reference: ${value}`);
  }
}

function validateOptionalReference(errors: string[], field: string, value: string | null) {
  if (value === null) return;
  if (!isValidScriptureReference(value)) {
    errors.push(`${field} is not a valid Scripture reference: ${value}`);
  }
}

function isValidIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

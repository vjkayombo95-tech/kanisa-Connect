export const DAILY_READINGS_NORMALIZATION_VERSION = "daily-readings-v1";

export type DailyReadingSourceRecord = {
  source_key: string;
  source_record_id: string;
  reading_date: string;
  language_code: string;
  first_reading_reference: string;
  responsorial_psalm_reference: string;
  gospel_reference: string;
  source_attribution: string;
  source_version?: string | null;
  source_url?: string | null;
  liturgical_year?: string | null;
  liturgical_season?: string | null;
  celebration?: string | null;
  liturgical_color?: string | null;
  second_reading_reference?: string | null;
  gospel_acclamation_reference?: string | null;
};

export type NormalizedDailyReadingSourcePayload = {
  source_key: string;
  source_record_id: string;
  source_version: string | null;
  reading_date: string;
  language_code: string;
  liturgical_year: string | null;
  liturgical_season: string | null;
  celebration: string | null;
  liturgical_color: string | null;
  first_reading_reference: string;
  responsorial_psalm_reference: string;
  second_reading_reference: string | null;
  gospel_acclamation_reference: string | null;
  gospel_reference: string;
  source_attribution: string;
};

export type PreparedDailyReadingSource = {
  normalized_payload: NormalizedDailyReadingSourcePayload;
  canonical_source: string;
  source_hash: string;
  normalization_version: typeof DAILY_READINGS_NORMALIZATION_VERSION;
  source_url: string | null;
};

export type DailyReadingNormalizationErrorCode =
  | "invalid_source_identity"
  | "invalid_date"
  | "invalid_reference"
  | "invalid_source_url"
  | "invalid_required_field";

export class DailyReadingNormalizationError extends Error {
  code: DailyReadingNormalizationErrorCode;
  field: string;

  constructor(code: DailyReadingNormalizationErrorCode, field: string) {
    super(`${code}: ${field}`);
    this.name = "DailyReadingNormalizationError";
    this.code = code;
    this.field = field;
  }
}

function normalizeRequired(value: unknown, field: string, code: DailyReadingNormalizationErrorCode) {
  if (typeof value !== "string") throw new DailyReadingNormalizationError(code, field);

  const normalized = value.trim();
  if (!normalized) throw new DailyReadingNormalizationError(code, field);

  return normalized;
}

function normalizeOptional(value: unknown, field: string) {
  if (value == null) return null;
  if (typeof value !== "string") throw new DailyReadingNormalizationError("invalid_required_field", field);

  const normalized = value.trim();
  return normalized || null;
}

function normalizeLanguage(value: unknown) {
  return normalizeRequired(value, "language_code", "invalid_required_field").toLowerCase();
}

function normalizeReadingDate(value: unknown) {
  const normalized = normalizeRequired(value, "reading_date", "invalid_date");
  const match = normalized.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) throw new DailyReadingNormalizationError("invalid_date", "reading_date");

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const monthLengths = [31, isLeapYear(year) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  const maxDay = monthLengths[month - 1];

  if (!Number.isInteger(year) || month < 1 || month > 12 || day < 1 || day > maxDay) {
    throw new DailyReadingNormalizationError("invalid_date", "reading_date");
  }

  return normalized;
}

function isLeapYear(year: number) {
  return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
}

function normalizeReference(value: unknown, field: string) {
  return normalizeRequired(value, field, "invalid_reference");
}

function normalizeOptionalReference(value: unknown, field: string) {
  if (value == null) return null;
  if (typeof value !== "string") throw new DailyReadingNormalizationError("invalid_reference", field);

  const normalized = value.trim();
  return normalized || null;
}

function normalizeSourceUrl(value: unknown) {
  const normalized = normalizeOptional(value, "source_url");
  if (!normalized) return null;

  let parsed: URL;
  try {
    parsed = new URL(normalized);
  } catch {
    throw new DailyReadingNormalizationError("invalid_source_url", "source_url");
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new DailyReadingNormalizationError("invalid_source_url", "source_url");
  }

  return normalized;
}

export function normalizeDailyReadingSource(record: DailyReadingSourceRecord) {
  const normalized_payload: NormalizedDailyReadingSourcePayload = {
    source_key: normalizeRequired(record.source_key, "source_key", "invalid_source_identity"),
    source_record_id: normalizeRequired(record.source_record_id, "source_record_id", "invalid_source_identity"),
    source_version: normalizeOptional(record.source_version, "source_version"),
    reading_date: normalizeReadingDate(record.reading_date),
    language_code: normalizeLanguage(record.language_code),
    liturgical_year: normalizeOptional(record.liturgical_year, "liturgical_year"),
    liturgical_season: normalizeOptional(record.liturgical_season, "liturgical_season"),
    celebration: normalizeOptional(record.celebration, "celebration"),
    liturgical_color: normalizeOptional(record.liturgical_color, "liturgical_color"),
    first_reading_reference: normalizeReference(record.first_reading_reference, "first_reading_reference"),
    responsorial_psalm_reference: normalizeReference(
      record.responsorial_psalm_reference,
      "responsorial_psalm_reference",
    ),
    second_reading_reference: normalizeOptionalReference(record.second_reading_reference, "second_reading_reference"),
    gospel_acclamation_reference: normalizeOptionalReference(
      record.gospel_acclamation_reference,
      "gospel_acclamation_reference",
    ),
    gospel_reference: normalizeReference(record.gospel_reference, "gospel_reference"),
    source_attribution: normalizeRequired(record.source_attribution, "source_attribution", "invalid_required_field"),
  };

  return {
    normalized_payload,
    source_url: normalizeSourceUrl(record.source_url),
    normalization_version: DAILY_READINGS_NORMALIZATION_VERSION,
  };
}

export function serializeDailyReadingSource(payload: NormalizedDailyReadingSourcePayload) {
  const canonicalPayload: NormalizedDailyReadingSourcePayload = {
    source_key: payload.source_key,
    source_record_id: payload.source_record_id,
    source_version: payload.source_version,
    reading_date: payload.reading_date,
    language_code: payload.language_code,
    liturgical_year: payload.liturgical_year,
    liturgical_season: payload.liturgical_season,
    celebration: payload.celebration,
    liturgical_color: payload.liturgical_color,
    first_reading_reference: payload.first_reading_reference,
    responsorial_psalm_reference: payload.responsorial_psalm_reference,
    second_reading_reference: payload.second_reading_reference,
    gospel_acclamation_reference: payload.gospel_acclamation_reference,
    gospel_reference: payload.gospel_reference,
    source_attribution: payload.source_attribution,
  };

  return JSON.stringify(canonicalPayload);
}

export async function hashDailyReadingSource(payload: NormalizedDailyReadingSourcePayload) {
  const bytes = new TextEncoder().encode(serializeDailyReadingSource(payload));
  const digest = await globalThis.crypto.subtle.digest("SHA-256", bytes);

  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export async function prepareDailyReadingSource(record: DailyReadingSourceRecord): Promise<PreparedDailyReadingSource> {
  const normalized = normalizeDailyReadingSource(record);
  const canonical_source = serializeDailyReadingSource(normalized.normalized_payload);
  const source_hash = await hashDailyReadingSource(normalized.normalized_payload);

  return {
    ...normalized,
    canonical_source,
    source_hash,
  };
}

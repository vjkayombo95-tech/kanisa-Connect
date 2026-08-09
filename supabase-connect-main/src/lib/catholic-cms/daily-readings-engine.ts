import { looksLikeBibleReference, parseBibleReference, type BibleReferenceBook } from "@/lib/bible-reference-parser";
import type { CmsContentStatus, CmsVisibility, ContentLanguage } from "@/lib/super-admin/prayer-library-service";

export const DAILY_READING_STATUSES = ["draft", "review", "published", "featured", "archived"] as const;
export const DAILY_READING_VISIBILITIES = ["public", "member", "pastoral", "admin"] as const;

export type CmsDailyReading = {
  id: string;
  reading_date: string;
  liturgical_year: string;
  liturgical_season: string;
  celebration: string;
  liturgical_color: string;
  first_reading_reference: string;
  responsorial_psalm_reference: string;
  second_reading_reference: string | null;
  gospel_acclamation_reference: string | null;
  gospel_reference: string;
  reflection: string | null;
  prayer: string | null;
  meditation_questions: string | null;
  daily_challenge: string | null;
  language_id: string | null;
  status: CmsContentStatus;
  visibility: CmsVisibility;
  source_attribution: string | null;
  editorial_notes: string | null;
  import_batch_id?: string | null;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
  language?: Pick<ContentLanguage, "id" | "code" | "name" | "native_name"> | null;
};

export type DailyReadingEditorDraft = Omit<CmsDailyReading, "created_by" | "updated_by" | "created_at" | "updated_at" | "language">;

export type CmsDailyReadingImportRow = {
  rowNumber: number;
  date?: string | number | Date;
  liturgicalYear?: string;
  liturgicalSeason?: string;
  celebration?: string;
  liturgicalColor?: string;
  firstReading?: string;
  psalm?: string;
  secondReading?: string;
  gospelAcclamation?: string;
  gospel?: string;
  reflection?: string;
  prayer?: string;
  meditationQuestions?: string;
  dailyChallenge?: string;
  language?: string;
  status?: string;
  visibility?: string;
  sourceAttribution?: string;
  editorialNotes?: string;
};

export type CmsDailyReadingImportIssue = {
  rowNumber: number;
  field: string;
  message: string;
  severity: "error" | "warning" | "information";
  date?: string;
  currentValue?: string;
  suggestedAction?: string;
  code?: string;
};

export type CmsDailyReadingImportValidation = {
  validRows: CmsDailyReadingImportRow[];
  issues: CmsDailyReadingImportIssue[];
  hasErrors: boolean;
  summary: DailyReadingValidationSummary;
};

export type DailyReadingCoverage = {
  year: number;
  totalDays: number;
  languageKey: string;
  datasetReadings: number;
  draftReadings: number;
  reviewReadings: number;
  publishedReadings: number;
  archivedReadings: number;
  completeLiturgicalReadings: number;
  publishedCompleteLiturgicalReadings: number;
  enrichedReadings: number;
  publishedEnrichedReadings: number;
  datasetCoveragePercent: number;
  publishedCoveragePercent: number;
  liturgicalCompletenessPercent: number;
  editorialEnrichmentPercent: number;
  missingDates: string[];
  missingPublishedDates: string[];
  incompleteDates: string[];
  incompletePublishedDates: string[];
};

export type DailyReadingReferenceLookup = {
  languages: ContentLanguage[];
};

export type DailyReadingImportBatchMetadata = {
  id?: string;
  filename: string;
  sourceOrganization: string;
  sourcePublication: string;
  sourceYear: number;
  sourceEdition?: string;
  dateObtained?: string;
  language?: string;
  importedBy?: string;
  importDate?: string;
  notes?: string;
};

export type DailyReadingConflictStrategy = "skip_existing" | "create_draft_revision" | "update_existing";

export type DailyReadingDateRange = {
  from?: string;
  to?: string;
};

export type DailyReadingValidationSummary = {
  totalRows: number;
  validRows: number;
  errorCount: number;
  warningCount: number;
  informationCount: number;
  existingRecordCount: number;
  missingDateCount: number;
  conflictCount: number;
};

export type DailyReadingDryRunReport = {
  metadata: DailyReadingImportBatchMetadata;
  rows: CmsDailyReadingImportRow[];
  rowsInRange: CmsDailyReadingImportRow[];
  validation: CmsDailyReadingImportValidation;
  coverage: DailyReadingCoverage;
  conflictStrategy: DailyReadingConflictStrategy;
  dryRun: true;
};

export type DailyReadingImportBatchSummary = DailyReadingValidationSummary & {
  warningRows: number;
  informationRows: number;
  importedRows: number;
  skippedRows: number;
  updatedRows: number;
  status: "Uploaded" | "Validating" | "Validation Failed" | "Ready for Import" | "Imported" | "Partially Imported" | "Cancelled";
};

export type DailyReadingPublicationSafetyResult = {
  allowed: boolean;
  issues: CmsDailyReadingImportIssue[];
  targetDates: string[];
};

function normalize(value: unknown) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function percent(value: number, total: number) {
  if (!total) return 0;
  return Math.round((value / total) * 1000) / 10;
}

export function dateKey(input: string | number | Date) {
  if (input instanceof Date) return Number.isNaN(input.getTime()) ? "" : input.toISOString().slice(0, 10);
  if (typeof input === "number") {
    const excelEpoch = Date.UTC(1899, 11, 30);
    const date = new Date(excelEpoch + input * 24 * 60 * 60 * 1000);
    return dateKey(date);
  }

  const value = normalize(input);
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? "" : parsed.toISOString().slice(0, 10);
}

export function isLeapYear(year: number) {
  return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
}

export function daysInYear(year: number) {
  return isLeapYear(year) ? 366 : 365;
}

export function isPublishedDailyReadingForMembers(reading: Pick<CmsDailyReading, "status" | "visibility">) {
  return ["published", "featured"].includes(reading.status) && ["public", "member"].includes(reading.visibility);
}

export function dailyReadingMatchesSearch(reading: CmsDailyReading, query: string) {
  const term = normalize(query).toLowerCase();
  if (!term) return true;

  return [
    reading.reading_date,
    reading.liturgical_year,
    reading.liturgical_season,
    reading.celebration,
    reading.liturgical_color,
    reading.first_reading_reference,
    reading.responsorial_psalm_reference,
    reading.second_reading_reference,
    reading.gospel_acclamation_reference,
    reading.gospel_reference,
    reading.reflection,
    reading.prayer,
    reading.language?.name,
    reading.language?.code,
  ]
    .join(" ")
    .toLowerCase()
    .includes(term);
}

export function filterMemberDailyReadings(readings: CmsDailyReading[], filters: { search?: string; from?: string; to?: string; languageCode?: string } = {}) {
  return readings.filter((reading) => {
    if (!isPublishedDailyReadingForMembers(reading)) return false;
    if (filters.from && reading.reading_date < filters.from) return false;
    if (filters.to && reading.reading_date > filters.to) return false;
    if (filters.languageCode && reading.language?.code && reading.language.code !== filters.languageCode) return false;
    return dailyReadingMatchesSearch(reading, filters.search ?? "");
  });
}

function languageMap(languages: ContentLanguage[]) {
  const map = new Map<string, ContentLanguage>();
  languages.forEach((language) => {
    [language.id, language.code, language.name, language.native_name].filter(Boolean).forEach((key) => map.set(String(key).toLowerCase(), language));
  });
  return map;
}

function addReferenceIssue(
  issues: CmsDailyReadingImportIssue[],
  rowNumber: number,
  field: string,
  value: string,
  severity: CmsDailyReadingImportIssue["severity"] = "warning",
  books?: BibleReferenceBook[],
) {
  if (!value) return;
  const valid = books?.length ? Boolean(parseBibleReference(value, books)) : looksLikeBibleReference(value);
  if (!valid) {
    issues.push({
      rowNumber,
      field,
      severity,
      message: `Review Bible reference formatting: ${value}.`,
      currentValue: value,
      suggestedAction: "Use a recognized Bible book and chapter:verse range.",
      code: severity === "error" ? "malformed_required_reference" : "malformed_optional_reference",
    });
  }
}

export function filterDailyReadingRowsByDateRange(rows: CmsDailyReadingImportRow[], range: DailyReadingDateRange = {}) {
  return rows.filter((row) => {
    const rowDate = dateKey(row.date ?? "");
    if (!rowDate) return true;
    if (range.from && rowDate < range.from) return false;
    if (range.to && rowDate > range.to) return false;
    return true;
  });
}

export function validateDailyReadingImportRows(
  rows: CmsDailyReadingImportRow[],
  reference: DailyReadingReferenceLookup,
  existingReadings: CmsDailyReading[] = [],
  books?: BibleReferenceBook[],
  range: DailyReadingDateRange = {},
): CmsDailyReadingImportValidation {
  const issues: CmsDailyReadingImportIssue[] = [];
  const rowsToValidate = filterDailyReadingRowsByDateRange(rows, range);
  const seen = new Set<string>();
  const existingKeys = new Set(existingReadings.map((reading) => `${reading.reading_date}:${reading.language?.code ?? reading.language_id ?? "default"}`));
  const languages = languageMap(reference.languages);

  rowsToValidate.forEach((row) => {
    const readingDate = dateKey(row.date ?? "");
    const language = row.language ? languages.get(normalize(row.language).toLowerCase()) : reference.languages.find((item) => item.is_default) ?? reference.languages[0] ?? null;
    const rowLanguageKey = language?.code ?? normalize(row.language).toLowerCase() ?? "";
    const rowKey = `${readingDate}:${rowLanguageKey || "default"}`;
    const status = normalize(row.status || "draft").toLowerCase();
    const visibility = normalize(row.visibility || "member").toLowerCase();
    const first = normalize(row.firstReading);
    const psalm = normalize(row.psalm);
    const gospel = normalize(row.gospel);

    if (!readingDate) issues.push({ rowNumber: row.rowNumber, field: "Date", severity: "error", message: "A valid reading date is required.", currentValue: normalize(row.date), suggestedAction: "Use YYYY-MM-DD.", code: "invalid_date" });
    if (!first) issues.push({ rowNumber: row.rowNumber, date: readingDate, field: "First Reading", severity: "error", message: "First reading reference is required.", suggestedAction: "Enter the official first reading reference.", code: "missing_first_reading" });
    if (!psalm) issues.push({ rowNumber: row.rowNumber, date: readingDate, field: "Psalm", severity: "error", message: "Responsorial psalm reference is required.", suggestedAction: "Enter the official psalm reference.", code: "missing_psalm" });
    if (!gospel) issues.push({ rowNumber: row.rowNumber, date: readingDate, field: "Gospel", severity: "error", message: "Gospel reference is required.", suggestedAction: "Enter the official Gospel reference.", code: "missing_gospel" });
    if (!DAILY_READING_STATUSES.includes(status as never)) issues.push({ rowNumber: row.rowNumber, date: readingDate, field: "Status", severity: "error", message: `Status must be one of: ${DAILY_READING_STATUSES.join(", ")}.`, currentValue: status, suggestedAction: "Use draft, review, published, featured, or archived.", code: "invalid_status" });
    if (!DAILY_READING_VISIBILITIES.includes(visibility as never)) issues.push({ rowNumber: row.rowNumber, date: readingDate, field: "Visibility", severity: "error", message: `Visibility must be one of: ${DAILY_READING_VISIBILITIES.join(", ")}.`, currentValue: visibility, suggestedAction: "Use public, member, pastoral, or admin.", code: "invalid_visibility" });
    if (row.language && !language) issues.push({ rowNumber: row.rowNumber, date: readingDate, field: "Language", severity: "error", message: `Unknown language: ${row.language}.`, currentValue: normalize(row.language), suggestedAction: "Use a configured CMS language.", code: "invalid_language" });
    if (readingDate && seen.has(rowKey)) issues.push({ rowNumber: row.rowNumber, date: readingDate, field: "Date", severity: "error", message: "Duplicate reading date and language in this import.", suggestedAction: "Keep one row per date/language.", code: "duplicate_workbook_date_language" });
    if (readingDate && existingKeys.has(rowKey)) issues.push({ rowNumber: row.rowNumber, date: readingDate, field: "Date", severity: "warning", message: "Existing CMS reading found.", suggestedAction: "Choose Skip Existing, Create Draft Revision, or Update Existing before import.", code: "existing_record" });
    if (!normalize(row.reflection)) issues.push({ rowNumber: row.rowNumber, date: readingDate, field: "Reflection", severity: "warning", message: "Reflection is missing.", suggestedAction: "Add editorial reflection before publication if required by the parish.", code: "missing_reflection" });
    if (!normalize(row.prayer)) issues.push({ rowNumber: row.rowNumber, date: readingDate, field: "Prayer", severity: "warning", message: "Prayer is missing.", suggestedAction: "Add editorial prayer before publication if required by the parish.", code: "missing_prayer" });
    if (!normalize(row.celebration)) issues.push({ rowNumber: row.rowNumber, date: readingDate, field: "Celebration", severity: "warning", message: "Celebration is missing.", suggestedAction: "Confirm the liturgical celebration from the verified source.", code: "missing_celebration" });
    if (!normalize(row.liturgicalColor)) issues.push({ rowNumber: row.rowNumber, date: readingDate, field: "Liturgical Color", severity: "warning", message: "Liturgical color is missing.", suggestedAction: "Confirm the liturgical color from the verified source.", code: "missing_liturgical_color" });
    if (!normalize(row.secondReading)) issues.push({ rowNumber: row.rowNumber, date: readingDate, field: "Second Reading", severity: "information", message: "Optional second reading is absent.", suggestedAction: "No action needed unless the day requires a second reading.", code: "optional_second_reading_absent" });
    if (!normalize(row.gospelAcclamation)) issues.push({ rowNumber: row.rowNumber, date: readingDate, field: "Gospel Acclamation", severity: "information", message: "Optional Gospel Acclamation is absent.", suggestedAction: "No action needed unless the source provides it.", code: "optional_acclamation_absent" });

    addReferenceIssue(issues, row.rowNumber, "First Reading", first, "error", books);
    addReferenceIssue(issues, row.rowNumber, "Psalm", psalm, "error", books);
    addReferenceIssue(issues, row.rowNumber, "Second Reading", normalize(row.secondReading), "warning", books);
    addReferenceIssue(issues, row.rowNumber, "Gospel Acclamation", normalize(row.gospelAcclamation), "warning", books);
    addReferenceIssue(issues, row.rowNumber, "Gospel", gospel, "error", books);

    if (readingDate) seen.add(rowKey);
  });

  const errorRows = new Set(issues.filter((issue) => issue.severity === "error").map((issue) => issue.rowNumber));
  const rowsWithWarnings = new Set(issues.filter((issue) => issue.severity === "warning").map((issue) => issue.rowNumber));
  const rowsWithInformation = new Set(issues.filter((issue) => issue.severity === "information").map((issue) => issue.rowNumber));
  const existingRecords = new Set(
    issues
      .filter((issue) => issue.code === "existing_record")
      .map((issue) => issue.date ?? `${issue.rowNumber}:${issue.field}`),
  );
  return {
    validRows: rowsToValidate.filter((row) => !errorRows.has(row.rowNumber)),
    issues,
    hasErrors: errorRows.size > 0,
    summary: {
      totalRows: rowsToValidate.length,
      validRows: rowsToValidate.filter((row) => !errorRows.has(row.rowNumber)).length,
      errorCount: issues.filter((issue) => issue.severity === "error").length,
      warningCount: issues.filter((issue) => issue.severity === "warning").length,
      informationCount: issues.filter((issue) => issue.severity === "information").length,
      existingRecordCount: existingRecords.size,
      missingDateCount: issues.filter((issue) => issue.code === "invalid_date").length,
      conflictCount: existingRecords.size + issues.filter((issue) => issue.code === "duplicate_workbook_date_language").length,
    },
  };
}

export function importDailyReadingRowToDraft(
  row: CmsDailyReadingImportRow,
  reference: DailyReadingReferenceLookup,
  existing?: CmsDailyReading,
): DailyReadingEditorDraft {
  const languages = languageMap(reference.languages);
  const language = row.language ? languages.get(normalize(row.language).toLowerCase()) : reference.languages.find((item) => item.is_default) ?? reference.languages[0] ?? null;

  return {
    id: existing?.id ?? `draft-import-${row.rowNumber}`,
    reading_date: dateKey(row.date ?? "") || new Date().toISOString().slice(0, 10),
    liturgical_year: normalize(row.liturgicalYear || existing?.liturgical_year),
    liturgical_season: normalize(row.liturgicalSeason || existing?.liturgical_season),
    celebration: normalize(row.celebration || existing?.celebration),
    liturgical_color: normalize(row.liturgicalColor || existing?.liturgical_color),
    first_reading_reference: normalize(row.firstReading || existing?.first_reading_reference),
    responsorial_psalm_reference: normalize(row.psalm || existing?.responsorial_psalm_reference),
    second_reading_reference: normalize(row.secondReading || existing?.second_reading_reference) || null,
    gospel_acclamation_reference: normalize(row.gospelAcclamation || existing?.gospel_acclamation_reference) || null,
    gospel_reference: normalize(row.gospel || existing?.gospel_reference),
    reflection: normalize(row.reflection || existing?.reflection) || null,
    prayer: normalize(row.prayer || existing?.prayer) || null,
    meditation_questions: normalize(row.meditationQuestions || existing?.meditation_questions) || null,
    daily_challenge: normalize(row.dailyChallenge || existing?.daily_challenge) || null,
    language_id: language?.id ?? existing?.language_id ?? null,
    status: (normalize(row.status || existing?.status || "draft").toLowerCase() as CmsContentStatus) || "draft",
    visibility: (normalize(row.visibility || existing?.visibility || "member").toLowerCase() as CmsVisibility) || "member",
    source_attribution: normalize(row.sourceAttribution || existing?.source_attribution) || null,
    editorial_notes: normalize(row.editorialNotes || existing?.editorial_notes) || null,
  };
}

export function buildDailyReadingRestoreDraft(current: CmsDailyReading, snapshot: Partial<CmsDailyReading>): DailyReadingEditorDraft {
  return {
    id: current.id,
    reading_date: snapshot.reading_date ?? current.reading_date,
    liturgical_year: snapshot.liturgical_year ?? current.liturgical_year,
    liturgical_season: snapshot.liturgical_season ?? current.liturgical_season,
    celebration: snapshot.celebration ?? current.celebration,
    liturgical_color: snapshot.liturgical_color ?? current.liturgical_color,
    first_reading_reference: snapshot.first_reading_reference ?? current.first_reading_reference,
    responsorial_psalm_reference: snapshot.responsorial_psalm_reference ?? current.responsorial_psalm_reference,
    second_reading_reference: snapshot.second_reading_reference ?? current.second_reading_reference,
    gospel_acclamation_reference: snapshot.gospel_acclamation_reference ?? current.gospel_acclamation_reference,
    gospel_reference: snapshot.gospel_reference ?? current.gospel_reference,
    reflection: snapshot.reflection ?? current.reflection,
    prayer: snapshot.prayer ?? current.prayer,
    meditation_questions: snapshot.meditation_questions ?? current.meditation_questions,
    daily_challenge: snapshot.daily_challenge ?? current.daily_challenge,
    language_id: snapshot.language_id ?? current.language_id,
    status: snapshot.status ?? current.status,
    visibility: snapshot.visibility ?? current.visibility,
    source_attribution: snapshot.source_attribution ?? current.source_attribution,
    editorial_notes: snapshot.editorial_notes ?? current.editorial_notes,
  };
}

export function buildDailyReadingCoverage(readings: CmsDailyReading[], year: number): DailyReadingCoverage {
  const byDate = new Map(readings.filter((reading) => reading.reading_date.startsWith(String(year)) && reading.status !== "archived").map((reading) => [reading.reading_date, reading]));
  const missingDates: string[] = [];
  const missingPublishedDates: string[] = [];
  const incompleteDates: string[] = [];
  const incompletePublishedDates: string[] = [];

  for (let day = 0; day < daysInYear(year); day += 1) {
    const date = new Date(Date.UTC(year, 0, 1 + day)).toISOString().slice(0, 10);
    const reading = byDate.get(date);
    if (!reading) {
      missingDates.push(date);
      missingPublishedDates.push(date);
      continue;
    }
    if (!reading.first_reading_reference || !reading.responsorial_psalm_reference || !reading.gospel_reference) {
      incompleteDates.push(date);
    }
    if (!["published", "featured"].includes(reading.status)) {
      missingPublishedDates.push(date);
    } else if (!reading.first_reading_reference || !reading.responsorial_psalm_reference || !reading.gospel_reference) {
      incompletePublishedDates.push(date);
    }
  }

  const values = Array.from(byDate.values());
  const published = values.filter((reading) => ["published", "featured"].includes(reading.status));
  const complete = values.filter((reading) => reading.first_reading_reference && reading.responsorial_psalm_reference && reading.gospel_reference);
  const enriched = values.filter((reading) => reading.reflection || reading.prayer || reading.meditation_questions || reading.daily_challenge);
  const publishedComplete = published.filter((reading) => reading.first_reading_reference && reading.responsorial_psalm_reference && reading.gospel_reference);
  const publishedEnriched = published.filter((reading) => reading.reflection || reading.prayer || reading.meditation_questions || reading.daily_challenge);
  const totalDays = daysInYear(year);

  return {
    year,
    totalDays,
    languageKey: "all",
    datasetReadings: byDate.size,
    draftReadings: values.filter((reading) => reading.status === "draft").length,
    reviewReadings: values.filter((reading) => reading.status === "review").length,
    publishedReadings: published.length,
    archivedReadings: readings.filter((reading) => reading.reading_date.startsWith(String(year)) && reading.status === "archived").length,
    completeLiturgicalReadings: complete.length,
    publishedCompleteLiturgicalReadings: publishedComplete.length,
    enrichedReadings: enriched.length,
    publishedEnrichedReadings: publishedEnriched.length,
    datasetCoveragePercent: percent(byDate.size, totalDays),
    publishedCoveragePercent: percent(published.length, totalDays),
    liturgicalCompletenessPercent: percent(complete.length, totalDays),
    editorialEnrichmentPercent: percent(enriched.length, totalDays),
    missingDates,
    missingPublishedDates,
    incompleteDates,
    incompletePublishedDates,
  };
}

export function buildDailyReadingCoverageFromRows(rows: CmsDailyReadingImportRow[], reference: DailyReadingReferenceLookup, year: number): DailyReadingCoverage {
  const readings = rows
    .map((row) => importDailyReadingRowToDraft(row, reference))
    .filter((draft) => draft.reading_date.startsWith(String(year)))
    .map((draft) => ({
      ...draft,
      created_by: null,
      updated_by: null,
      created_at: "",
      updated_at: "",
      language: reference.languages.find((language) => language.id === draft.language_id) ?? null,
    })) as CmsDailyReading[];

  return buildDailyReadingCoverage(readings, year);
}

export function buildDailyReadingDryRunReport(input: {
  rows: CmsDailyReadingImportRow[];
  reference: DailyReadingReferenceLookup;
  existingReadings?: CmsDailyReading[];
  metadata: DailyReadingImportBatchMetadata;
  conflictStrategy?: DailyReadingConflictStrategy;
  range?: DailyReadingDateRange;
  books?: BibleReferenceBook[];
}): DailyReadingDryRunReport {
  const rowsInRange = filterDailyReadingRowsByDateRange(input.rows, input.range);
  const validation = validateDailyReadingImportRows(rowsInRange, input.reference, input.existingReadings ?? [], input.books);
  const year = input.metadata.sourceYear || Number(dateKey(rowsInRange[0]?.date ?? "").slice(0, 4)) || new Date().getFullYear();
  return {
    metadata: input.metadata,
    rows: input.rows,
    rowsInRange,
    validation,
    coverage: buildDailyReadingCoverageFromRows(rowsInRange, input.reference, year),
    conflictStrategy: input.conflictStrategy ?? "create_draft_revision",
    dryRun: true,
  };
}

export function summarizeDailyReadingImportBatch(input: {
  validation: CmsDailyReadingImportValidation;
  importedRows?: number;
  skippedRows?: number;
  updatedRows?: number;
  status?: DailyReadingImportBatchSummary["status"];
}): DailyReadingImportBatchSummary {
  const rowsWithWarnings = new Set(input.validation.issues.filter((issue) => issue.severity === "warning").map((issue) => issue.rowNumber));
  const rowsWithInformation = new Set(input.validation.issues.filter((issue) => issue.severity === "information").map((issue) => issue.rowNumber));
  return {
    ...input.validation.summary,
    warningRows: rowsWithWarnings.size,
    informationRows: rowsWithInformation.size,
    importedRows: input.importedRows ?? 0,
    skippedRows: input.skippedRows ?? 0,
    updatedRows: input.updatedRows ?? 0,
    status: input.status ?? (input.validation.hasErrors ? "Validation Failed" : "Ready for Import"),
  } as DailyReadingImportBatchSummary;
}

export function validateDailyReadingPublicationSafety(readings: CmsDailyReading[], range: Required<DailyReadingDateRange>, targetStatus: "review" | "published" | "featured" = "published"): DailyReadingPublicationSafetyResult {
  const issues: CmsDailyReadingImportIssue[] = [];
  const targetDates: string[] = [];
  const byDate = new Map(readings.map((reading) => [reading.reading_date, reading]));

  for (let cursor = new Date(`${range.from}T00:00:00Z`); cursor <= new Date(`${range.to}T00:00:00Z`); cursor.setUTCDate(cursor.getUTCDate() + 1)) {
    const day = cursor.toISOString().slice(0, 10);
    targetDates.push(day);
    const reading = byDate.get(day);
    if (!reading) {
      issues.push({ rowNumber: 0, date: day, field: "Date", severity: "error", message: "Required date is missing for the requested publication range.", suggestedAction: "Import or create this reading before publishing.", code: "missing_publication_date" });
      continue;
    }
    if (!reading.first_reading_reference) issues.push({ rowNumber: 0, date: day, field: "First Reading", severity: "error", message: "First reading is required before publication.", code: "publish_missing_first_reading" });
    if (!reading.responsorial_psalm_reference) issues.push({ rowNumber: 0, date: day, field: "Psalm", severity: "error", message: "Psalm is required before publication.", code: "publish_missing_psalm" });
    if (!reading.gospel_reference) issues.push({ rowNumber: 0, date: day, field: "Gospel", severity: "error", message: "Gospel is required before publication.", code: "publish_missing_gospel" });
    if (!DAILY_READING_STATUSES.includes(reading.status as never)) issues.push({ rowNumber: 0, date: day, field: "Status", severity: "error", message: "Current lifecycle state is invalid.", code: "publish_invalid_status" });
    if (targetStatus !== "review" && reading.status === "archived") issues.push({ rowNumber: 0, date: day, field: "Status", severity: "error", message: "Archived readings cannot be bulk published.", code: "publish_archived_record" });
    if (!DAILY_READING_VISIBILITIES.includes(reading.visibility as never)) issues.push({ rowNumber: 0, date: day, field: "Visibility", severity: "error", message: "Visibility is invalid.", code: "publish_invalid_visibility" });
  }

  return { allowed: issues.length === 0, issues, targetDates };
}

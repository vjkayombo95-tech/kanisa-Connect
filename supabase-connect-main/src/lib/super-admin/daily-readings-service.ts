import { supabase } from "@/integrations/supabase/client";
import {
  DAILY_READING_STATUSES,
  DAILY_READING_VISIBILITIES,
  buildDailyReadingCoverage,
  buildDailyReadingDryRunReport,
  buildDailyReadingRestoreDraft,
  filterMemberDailyReadings,
  filterDailyReadingRowsByDateRange,
  importDailyReadingRowToDraft,
  summarizeDailyReadingImportBatch,
  validateDailyReadingImportRows,
  validateDailyReadingPublicationSafety,
  type CmsDailyReading,
  type CmsDailyReadingImportRow,
  type CmsDailyReadingImportValidation,
  type DailyReadingConflictStrategy,
  type DailyReadingCoverage,
  type DailyReadingDateRange,
  type DailyReadingEditorDraft,
  type DailyReadingDryRunReport,
  type DailyReadingImportBatchMetadata,
  type DailyReadingImportBatchSummary,
  type DailyReadingPublicationSafetyResult,
} from "@/lib/catholic-cms/daily-readings-engine";
import type { ContentLanguage } from "@/lib/super-admin/prayer-library-service";
import { preferLocalizedContent } from "@/lib/localization";

export type ReadingDraft = DailyReadingEditorDraft;

export type CmsDailyReadingVersion = {
  id: string;
  content_type: "daily_reading";
  content_id: string;
  version_number: number;
  snapshot: CmsDailyReading;
  created_by: string | null;
  created_at: string;
};

export type DailyReadingsReferenceData = {
  languages: ContentLanguage[];
};

export type DailyReadingsDashboardStats = {
  total: number;
  published: number;
  review: number;
  drafts: number;
  archived: number;
  coverage: DailyReadingCoverage;
  recentlyUpdated: CmsDailyReading[];
};

export type DailyReadingImportBatchStatus =
  | "Uploaded"
  | "Validating"
  | "Validation Failed"
  | "Ready for Import"
  | "Imported"
  | "Partially Imported"
  | "Cancelled";

export type DailyReadingImportBatch = {
  id: string;
  content_type: "daily_reading";
  filename: string;
  source_organization: string | null;
  source_publication: string | null;
  source_year: number | null;
  source_edition: string | null;
  date_obtained: string | null;
  language_id: string | null;
  notes: string | null;
  imported_by: string | null;
  imported_at: string | null;
  total_rows: number;
  valid_rows: number;
  warning_rows: number;
  invalid_rows: number;
  information_rows: number;
  imported_rows: number;
  skipped_rows: number;
  updated_rows: number;
  status: DailyReadingImportBatchStatus;
  validation_summary: unknown | null;
  conflict_strategy: DailyReadingConflictStrategy;
  created_at: string;
  updated_at: string;
  language?: Pick<ContentLanguage, "id" | "code" | "name" | "native_name"> | null;
};

const DAILY_READING_SELECT = `
  *,
  language:content_languages(id,code,name,native_name)
`;

const IMPORT_BATCH_SELECT = `
  *,
  language:content_languages(id,code,name,native_name)
`;

function normalizeText(value: string | null | undefined) {
  return (value ?? "").replace(/\s+/g, " ").trim();
}

function draftId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `draft-${Date.now()}`;
}

export async function fetchDailyReadingsReferenceData(): Promise<DailyReadingsReferenceData> {
  const { data, error } = await supabase
    .from("content_languages" as never)
    .select("*")
    .order("is_default", { ascending: false })
    .order("name", { ascending: true });

  if (error) throw error;
  return { languages: (data ?? []) as unknown as ContentLanguage[] };
}

export function createEmptyReadingDraft(reference?: DailyReadingsReferenceData): ReadingDraft {
  const defaultLanguage = reference?.languages.find((language) => language.is_default) ?? reference?.languages[0] ?? null;
  return {
    id: draftId(),
    reading_date: new Date().toISOString().slice(0, 10),
    liturgical_year: "",
    liturgical_season: "",
    celebration: "",
    liturgical_color: "",
    first_reading_reference: "",
    responsorial_psalm_reference: "",
    second_reading_reference: null,
    gospel_acclamation_reference: null,
    gospel_reference: "",
    reflection: null,
    prayer: null,
    meditation_questions: null,
    daily_challenge: null,
    language_id: defaultLanguage?.id ?? null,
    status: "draft",
    visibility: "member",
    source_attribution: null,
    editorial_notes: null,
    import_batch_id: null,
  };
}

export async function fetchCmsDailyReadings(limit = 1200): Promise<CmsDailyReading[]> {
  const { data, error } = await supabase
    .from("content_daily_readings" as never)
    .select(DAILY_READING_SELECT)
    .order("reading_date", { ascending: false })
    .limit(limit);

  if (error) throw error;
  return (data ?? []) as unknown as CmsDailyReading[];
}

export async function fetchDailyReadingDrafts() {
  return fetchCmsDailyReadings();
}

export function readingToEditorDraft(reading: CmsDailyReading): ReadingDraft {
  return {
    id: reading.id,
    reading_date: reading.reading_date,
    liturgical_year: reading.liturgical_year,
    liturgical_season: reading.liturgical_season,
    celebration: reading.celebration,
    liturgical_color: reading.liturgical_color,
    first_reading_reference: reading.first_reading_reference,
    responsorial_psalm_reference: reading.responsorial_psalm_reference,
    second_reading_reference: reading.second_reading_reference,
    gospel_acclamation_reference: reading.gospel_acclamation_reference,
    gospel_reference: reading.gospel_reference,
    reflection: reading.reflection,
    prayer: reading.prayer,
    meditation_questions: reading.meditation_questions,
    daily_challenge: reading.daily_challenge,
    language_id: reading.language_id,
    status: reading.status,
    visibility: reading.visibility,
    source_attribution: reading.source_attribution,
    editorial_notes: reading.editorial_notes,
    import_batch_id: reading.import_batch_id ?? null,
  };
}

async function existingDailyReading(id: string) {
  if (!id || id.startsWith("draft-")) return null;
  const { data, error } = await supabase.from("content_daily_readings" as never).select("id").eq("id", id).maybeSingle();
  if (error) throw error;
  return data as unknown as { id: string } | null;
}

export async function saveDailyReadingDraft(draft: ReadingDraft): Promise<CmsDailyReading> {
  const existing = await existingDailyReading(draft.id);
  const userId = (await supabase.auth.getUser()).data.user?.id ?? null;
  const payload = {
    reading_date: draft.reading_date,
    liturgical_year: normalizeText(draft.liturgical_year),
    liturgical_season: normalizeText(draft.liturgical_season),
    celebration: normalizeText(draft.celebration),
    liturgical_color: normalizeText(draft.liturgical_color),
    first_reading_reference: normalizeText(draft.first_reading_reference),
    responsorial_psalm_reference: normalizeText(draft.responsorial_psalm_reference),
    second_reading_reference: normalizeText(draft.second_reading_reference) || null,
    gospel_acclamation_reference: normalizeText(draft.gospel_acclamation_reference) || null,
    gospel_reference: normalizeText(draft.gospel_reference),
    reflection: normalizeText(draft.reflection) || null,
    prayer: normalizeText(draft.prayer) || null,
    meditation_questions: normalizeText(draft.meditation_questions) || null,
    daily_challenge: normalizeText(draft.daily_challenge) || null,
    language_id: draft.language_id || null,
    status: draft.status,
    visibility: draft.visibility,
    source_attribution: normalizeText(draft.source_attribution) || null,
    editorial_notes: normalizeText(draft.editorial_notes) || null,
    import_batch_id: draft.import_batch_id || null,
    updated_by: userId,
  };

  const query = existing
    ? supabase.from("content_daily_readings" as never).update(payload as never).eq("id", draft.id).select(DAILY_READING_SELECT).single()
    : supabase
        .from("content_daily_readings" as never)
        .insert({ ...payload, created_by: userId } as never)
        .select(DAILY_READING_SELECT)
        .single();

  const { data, error } = await query;
  if (error) throw error;
  return data as unknown as CmsDailyReading;
}

export async function deleteDailyReadingDraft(id: string) {
  const { error } = await supabase.from("content_daily_readings" as never).delete().eq("id", id);
  if (error) throw error;
}

export async function fetchCmsDailyReadingByDate(date: string, languageCode?: string): Promise<CmsDailyReading | null> {
  const query = supabase.from("content_daily_readings" as never).select(DAILY_READING_SELECT).eq("reading_date", date);
  const { data, error } = await query.order("updated_at", { ascending: false }).limit(5);
  if (error) throw error;
  const readings = (data ?? []) as unknown as CmsDailyReading[];
  return (languageCode ? readings.find((reading) => reading.language?.code === languageCode) : readings[0]) ?? null;
}

export async function fetchMemberCmsDailyReadingByDate(date: string, languageCode?: string): Promise<CmsDailyReading | null> {
  const { data, error } = await supabase
    .from("content_daily_readings" as never)
    .select(DAILY_READING_SELECT)
    .eq("reading_date", date)
    .in("status", ["published", "featured"] as never)
    .in("visibility", ["public", "member"] as never)
    .order("updated_at", { ascending: false })
    .limit(10);

  if (error) throw error;
  const readings = filterMemberDailyReadings((data ?? []) as unknown as CmsDailyReading[]);
  if (languageCode === "en" || languageCode === "sw") {
    return preferLocalizedContent(readings, languageCode, (reading) => reading.language?.code).item;
  }

  return readings[0] ?? null;
}

export async function searchPublishedDailyReadings(query: string, limit = 12): Promise<CmsDailyReading[]> {
  const readings = await fetchCmsDailyReadings(500);
  return filterMemberDailyReadings(readings, { search: query }).slice(0, limit);
}

export async function fetchDailyReadingVersions(readingId: string): Promise<CmsDailyReadingVersion[]> {
  const { data, error } = await supabase
    .from("content_versions" as never)
    .select("*")
    .eq("content_type", "daily_reading")
    .eq("content_id", readingId)
    .order("version_number", { ascending: false });

  if (error) throw error;
  return (data ?? []) as unknown as CmsDailyReadingVersion[];
}

export async function restoreDailyReadingVersion(current: CmsDailyReading, version: CmsDailyReadingVersion) {
  return saveDailyReadingDraft(buildDailyReadingRestoreDraft(current, version.snapshot));
}

export async function validateDailyReadingImport(rows: CmsDailyReadingImportRow[], range: DailyReadingDateRange = {}): Promise<CmsDailyReadingImportValidation> {
  const [reference, existing] = await Promise.all([fetchDailyReadingsReferenceData(), fetchCmsDailyReadings()]);
  return validateDailyReadingImportRows(rows, reference, existing, undefined, range);
}

export async function dryRunDailyReadingImport(input: {
  rows: CmsDailyReadingImportRow[];
  metadata: DailyReadingImportBatchMetadata;
  conflictStrategy?: DailyReadingConflictStrategy;
  range?: DailyReadingDateRange;
}): Promise<DailyReadingDryRunReport> {
  const [reference, existing] = await Promise.all([fetchDailyReadingsReferenceData(), fetchCmsDailyReadings()]);
  return buildDailyReadingDryRunReport({
    rows: input.rows,
    reference,
    existingReadings: existing,
    metadata: input.metadata,
    conflictStrategy: input.conflictStrategy,
    range: input.range,
  });
}

function languageIdFromMetadata(reference: DailyReadingsReferenceData, metadata: DailyReadingImportBatchMetadata) {
  const language = metadata.language
    ? reference.languages.find((item) => [item.id, item.code, item.name, item.native_name].filter(Boolean).some((value) => String(value).toLowerCase() === metadata.language?.toLowerCase()))
    : reference.languages.find((item) => item.is_default) ?? reference.languages[0] ?? null;
  return language?.id ?? null;
}

export async function createDailyReadingImportBatch(input: {
  metadata: DailyReadingImportBatchMetadata;
  validation: CmsDailyReadingImportValidation;
  conflictStrategy: DailyReadingConflictStrategy;
  status?: DailyReadingImportBatchStatus;
}): Promise<DailyReadingImportBatch> {
  const reference = await fetchDailyReadingsReferenceData();
  const userId = (await supabase.auth.getUser()).data.user?.id ?? null;
  const summary = summarizeDailyReadingImportBatch({
    validation: input.validation,
    status: input.status ?? (input.validation.hasErrors ? "Validation Failed" : "Ready for Import"),
  });

  const { data, error } = await supabase
    .from("content_import_batches" as never)
    .insert({
      content_type: "daily_reading",
      filename: input.metadata.filename,
      source_organization: normalizeText(input.metadata.sourceOrganization) || null,
      source_publication: normalizeText(input.metadata.sourcePublication) || null,
      source_year: input.metadata.sourceYear || null,
      source_edition: normalizeText(input.metadata.sourceEdition) || null,
      date_obtained: normalizeText(input.metadata.dateObtained) || null,
      language_id: languageIdFromMetadata(reference, input.metadata),
      notes: normalizeText(input.metadata.notes) || null,
      imported_by: userId,
      total_rows: summary.totalRows,
      valid_rows: summary.validRows,
      warning_rows: summary.warningRows,
      invalid_rows: summary.errorCount,
      information_rows: summary.informationRows,
      imported_rows: 0,
      skipped_rows: 0,
      updated_rows: 0,
      status: summary.status,
      validation_summary: summary,
      conflict_strategy: input.conflictStrategy,
    } as never)
    .select(IMPORT_BATCH_SELECT)
    .single();

  if (error) throw error;
  return data as unknown as DailyReadingImportBatch;
}

export async function fetchDailyReadingImportBatches(limit = 20): Promise<DailyReadingImportBatch[]> {
  const { data, error } = await supabase
    .from("content_import_batches" as never)
    .select(IMPORT_BATCH_SELECT)
    .eq("content_type", "daily_reading")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw error;
  return (data ?? []) as unknown as DailyReadingImportBatch[];
}

async function updateDailyReadingImportBatch(id: string, patch: Partial<DailyReadingImportBatch>) {
  const { data, error } = await supabase
    .from("content_import_batches" as never)
    .update(patch as never)
    .eq("id", id)
    .select(IMPORT_BATCH_SELECT)
    .single();

  if (error) throw error;
  return data as unknown as DailyReadingImportBatch;
}

export async function importDailyReadingRows(input: {
  rows: CmsDailyReadingImportRow[];
  metadata: DailyReadingImportBatchMetadata;
  conflictStrategy?: DailyReadingConflictStrategy;
  range?: DailyReadingDateRange;
  batchId?: string;
}) {
  const conflictStrategy = input.conflictStrategy ?? "create_draft_revision";
  const rowsInRange = filterDailyReadingRowsByDateRange(input.rows, input.range);
  const [reference, existing] = await Promise.all([fetchDailyReadingsReferenceData(), fetchCmsDailyReadings()]);
  const validation = validateDailyReadingImportRows(rowsInRange, reference, existing, undefined, input.range);
  if (validation.hasErrors) throw new Error("Fix import validation errors before confirming import.");

  const existingByDateAndLanguage = new Map(existing.map((reading) => [`${reading.reading_date}:${reading.language?.code ?? reading.language_id ?? "default"}`, reading]));
  const imported: CmsDailyReading[] = [];
  let skippedRows = 0;
  let updatedRows = 0;
  let batch = input.batchId
    ? null
    : await createDailyReadingImportBatch({ metadata: input.metadata, validation, conflictStrategy, status: "Ready for Import" });
  const batchId = input.batchId ?? batch?.id ?? null;

  for (const row of validation.validRows) {
    const draft = importDailyReadingRowToDraft(row, reference);
    const language = reference.languages.find((item) => item.id === draft.language_id);
    const existingReading = existingByDateAndLanguage.get(`${draft.reading_date}:${language?.code ?? draft.language_id ?? "default"}`);
    if (existingReading && conflictStrategy === "skip_existing") {
      skippedRows += 1;
      continue;
    }

    const shouldUpdateExisting = Boolean(existingReading && (conflictStrategy === "update_existing" || conflictStrategy === "create_draft_revision"));
    const draftToSave: ReadingDraft = {
      ...draft,
      id: shouldUpdateExisting && existingReading ? existingReading.id : draft.id,
      status: existingReading && conflictStrategy === "create_draft_revision" ? "draft" : draft.status,
      editorial_notes: [
        draft.editorial_notes,
        existingReading && conflictStrategy === "create_draft_revision" ? `Draft revision created from import for existing reading ${existingReading.id}.` : null,
      ].filter(Boolean).join(" "),
      import_batch_id: batchId,
    };

    imported.push(await saveDailyReadingDraft(draftToSave));
    if (shouldUpdateExisting) updatedRows += 1;
  }

  const finalStatus: DailyReadingImportBatchStatus = imported.length && skippedRows ? "Partially Imported" : "Imported";
  if (batchId) {
    batch = await updateDailyReadingImportBatch(batchId, {
      imported_at: new Date().toISOString(),
      imported_rows: imported.length,
      skipped_rows: skippedRows,
      updated_rows: updatedRows,
      status: finalStatus,
      validation_summary: summarizeDailyReadingImportBatch({ validation, importedRows: imported.length, skippedRows, updatedRows, status: finalStatus }),
    } as Partial<DailyReadingImportBatch>);
  }

  return { imported, skippedRows, updatedRows, validation, batch };
}

export async function fetchDailyReadingCoverageStats(year = new Date().getFullYear()): Promise<DailyReadingCoverage> {
  const readings = await fetchCmsDailyReadings(2000);
  return buildDailyReadingCoverage(readings, year);
}

export async function fetchDailyReadingsDashboardStats(year = new Date().getFullYear()): Promise<DailyReadingsDashboardStats> {
  const readings = await fetchCmsDailyReadings(2000);
  const coverage = buildDailyReadingCoverage(readings, year);

  return {
    total: readings.length,
    published: readings.filter((reading) => ["published", "featured"].includes(reading.status)).length,
    review: readings.filter((reading) => reading.status === "review").length,
    drafts: readings.filter((reading) => reading.status === "draft").length,
    archived: readings.filter((reading) => reading.status === "archived").length,
    coverage,
    recentlyUpdated: [...readings].sort((left, right) => right.updated_at.localeCompare(left.updated_at)).slice(0, 6),
  };
}

export async function validateDailyReadingPublicationRange(range: Required<DailyReadingDateRange>): Promise<DailyReadingPublicationSafetyResult> {
  const readings = await fetchCmsDailyReadings(2000);
  return validateDailyReadingPublicationSafety(readings, range);
}

export async function publishDailyReadingDateRange(input: { range: Required<DailyReadingDateRange>; status: "review" | "published" | "featured" }) {
  const safety = await validateDailyReadingPublicationRange(input.range);
  if (!safety.allowed) {
    throw new Error("Daily readings in this date range are not safe to publish. Review validation issues first.");
  }

  const { data, error } = await supabase
    .from("content_daily_readings" as never)
    .update({ status: input.status } as never)
    .gte("reading_date", input.range.from)
    .lte("reading_date", input.range.to)
    .select(DAILY_READING_SELECT);

  if (error) throw error;
  return { readings: (data ?? []) as unknown as CmsDailyReading[], safety };
}

export { DAILY_READING_STATUSES, DAILY_READING_VISIBILITIES, type CmsDailyReading, type CmsDailyReadingImportRow, type CmsDailyReadingImportValidation, type DailyReadingConflictStrategy, type DailyReadingCoverage, type DailyReadingDateRange, type DailyReadingDryRunReport, type DailyReadingEditorDraft, type DailyReadingImportBatchMetadata };

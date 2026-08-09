import * as XLSX from "xlsx";

import { supabase } from "@/integrations/supabase/client";
import { appEnvironment, supabaseProjectRef } from "@/lib/environment";
import {
  APPROVED_STAGING_PROJECT_REF,
  PRAYER_WORKBOOK_HEADERS,
  buildPrayerImportPlan,
  cellText,
  safeDryRunReport,
  validateWorkbookHeaders,
  type PrayerCatalogRecord,
  type PrayerImportPlan,
  type PrayerReferenceData,
  type PrayerWorkbookRow,
} from "../../../scripts/prayer-library/prayer-import-core";

export const PRAYER_IMPORT_CONFIRMATION = "IMPORT_PRAYERS_TO_STAGING_AS_DRAFT";

export type ParsedPrayerWorkbook = {
  rows: PrayerWorkbookRow[];
  filename: string;
  size: number;
  checksum: string;
};

export type PrayerImportPreviewRow = {
  rowNumber: number;
  prayerCode: string;
  title: string;
  language: string;
  action: "update" | "unchanged" | "missing" | "invalid";
  currentState: string;
  incomingState: string;
  validationStatus: "valid" | "invalid";
  notes: string;
};

export type PrayerImportDryRun = {
  parsed: ParsedPrayerWorkbook;
  plan: PrayerImportPlan;
  report: ReturnType<typeof safeDryRunReport>;
  preview: PrayerImportPreviewRow[];
  validRows: number;
  invalidRows: number;
  missingRecords: number;
  warnings: number;
};

export type PrayerImportResult = {
  batchId: string;
  updated: number;
  skipped: number;
  unchanged: number;
  failed: number;
  status: string;
  initiatedByUserUuid: string;
  initiatedByEmail: string | null;
  initiatedByDisplayName: string | null;
  executedBy: "service_role";
};

export type PrayerImportHistoryRecord = {
  id: string;
  filename: string;
  checksum: string;
  environment: string;
  initiatedByUserUuid: string | null;
  initiatedByEmail: string | null;
  initiatedByDisplayName: string | null;
  executedBy: string;
  startedAt: string;
  completedAt: string | null;
  status: string;
  updated: number;
  skipped: number;
  failed: number;
};

export function assertPrayerImporterStagingEnvironment() {
  if (appEnvironment !== "staging") throw new Error(`Prayer imports require VITE_APP_ENV=staging; received ${appEnvironment}.`);
  if (supabaseProjectRef !== APPROVED_STAGING_PROJECT_REF) throw new Error("Prayer importer is not connected to the approved staging project.");
}

async function sha256(buffer: ArrayBuffer) {
  const digest = await crypto.subtle.digest("SHA-256", buffer);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function parsePrayerWorkbook(file: Pick<File, "name" | "size" | "arrayBuffer">): Promise<ParsedPrayerWorkbook> {
  if (!file.name.toLowerCase().endsWith(".xlsx")) throw new Error("Only .xlsx Prayer Library workbooks are supported.");
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: "array", cellDates: false });
  const sheet = workbook.Sheets.Prayers;
  if (!sheet) throw new Error('Workbook must contain a sheet named "Prayers".');
  const matrix = XLSX.utils.sheet_to_json<Array<string | number | boolean>>(sheet, { header: 1, defval: "", raw: false });
  const headers = (matrix[0] ?? []).map(cellText);
  const { missing, forbidden } = validateWorkbookHeaders(headers);
  if (missing.length) throw new Error(`Prayers sheet is missing required headers: ${missing.join(", ")}.`);
  if (forbidden.length) throw new Error(`Ownership/system columns are forbidden: ${forbidden.join(", ")}.`);
  const rows = matrix.slice(1).map((values, index) => {
    const row = { __rowNumber: index + 2 } as PrayerWorkbookRow;
    PRAYER_WORKBOOK_HEADERS.forEach((header) => { row[header] = values[headers.indexOf(header)] ?? ""; });
    return row;
  }).filter((row) => PRAYER_WORKBOOK_HEADERS.some((header) => cellText(row[header])));
  if (!rows.length) throw new Error("Prayers sheet contains no import rows.");
  return { rows, filename: file.name, size: file.size, checksum: await sha256(buffer) };
}

export async function fetchPrayerImportCatalog() {
  const [prayers, categories, languages] = await Promise.all([
    supabase.from("content_prayers" as never).select("*").order("sort_order", { ascending: true }).limit(1000),
    supabase.from("content_categories" as never).select("id,name,slug").order("sort_order", { ascending: true }),
    supabase.from("content_languages" as never).select("id,code,name").order("code", { ascending: true }),
  ]);
  if (prayers.error) throw prayers.error;
  if (categories.error) throw categories.error;
  if (languages.error) throw languages.error;
  return {
    catalog: (prayers.data ?? []) as unknown as PrayerCatalogRecord[],
    reference: { categories: categories.data ?? [], languages: languages.data ?? [] } as unknown as PrayerReferenceData,
  };
}

export async function runPrayerWorkbookDryRun(file: File): Promise<PrayerImportDryRun> {
  assertPrayerImporterStagingEnvironment();
  const parsed = await parsePrayerWorkbook(file);
  const { catalog, reference } = await fetchPrayerImportCatalog();
  const plan = buildPrayerImportPlan(parsed.rows, catalog, reference, { forceDraft: true });
  const errorsByRow = new Map<number, string[]>();
  plan.errors.forEach((error) => errorsByRow.set(error.rowNumber, [...(errorsByRow.get(error.rowNumber) ?? []), error.message]));
  const changesByRow = new Map(plan.changes.map((change) => [change.rowNumber, change]));
  const byCode = new Map(catalog.map((record) => [cellText(record.prayer_code).toLowerCase(), record]));
  const preview = parsed.rows.map((row): PrayerImportPreviewRow => {
    const record = byCode.get(cellText(row["Prayer Code"]).toLowerCase());
    const rowErrors = errorsByRow.get(row.__rowNumber) ?? [];
    const change = changesByRow.get(row.__rowNumber);
    return {
      rowNumber: row.__rowNumber,
      prayerCode: cellText(row["Prayer Code"]), title: cellText(row.Title), language: cellText(row.Language),
      action: rowErrors.length ? (record ? "invalid" : "missing") : change ? "update" : "unchanged",
      currentState: record ? `${record.status}; ${record.body ? "body present" : "blank body"}` : "not found",
      incomingState: `draft; ${cellText(row["Prayer Body"]) ? "body supplied" : "blank body"}`,
      validationStatus: rowErrors.length ? "invalid" : "valid",
      notes: rowErrors.join(" ") || (change?.changedFields.join(", ") ?? "No changes"),
    };
  });
  const invalidRows = new Set(plan.errors.map((error) => error.rowNumber)).size;
  return { parsed, plan, report: safeDryRunReport(plan), preview, validRows: parsed.rows.length - invalidRows, invalidRows, missingRecords: plan.errors.filter((error) => error.code.startsWith("unknown_")).length, warnings: 0 };
}

function buildRpcChanges(dryRun: PrayerImportDryRun, catalog: PrayerCatalogRecord[]) {
  const byId = new Map(catalog.map((record) => [record.id, record]));
  return dryRun.plan.changes.map((change) => {
    const original = byId.get(change.recordId);
    if (!original?.updated_at) throw new Error(`Missing concurrency timestamp for ${change.prayerCode}.`);
    const patch: Record<string, unknown> = {};
    for (const changedField of change.changedFields) {
      const field = changedField.split(".")[0] as keyof PrayerCatalogRecord;
      patch[field] = change.next[field];
    }
    return { recordId: change.recordId, prayerCode: change.prayerCode, expectedUpdatedAt: original.updated_at, patch };
  });
}

export async function applyApprovedPrayerImport(dryRun: PrayerImportDryRun, confirmation: string) {
  assertPrayerImporterStagingEnvironment();
  if (confirmation !== PRAYER_IMPORT_CONFIRMATION) throw new Error("Enter the exact staging confirmation before import.");
  if (dryRun.plan.errors.length) throw new Error("Import is blocked while validation errors exist.");
  if (!dryRun.plan.changes.length) throw new Error("The workbook contains no changes to import.");
  const { catalog } = await fetchPrayerImportCatalog();
  const { data, error } = await supabase.functions.invoke("prayer-import", {
    body: {
      filename: dryRun.parsed.filename,
      workbookChecksum: dryRun.parsed.checksum,
      changes: buildRpcChanges(dryRun, catalog),
      confirmation,
    },
  });
  if (error) throw error;
  return data as PrayerImportResult;
}

export async function fetchPrayerImportHistory(limit = 20) {
  const { data, error } = await supabase.from("content_import_batches" as never)
    .select("id,filename,initiated_by_user_uuid,initiated_by_email,initiated_by_display_name,executed_by,created_at,imported_at,status,updated_rows,skipped_rows,invalid_rows,validation_summary")
    .eq("content_type", "prayer")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return ((data ?? []) as unknown as Array<Record<string, unknown>>).map((item): PrayerImportHistoryRecord => {
    const validation = (item.validation_summary ?? {}) as Record<string, unknown>;
    return {
      id: String(item.id),
      filename: String(item.filename),
      checksum: String(validation.workbook_checksum ?? ""),
      environment: String(validation.environment ?? "unknown"),
      initiatedByUserUuid: item.initiated_by_user_uuid ? String(item.initiated_by_user_uuid) : null,
      initiatedByEmail: item.initiated_by_email ? String(item.initiated_by_email) : null,
      initiatedByDisplayName: item.initiated_by_display_name ? String(item.initiated_by_display_name) : null,
      executedBy: String(item.executed_by ?? "unknown"),
      startedAt: String(item.created_at),
      completedAt: item.imported_at ? String(item.imported_at) : null,
      status: String(item.status),
      updated: Number(item.updated_rows ?? 0),
      skipped: Number(item.skipped_rows ?? 0),
      failed: Number(item.invalid_rows ?? 0),
    };
  });
}

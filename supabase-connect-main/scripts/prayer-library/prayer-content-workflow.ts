import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import XLSX from "xlsx";

import {
  PRAYER_WORKBOOK_HEADERS,
  assertApprovedStagingRef,
  assertStagingImportConfirmation,
  buildPrayerImportPlan,
  cellText,
  safeDryRunReport,
  validateWorkbookHeaders,
  type PrayerCatalogRecord,
  type PrayerReferenceData,
  type PrayerWorkbookRow,
} from "./prayer-import-core.ts";

const DEFAULT_WORKBOOK = ".tmp/catholic-prayer-content-import-template.xlsx";
const DEFAULT_REPORT_JSON = ".tmp/prayer-import-dry-run-report.json";
const DEFAULT_REPORT_MD = ".tmp/prayer-import-dry-run-report.md";
const scriptDir = path.dirname(fileURLToPath(import.meta.url));

type ApiContext = { ref: string; root: string; serviceKey: string };

function argument(name: string, fallback?: string) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : fallback;
}

function hasFlag(name: string) {
  return process.argv.includes(name);
}

function maskedRef(ref: string) {
  return `${ref.slice(0, 4)}...${ref.slice(-4)}`;
}

function delay(milliseconds: number) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function stagingContext(): Promise<ApiContext> {
  const ref = (await readFile("supabase/.temp/project-ref", "utf8")).trim();
  assertApprovedStagingRef(ref);

  let raw = "";
  let lastError: unknown;
  for (let attempt = 1; attempt <= 4 && !raw; attempt += 1) {
    try {
      raw = execFileSync("supabase", ["projects", "api-keys", "--project-ref", ref, "--output", "json"], {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
      });
    } catch (error) {
      lastError = error;
      if (attempt < 4) await delay(1_500);
    }
  }
  if (!raw) throw lastError instanceof Error ? lastError : new Error("Supabase API key lookup failed after retries.");
  const keys = JSON.parse(raw) as Array<{ name: string; api_key: string }>;
  const serviceKey = keys.find((key) => key.name === "service_role")?.api_key;
  if (!serviceKey) throw new Error("Staging service credential was not returned by the Supabase CLI.");
  console.log(`Staging target confirmed: ${maskedRef(ref)}`);
  return { ref, root: `https://${ref}.supabase.co`, serviceKey };
}

async function rest<T>(context: ApiContext, endpoint: string, init: RequestInit = {}): Promise<T> {
  const method = (init.method ?? "GET").toUpperCase();
  let lastError: unknown;
  for (let attempt = 1; attempt <= (method === "GET" ? 4 : 1); attempt += 1) {
    try {
      const response = await fetch(`${context.root}/rest/v1/${endpoint}`, {
        ...init,
        headers: {
          apikey: context.serviceKey,
          Authorization: `Bearer ${context.serviceKey}`,
          ...(init.body ? { "Content-Type": "application/json" } : {}),
          ...(init.headers ?? {}),
        },
      });
      if (!response.ok) throw new Error(`Staging REST ${response.status}: ${await response.text()}`);
      const text = await response.text();
      return (text ? JSON.parse(text) : null) as T;
    } catch (error) {
      lastError = error;
      if (attempt < (method === "GET" ? 4 : 1)) await delay(1_500);
    }
  }
  throw lastError instanceof Error ? lastError : new Error("Staging REST request failed.");
}

async function fetchCatalog(context: ApiContext) {
  const query = new URLSearchParams({
    select: "id,prayer_code,slug,title,parent_prayer_id,prayer_type,category_id,language_id,sort_order,summary,body,status,visibility,featured,recommended_time,scripture_reference,liturgical_season,audio_url,author,source,source_title,source_type,source_organization,source_reference,source_url,source_notes,copyright_holder,copyright_notice,license_type,license_reference,content_edition,content_version_label,ecclesial_approval_status,ecclesial_approval_authority,ecclesial_approval_reference,reviewed_by,reviewed_at,translation_group_id,translation_key,metadata,is_global,church_id,created_by,updated_by,created_at,updated_at",
    order: "sort_order.asc,title.asc",
  });
  query.set("metadata->>seeded_title_only", "eq.true");
  const catalog = await rest<PrayerCatalogRecord[]>(context, `content_prayers?${query}`);
  const [categories, languages] = await Promise.all([
    rest<PrayerReferenceData["categories"]>(context, "content_categories?select=id,name,slug&order=sort_order.asc,name.asc"),
    rest<PrayerReferenceData["languages"]>(context, "content_languages?select=id,code,name&order=code.asc"),
  ]);
  if (catalog.length !== 55) throw new Error(`Expected 55 seeded Prayer Library records on staging; found ${catalog.length}.`);
  return { catalog, reference: { categories, languages } satisfies PrayerReferenceData };
}

function workbookRows(catalog: PrayerCatalogRecord[], reference: PrayerReferenceData): PrayerWorkbookRow[] {
  const byId = new Map(catalog.map((record) => [record.id, record]));
  const categories = new Map(reference.categories.map((item) => [item.id, item]));
  const languages = new Map(reference.languages.map((item) => [item.id, item]));
  return catalog.map((record, index) => {
    const parent = record.parent_prayer_id ? byId.get(record.parent_prayer_id) : null;
    const category = record.category_id ? categories.get(record.category_id) : null;
    const language = record.language_id ? languages.get(record.language_id) : null;
    return {
      __rowNumber: index + 2,
      "Prayer Code": record.prayer_code ?? "",
      Slug: record.slug,
      Title: record.title,
      "Parent Prayer Code": parent?.prayer_code ?? "",
      "Parent Title": parent?.title ?? "",
      "Prayer Type": record.prayer_type,
      Category: category?.name ?? "",
      "Category Slug": category?.slug ?? "",
      "Sort Order": record.sort_order,
      Language: language?.code ?? "sw",
      "Translation Key": record.translation_key ?? "",
      "Translation Group ID": record.translation_group_id,
      Summary: record.summary ?? "",
      "Prayer Body": "",
      Status: "draft",
      Visibility: record.visibility || "member",
      Featured: false,
      "Recommended Time": record.recommended_time ?? "",
      "Scripture Reference": record.scripture_reference ?? "",
      "Liturgical Season": record.liturgical_season ?? "",
      "Audio URL": record.audio_url ?? "",
      Author: record.author ?? "",
      Source: record.source ?? "",
      "Content Edition": record.content_edition ?? "",
      "Content Version": record.content_version_label ?? "",
      "Source Type": record.source_type ?? "",
      "Source Title": record.source_title ?? "",
      "Source Organization": record.source_organization ?? "",
      "Source Reference": record.source_reference ?? "",
      "Source URL": record.source_url ?? "",
      "Source Notes": record.source_notes ?? "",
      "Copyright Holder": record.copyright_holder ?? "",
      "Copyright Notice": record.copyright_notice ?? "",
      "License Type": record.license_type ?? "",
      "License Reference": record.license_reference ?? "",
      "Reviewed By": record.reviewed_by ?? "",
      "Review Date": record.reviewed_at ?? "",
      "Ecclesial Approval Status": record.ecclesial_approval_status || "pending",
      "Ecclesial Approval Authority": record.ecclesial_approval_authority ?? "",
      "Ecclesial Approval Reference": record.ecclesial_approval_reference ?? "",
      "Import Notes": cellText(record.metadata?.import_notes),
    };
  });
}

async function exportWorkbook(context: ApiContext, output: string) {
  const { catalog, reference } = await fetchCatalog(context);
  const rows = workbookRows(catalog, reference);
  const byId = new Map(catalog.map((record) => [record.id, record]));
  const payload = {
    headers: PRAYER_WORKBOOK_HEADERS,
    prayers: rows.map(({ __rowNumber: _row, ...row }) => row),
    categories: reference.categories.filter((category) => catalog.some((record) => record.category_id === category.id)),
    collections: catalog
      .filter((record) => record.parent_prayer_id)
      .map((record) => ({
        parentPrayerCode: byId.get(record.parent_prayer_id!)?.prayer_code ?? "",
        parentTitle: byId.get(record.parent_prayer_id!)?.title ?? "",
        childPrayerCode: record.prayer_code ?? "",
        childTitle: record.title,
        childType: record.prayer_type,
        sortOrder: record.sort_order,
      })),
  };
  await mkdir(path.dirname(output), { recursive: true });
  const jsonPath = path.join(path.dirname(output), "prayer-content-template-data.json");
  await writeFile(jsonPath, JSON.stringify(payload, null, 2), "utf8");
  execFileSync("python", [path.join(scriptDir, "write-prayer-workbook.py"), "--input", jsonPath, "--output", output], { stdio: "inherit" });
  console.log(`Workbook generated: ${output}`);
  console.log(`Exported prayer rows: ${rows.length}; categories: ${payload.categories.length}; collection children: ${payload.collections.length}`);
}

async function backupPrayerSchemaAndData(context: ApiContext) {
  const [openApi, prayers, versions, importBatches] = await Promise.all([
    rest<Record<string, unknown>>(context, ""),
    rest<unknown[]>(context, "content_prayers?select=*&order=id.asc"),
    rest<unknown[]>(context, "content_versions?select=*&content_type=eq.prayer&order=content_id.asc,version_number.asc"),
    rest<unknown[]>(context, "content_import_batches?select=*&content_type=eq.prayer&order=created_at.asc"),
  ]);
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const output = `.tmp/prayer-provenance-staging-backup-${timestamp}.json`;
  await mkdir(path.dirname(output), { recursive: true });
  await writeFile(output, JSON.stringify({ stagingRef: maskedRef(context.ref), capturedAt: new Date().toISOString(), schema: openApi, content_prayers: prayers, content_versions: versions, content_import_batches: importBatches }, null, 2), "utf8");
  console.log(`Prayer schema/data backup written: ${output}; prayers: ${prayers.length}; versions: ${versions.length}; import batches: ${importBatches.length}`);
}

async function sha256(filename: string) {
  return createHash("sha256").update(await readFile(filename)).digest("hex").toUpperCase();
}

function readWorkbookRows(filename: string): PrayerWorkbookRow[] {
  const workbook = XLSX.readFile(filename, { cellDates: false });
  if (!workbook.Sheets.Prayers) throw new Error('Workbook must contain a sheet named "Prayers".');
  const matrix = XLSX.utils.sheet_to_json<Array<string | number | boolean>>(workbook.Sheets.Prayers, { header: 1, defval: "", raw: false });
  const headers = (matrix[0] ?? []).map(cellText);
  const { missing, forbidden } = validateWorkbookHeaders(headers);
  if (missing.length) throw new Error(`Prayers sheet is missing required headers: ${missing.join(", ")}.`);
  if (forbidden.length) throw new Error(`Ownership/system columns are forbidden: ${forbidden.join(", ")}.`);
  return matrix.slice(1).map((values, index) => {
    const row = { __rowNumber: index + 2 } as PrayerWorkbookRow;
    PRAYER_WORKBOOK_HEADERS.forEach((header) => { row[header] = values[headers.indexOf(header)] ?? ""; });
    return row;
  }).filter((row) => PRAYER_WORKBOOK_HEADERS.some((header) => cellText(row[header])));
}

function markdownReport(report: ReturnType<typeof safeDryRunReport>) {
  const lines = [
    "# Prayer Library import dry run", "",
    `- Workbook rows: ${report.totalWorkbookRows}`,
    `- Matched records: ${report.matchedRecords}`,
    `- Unchanged records: ${report.unchangedRecords}`,
    `- Records that would update: ${report.recordsThatWouldUpdate}`,
    `- Bodies that would update: ${report.bodiesThatWouldUpdate}`,
    `- Summaries that would update: ${report.summariesThatWouldUpdate}`,
    `- Status changes: ${report.statusChanges}`,
    `- Records that would publish: ${report.recordsThatWouldPublish}`,
    `- Validation failures: ${report.validationFailures}`,
    `- Duplicate identifiers: ${report.duplicateIdentifiers}`,
    `- Unknown identifiers: ${report.unknownIdentifiers}`,
    `- Parent/child validation errors: ${report.parentChildValidationErrors}`,
    `- Provenance field updates: ${report.provenanceFieldUpdates}`,
    `- License validation failures: ${report.licenseValidationFailures}`,
    `- Translation-group validation failures: ${report.translationGroupValidationFailures}`,
    `- Content-version-label changes: ${report.contentVersionLabelChanges}`,
    `- Approval changes: ${report.approvalChanges}`,
    `- Source changes: ${report.sourceChanges}`,
    `- Copyright changes: ${report.copyrightChanges}`,
    `- Potential publication blockers: ${report.potentialPublicationBlockers}`,
    `- Version records that would be created: ${report.versionRecordsThatWouldBeCreated}`,
    `- Force draft mode: ${report.forceDraft ? "enabled" : "disabled"}`, "",
  ];
  if (report.errors.length) {
    lines.push("## Validation errors", "", "| Row | Prayer Code | Title | Field | Error |", "|---:|---|---|---|---|");
    report.errors.forEach((error) => lines.push(`| ${error.rowNumber} | ${error.prayerCode} | ${error.title} | ${error.field} | ${error.message.replace(/\|/g, "\\|")} |`));
  } else lines.push("No validation errors.");
  return `${lines.join("\n")}\n`;
}

async function dryRun(context: ApiContext, workbookPath: string, allowReviewedPublish = false) {
  const rows = readWorkbookRows(workbookPath);
  const { catalog, reference } = await fetchCatalog(context);
  const plan = buildPrayerImportPlan(rows, catalog, reference, { forceDraft: !allowReviewedPublish, allowReviewedPublish });
  const report = safeDryRunReport(plan);
  await mkdir(".tmp", { recursive: true });
  await Promise.all([
    writeFile(DEFAULT_REPORT_JSON, JSON.stringify(report, null, 2), "utf8"),
    writeFile(DEFAULT_REPORT_MD, markdownReport(report), "utf8"),
  ]);
  console.log(`Dry run complete: ${report.matchedRecords} matched, ${report.recordsThatWouldUpdate} updates, ${report.validationFailures} validation failures.`);
  console.log(`Reports: ${DEFAULT_REPORT_JSON}, ${DEFAULT_REPORT_MD}`);
  return { plan, catalog, reference };
}

function updatePayload(change: { changedFields: string[]; next: PrayerCatalogRecord }, record: PrayerCatalogRecord) {
  const payload: Record<string, unknown> = {};
  for (const changedField of change.changedFields) {
    const field = changedField.split(".")[0] as keyof PrayerCatalogRecord;
    if (field === "metadata") payload.metadata = record.metadata;
    else payload[field] = record[field];
  }
  return payload;
}

async function applyStagingImport(context: ApiContext, workbookPath: string) {
  assertStagingImportConfirmation(process.argv);
  const checksumBeforePlan = await sha256(workbookPath);
  const allowReviewedPublish = hasFlag("--allow-reviewed-publish");
  const { plan, catalog } = await dryRun(context, workbookPath, allowReviewedPublish);
  const checksumBeforeWrite = await sha256(workbookPath);
  if (checksumBeforeWrite !== checksumBeforePlan) throw new Error("Workbook changed during validation; staging import refused.");
  if (plan.errors.length) throw new Error("Import refused because validation errors exist. Review the dry-run reports.");
  if (!plan.changes.length) { console.log("No database changes are required."); return; }
  if (!allowReviewedPublish && plan.changes.some((change) => change.next.status !== "draft")) throw new Error("First import must keep every changed prayer in draft status.");

  const affected = new Set(plan.changes.map((change) => change.recordId));
  const versionsQuery = new URLSearchParams({ select: "*", content_type: "eq.prayer", content_id: `in.(${[...affected].join(",")})` });
  const versions = await rest<unknown[]>(context, `content_versions?${versionsQuery}`);
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const backupPath = `.tmp/prayer-import-backup-${timestamp}.json`;
  await writeFile(backupPath, JSON.stringify({ prayers: catalog.filter((record) => affected.has(record.id)), versions }, null, 2), "utf8");
  console.log(`Affected staging rows and versions backed up: ${backupPath}`);

  const originalById = new Map(catalog.map((record) => [record.id, record]));
  const changes = plan.changes.map((change) => {
    const original = originalById.get(change.recordId)!;
    return {
      recordId: change.recordId,
      prayerCode: change.prayerCode,
      expectedUpdatedAt: original.updated_at,
      patch: updatePayload(change, change.next),
    };
  });
  const transaction = await rest<{ batchId: string; updated: number; skipped: number; unchanged: number; failed: number; status: string; forcedStatus: string; importedBy?: string }>(context, "rpc/apply_staging_prayer_import", {
    method: "POST",
    body: JSON.stringify({
      _filename: path.basename(workbookPath),
      _workbook_checksum: checksumBeforeWrite,
      _changes: changes,
      _confirmation: "IMPORT_PRAYERS_TO_STAGING_AS_DRAFT",
    }),
  });
  if (transaction.updated !== plan.changes.length || transaction.failed !== 0 || transaction.status !== "Imported" || transaction.forcedStatus !== "draft") {
    throw new Error(`Transactional import returned an unexpected result: ${JSON.stringify(transaction)}`);
  }
  const postReport = { appliedAt: new Date().toISOString(), stagingRef: maskedRef(context.ref), workbookChecksum: checksumBeforeWrite, updatedRows: transaction.updated, unchangedRows: plan.unchangedRecords, forceDraft: !allowReviewedPublish, backupPath, transaction };
  const postPath = `.tmp/prayer-import-post-import-report-${timestamp}.json`;
  await writeFile(postPath, JSON.stringify(postReport, null, 2), "utf8");
  console.log(`Staging import transaction complete. Batch: ${transaction.batchId}; post-import report: ${postPath}`);
}

async function main() {
  const command = process.argv[2];
  if (!command || !["backup", "export", "dry-run", "import"].includes(command)) {
    throw new Error("Usage: prayer-content-workflow.ts <backup|export|dry-run|import> [--workbook path] [--confirm-staging-import] [--allow-reviewed-publish]");
  }
  const context = await stagingContext();
  const workbookPath = argument("--workbook", DEFAULT_WORKBOOK)!;
  if (command === "backup") await backupPrayerSchemaAndData(context);
  if (command === "export") await exportWorkbook(context, argument("--output", DEFAULT_WORKBOOK)!);
  if (command === "dry-run") await dryRun(context, workbookPath, hasFlag("--allow-reviewed-publish"));
  if (command === "import") await applyStagingImport(context, workbookPath);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});

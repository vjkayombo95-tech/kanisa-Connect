import { mkdir } from "node:fs/promises";
import path from "node:path";
import XLSX from "xlsx";

import { loadHtmlFixture } from "../../fixtures/loader.ts";
import type { CanonicalDailyReading } from "../../models/daily-readings.ts";
import { normalizeDailyReading } from "../../normalizers/daily-reading-normalizer.ts";
import { parseReadingHtml } from "../../parsers/html-parser.ts";
import {
  liturgicalWorkbookSchema,
  validationLists,
  type ValidationList,
  type WorkbookWorksheet,
} from "./workbook-schema.ts";

export type WorkbookWriteResult = {
  outputPath: string;
  rowsWritten: number;
  worksheetsWritten: number;
};

export type GenerateWorkbookOptions = {
  output?: string;
};

const DEFAULT_WORKBOOK_OUTPUT = "reports/liturgy/liturgical-calendar.xlsx";

export async function generateWorkbook(options: GenerateWorkbookOptions = {}): Promise<WorkbookWriteResult> {
  const html = await loadHtmlFixture("usccb-2026-01-01.html");
  const reading = normalizeDailyReading(parseReadingHtml(html, new Date("2026-01-01T00:00:00.000Z")));
  return writeLiturgicalWorkbook([reading], options.output ?? DEFAULT_WORKBOOK_OUTPUT);
}

export async function writeLiturgicalWorkbook(
  readings: CanonicalDailyReading[],
  outputPath: string,
): Promise<WorkbookWriteResult> {
  await mkdir(path.dirname(outputPath), { recursive: true });

  const workbook = XLSX.utils.book_new();

  for (const worksheetSchema of liturgicalWorkbookSchema) {
    XLSX.utils.book_append_sheet(workbook, buildWorksheet(worksheetSchema, readings), worksheetSchema.name);
  }

  XLSX.utils.book_append_sheet(workbook, buildValidationWorksheet(validationLists), "Validation Lists");
  XLSX.writeFile(workbook, outputPath, { bookType: "xlsx", compression: true });

  return {
    outputPath,
    rowsWritten: readings.length,
    worksheetsWritten: liturgicalWorkbookSchema.length + 1,
  };
}

function buildWorksheet(schema: WorkbookWorksheet, readings: CanonicalDailyReading[]): XLSX.WorkSheet {
  const rows = [
    schema.columns.map((column) => column.header),
    ...readings.map((reading) => schema.columns.map((column) => column.extractor(reading) ?? "")),
  ];
  const worksheet = XLSX.utils.aoa_to_sheet(rows);

  worksheet["!cols"] = schema.columns.map((column) => ({ wch: column.width }));
  worksheet["!autofilter"] = { ref: XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: rows.length - 1, c: schema.columns.length - 1 } }) };
  worksheet["!freeze"] = { xSplit: 0, ySplit: 1, topLeftCell: "A2", activePane: "bottomLeft", state: "frozen" };

  return worksheet;
}

function buildValidationWorksheet(lists: ValidationList[]): XLSX.WorkSheet {
  const maxRows = Math.max(...lists.map((list) => list.values.length));
  const rows = [
    lists.map((list) => list.name),
    ...Array.from({ length: maxRows }, (_, rowIndex) => lists.map((list) => list.values[rowIndex] ?? "")),
  ];
  const worksheet = XLSX.utils.aoa_to_sheet(rows);

  worksheet["!cols"] = lists.map((list) => ({ wch: Math.max(18, list.name.length + 2) }));
  worksheet["!autofilter"] = { ref: XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: rows.length - 1, c: lists.length - 1 } }) };
  worksheet["!freeze"] = { xSplit: 0, ySplit: 1, topLeftCell: "A2", activePane: "bottomLeft", state: "frozen" };

  return worksheet;
}

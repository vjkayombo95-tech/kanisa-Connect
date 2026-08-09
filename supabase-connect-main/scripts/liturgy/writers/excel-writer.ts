import type { CanonicalDailyReading } from "../models/daily-readings.ts";
import { writeLiturgicalWorkbook } from "../export/excel/workbook-writer.ts";

export type ExcelWriteResult = {
  outputPath: string;
  rowsWritten: number;
  worksheetsWritten: number;
};

export async function writeDailyReadingsWorkbook(
  readings: CanonicalDailyReading[],
  outputPath: string,
): Promise<ExcelWriteResult> {
  return writeLiturgicalWorkbook(readings, outputPath);
}

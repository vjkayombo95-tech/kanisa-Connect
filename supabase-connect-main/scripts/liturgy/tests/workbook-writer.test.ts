import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";
import XLSX from "xlsx";

import { loadHtmlFixture } from "../fixtures/loader.ts";
import { normalizeDailyReading } from "../normalizers/daily-reading-normalizer.ts";
import { parseReadingHtml } from "../parsers/html-parser.ts";
import { writeLiturgicalWorkbook } from "../export/excel/workbook-writer.ts";

test("generates a schema-driven liturgical workbook from fixture data", async () => {
  const tempDir = await mkdtemp(path.join(tmpdir(), "kanisa-liturgy-"));
  const outputPath = path.join(tempDir, "liturgical-calendar.xlsx");

  try {
    const html = await loadHtmlFixture("usccb-2026-01-01.html");
    const reading = normalizeDailyReading(parseReadingHtml(html, new Date("2026-01-01T00:00:00.000Z")));
    const result = await writeLiturgicalWorkbook([reading], outputPath);
    const workbook = XLSX.readFile(outputPath);

    assert.equal(result.rowsWritten, 1);
    assert.equal(result.worksheetsWritten, 3);
    assert.deepEqual(workbook.SheetNames, ["Liturgical Calendar", "Daily Readings", "Validation Lists"]);

    const calendarRows = XLSX.utils.sheet_to_json<string[]>(workbook.Sheets["Liturgical Calendar"], { header: 1 });
    const readingRows = XLSX.utils.sheet_to_json<string[]>(workbook.Sheets["Daily Readings"], { header: 1 });
    const validationRows = XLSX.utils.sheet_to_json<string[]>(workbook.Sheets["Validation Lists"], { header: 1 });

    assert.deepEqual(calendarRows[0], [
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
    ]);
    assert.equal(calendarRows[1][0], "2026-01-01");
    assert.equal(calendarRows[1][1], "Solemnity of the Blessed Virgin Mary, the Mother of God");
    assert.equal(calendarRows[1][10], "18");

    assert.deepEqual(readingRows[0], [
      "Date",
      "Celebration",
      "First Reading Reference",
      "Responsorial Psalm Reference",
      "Psalm Response",
      "Second Reading Reference",
      "Gospel Acclamation",
      "Gospel Reference",
    ]);
    assert.equal(readingRows[1][2], "Numbers 6:22-27");
    assert.equal(readingRows[1][7], "Luke 2:16-21");

    assert.deepEqual(validationRows[0], [
      "Liturgical Years",
      "Weekday Cycles",
      "Liturgical Colors",
      "Ranks",
      "Boolean",
    ]);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

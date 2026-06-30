import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";

import { loadHtmlFixture } from "../fixtures/loader.ts";
import { readLiturgicalWorkbook } from "../import/workbook-reader.ts";
import { normalizeDailyReading } from "../normalizers/daily-reading-normalizer.ts";
import { parseReadingHtml } from "../parsers/html-parser.ts";
import { writeLiturgicalWorkbook } from "../export/excel/workbook-writer.ts";

test("reads generated liturgical workbook rows into canonical models", async () => {
  const tempDir = await mkdtemp(path.join(tmpdir(), "kanisa-liturgy-import-"));
  const outputPath = path.join(tempDir, "liturgical-calendar.xlsx");

  try {
    const html = await loadHtmlFixture("usccb-2026-01-01.html");
    const reading = normalizeDailyReading(parseReadingHtml(html, new Date("2026-01-01T00:00:00.000Z")));
    await writeLiturgicalWorkbook([reading], outputPath);

    const result = readLiturgicalWorkbook(outputPath);

    assert.deepEqual(result.errors, []);
    assert.equal(result.readings.length, 1);
    assert.equal(result.readings[0].liturgicalDay.date, "2026-01-01");
    assert.equal(result.readings[0].dailyReadings.firstReadingReference, "Numbers 6:22-27");
    assert.equal(result.readings[0].dailyReadings.gospelReference, "Luke 2:16-21");
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

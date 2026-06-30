import assert from "node:assert/strict";
import { test } from "node:test";

import { loadHtmlFixture } from "../fixtures/loader.ts";
import { normalizeDailyReading } from "../normalizers/daily-reading-normalizer.ts";
import { parseReadingHtml } from "../parsers/html-parser.ts";
import { validateCanonicalDailyReading } from "../validation/daily-reading-validator.ts";

test("parses USCCB daily reading references into canonical liturgical models", async () => {
  const html = await loadHtmlFixture("usccb-2026-01-01.html");
  const rawReading = parseReadingHtml(html, new Date("2026-01-01T00:00:00.000Z"));
  const entry = normalizeDailyReading(rawReading);
  const validation = validateCanonicalDailyReading(entry);

  assert.equal(validation.valid, true);
  assert.equal(entry.liturgicalDay.date, "2026-01-01");
  assert.equal(entry.liturgicalDay.celebration, "Solemnity of the Blessed Virgin Mary, the Mother of God");
  assert.equal(entry.liturgicalDay.lectionaryNumber, "18");
  assert.equal(entry.dailyReadings.firstReadingReference, "Numbers 6:22-27");
  assert.equal(entry.dailyReadings.responsorialPsalmReference, "Psalm 67:2-3, 5, 6, 8");
  assert.equal(entry.dailyReadings.psalmResponse, "May God bless us in his mercy.");
  assert.equal(entry.dailyReadings.secondReadingReference, "Galatians 4:4-7");
  assert.equal(entry.dailyReadings.gospelAcclamation, "Alleluia, alleluia.");
  assert.equal(entry.dailyReadings.gospelReference, "Luke 2:16-21");
});

test("handles missing second reading gracefully", () => {
  const html = `
    <h1>Tuesday of the First Week in Ordinary Time</h1>
    <p>Lectionary: 306</p>
    <h2>Reading I</h2>
    <p>1 Samuel 1:9-20</p>
    <h2>Responsorial Psalm</h2>
    <p>1 Samuel 2:1, 4-5, 6-7, 8abcd</p>
    <p>R. My heart exults in the Lord, my Savior.</p>
    <h2>Alleluia</h2>
    <p>1 Thessalonians 2:13</p>
    <p>R. Alleluia, alleluia.</p>
    <h2>Gospel</h2>
    <p>Mark 1:21-28</p>
  `;

  const rawReading = parseReadingHtml(html, new Date("2026-01-13T00:00:00.000Z"));
  const entry = normalizeDailyReading(rawReading);
  const validation = validateCanonicalDailyReading(entry);

  assert.equal(validation.valid, true);
  assert.equal(entry.dailyReadings.secondReadingReference, null);
  assert.equal(entry.dailyReadings.gospelReference, "Mark 1:21-28");
});

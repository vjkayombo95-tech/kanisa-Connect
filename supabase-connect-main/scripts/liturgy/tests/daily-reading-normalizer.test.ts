import assert from "node:assert/strict";
import { test } from "node:test";

import type { RawReading } from "../models/daily-reading.ts";
import {
  normalizeDailyReading,
  normalizeScriptureReference,
  toDailyReadingCompatibility,
} from "../normalizers/daily-reading-normalizer.ts";
import { validateCanonicalDailyReading, validateDailyReading } from "../validation/daily-reading-validator.ts";

test("normalizes common USCCB Scripture reference formats", () => {
  assert.equal(normalizeScriptureReference(" Nm 6:22\u201327 "), "Numbers 6:22-27");
  assert.equal(normalizeScriptureReference("Ps 67:2\u20133, 5, 6, 8"), "Psalm 67:2-3, 5, 6, 8");
  assert.equal(normalizeScriptureReference("Gal 4:4\u20147"), "Galatians 4:4-7");
  assert.equal(normalizeScriptureReference("Lk 2:16\u201121"), "Luke 2:16-21");
  assert.equal(normalizeScriptureReference("1 Sm 2:1, 4\u20135, 6\u20137, 8abcd"), "1 Samuel 2:1, 4-5, 6-7, 8abcd");
});

test("normalizes RawReading into canonical liturgical models before validation", () => {
  const rawReading: RawReading = {
    date: " 2026-01-01 ",
    celebration: " Solemnity  of Mary ",
    liturgicalSeason: "",
    liturgicalWeek: "",
    liturgicalYear: " c ",
    weekdayCycle: "2",
    liturgicalColor: " White ",
    rank: "Solemnity",
    holyDayOfObligation: "yes",
    saint: " Mary, Mother of God ",
    firstReadingReference: " Nm 6:22\u201327 ",
    responsorialPsalmReference: " Ps 67:2\u20133, 5, 6, 8 ",
    psalmResponse: " May God  bless us in his mercy. ",
    secondReadingReference: " ",
    gospelAcclamation: "",
    gospelReference: " Lk 2:16\u201421 ",
    lectionaryNumber: " 18 ",
    notes: "",
  };

  const entry = normalizeDailyReading(rawReading);
  const validation = validateCanonicalDailyReading(entry);
  const compatibleReading = toDailyReadingCompatibility(entry);

  assert.equal(validation.valid, true);
  assert.equal(entry.liturgicalDay.celebration, "Solemnity of Mary");
  assert.equal(entry.liturgicalDay.liturgicalYear, "C");
  assert.equal(entry.liturgicalDay.weekdayCycle, "II");
  assert.equal(entry.liturgicalDay.liturgicalColor, "white");
  assert.equal(entry.liturgicalDay.rank, "solemnity");
  assert.equal(entry.liturgicalDay.holyDayOfObligation, true);
  assert.equal(entry.liturgicalDay.saint, "Mary, Mother of God");
  assert.equal(entry.dailyReadings.firstReadingReference, "Numbers 6:22-27");
  assert.equal(entry.dailyReadings.secondReadingReference, null);
  assert.equal(entry.dailyReadings.gospelAcclamation, null);
  assert.equal(entry.dailyReadings.gospelReference, "Luke 2:16-21");
  assert.equal(entry.liturgicalDay.notes, null);
  assert.equal(validateDailyReading(compatibleReading).valid, true);
});

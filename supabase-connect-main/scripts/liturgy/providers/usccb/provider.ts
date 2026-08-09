import type { CanonicalDailyReading } from "../../models/daily-readings.ts";
import { normalizeDailyReading } from "../../normalizers/daily-reading-normalizer.ts";
import { parseReadingHtml } from "../../parsers/html-parser.ts";
import { validateCanonicalDailyReading } from "../../validation/daily-reading-validator.ts";
import { fetchDayHtml } from "./fetch-day.ts";
import type { ReadingProvider } from "../reading-provider.ts";

export class USCCBProvider implements ReadingProvider {
  async getReading(date: Date): Promise<CanonicalDailyReading> {
    const { html } = await fetchDayHtml(date);
    const rawReading = parseReadingHtml(html, date);
    const reading = normalizeDailyReading(rawReading);
    validateCanonicalDailyReading(reading);
    return reading;
  }
}

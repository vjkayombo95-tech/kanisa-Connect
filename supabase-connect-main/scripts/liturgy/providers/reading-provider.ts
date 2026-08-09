import type { CanonicalDailyReading } from "../models/daily-readings.ts";

export interface ReadingProvider {
  getReading(date: Date): Promise<CanonicalDailyReading>;
}

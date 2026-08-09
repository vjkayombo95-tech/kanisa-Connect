import type { LiturgicalDay } from "./liturgical-day.ts";

export interface DailyReadings {
  firstReadingReference: string;
  responsorialPsalmReference: string;
  psalmResponse: string;
  secondReadingReference: string | null;
  gospelAcclamation: string | null;
  gospelReference: string;
}

export interface CanonicalDailyReading {
  liturgicalDay: LiturgicalDay;
  dailyReadings: DailyReadings;
}

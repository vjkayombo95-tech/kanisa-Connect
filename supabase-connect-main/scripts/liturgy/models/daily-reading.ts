import type { DailyReadings } from "./daily-readings.ts";
import type {
  LiturgicalColor,
  LiturgicalDay,
  LiturgicalRank,
  LiturgicalYear,
  WeekdayCycle,
} from "./liturgical-day.ts";

export type { LiturgicalColor, LiturgicalDay, LiturgicalRank, LiturgicalYear, WeekdayCycle };

export type DailyReading = Omit<LiturgicalDay, "season" | "week" | "holyDayOfObligation" | "saint"> &
  DailyReadings & {
    liturgicalSeason: string;
    liturgicalWeek: string;
  };

export interface RawReading {
  date: string;
  celebration: string;
  liturgicalSeason: string;
  liturgicalWeek: string;
  liturgicalYear: string;
  weekdayCycle: string;
  liturgicalColor: string;
  rank: string;
  holyDayOfObligation: boolean | string | null;
  saint: string | null;
  firstReadingReference: string;
  responsorialPsalmReference: string;
  psalmResponse: string;
  secondReadingReference: string | null;
  gospelAcclamation: string | null;
  gospelReference: string;
  lectionaryNumber: string;
  notes: string | null;
}

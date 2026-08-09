export type LiturgicalYear = "A" | "B" | "C";

export type WeekdayCycle = "I" | "II";

export type LiturgicalColor = "green" | "purple" | "white" | "red" | "rose" | "gold";

export type LiturgicalRank =
  | "weekday"
  | "optional_memorial"
  | "memorial"
  | "feast"
  | "solemnity"
  | "sunday"
  | "holy_day";

export interface LiturgicalDay {
  date: string;
  celebration: string;
  season: string;
  week: string;
  liturgicalYear: LiturgicalYear;
  weekdayCycle: WeekdayCycle;
  liturgicalColor: LiturgicalColor;
  rank: LiturgicalRank;
  holyDayOfObligation: boolean;
  saint: string | null;
  lectionaryNumber: string;
  notes: string | null;
}

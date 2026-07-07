import { supabase } from "@/integrations/supabase/client";

export type LiturgicalDayRow = {
  id: string;
  date: string;
  celebration: string;
  season: string;
  liturgical_color: string;
  rank: string;
  daily_readings: DailyReadingRow[] | null;
};

export type DailyReadingRow = {
  id: string;
  liturgical_day_id: string;
  first_reading_reference: string;
  responsorial_psalm_reference: string;
  psalm_response: string;
  second_reading_reference: string | null;
  gospel_acclamation: string | null;
  gospel_reference: string;
  reflection?: string | null;
  prayer?: string | null;
};

export type BibleBookRow = {
  id: string;
  book_number: number;
  name: string;
  abbreviation: string | null;
};

export type TodayLiturgicalReadings = {
  day: LiturgicalDayRow | null;
  books: BibleBookRow[];
};

export function getTodayDateKey() {
  return new Date().toLocaleDateString("en-CA");
}

export function formatLiturgicalDate(date: string) {
  return new Intl.DateTimeFormat("en-TZ", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(new Date(`${date}T12:00:00`));
}

export function getTodayLiturgicalReadingsQueryKey(date: string) {
  return ["live-daily-readings", date] as const;
}

export async function fetchTodayLiturgicalReadings(date: string): Promise<TodayLiturgicalReadings> {
  const [dayResult, booksResult] = await Promise.all([
    supabase
      .from("liturgical_days" as never)
      .select(
        "id,date,celebration,season,liturgical_color,rank,daily_readings(id,liturgical_day_id,first_reading_reference,responsorial_psalm_reference,psalm_response,second_reading_reference,gospel_acclamation,gospel_reference,reflection,prayer)",
      )
      .eq("date", date)
      .maybeSingle(),
    supabase
      .from("bible_books" as never)
      .select("id,book_number,name,abbreviation"),
  ]);

  if (dayResult.error) throw dayResult.error;
  if (booksResult.error) throw booksResult.error;

  return {
    day: dayResult.data as unknown as LiturgicalDayRow | null,
    books: (booksResult.data ?? []) as unknown as BibleBookRow[],
  };
}

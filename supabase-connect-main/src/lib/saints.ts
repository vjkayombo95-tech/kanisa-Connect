import { supabase } from "@/integrations/supabase/client";
import { SAINT_SELECT, type LibrarySaint } from "@/lib/catholic-library";

export type LiturgicalSaintDay = {
  id: string;
  date: string;
  celebration: string;
  saint: string | null;
};

export type SaintOfDayResult = {
  liturgicalDay: LiturgicalSaintDay | null;
  saint: LibrarySaint | null;
};

export function getSaintOfDayQueryKey(date: string) {
  return ["saint-of-day", date] as const;
}

function normalizeLookupText(value: string | null | undefined) {
  return (value ?? "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/\b(?:saint|saints|st)\.?\b/g, " ")
    .replace(/\b(?:solemnity|feast|memorial|optional memorial|of|the)\b/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function scoreSaintForLiturgicalDay(saint: LibrarySaint, liturgicalDay: LiturgicalSaintDay) {
  const sourceText = normalizeLookupText([liturgicalDay.saint, liturgicalDay.celebration].filter(Boolean).join(" "));
  if (!sourceText) return 0;

  const saintName = normalizeLookupText(saint.name);
  const saintTitle = normalizeLookupText(saint.title);
  const searchableSaint = [saintName, saintTitle].filter(Boolean).join(" ");

  if (!saintName) return 0;
  if (sourceText === saintName) return 100;
  if (sourceText.includes(saintName)) return 80;
  if (searchableSaint && sourceText.includes(searchableSaint)) return 70;
  if (saintTitle && sourceText.includes(saintTitle)) return 45;

  const saintWords = saintName.split(" ").filter((word) => word.length > 2);
  const matchingWords = saintWords.filter((word) => sourceText.includes(word)).length;

  return matchingWords >= Math.min(2, saintWords.length) ? 20 + matchingWords : 0;
}

export async function fetchSaintOfDayFromLiturgy(date: string): Promise<SaintOfDayResult> {
  const [dayResult, saintsResult] = await Promise.all([
    supabase
      .from("liturgical_days" as never)
      .select("id,date,celebration,saint")
      .eq("date", date)
      .maybeSingle(),
    supabase
      .from("saints" as never)
      .select(SAINT_SELECT)
      .eq("is_active", true)
      .order("is_featured", { ascending: false })
      .order("name", { ascending: true })
      .limit(500),
  ]);

  if (dayResult.error) throw dayResult.error;
  if (saintsResult.error) throw saintsResult.error;

  const liturgicalDay = dayResult.data as unknown as LiturgicalSaintDay | null;
  const saints = (saintsResult.data ?? []) as unknown as LibrarySaint[];

  if (!liturgicalDay || saints.length === 0) {
    return { liturgicalDay, saint: null };
  }

  const [bestMatch] = saints
    .map((saint) => ({ saint, score: scoreSaintForLiturgicalDay(saint, liturgicalDay) }))
    .filter((entry) => entry.score > 0)
    .sort((left, right) => right.score - left.score || left.saint.name.localeCompare(right.saint.name));

  return {
    liturgicalDay,
    saint: bestMatch?.saint ?? null,
  };
}

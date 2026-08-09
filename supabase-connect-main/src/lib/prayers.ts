import { fetchTodayLiturgicalReadings, getTodayDateKey, type TodayLiturgicalReadings } from "@/lib/liturgy";
import { fetchMemberCmsPrayerByIdOrSlug } from "@/lib/catholic-cms";

export type TodayPrayer = {
  id: string;
  title: string;
  text: string;
  source: "liturgical" | "default";
};

const DEFAULT_MORNING_PRAYER: TodayPrayer = {
  id: "morning-offering",
  title: "Morning Offering",
  text:
    "O Jesus, through the Immaculate Heart of Mary, I offer you my prayers, works, joys, and sufferings of this day for all the intentions of your Sacred Heart.",
  source: "default",
};

const CELEBRATION_PRAYERS: Array<{ match: RegExp; prayer: TodayPrayer }> = [
  {
    match: /blessed virgin mary|mother of god|mary/i,
    prayer: {
      id: "mary-mother-of-god-prayer",
      title: "Prayer to Mary, Mother of God",
      text:
        "Mary, Mother of God, lead us closer to your Son today. Teach us to welcome Christ with faith, humility, and a heart ready to serve.",
      source: "liturgical",
    },
  },
];

function normalize(value: string | null | undefined) {
  return (value ?? "").replace(/\s+/g, " ").trim();
}

export function getTodayPrayerQueryKey(date = getTodayDateKey()) {
  return ["today-prayer", date] as const;
}

export function buildTodayPrayerFromReadings(readings: TodayLiturgicalReadings, date = getTodayDateKey()): TodayPrayer | null {
  const { day } = readings;
  const dailyReading = day?.daily_readings?.[0] ?? null;
  const assignedPrayer = normalize(dailyReading?.prayer);

  if (assignedPrayer) {
    return {
      id: `liturgical-prayer-${date}`,
      title: `${day?.celebration ?? "Today's"} Prayer`,
      text: assignedPrayer,
      source: "liturgical",
    };
  }

  const celebration = normalize(day?.celebration);
  const matchedPrayer = CELEBRATION_PRAYERS.find((item) => item.match.test(celebration));

  return matchedPrayer?.prayer ?? DEFAULT_MORNING_PRAYER;
}

export async function fetchTodayPrayer(date = getTodayDateKey()): Promise<TodayPrayer | null> {
  return buildTodayPrayerFromReadings(await fetchTodayLiturgicalReadings(date), date);
}

export async function fetchPrayerById(id: string): Promise<TodayPrayer | null> {
  if (id === DEFAULT_MORNING_PRAYER.id) return DEFAULT_MORNING_PRAYER;

  const matchedPrayer = CELEBRATION_PRAYERS.find((item) => item.prayer.id === id);
  if (matchedPrayer) return matchedPrayer.prayer;

  if (id.startsWith("liturgical-prayer-")) {
    const date = id.replace("liturgical-prayer-", "");
    return fetchTodayPrayer(date);
  }

  const cmsPrayer = await fetchMemberCmsPrayerByIdOrSlug(id);
  if (!cmsPrayer) return null;

  return {
    id: cmsPrayer.slug || cmsPrayer.id,
    title: cmsPrayer.title,
    text: cmsPrayer.body,
    source: "default",
  };
}

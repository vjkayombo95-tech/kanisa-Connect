import { fetchTodayLiturgicalReadings, getTodayDateKey, type TodayLiturgicalReadings } from "@/lib/liturgy";

export type TodayReflection = {
  id: string;
  title: string;
  text: string;
  source: "liturgical" | "empty";
};

const EMPTY_REFLECTION: TodayReflection = {
  id: "no-reflection-available",
  title: "Today's Gospel Reflection",
  text: "No reflection available.",
  source: "empty",
};

function normalize(value: string | null | undefined) {
  return (value ?? "").replace(/\s+/g, " ").trim();
}

export function getTodayReflectionQueryKey(date = getTodayDateKey()) {
  return ["today-reflection", date] as const;
}

export function buildTodayReflectionFromReadings(readings: TodayLiturgicalReadings, date = getTodayDateKey()): TodayReflection | null {
  const { day } = readings;
  const dailyReading = day?.daily_readings?.[0] ?? null;
  const reflection = normalize(dailyReading?.reflection);

  if (!reflection) return EMPTY_REFLECTION;

  return {
    id: `liturgical-reflection-${date}`,
    title: "Today's Gospel Reflection",
    text: reflection,
    source: "liturgical",
  };
}

export async function fetchTodayReflection(date = getTodayDateKey()): Promise<TodayReflection | null> {
  return buildTodayReflectionFromReadings(await fetchTodayLiturgicalReadings(date), date);
}

export async function fetchReflectionById(id: string): Promise<TodayReflection | null> {
  if (id === EMPTY_REFLECTION.id) return EMPTY_REFLECTION;

  if (id.startsWith("liturgical-reflection-")) {
    const date = id.replace("liturgical-reflection-", "");
    return fetchTodayReflection(date);
  }

  return null;
}

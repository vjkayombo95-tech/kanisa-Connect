import type { DailyReadingBibleReference } from "../daily-reading-references";

export type ReadingDraft = {
  id: string;
  date: string;
  season: string;
  firstReading: string;
  firstBibleReference?: DailyReadingBibleReference | null;
  psalm: string;
  psalmBibleReference?: DailyReadingBibleReference | null;
  secondReading: string;
  secondBibleReference?: DailyReadingBibleReference | null;
  gospel: string;
  gospelBibleReference?: DailyReadingBibleReference | null;
  reflection: string;
  prayer: string;
};

let dailyReadingDrafts: ReadingDraft[] = [];

export function createEmptyReadingDraft(): ReadingDraft {
  return {
    id: crypto.randomUUID(),
    date: new Date().toISOString().slice(0, 10),
    season: "",
    firstReading: "",
    firstBibleReference: null,
    psalm: "",
    psalmBibleReference: null,
    secondReading: "",
    secondBibleReference: null,
    gospel: "",
    gospelBibleReference: null,
    reflection: "",
    prayer: "",
  };
}

export async function fetchDailyReadingDrafts() {
  return dailyReadingDrafts;
}

export async function saveDailyReadingDraft(draft: ReadingDraft) {
  const exists = dailyReadingDrafts.some((item) => item.id === draft.id);
  dailyReadingDrafts = exists
    ? dailyReadingDrafts.map((item) => (item.id === draft.id ? draft : item))
    : [draft, ...dailyReadingDrafts];
  return draft;
}

export async function deleteDailyReadingDraft(id: string) {
  dailyReadingDrafts = dailyReadingDrafts.filter((item) => item.id !== id);
}

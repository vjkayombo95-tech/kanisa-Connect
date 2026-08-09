export const PRAYER_CATEGORIES = ["Morning", "Evening", "Family", "Healing", "Thanksgiving", "Marian", "Eucharistic", "Saint Prayers"];

export type PrayerDraft = {
  id: string;
  title: string;
  category: string;
  text: string;
  isPublished: boolean;
};

let prayerDrafts: PrayerDraft[] = [];

export function createEmptyPrayerDraft(): PrayerDraft {
  return { id: crypto.randomUUID(), title: "", category: "Morning", text: "", isPublished: false };
}

export async function fetchPrayerDrafts() {
  return prayerDrafts;
}

export async function savePrayerDraft(draft: PrayerDraft) {
  const exists = prayerDrafts.some((item) => item.id === draft.id);
  prayerDrafts = exists
    ? prayerDrafts.map((item) => (item.id === draft.id ? draft : item))
    : [draft, ...prayerDrafts];
  return draft;
}

export async function deletePrayerDraft(id: string) {
  prayerDrafts = prayerDrafts.filter((item) => item.id !== id);
}

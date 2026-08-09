export type LibrarySaint = {
  id: string;
  slug: string;
  name: string;
  title: string | null;
  feast_month: number;
  feast_day: number;
  patron_of: string | null;
  birth_year: number | null;
  death_year: number | null;
  country: string | null;
  biography_short: string;
  biography_long: string;
  quote: string | null;
  reflection: string;
  prayer: string;
  image_url: string | null;
  color_theme: string | null;
  liturgical_rank: string | null;
  is_featured: boolean;
  scripture_reference: string | null;
  tags: string[] | null;
};

export const SAINT_SELECT = [
  "id",
  "slug",
  "name",
  "title",
  "feast_month",
  "feast_day",
  "patron_of",
  "birth_year",
  "death_year",
  "country",
  "biography_short",
  "biography_long",
  "quote",
  "reflection",
  "prayer",
  "image_url",
  "color_theme",
  "liturgical_rank",
  "is_featured",
  "scripture_reference",
  "tags",
].join(", ");

export type SaintCategory = {
  id: string;
  label: string;
  aliases: string[];
};

export const SAINT_CATEGORIES: SaintCategory[] = [
  { id: "all", label: "All Saints", aliases: [] },
  { id: "apostles", label: "Apostles", aliases: ["apostle", "apostles"] },
  { id: "holy-family", label: "Holy Family", aliases: ["holy family", "holy-family", "family"] },
  { id: "doctors", label: "Doctors of the Church", aliases: ["doctor", "doctor of the church", "doctors"] },
  { id: "african", label: "African Saints", aliases: ["african", "africa"] },
  { id: "modern", label: "Modern Saints", aliases: ["modern", "20th century", "contemporary"] },
  { id: "martyrs", label: "Martyrs", aliases: ["martyr", "martyrs"] },
  { id: "popes", label: "Popes", aliases: ["pope", "popes", "papacy"] },
  { id: "religious-orders", label: "Religious Orders", aliases: ["religious order", "religious orders", "monastic", "missionary"] },
];

export function formatFeastDay(month?: number | null, day?: number | null) {
  if (!month || !day) return "Feast day not set";

  return new Intl.DateTimeFormat("en-TZ", {
    month: "long",
    day: "numeric",
  }).format(new Date(2026, month - 1, day));
}

export function normalizeTags(tags: string[] | null | undefined) {
  return (tags ?? [])
    .map((tag) => tag.trim().toLowerCase())
    .filter(Boolean);
}

export function saintMatchesCategory(saint: LibrarySaint, categoryId: string) {
  if (categoryId === "all") return true;

  const category = SAINT_CATEGORIES.find((item) => item.id === categoryId);
  if (!category) return true;

  const tags = normalizeTags(saint.tags);
  return category.aliases.some((alias) => tags.includes(alias));
}

export function saintMatchesSearch(saint: LibrarySaint, search: string) {
  const term = search.trim().toLowerCase();
  if (!term) return true;

  const tags = normalizeTags(saint.tags).join(" ");
  return [
    saint.name,
    saint.title,
    saint.patron_of,
    saint.country,
    saint.scripture_reference,
    tags,
  ]
    .filter(Boolean)
    .some((value) => String(value).toLowerCase().includes(term));
}

export function getSaintImageAlt(saint: Pick<LibrarySaint, "name" | "title">) {
  return saint.title ? `${saint.name}, ${saint.title}` : saint.name;
}


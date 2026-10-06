import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import i18n, { changeAppLanguage } from "@/i18n";
import { formatFeastDay, SAINT_CATEGORIES, saintMatchesCategory } from "@/lib/catholic-library";

const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8");
const library = read("src/pages/portal/MemberLibraryPage.tsx");
const detail = read("src/pages/portal/MemberSaintDetailsPage.tsx");
const helper = read("src/lib/catholic-library.ts");
const en = JSON.parse(read("src/locales/en.json"));
const sw = JSON.parse(read("src/locales/sw.json"));
const flattenKeys = (value: unknown, prefix = ""): string[] => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return [prefix];
  return Object.entries(value).flatMap(([key, nested]) => flattenKeys(nested, prefix ? `${prefix}.${key}` : key));
};

describe("member Catholic Library localization", () => {
  it("keeps English and Kiswahili member_library locale keys symmetric", () => {
    expect(flattenKeys(en.member_library).sort()).toEqual(flattenKeys(sw.member_library).sort());
  });

  it("renders library app copy in English and Kiswahili through member_library keys", async () => {
    await changeAppLanguage("en");
    expect(i18n.t("member_library.hero.eyebrow")).toBe("Catholic formation");
    expect(i18n.t("member_library.hero.title")).toBe("Saints");
    expect(i18n.t("member_library.search.label")).toBe("Search saints");
    expect(i18n.t("member_library.results_count_one", { count: 1 })).toBe("1 saint found");
    expect(i18n.t("member_library.results_count_other", { count: 2 })).toBe("2 saints found");
    expect(i18n.t("member_library.pagination.page_of", { page: 2, total: 4 })).toBe("Page 2 of 4");

    await changeAppLanguage("sw");
    expect(i18n.t("member_library.hero.eyebrow")).toBe("Malezi ya Kikatoliki");
    expect(i18n.t("member_library.hero.title")).toBe("Watakatifu");
    expect(i18n.t("member_library.search.label")).toBe("Tafuta watakatifu");
    expect(i18n.t("member_library.results_count_one", { count: 1 })).toBe("Mtakatifu 1 amepatikana");
    expect(i18n.t("member_library.results_count_other", { count: 2 })).toBe("Watakatifu 2 wamepatikana");
    expect(i18n.t("member_library.pagination.page_of", { page: 2, total: 4 })).toBe("Ukurasa 2 kati ya 4");
  });

  it("localizes category presentation without changing stable IDs, aliases, or filtering", () => {
    expect(SAINT_CATEGORIES.map((category) => category.id)).toEqual([
      "all",
      "apostles",
      "holy-family",
      "doctors",
      "african",
      "modern",
      "martyrs",
      "popes",
      "religious-orders",
    ]);
    expect(library).toContain("categoryLabelKey(item.id)");
    expect(library).toContain("item.id");
    expect(helper).toContain('{ id: "holy-family", label: "Holy Family", aliases: ["holy family", "holy-family", "family"] }');
    expect(saintMatchesCategory({ tags: ["apostle"] } as any, "apostles")).toBe(true);
    expect(saintMatchesCategory({ tags: ["apostle"] } as any, "modern")).toBe(false);
  });

  it("keeps dynamic saint content untranslated in library and detail surfaces", () => {
    for (const source of [library, detail]) {
      expect(source).not.toContain("t(saint.name");
      expect(source).not.toContain("t(saint.title");
      expect(source).not.toContain("t(saint.biography");
      expect(source).not.toContain("t(saint.reflection");
      expect(source).not.toContain("t(saint.prayer");
      expect(source).not.toContain("t(tag");
    }
    expect(library).toContain("{saint.name}");
    expect(library).toContain("{saint.title}");
    expect(library).toContain("{saint.biography_short}");
    expect(detail).toContain("{saint.name}");
    expect(detail).toContain("{saint.biography_short}");
    expect(detail).toContain("{saint.biography_long}");
    expect(detail).toContain("{saint.reflection}");
    expect(detail).toContain("{saint.prayer}");
    expect(detail).toContain("{tag}");
    expect(detail).toContain("{item.name}");
  });

  it("localizes saint detail labels, sharing text, and feast-day presentation", async () => {
    await changeAppLanguage("en");
    expect(i18n.t("member_library.detail.share_text", { name: "Dynamic Saint" })).toBe(
      "Read about Dynamic Saint in the Kanisa Connect Catholic Library.",
    );
    expect(i18n.t("member_library.detail.link_copied_description", { name: "Dynamic Saint" })).toBe("Dynamic Saint can now be shared.");
    expect(i18n.t("member_library.detail.fields.feast_day")).toBe("Feast Day");
    expect(formatFeastDay(8, 28, "en", i18n.t("member_library.feast_day_not_set"))).toContain("August");

    await changeAppLanguage("sw");
    expect(i18n.t("member_library.detail.share_text", { name: "Dynamic Saint" })).toBe(
      "Soma kuhusu Dynamic Saint kwenye Maktaba ya Kikatoliki ya Kanisa Connect.",
    );
    expect(i18n.t("member_library.detail.link_copied_description", { name: "Dynamic Saint" })).toBe("Dynamic Saint sasa anaweza kushirikiwa.");
    expect(i18n.t("member_library.detail.fields.feast_day")).toBe("Sikukuu");
    expect(formatFeastDay(8, 28, "sw", i18n.t("member_library.feast_day_not_set"))).toContain("Agosti");
    expect(formatFeastDay(null, null, "sw", i18n.t("member_library.feast_day_not_set"))).toBe("Sikukuu haijawekwa");
  });

  it("preserves query keys, routes, pagination, related saints, and sharing behavior", () => {
    expect(library).toContain('const PAGE_SIZE = 12');
    expect(library).toContain('queryKey: ["member-catholic-library-saints"]');
    expect(library).toContain('.from("saints" as never)');
    expect(library).toContain(".select(SAINT_SELECT)");
    expect(library).toContain('.eq("is_active", true)');
    expect(library).toContain('.order("is_featured", { ascending: false })');
    expect(library).toContain('.order("name", { ascending: true })');
    expect(library).toContain(".limit(500)");
    expect(library).toContain("saintMatchesCategory(saint, category)");
    expect(library).toContain("saintMatchesSearch(saint, search)");
    expect(library).toContain('to={`/member/library/${saint.slug}`}');
    expect(library).toContain("Math.max(1, current - 1)");
    expect(library).toContain("Math.min(totalPages, current + 1)");

    expect(detail).toContain('queryKey: ["member-catholic-library-saint", saintKey]');
    expect(detail).toContain('queryKey: ["member-catholic-library-related-saints"]');
    expect(detail).toContain("saintId ?? slug");
    expect(detail).toContain("? query.eq(\"id\", saintKey)");
    expect(detail).toContain(": query.eq(\"slug\", saintKey)");
    expect(detail).toContain("normalizeTags(saint.tags)");
    expect(detail).toContain("a.item.name.localeCompare(b.item.name)");
    expect(detail).toContain("navigator.share");
    expect(detail).toContain("window.location.href");
    expect(detail).toContain("navigator.clipboard.writeText(url)");
    expect(detail).toContain('to="/member/library"');
  });
});

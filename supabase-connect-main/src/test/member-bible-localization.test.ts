import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import i18n, { changeAppLanguage } from "@/i18n";

const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8");
const home = read("src/pages/portal/MemberBibleHomePage.tsx");
const book = read("src/pages/portal/MemberBibleBookPage.tsx");
const chapter = read("src/pages/portal/MemberBibleChapterPage.tsx");
const en = JSON.parse(read("src/locales/en.json"));
const sw = JSON.parse(read("src/locales/sw.json"));
const flattenKeys = (value: unknown, prefix = ""): string[] => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return [prefix];
  return Object.entries(value).flatMap(([key, nested]) => flattenKeys(nested, prefix ? `${prefix}.${key}` : key));
};

describe("member Bible localization", () => {
  afterAll(async () => {
    await changeAppLanguage("en");
  });

  it("keeps English and Kiswahili member_bible locale keys symmetric", () => {
    expect(flattenKeys(en.member_bible).sort()).toEqual(flattenKeys(sw.member_bible).sort());
  });

  it("provides English and Kiswahili UI chrome for the Bible home flow", async () => {
    await changeAppLanguage("en");
    expect(i18n.t("member_bible.common.bible")).toBe("Bible");
    expect(i18n.t("member_bible.home.title")).toBe("Holy Bible");
    expect(i18n.t("member_bible.search.label")).toBe("Search Bible");
    expect(i18n.t("member_bible.search.results_title")).toBe("Search Results");
    expect(i18n.t("member_bible.search.results_count", { count: 7 })).toBe("7 found");
    expect(i18n.t("member_bible.search.chapter_verse", { chapter: 3, verse: 16 })).toBe("Chapter 3, Verse 16");
    expect(i18n.t("member_bible.home.books_count", { count: 5 })).toBe("5 books");

    await changeAppLanguage("sw");
    expect(i18n.t("member_bible.common.bible")).toBe("Biblia");
    expect(i18n.t("member_bible.home.title")).toBe("Biblia Takatifu");
    expect(i18n.t("member_bible.search.label")).toBe("Tafuta kwenye Biblia");
    expect(i18n.t("member_bible.search.results_title")).toBe("Matokeo ya Utafutaji");
    expect(i18n.t("member_bible.search.results_count", { count: 7 })).toBe("7 zimepatikana");
    expect(i18n.t("member_bible.search.chapter_verse", { chapter: 3, verse: 16 })).toBe("Sura 3, Mstari 16");
    expect(i18n.t("member_bible.home.books_count", { count: 5 })).toBe("Vitabu 5");
  });

  it("localizes testament labels without changing canonical testament values", async () => {
    await changeAppLanguage("en");
    expect(i18n.t("member_bible.testaments.old")).toBe("Old Testament");
    expect(i18n.t("member_bible.testaments.new")).toBe("New Testament");
    expect(i18n.t("member_bible.testaments.deuterocanonical")).toBe("Deuterocanonical");

    await changeAppLanguage("sw");
    expect(i18n.t("member_bible.testaments.old")).toBe("Agano la Kale");
    expect(i18n.t("member_bible.testaments.new")).toBe("Agano Jipya");
    expect(i18n.t("member_bible.testaments.deuterocanonical")).toBe("Deuterokanoni");

    expect(home).toContain('const TESTAMENT_ORDER: BibleBookRow["testament"][] = ["old", "new", "deuterocanonical"]');
    for (const source of [home, book, chapter]) {
      expect(source).toContain('testament: "old" | "new" | "deuterocanonical"');
      expect(source).toContain("member_bible.testaments.");
      expect(source).not.toContain("const TESTAMENT_LABELS");
    }
  });

  it("routes all three Bible pages through member_bible presentation keys", () => {
    for (const key of [
      "member_bible.common.bible",
      "member_bible.home.title",
      "member_bible.search.label",
      "member_bible.search.placeholder",
      "member_bible.search.results_title",
      "member_bible.search.results_limit",
      "member_bible.search.results_count",
      "member_bible.search.error_title",
      "member_bible.search.empty_title",
      "member_bible.search.empty_description",
      "member_bible.search.chapter_verse",
      "member_bible.home.books_error_title",
      "member_bible.home.empty_books_title",
      "member_bible.home.empty_books_description",
      "member_bible.home.books_count",
    ]) {
      expect(home).toContain(key);
    }

    for (const key of [
      "member_bible.common.bible",
      "member_bible.book.chapter_label",
      "member_bible.book.open_chapter",
      "member_bible.book.error_title",
      "member_bible.book.book_number",
      "member_bible.book.chapters_count_label",
      "member_bible.book.empty_title",
      "member_bible.book.empty_description",
      "member_bible.book.chapters_title",
      "member_bible.book.ordered_by_chapter",
    ]) {
      expect(book).toContain(key);
    }

    for (const key of [
      "member_bible.chapter.back_to_chapters",
      "member_bible.chapter.error_title",
      "member_bible.chapter.invalid_link",
      "member_bible.common.try_again",
      "member_bible.common.retry",
      "member_bible.book.chapter_label",
      "member_bible.chapter.empty_verses",
      "member_bible.chapter.navigation_aria",
      "member_bible.chapter.previous",
      "member_bible.chapter.next",
    ]) {
      expect(chapter).toContain(key);
    }
  });

  it("preserves dynamic Bible content and does not translate scripture fields", () => {
    expect(home).toContain("<h2 className=\"truncate text-base font-semibold text-foreground\">{book.name}</h2>");
    expect(book).toContain('<h1 className="mt-2 text-3xl font-bold tracking-tight text-foreground sm:text-4xl">{book.name}</h1>');
    expect(chapter).toContain('<h1 className="mt-2 text-3xl font-bold tracking-tight text-foreground sm:text-4xl">{data.book.name}</h1>');
    expect(home).toContain("{getVerseText(verse)}");
    expect(chapter).toContain("{getVerseText(verse)}");
    expect(home).not.toContain("t(book.name");
    expect(book).not.toContain("t(book.name");
    expect(chapter).not.toContain("t(data.book.name");
    expect(home).not.toContain("t(getVerseText");
    expect(chapter).not.toContain("t(getVerseText");
  });

  it("preserves Bible query keys, Supabase contracts, search behavior, and navigation routes", () => {
    expect(home).toContain('queryKey: ["member-bible-books"]');
    expect(home).toContain('.from("bible_books" as never)');
    expect(home).toContain('.select("id, book_number, name, abbreviation, testament")');
    expect(home).toContain('.order("testament", { ascending: false })');
    expect(home).toContain('.order("book_number", { ascending: true })');
    expect(home).toContain('queryKey: ["member-bible-search", normalizedSearch]');
    expect(home).toContain(".limit(50)");
    expect(home).toContain("useDebouncedValue(search, 300)");
    expect(home).toContain('to={`/portal/bible/${book.id}`}');
    expect(home).toContain('to={`/portal/bible/${verse.book_id}/chapter/${verse.chapter_number}`}');

    expect(book).toContain('queryKey: ["member-bible-book", bookId]');
    expect(book).toContain('queryKey: ["member-bible-chapters", bookId]');
    expect(book).toContain('.eq("book_id", bookId)');
    expect(book).toContain('.order("chapter_number", { ascending: true })');
    expect(book).toContain('to="/portal/bible"');
    expect(book).toContain('to={`/portal/bible/${bookId}/chapter/${chapter.chapter_number}`}');

    expect(chapter).toContain('queryKey: ["member-bible-chapter-reader", bookId, parsedChapterNumber]');
    expect(chapter).toContain('parseVerseQueryParam(searchParams.get("startVerse"))');
    expect(chapter).toContain('parseVerseQueryParam(searchParams.get("endVerse")) ?? startVerse');
    expect(chapter).toContain("highlightedVerseRange");
    expect(chapter).toContain("scrollIntoView");
    expect(chapter).toContain('to={`/portal/bible/${data.book.id}/chapter/${navigation.previous}`}');
    expect(chapter).toContain('to={`/portal/bible/${data.book.id}/chapter/${navigation.next}`}');
    expect(chapter).toContain('aria-label={t("member_bible.chapter.navigation_aria")}');
  });
});

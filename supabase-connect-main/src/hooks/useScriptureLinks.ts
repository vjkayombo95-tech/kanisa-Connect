import { useMemo } from "react";

import {
  bibleReferenceToPath,
  getBibleBookAliases,
  parseBibleReference,
  type BibleReferenceBook,
  type ParsedBibleReference,
} from "@/lib/bible-reference-parser";

type ScriptureReferenceBook = BibleReferenceBook & {
  chapterCount?: number;
};

export type ScriptureTextPart =
  | { type: "text"; value: string }
  | {
      type: "reference";
      value: string;
      href: string;
      ariaLabel: string;
      parsed: ParsedBibleReference;
    };

const MAX_REASONABLE_VERSE = 176;

export const SCRIPTURE_ROUTE_BOOK_PREFIX = "book-";

export const SCRIPTURE_REFERENCE_BOOKS: ScriptureReferenceBook[] = [
  { id: "book-1", book_number: 1, name: "Mwanzo", abbreviation: null, chapterCount: 50 },
  { id: "book-2", book_number: 2, name: "Kutoka", abbreviation: null, chapterCount: 40 },
  { id: "book-3", book_number: 3, name: "Walawi", abbreviation: null, chapterCount: 27 },
  { id: "book-4", book_number: 4, name: "Hesabu", abbreviation: null, chapterCount: 36 },
  { id: "book-5", book_number: 5, name: "Kumbukumbu la Torati", abbreviation: null, chapterCount: 34 },
  { id: "book-6", book_number: 6, name: "Yoshua", abbreviation: null, chapterCount: 24 },
  { id: "book-7", book_number: 7, name: "Waamuzi", abbreviation: null, chapterCount: 21 },
  { id: "book-8", book_number: 8, name: "Ruthu", abbreviation: null, chapterCount: 4 },
  { id: "book-9", book_number: 9, name: "1 Samweli", abbreviation: null, chapterCount: 31 },
  { id: "book-10", book_number: 10, name: "2 Samweli", abbreviation: null, chapterCount: 24 },
  { id: "book-11", book_number: 11, name: "1 Wafalme", abbreviation: null, chapterCount: 22 },
  { id: "book-12", book_number: 12, name: "2 Wafalme", abbreviation: null, chapterCount: 25 },
  { id: "book-13", book_number: 13, name: "1 Nyakati", abbreviation: null, chapterCount: 29 },
  { id: "book-14", book_number: 14, name: "2 Nyakati", abbreviation: null, chapterCount: 36 },
  { id: "book-15", book_number: 15, name: "Ezra", abbreviation: null, chapterCount: 10 },
  { id: "book-16", book_number: 16, name: "Nehemia", abbreviation: null, chapterCount: 13 },
  { id: "book-17", book_number: 17, name: "Esta", abbreviation: null, chapterCount: 10 },
  { id: "book-18", book_number: 18, name: "Ayubu", abbreviation: null, chapterCount: 42 },
  { id: "book-19", book_number: 19, name: "Zaburi", abbreviation: null, chapterCount: 150 },
  { id: "book-20", book_number: 20, name: "Mithali", abbreviation: null, chapterCount: 31 },
  { id: "book-21", book_number: 21, name: "Mhubiri", abbreviation: null, chapterCount: 12 },
  { id: "book-22", book_number: 22, name: "Wimbo Ulio Bora", abbreviation: null, chapterCount: 8 },
  { id: "book-23", book_number: 23, name: "Isaya", abbreviation: null, chapterCount: 66 },
  { id: "book-24", book_number: 24, name: "Yeremia", abbreviation: null, chapterCount: 52 },
  { id: "book-25", book_number: 25, name: "Maombolezo", abbreviation: null, chapterCount: 5 },
  { id: "book-26", book_number: 26, name: "Ezekieli", abbreviation: null, chapterCount: 48 },
  { id: "book-27", book_number: 27, name: "Danieli", abbreviation: null, chapterCount: 12 },
  { id: "book-28", book_number: 28, name: "Hosea", abbreviation: null, chapterCount: 14 },
  { id: "book-29", book_number: 29, name: "Yoeli", abbreviation: null, chapterCount: 3 },
  { id: "book-30", book_number: 30, name: "Amosi", abbreviation: null, chapterCount: 9 },
  { id: "book-31", book_number: 31, name: "Obadia", abbreviation: null, chapterCount: 1 },
  { id: "book-32", book_number: 32, name: "Yona", abbreviation: null, chapterCount: 4 },
  { id: "book-33", book_number: 33, name: "Mika", abbreviation: null, chapterCount: 7 },
  { id: "book-34", book_number: 34, name: "Nahumu", abbreviation: null, chapterCount: 3 },
  { id: "book-35", book_number: 35, name: "Habakuki", abbreviation: null, chapterCount: 3 },
  { id: "book-36", book_number: 36, name: "Sefania", abbreviation: null, chapterCount: 3 },
  { id: "book-37", book_number: 37, name: "Hagai", abbreviation: null, chapterCount: 2 },
  { id: "book-38", book_number: 38, name: "Zekaria", abbreviation: null, chapterCount: 14 },
  { id: "book-39", book_number: 39, name: "Malaki", abbreviation: null, chapterCount: 4 },
  { id: "book-40", book_number: 40, name: "Mathayo", abbreviation: null, chapterCount: 28 },
  { id: "book-41", book_number: 41, name: "Marko", abbreviation: null, chapterCount: 16 },
  { id: "book-42", book_number: 42, name: "Luka", abbreviation: null, chapterCount: 24 },
  { id: "book-43", book_number: 43, name: "Yohana", abbreviation: null, chapterCount: 21 },
  { id: "book-44", book_number: 44, name: "Matendo", abbreviation: null, chapterCount: 28 },
  { id: "book-45", book_number: 45, name: "Warumi", abbreviation: null, chapterCount: 16 },
  { id: "book-46", book_number: 46, name: "1 Wakorintho", abbreviation: null, chapterCount: 16 },
  { id: "book-47", book_number: 47, name: "2 Wakorintho", abbreviation: null, chapterCount: 13 },
  { id: "book-48", book_number: 48, name: "Wagalatia", abbreviation: null, chapterCount: 6 },
  { id: "book-49", book_number: 49, name: "Waefeso", abbreviation: null, chapterCount: 6 },
  { id: "book-50", book_number: 50, name: "Wafilipi", abbreviation: null, chapterCount: 4 },
  { id: "book-51", book_number: 51, name: "Wakolosai", abbreviation: null, chapterCount: 4 },
  { id: "book-52", book_number: 52, name: "1 Wathesalonike", abbreviation: null, chapterCount: 5 },
  { id: "book-53", book_number: 53, name: "2 Wathesalonike", abbreviation: null, chapterCount: 3 },
  { id: "book-54", book_number: 54, name: "1 Timotheo", abbreviation: null, chapterCount: 6 },
  { id: "book-55", book_number: 55, name: "2 Timotheo", abbreviation: null, chapterCount: 4 },
  { id: "book-56", book_number: 56, name: "Tito", abbreviation: null, chapterCount: 3 },
  { id: "book-57", book_number: 57, name: "Filemoni", abbreviation: null, chapterCount: 1 },
  { id: "book-58", book_number: 58, name: "Waebrania", abbreviation: null, chapterCount: 13 },
  { id: "book-59", book_number: 59, name: "Yakobo", abbreviation: null, chapterCount: 5 },
  { id: "book-60", book_number: 60, name: "1 Petro", abbreviation: null, chapterCount: 5 },
  { id: "book-61", book_number: 61, name: "2 Petro", abbreviation: null, chapterCount: 3 },
  { id: "book-62", book_number: 62, name: "1 Yohana", abbreviation: null, chapterCount: 5 },
  { id: "book-63", book_number: 63, name: "2 Yohana", abbreviation: null, chapterCount: 1 },
  { id: "book-64", book_number: 64, name: "3 Yohana", abbreviation: null, chapterCount: 1 },
  { id: "book-65", book_number: 65, name: "Yuda", abbreviation: null, chapterCount: 1 },
  { id: "book-66", book_number: 66, name: "Ufunuo", abbreviation: null, chapterCount: 22 },
  { id: "book-67", book_number: 67, name: "Tobit", abbreviation: "Tob", chapterCount: 14 },
  { id: "book-68", book_number: 68, name: "Judith", abbreviation: "Jdt", chapterCount: 16 },
  { id: "book-69", book_number: 69, name: "Wisdom", abbreviation: "Wis", chapterCount: 19 },
  { id: "book-70", book_number: 70, name: "Sirach", abbreviation: "Sir", chapterCount: 51 },
  { id: "book-71", book_number: 71, name: "Baruch", abbreviation: "Bar", chapterCount: 6 },
  { id: "book-72", book_number: 72, name: "1 Maccabees", abbreviation: "1 Mac", chapterCount: 16 },
  { id: "book-73", book_number: 73, name: "2 Maccabees", abbreviation: "2 Mac", chapterCount: 15 },
];

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function getBooks(books?: BibleReferenceBook[]) {
  return books?.length ? books : SCRIPTURE_REFERENCE_BOOKS;
}

function getChapterCount(book: BibleReferenceBook) {
  return (book as ScriptureReferenceBook).chapterCount;
}

function isReferenceInRange(reference: ParsedBibleReference) {
  if (reference.kind === "book") return true;

  const chapterCount = getChapterCount(reference.book);
  if (chapterCount && reference.chapter > chapterCount) return false;

  if (reference.kind === "chapter") return true;

  if (reference.startVerse > MAX_REASONABLE_VERSE) return false;
  if (reference.endVerse && reference.endVerse > MAX_REASONABLE_VERSE) return false;

  return true;
}

export function parseStaticBookRouteId(bookId: string | null | undefined) {
  if (!bookId?.startsWith(SCRIPTURE_ROUTE_BOOK_PREFIX)) return null;

  const bookNumber = Number(bookId.slice(SCRIPTURE_ROUTE_BOOK_PREFIX.length));
  return Number.isInteger(bookNumber) && bookNumber > 0 ? bookNumber : null;
}

export function getScriptureAliasPattern(books?: BibleReferenceBook[]) {
  return getBooks(books)
    .flatMap(getBibleBookAliases)
    .filter(Boolean)
    .sort((left, right) => right.length - left.length)
    .map(escapeRegExp)
    .join("|");
}

export function getScriptureReferenceLabel(reference: ParsedBibleReference) {
  if (reference.kind === "book") return reference.book.name;
  if (reference.kind === "chapter") return `${reference.book.name} ${reference.chapter}`;

  return `${reference.book.name} ${reference.chapter}:${reference.startVerse}${
    reference.endVerse && reference.endVerse !== reference.startVerse ? `-${reference.endVerse}` : ""
  }`;
}

export function getScriptureAriaLabel(reference: ParsedBibleReference) {
  if (reference.kind === "book") return `Open Bible passage ${reference.book.name}`;
  if (reference.kind === "chapter") return `Open Bible passage ${reference.book.name} chapter ${reference.chapter}`;

  const verseLabel =
    reference.endVerse && reference.endVerse !== reference.startVerse
      ? `verses ${reference.startVerse} to ${reference.endVerse}`
      : `verse ${reference.startVerse}`;

  return `Open Bible passage ${reference.book.name} chapter ${reference.chapter} ${verseLabel}`;
}

export function resolveScriptureReference(reference: string, books?: BibleReferenceBook[]) {
  const parsed = parseBibleReference(reference, getBooks(books));
  if (!parsed || !isReferenceInRange(parsed)) return null;

  return {
    parsed,
    href: bibleReferenceToPath(parsed),
    label: getScriptureReferenceLabel(parsed),
    ariaLabel: getScriptureAriaLabel(parsed),
  };
}

export function splitScriptureReferences(text: string, books?: BibleReferenceBook[]): ScriptureTextPart[] {
  if (!text) return [{ type: "text", value: text }];

  const referenceBooks = getBooks(books);
  const aliasPattern = getScriptureAliasPattern(referenceBooks);
  if (!aliasPattern) return [{ type: "text", value: text }];

  const referencePattern = new RegExp(
    `\\b(?:${aliasPattern})\\s+\\d+(?::\\s*\\d+(?:\\s*[-\\u2013\\u2014]\\s*(?:(?:\\d+)\\s*:\\s*)?\\d+)?)?`,
    "gi",
  );
  const parts: ScriptureTextPart[] = [];
  let lastIndex = 0;

  for (const match of text.matchAll(referencePattern)) {
    const value = match[0];
    const index = match.index ?? 0;
    const resolved = resolveScriptureReference(value, referenceBooks);

    if (!resolved) continue;

    if (index > lastIndex) {
      parts.push({ type: "text", value: text.slice(lastIndex, index) });
    }

    parts.push({
      type: "reference",
      value,
      href: resolved.href,
      ariaLabel: resolved.ariaLabel,
      parsed: resolved.parsed,
    });
    lastIndex = index + value.length;
  }

  if (lastIndex < text.length) {
    parts.push({ type: "text", value: text.slice(lastIndex) });
  }

  return parts.length ? parts : [{ type: "text", value: text }];
}

export function useScriptureReference(reference: string, books?: BibleReferenceBook[]) {
  return useMemo(() => resolveScriptureReference(reference, books), [books, reference]);
}

export function useScriptureLinks(text: string, books?: BibleReferenceBook[]) {
  return useMemo(() => splitScriptureReferences(text, books), [books, text]);
}

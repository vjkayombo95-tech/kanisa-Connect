import { describe, expect, it } from "vitest";

import { looksLikeBibleReference, parseBibleReference, type BibleReferenceBook } from "@/lib/bible-reference-parser";

const books: BibleReferenceBook[] = [
  { id: "book-40", book_number: 40, name: "Mathayo", abbreviation: null },
];

describe("Bible reference parsing", () => {
  it.each([
    "Matthew 3:16",
    "Matthew 3 : 16",
    "Matthew 3:16-17",
    "Matthew 3 : 16 - 17",
    "Mathayo 3:16",
    "Mathayo 3 : 16",
    "Mt 3:16",
    "MATTHEW 3:16",
    "matthew 3:16",
    "  Matthew 3:16",
    "Matthew 3:16  ",
    "Matthew   3:16",
    "Matthew\t3:\t16",
    "Matthew \t 3 : \t 16 - 17",
  ])("normalizes and parses %s", (input) => {
    const reference = parseBibleReference(input, books);

    expect(looksLikeBibleReference(input)).toBe(true);
    expect(reference).toMatchObject({
      kind: "verse",
      book: books[0],
      chapter: 3,
      startVerse: 16,
    });
  });
});

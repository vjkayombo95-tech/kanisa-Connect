export type BibleTestament = "old" | "new" | "deuterocanonical";

export type BibleTranslationSeed = {
  code: string;
  name: string;
  language: string;
  description?: string;
};

export type BibleVerseSeed = {
  verse: number;
  text: string;
};

export type BibleChapterSeed = {
  chapter: number;
  verses: BibleVerseSeed[];
};

export type BibleBookSeed = {
  book_number: number;
  name: string;
  abbreviation?: string;
  testament: BibleTestament;
  chapters: BibleChapterSeed[];
};

export type BibleSeed = {
  translation: BibleTranslationSeed;
  books: BibleBookSeed[];
};

export type BibleValidationIssue = {
  severity: "error" | "warning";
  path: string;
  message: string;
};

export type BibleValidationSummary = {
  valid: boolean;
  books: number;
  chapters: number;
  verses: number;
  warnings: BibleValidationIssue[];
  errors: BibleValidationIssue[];
};

const VALID_TESTAMENTS = new Set<BibleTestament>(["old", "new", "deuterocanonical"]);

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function normalizeText(value: unknown): string {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

export function toPositiveInteger(value: unknown): number | null {
  if (typeof value === "number" && Number.isInteger(value) && value > 0) return value;
  const normalized = normalizeText(value);
  if (!/^\d+$/.test(normalized)) return null;
  const parsed = Number(normalized);
  return parsed > 0 ? parsed : null;
}

export function validateBibleSeed(input: unknown): BibleValidationSummary {
  const issues: BibleValidationIssue[] = [];
  const addIssue = (severity: BibleValidationIssue["severity"], path: string, message: string) => {
    issues.push({ severity, path, message });
  };

  let bookCount = 0;
  let chapterCount = 0;
  let verseCount = 0;

  if (!isRecord(input)) {
    addIssue("error", "$", "Bible JSON must be an object.");
    return buildSummary(bookCount, chapterCount, verseCount, issues);
  }

  const translation = input.translation;
  if (!isRecord(translation)) {
    addIssue("error", "translation", "Missing translation metadata.");
  } else {
    if (!normalizeText(translation.code)) addIssue("error", "translation.code", "Translation code is required.");
    if (!normalizeText(translation.name)) addIssue("error", "translation.name", "Translation name is required.");
    if (!normalizeText(translation.language)) addIssue("error", "translation.language", "Translation language is required.");
  }

  if (!Array.isArray(input.books)) {
    addIssue("error", "books", "Books must be an array.");
    return buildSummary(bookCount, chapterCount, verseCount, issues);
  }

  if (!input.books.length) {
    addIssue("error", "books", "At least one Bible book is required.");
  }

  const seenBookNumbers = new Set<number>();
  const seenBookNames = new Set<string>();

  input.books.forEach((rawBook, bookIndex) => {
    const bookPath = `books[${bookIndex}]`;
    if (!isRecord(rawBook)) {
      addIssue("error", bookPath, "Book must be an object.");
      return;
    }

    bookCount += 1;
    const bookNumber = toPositiveInteger(rawBook.book_number);
    const bookName = normalizeText(rawBook.name);
    const testament = normalizeText(rawBook.testament) as BibleTestament;

    if (!bookNumber) {
      addIssue("error", `${bookPath}.book_number`, "Book number must be a positive integer.");
    } else if (seenBookNumbers.has(bookNumber)) {
      addIssue("error", `${bookPath}.book_number`, `Duplicate book number ${bookNumber}.`);
    } else {
      seenBookNumbers.add(bookNumber);
    }

    if (!bookName) {
      addIssue("error", `${bookPath}.name`, "Book name is required.");
    } else {
      const key = bookName.toLowerCase();
      if (seenBookNames.has(key)) addIssue("error", `${bookPath}.name`, `Duplicate book name ${bookName}.`);
      seenBookNames.add(key);
    }

    if (!VALID_TESTAMENTS.has(testament)) {
      addIssue("error", `${bookPath}.testament`, `Invalid testament "${testament}".`);
    }

    if (!Array.isArray(rawBook.chapters)) {
      addIssue("error", `${bookPath}.chapters`, "Chapters must be an array.");
      return;
    }

    if (!rawBook.chapters.length) {
      addIssue("error", `${bookPath}.chapters`, `Book ${bookName || bookIndex + 1} has no chapters.`);
    }

    const seenChapters = new Set<number>();
    rawBook.chapters.forEach((rawChapter, chapterIndex) => {
      const chapterPath = `${bookPath}.chapters[${chapterIndex}]`;
      if (!isRecord(rawChapter)) {
        addIssue("error", chapterPath, "Chapter must be an object.");
        return;
      }

      chapterCount += 1;
      const chapterNumber = toPositiveInteger(rawChapter.chapter);
      if (!chapterNumber) {
        addIssue("error", `${chapterPath}.chapter`, "Chapter number must be a positive integer.");
      } else if (seenChapters.has(chapterNumber)) {
        addIssue("error", `${chapterPath}.chapter`, `Duplicate chapter ${chapterNumber}.`);
      } else {
        seenChapters.add(chapterNumber);
      }

      if (!Array.isArray(rawChapter.verses)) {
        addIssue("error", `${chapterPath}.verses`, "Verses must be an array.");
        return;
      }

      if (!rawChapter.verses.length) {
        addIssue("error", `${chapterPath}.verses`, `Chapter ${chapterNumber ?? chapterIndex + 1} has no verses.`);
      }

      const seenVerses = new Set<number>();
      let previousVerse = 0;
      rawChapter.verses.forEach((rawVerse, verseIndex) => {
        const versePath = `${chapterPath}.verses[${verseIndex}]`;
        if (!isRecord(rawVerse)) {
          addIssue("error", versePath, "Verse must be an object.");
          return;
        }

        verseCount += 1;
        const verseNumber = toPositiveInteger(rawVerse.verse);
        const verseText = normalizeText(rawVerse.text);

        if (!verseNumber) {
          addIssue("error", `${versePath}.verse`, "Verse number must be a positive integer.");
        } else {
          if (seenVerses.has(verseNumber)) {
            addIssue("error", `${versePath}.verse`, `Duplicate verse ${verseNumber}.`);
          }
          if (verseNumber <= previousVerse) {
            addIssue("warning", `${versePath}.verse`, `Verse ${verseNumber} is not in ascending order.`);
          }
          seenVerses.add(verseNumber);
          previousVerse = verseNumber;
        }

        if (!verseText) {
          addIssue("error", `${versePath}.text`, "Verse text cannot be empty.");
        }
      });

      if (seenVerses.size > 1) {
        const maxVerse = Math.max(...seenVerses);
        for (let verse = 1; verse <= maxVerse; verse += 1) {
          if (!seenVerses.has(verse)) {
            addIssue("warning", `${chapterPath}.verses`, `Missing verse number ${verse}.`);
          }
        }
      }
    });

    if (seenChapters.size > 1) {
      const maxChapter = Math.max(...seenChapters);
      for (let chapter = 1; chapter <= maxChapter; chapter += 1) {
        if (!seenChapters.has(chapter)) {
          addIssue("warning", `${bookPath}.chapters`, `Missing chapter number ${chapter}.`);
        }
      }
    }
  });

  if (seenBookNumbers.size > 1) {
    const maxBook = Math.max(...seenBookNumbers);
    for (let bookNumber = 1; bookNumber <= maxBook; bookNumber += 1) {
      if (!seenBookNumbers.has(bookNumber)) {
        addIssue("warning", "books", `Missing book number ${bookNumber}.`);
      }
    }
  }

  return buildSummary(bookCount, chapterCount, verseCount, issues);
}

function buildSummary(
  books: number,
  chapters: number,
  verses: number,
  issues: BibleValidationIssue[],
): BibleValidationSummary {
  const errors = issues.filter((issue) => issue.severity === "error");
  const warnings = issues.filter((issue) => issue.severity === "warning");
  return {
    valid: errors.length === 0,
    books,
    chapters,
    verses,
    warnings,
    errors,
  };
}

export function summarizeBibleSeed(seed: BibleSeed) {
  const books = seed.books.length;
  const chapters = seed.books.reduce((sum, book) => sum + book.chapters.length, 0);
  const verses = seed.books.reduce(
    (sum, book) =>
      sum + book.chapters.reduce((chapterSum, chapter) => chapterSum + chapter.verses.length, 0),
    0,
  );

  return { books, chapters, verses };
}

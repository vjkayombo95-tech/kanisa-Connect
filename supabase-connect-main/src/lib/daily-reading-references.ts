export type DailyReadingReferenceBook = {
  id: string;
  name: string;
  abbreviation?: string | null;
};

export type DailyReadingBibleReference = {
  book_id: string;
  book_name?: string;
  chapter_start: number;
  verse_start: number;
  chapter_end: number;
  verse_end: number;
};

export type DailyReadingReferenceValues = {
  book_id: string | null;
  chapter_start: number | null;
  verse_start: number | null;
  chapter_end: number | null;
  verse_end: number | null;
};

const EMPTY_REFERENCE_VALUES: DailyReadingReferenceValues = {
  book_id: null,
  chapter_start: null,
  verse_start: null,
  chapter_end: null,
  verse_end: null,
};

function normalizeValue(value: string) {
  return value.toLowerCase().replace(/\s+/g, " ").trim();
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function findBook(input: string, books: DailyReadingReferenceBook[]) {
  return [...books]
    .sort((left, right) => right.name.length - left.name.length)
    .find((book) => {
      const names = [book.name, book.abbreviation].filter(Boolean) as string[];
      return names.some((name) => new RegExp(`^${escapeRegExp(name)}\\s+`, "i").test(input));
    });
}

export function resolveReference(input: string, books: DailyReadingReferenceBook[]): DailyReadingBibleReference | null {
  const normalizedInput = input.replace(/\s+/g, " ").trim();
  if (!normalizedInput) return null;

  const book = findBook(normalizedInput, books);
  if (!book) return null;

  const names = [book.name, book.abbreviation].filter(Boolean) as string[];
  const bookPattern = names.map(escapeRegExp).join("|");
  const range = normalizedInput
    .replace(new RegExp(`^(?:${bookPattern})\\s+`, "i"), "")
    .match(/^(\d+):(\d+)(?:\s*-\s*(?:(\d+):)?(\d+))?$/);

  if (!range) return null;

  const chapterStart = Number(range[1]);
  const verseStart = Number(range[2]);
  const chapterEnd = range[3] ? Number(range[3]) : chapterStart;
  const verseEnd = range[4] ? Number(range[4]) : verseStart;

  if (![chapterStart, verseStart, chapterEnd, verseEnd].every((value) => Number.isInteger(value) && value > 0)) {
    return null;
  }

  return {
    book_id: book.id,
    book_name: book.name,
    chapter_start: chapterStart,
    verse_start: verseStart,
    chapter_end: chapterEnd,
    verse_end: verseEnd,
  };
}

export function formatReference(reference: DailyReadingBibleReference | null | undefined, books: DailyReadingReferenceBook[] = []) {
  if (!reference) return "";

  const bookName =
    reference.book_name ??
    books.find((book) => normalizeValue(book.id) === normalizeValue(reference.book_id))?.name ??
    reference.book_id;
  const start = `${reference.chapter_start}:${reference.verse_start}`;
  const end =
    reference.chapter_end === reference.chapter_start
      ? reference.verse_end === reference.verse_start
        ? ""
        : `-${reference.verse_end}`
      : `-${reference.chapter_end}:${reference.verse_end}`;

  return `${bookName} ${start}${end}`;
}

export function toReferenceValues(reference: DailyReadingBibleReference | null | undefined): DailyReadingReferenceValues {
  if (!reference) return { ...EMPTY_REFERENCE_VALUES };

  return {
    book_id: reference.book_id,
    chapter_start: reference.chapter_start,
    verse_start: reference.verse_start,
    chapter_end: reference.chapter_end,
    verse_end: reference.verse_end,
  };
}

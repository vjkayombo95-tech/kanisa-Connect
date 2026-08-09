export type ParsedScriptureReference = {
  book: string;
  chapterStart: number | null;
  verseStart: number | null;
  chapterEnd: number | null;
  verseEnd: number | null;
};

const VERSE_PATTERN = String.raw`\d{1,3}[a-d]*`;
const SCRIPTURE_REFERENCE_PATTERN = new RegExp(
  String.raw`^(?:[1-3]\s)?[A-Z][A-Za-z .]+(?:\s\d{1,3}:${VERSE_PATTERN}(?:-${VERSE_PATTERN})?(?:,\s?${VERSE_PATTERN}(?:-${VERSE_PATTERN})?)*|\s\d{1,3}:${VERSE_PATTERN}-\d{1,3}:${VERSE_PATTERN}|\s\d{1,3}(?:-\d{1,3})?)$`,
);

export function parseScriptureReference(reference: string): ParsedScriptureReference {
  const trimmedReference = reference.trim();
  const bookMatch = trimmedReference.match(/^((?:[1-3]\s)?[A-Z][A-Za-z .]+?)\s+(?=\d)/);
  const chapterVerseMatch = trimmedReference.match(/\s(\d{1,3})(?::(\d{1,3}))?(?:-(?:(\d{1,3}):)?(\d{1,3}))?/);

  return {
    book: bookMatch?.[1]?.trim() ?? trimmedReference,
    chapterStart: chapterVerseMatch?.[1] ? Number(chapterVerseMatch[1]) : null,
    verseStart: chapterVerseMatch?.[2] ? Number(chapterVerseMatch[2]) : null,
    chapterEnd: chapterVerseMatch?.[3] ? Number(chapterVerseMatch[3]) : null,
    verseEnd: chapterVerseMatch?.[4] ? Number(chapterVerseMatch[4]) : null,
  };
}

export function isValidScriptureReference(reference: string): boolean {
  return SCRIPTURE_REFERENCE_PATTERN.test(reference.trim());
}

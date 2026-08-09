export type BibleBookRow = {
  id: string;
  translation_id: string;
  book_number: number;
  name: string;
  abbreviation: string | null;
  testament: "old" | "new" | "deuterocanonical";
};

export type BibleTranslationRow = {
  id: string;
  code: string;
  name: string;
  language_code: string;
  canon_type: string | null;
  publisher: string | null;
  copyright_notice: string | null;
  license_name: string | null;
  license_url: string | null;
  source_url: string | null;
  attribution_text: string | null;
  audio_generation_allowed: boolean | null;
  ai_processing_allowed: boolean | null;
  active: boolean | null;
  default_translation: boolean | null;
};

export type BibleChapterRow = {
  id: string;
  chapter_number: number;
};

export type BibleVerseRow = {
  id: string;
  verse_number: number;
  verse_text: string | null;
  text: string | null;
};

export type ChapterReaderData = {
  translation: BibleTranslationRow | null;
  book: BibleBookRow;
  chapters: BibleChapterRow[];
  selectedChapter: BibleChapterRow | null;
  verses: BibleVerseRow[];
};

export type ReadingMode = "read" | "listen" | "read-listen";
export type ReaderTheme = "light" | "dark" | "system";

export function getVerseText(verse: BibleVerseRow) {
  return verse.verse_text ?? verse.text ?? "";
}

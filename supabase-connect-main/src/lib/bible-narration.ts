export const DEFAULT_SWAHILI_INTRO_TEMPLATE =
  "Tusikilize Neno la Mungu kutoka {book_reference}, sura ya {chapter_words}.";
export const DEFAULT_SWAHILI_OUTRO = "Hilo ndilo Neno la Mungu.";

export type BibleNarrationTranslation = {
  code?: string | null;
  language_code?: string | null;
};

export type BibleNarrationBook = {
  name: string;
};

export type BibleNarrationChapter = {
  chapter_number: number;
};

export type BibleNarrationVerse = {
  verse_number?: number | null;
  verse_text?: string | null;
  text?: string | null;
  paragraph_break_before?: boolean | null;
  section_title?: string | null;
};

export type BibleNarrationOptions = {
  includeIntroduction?: boolean;
  introductionTemplate?: string;
  includeOutro?: boolean;
  outroTemplate?: string;
};

export type BibleNarrationInput = {
  translation: BibleNarrationTranslation;
  book: BibleNarrationBook;
  chapter: BibleNarrationChapter;
  verses: BibleNarrationVerse[];
  options?: BibleNarrationOptions;
};

const SWAHILI_ONES: Record<number, string> = {
  0: "sifuri",
  1: "moja",
  2: "mbili",
  3: "tatu",
  4: "nne",
  5: "tano",
  6: "sita",
  7: "saba",
  8: "nane",
  9: "tisa",
};

const SWAHILI_TEENS: Record<number, string> = {
  10: "kumi",
  11: "kumi na moja",
  12: "kumi na mbili",
  13: "kumi na tatu",
  14: "kumi na nne",
  15: "kumi na tano",
  16: "kumi na sita",
  17: "kumi na saba",
  18: "kumi na nane",
  19: "kumi na tisa",
};

const SWAHILI_TENS: Record<number, string> = {
  20: "ishirini",
  30: "thelathini",
  40: "arobaini",
  50: "hamsini",
  60: "sitini",
  70: "sabini",
  80: "themanini",
  90: "tisini",
};

const GOSPEL_BOOK_NAMES = new Set(["mathayo", "marko", "luka", "yohane"]);

export function swahiliNumberToWords(value: number): string {
  if (!Number.isInteger(value) || value < 0 || value > 9999) {
    throw new Error("Swahili narration supports whole numbers from 0 to 9999.");
  }

  if (value < 10) return SWAHILI_ONES[value];
  if (value < 20) return SWAHILI_TEENS[value];
  if (value < 100) return swahiliUnderOneHundred(value);
  if (value < 1000) return swahiliUnderOneThousand(value);

  const thousands = Math.floor(value / 1000);
  const remainder = value % 1000;
  const prefix = `elfu ${swahiliNumberToWords(thousands)}`;
  return remainder ? `${prefix} ${swahiliNumberToWords(remainder)}` : prefix;
}

export function getSwahiliBookReference(book: BibleNarrationBook): string {
  const bookName = cleanNarrationLine(book.name);
  if (GOSPEL_BOOK_NAMES.has(bookName.toLowerCase())) {
    return `Injili ya ${bookName}`;
  }
  return `kitabu cha ${bookName}`;
}

export function buildBibleNarrationText(input: BibleNarrationInput): string {
  const options = input.options ?? {};
  const includeIntroduction = options.includeIntroduction !== false;
  const introTemplate = options.introductionTemplate ?? DEFAULT_SWAHILI_INTRO_TEMPLATE;
  const includeOutro = options.includeOutro === true;
  const outroTemplate = options.outroTemplate ?? DEFAULT_SWAHILI_OUTRO;

  const blocks: string[] = [];
  if (includeIntroduction) {
    blocks.push(renderNarrationTemplate(introTemplate, input));
    blocks.push("");
  }

  for (const verse of input.verses) {
    const sectionTitle = cleanNarrationLine(verse.section_title ?? "");
    if (sectionTitle) {
      pushBlankLine(blocks);
      blocks.push(sectionTitle);
      pushBlankLine(blocks);
    } else if (verse.paragraph_break_before) {
      pushBlankLine(blocks);
    }

    const line = prepareVerseForNarration(verse);
    if (line) blocks.push(line);
  }

  if (includeOutro) {
    pushBlankLine(blocks);
    blocks.push(renderNarrationTemplate(outroTemplate, input));
  }

  return normalizeNarrationText(blocks.join("\n"));
}

export function prepareVerseForNarration(verse: BibleNarrationVerse): string {
  const rawText = verse.verse_text ?? verse.text ?? "";
  return cleanNarrationLine(rawText).replace(/^\d+[\s.)-]+/, "").trim();
}

export function renderNarrationTemplate(template: string, input: BibleNarrationInput): string {
  const languageCode = input.translation.language_code ?? input.translation.code ?? "sw";
  const chapterWords = languageCode.toLowerCase().startsWith("sw")
    ? swahiliNumberToWords(input.chapter.chapter_number)
    : String(input.chapter.chapter_number);
  const book = cleanNarrationLine(input.book.name);
  const replacements: Record<string, string> = {
    book,
    book_reference: getSwahiliBookReference(input.book),
    chapter: String(input.chapter.chapter_number),
    chapter_words: chapterWords,
  };

  return cleanNarrationLine(template.replace(/\{([a-z_]+)\}/gi, (_match, key: string) => replacements[key] ?? ""));
}

function swahiliUnderOneHundred(value: number): string {
  if (value < 20) return swahiliNumberToWords(value);

  const tens = Math.floor(value / 10) * 10;
  const remainder = value % 10;
  const prefix = SWAHILI_TENS[tens];
  return remainder ? `${prefix} na ${SWAHILI_ONES[remainder]}` : prefix;
}

function swahiliUnderOneThousand(value: number): string {
  const hundreds = Math.floor(value / 100);
  const remainder = value % 100;
  const prefix = `mia ${swahiliNumberToWords(hundreds)}`;
  return remainder ? `${prefix} ${swahiliNumberToWords(remainder)}` : prefix;
}

function cleanNarrationLine(value: string): string {
  return value
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((line) => line.replace(/\s+/g, " ").replace(/\s+([,.;:!?])/g, "$1").trim())
    .filter(Boolean)
    .join("\n");
}

function normalizeNarrationText(value: string): string {
  return value
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function pushBlankLine(lines: string[]) {
  if (lines.length > 0 && lines[lines.length - 1] !== "") {
    lines.push("");
  }
}

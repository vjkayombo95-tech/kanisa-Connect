import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { readdir } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import type { BibleBookSeed, BibleChapterSeed, BibleSeed, BibleTestament, BibleVerseSeed } from "../../src/lib/bible/schema.ts";
import { summarizeBibleSeed } from "../../src/lib/bible/schema.ts";

type ExtractionReport = {
  timestamp: string;
  input: string | null;
  output: string;
  book_name: string | null;
  books_processed: number;
  chapters_processed: number;
  verses_processed: number;
  chapters_found: number;
  verses_found: number;
  missing_chapters: number[];
  missing_verses: Array<{ chapter: number; verses: number[] }>;
  warnings: string[];
  errors: string[];
  duration_ms: number;
};

type PdfParseResult = {
  text: string;
  pages: number;
};

type SwahiliBookMetadata = {
  name: string;
  abbreviation: string;
  testament: BibleTestament;
};

type BibleBookConfig = SwahiliBookMetadata & {
  book_number: number;
  start_heading: string;
  end_heading: string | null;
  expected_chapter_count: number;
};

const startedAt = Date.now();
const args = parseArgs(process.argv.slice(2));
let inputPath = args.input ?? process.env.BIBLE_PDF_PATH ?? null;
const requestedBookName = args.book ? cleanLine(args.book) : null;
const requestedBookSlug = requestedBookName ? slugify(requestedBookName) : null;
const outputPath =
  args.output ??
  (requestedBookSlug
    ? `supabase/seed/bible/generated/${requestedBookSlug}.json`
    : "supabase/seed/bible/generated/biblica-sw.json");
const reportPath =
  args.report ??
  (requestedBookSlug
    ? `reports/bible/${requestedBookSlug}-extraction-report.json`
    : "reports/bible/extraction-report.json");
const warnings: string[] = [];
const errors: string[] = [];

const SWAHILI_BOOKS: SwahiliBookMetadata[] = [
  { name: "Mwanzo", abbreviation: "Mwa", testament: "old" },
  { name: "Kutoka", abbreviation: "Kut", testament: "old" },
  { name: "Walawi", abbreviation: "Law", testament: "old" },
  { name: "Hesabu", abbreviation: "Hes", testament: "old" },
  { name: "Kumbukumbu la Torati", abbreviation: "Kum", testament: "old" },
  { name: "Yoshua", abbreviation: "Yos", testament: "old" },
  { name: "Waamuzi", abbreviation: "Amu", testament: "old" },
  { name: "Ruthu", abbreviation: "Rut", testament: "old" },
  { name: "1 Samweli", abbreviation: "1Sam", testament: "old" },
  { name: "2 Samweli", abbreviation: "2Sam", testament: "old" },
  { name: "1 Wafalme", abbreviation: "1Fal", testament: "old" },
  { name: "2 Wafalme", abbreviation: "2Fal", testament: "old" },
  { name: "1 Nyakati", abbreviation: "1Nya", testament: "old" },
  { name: "2 Nyakati", abbreviation: "2Nya", testament: "old" },
  { name: "Ezra", abbreviation: "Ezr", testament: "old" },
  { name: "Nehemia", abbreviation: "Neh", testament: "old" },
  { name: "Esta", abbreviation: "Est", testament: "old" },
  { name: "Ayubu", abbreviation: "Ayu", testament: "old" },
  { name: "Zaburi", abbreviation: "Zab", testament: "old" },
  { name: "Mithali", abbreviation: "Mit", testament: "old" },
  { name: "Mhubiri", abbreviation: "Mhu", testament: "old" },
  { name: "Wimbo Ulio Bora", abbreviation: "Wim", testament: "old" },
  { name: "Isaya", abbreviation: "Isa", testament: "old" },
  { name: "Yeremia", abbreviation: "Yer", testament: "old" },
  { name: "Maombolezo", abbreviation: "Omb", testament: "old" },
  { name: "Ezekieli", abbreviation: "Eze", testament: "old" },
  { name: "Danieli", abbreviation: "Dan", testament: "old" },
  { name: "Hosea", abbreviation: "Hos", testament: "old" },
  { name: "Yoeli", abbreviation: "Yoe", testament: "old" },
  { name: "Amosi", abbreviation: "Amo", testament: "old" },
  { name: "Obadia", abbreviation: "Oba", testament: "old" },
  { name: "Yona", abbreviation: "Yon", testament: "old" },
  { name: "Mika", abbreviation: "Mik", testament: "old" },
  { name: "Nahumu", abbreviation: "Nah", testament: "old" },
  { name: "Habakuki", abbreviation: "Hab", testament: "old" },
  { name: "Sefania", abbreviation: "Sef", testament: "old" },
  { name: "Hagai", abbreviation: "Hag", testament: "old" },
  { name: "Zekaria", abbreviation: "Zek", testament: "old" },
  { name: "Malaki", abbreviation: "Mal", testament: "old" },
  { name: "Mathayo", abbreviation: "Mat", testament: "new" },
  { name: "Marko", abbreviation: "Mk", testament: "new" },
  { name: "Luka", abbreviation: "Lk", testament: "new" },
  { name: "Yohana", abbreviation: "Yn", testament: "new" },
  { name: "Matendo", abbreviation: "Mdo", testament: "new" },
  { name: "Warumi", abbreviation: "Rum", testament: "new" },
  { name: "1 Wakorintho", abbreviation: "1Kor", testament: "new" },
  { name: "2 Wakorintho", abbreviation: "2Kor", testament: "new" },
  { name: "Wagalatia", abbreviation: "Gal", testament: "new" },
  { name: "Waefeso", abbreviation: "Efe", testament: "new" },
  { name: "Wafilipi", abbreviation: "Flp", testament: "new" },
  { name: "Wakolosai", abbreviation: "Kol", testament: "new" },
  { name: "1 Wathesalonike", abbreviation: "1The", testament: "new" },
  { name: "2 Wathesalonike", abbreviation: "2The", testament: "new" },
  { name: "1 Timotheo", abbreviation: "1Tim", testament: "new" },
  { name: "2 Timotheo", abbreviation: "2Tim", testament: "new" },
  { name: "Tito", abbreviation: "Tit", testament: "new" },
  { name: "Filemoni", abbreviation: "Flm", testament: "new" },
  { name: "Waebrania", abbreviation: "Ebr", testament: "new" },
  { name: "Yakobo", abbreviation: "Yak", testament: "new" },
  { name: "1 Petro", abbreviation: "1Pet", testament: "new" },
  { name: "2 Petro", abbreviation: "2Pet", testament: "new" },
  { name: "1 Yohana", abbreviation: "1Yn", testament: "new" },
  { name: "2 Yohana", abbreviation: "2Yn", testament: "new" },
  { name: "3 Yohana", abbreviation: "3Yn", testament: "new" },
  { name: "Yuda", abbreviation: "Yud", testament: "new" },
  { name: "Ufunuo", abbreviation: "Ufu", testament: "new" },
];

const EXPECTED_CHAPTER_COUNTS = [
  50, 40, 27, 36, 34, 24, 21, 4, 31, 24, 22, 25, 29, 36, 10, 13, 10, 42, 150, 31, 12, 8, 66,
  52, 5, 48, 12, 14, 3, 9, 1, 4, 7, 3, 3, 3, 2, 14, 4, 28, 16, 24, 21, 28, 16, 16, 13, 6, 6,
  4, 4, 5, 3, 6, 4, 3, 1, 13, 5, 5, 3, 5, 1, 1, 1, 22,
];

const BOOK_CONFIGS = buildBookConfigs(SWAHILI_BOOKS);

async function main() {
  try {
    inputPath = await resolveInputPath(inputPath);

    if (!inputPath) {
      throw new Error("Missing PDF input. Pass --input path/to/bible.pdf or set BIBLE_PDF_PATH.");
    }

    if (!existsSync(inputPath)) {
      throw new Error(`PDF input does not exist: ${inputPath}`);
    }

    console.log("Loading PDF...");
    const pdf = await readPdfText(inputPath);
    console.log("PDF loaded successfully.");
    console.log(`Pages: ${pdf.pages}`);
    console.log(`Characters extracted: ${pdf.text.length}`);

    const seed = extractSeed(pdf.text, requestedBookName);
    const summary = summarizeBibleSeed(seed);
    const diagnostics = buildExtractionDiagnostics(seed, requestedBookName);

    mkdirSync(path.dirname(outputPath), { recursive: true });
    writeFileSync(outputPath, `${JSON.stringify(seed, null, 2)}\n`, "utf8");

    writeReport({
      timestamp: new Date().toISOString(),
      input: inputPath,
      output: outputPath,
      book_name: diagnostics.bookName,
      books_processed: summary.books,
      chapters_processed: summary.chapters,
      verses_processed: summary.verses,
      chapters_found: diagnostics.chaptersFound,
      verses_found: diagnostics.versesFound,
      missing_chapters: diagnostics.missingChapters,
      missing_verses: diagnostics.missingVerses,
      warnings,
      errors,
      duration_ms: Date.now() - startedAt,
    });

    console.log(`Bible extraction complete: ${outputPath}`);
  } catch (error) {
    errors.push(error instanceof Error ? error.message : String(error));
    writeReport({
      timestamp: new Date().toISOString(),
      input: inputPath,
      output: outputPath,
      book_name: requestedBookName,
      books_processed: 0,
      chapters_processed: 0,
      verses_processed: 0,
      chapters_found: 0,
      verses_found: 0,
      missing_chapters: [],
      missing_verses: [],
      warnings,
      errors,
      duration_ms: Date.now() - startedAt,
    });
    console.error(errors[errors.length - 1]);
    process.exitCode = 1;
  }
}

async function resolveInputPath(explicitInputPath: string | null) {
  if (explicitInputPath) return explicitInputPath;

  const sourceDir = "supabase/seed/bible/source";
  const preferredPaths = [
    path.join(sourceDir, "Biblia-Takatifu.pdf"),
    path.join(sourceDir, "biblia-takatifu.pdf"),
  ];

  for (const candidate of preferredPaths) {
    if (existsSync(candidate)) return candidate;
  }

  let sourceFiles: string[];
  try {
    sourceFiles = await readdir(sourceDir);
  } catch {
    throw new Error("No Bible PDF found in supabase/seed/bible/source.");
  }

  const pdfFiles = sourceFiles.filter((file) => file.toLowerCase().endsWith(".pdf"));
  if (pdfFiles.length === 1) return path.join(sourceDir, pdfFiles[0]);
  if (pdfFiles.length > 1) throw new Error("Multiple Bible PDFs found. Please specify --input.");

  throw new Error("No Bible PDF found in supabase/seed/bible/source.");
}

async function readPdfText(pdfPath: string) {
  let parser: { getText: () => Promise<{ text: string; total: number }>; destroy: () => Promise<void> } | null = null;
  let PDFParse: new (options: { data: Buffer }) => { getText: () => Promise<{ text: string; total: number }>; destroy: () => Promise<void> };

  try {
    ({ PDFParse } = await import("pdf-parse"));
  } catch {
    throw new Error("PDF extraction requires the optional dependency pdf-parse. Install it before running bible:extract.");
  }

  try {
    parser = new PDFParse({ data: readFileSync(pdfPath) });
    const result = await parser.getText();
    return {
      text: result.text,
      pages: result.total,
    };
  } finally {
    await parser?.destroy();
  }
}

function extractSeed(text: string, requestedBook: string | null): BibleSeed {
  const lines = text.split(/\r?\n/);
  const bookRanges = buildBookRanges(lines);
  const booksByName = new Map(BOOK_CONFIGS.map((book) => [normalizeHeading(book.name), book]));
  const requestedBookKey = requestedBook ? normalizeHeading(requestedBook) : null;
  const requestedBookConfig = requestedBookKey ? booksByName.get(requestedBookKey) : null;

  if (requestedBookKey && !requestedBookConfig) {
    throw new Error(`Unsupported Bible book "${requestedBook}". Check the Kiswahili book name, for example: Mathayo.`);
  }

  const seed: BibleSeed = {
    translation: {
      code: "sw-biblica",
      name: "Biblica Toleo Wazi Neno",
      language: "sw",
    },
    books: requestedBookConfig
      ? [extractConfiguredBook(lines, requestedBookConfig, bookRanges.get(requestedBookConfig.name))]
      : BOOK_CONFIGS.map((bookConfig) => extractConfiguredBook(lines, bookConfig, bookRanges.get(bookConfig.name))),
  };

  if (!seed.books.length) {
    warnings.push(
      requestedBook
        ? `Book "${requestedBook}" was not detected. Check whether the PDF text headings match the extractor heuristics.`
        : "No books were detected. Check whether the PDF text layout matches the extractor heuristics.",
    );
  }

  return seed;
}

function buildBookConfigs(books: SwahiliBookMetadata[]): BibleBookConfig[] {
  return books.map((book, index) => ({
    ...book,
    book_number: index + 1,
    start_heading: getBookHeading(book.name),
    end_heading: books[index + 1] ? getBookHeading(books[index + 1].name) : null,
    expected_chapter_count: EXPECTED_CHAPTER_COUNTS[index] ?? 0,
  }));
}

function getBookHeading(bookName: string) {
  if (bookName === "Walawi") return "MAMBO YA WALAWI";
  if (bookName === "1 Nyakati") return "1 MAMBO YA NYAKATI";
  if (bookName === "2 Nyakati") return "2 MAMBO YA NYAKATI";
  if (bookName === "Matendo") return "MATENDO YA MITUME";
  return bookName.toUpperCase();
}

function extractConfiguredBook(
  lines: string[],
  bookConfig: BibleBookConfig,
  range: { startIndex: number; endIndex: number } | undefined,
): BibleBookSeed {
  const startIndex = range?.startIndex ?? -1;
  const endIndex = range?.endIndex ?? lines.length;

  if (startIndex === -1) {
    warnings.push(`Book "${bookConfig.name}" was not detected at body heading "${bookConfig.start_heading}".`);
    return {
      book_number: bookConfig.book_number,
      name: bookConfig.name,
      abbreviation: bookConfig.abbreviation,
      testament: bookConfig.testament,
      chapters: [],
    };
  }

  const book: BibleBookSeed = {
    book_number: bookConfig.book_number,
    name: bookConfig.name,
    abbreviation: bookConfig.abbreviation,
    testament: bookConfig.testament,
    chapters: [],
  };

  let currentChapter: BibleChapterSeed | null = null;
  let currentVerse: BibleVerseSeed | null = null;
  let pendingVerseNumber: number | null = null;
  let isSkippingCrossReferenceBlock = false;

  for (let index = startIndex + 1; index < endIndex; index += 1) {
    const line = normalizeBodyLine(lines[index]);
    if (!line || isSingleBookNoise(line, bookConfig)) continue;

    if (isSkippingCrossReferenceBlock) {
      if (!isBibleBodyLine(line, bookConfig, book, currentChapter, currentVerse, pendingVerseNumber)) continue;
      isSkippingCrossReferenceBlock = false;
    }

    if (isCrossReferenceBlockStartLine(line)) {
      isSkippingCrossReferenceBlock = true;
      continue;
    }

    const namedChapterStart = matchNamedChapterStart(line, bookConfig, book.chapters.length + 1);
    if (namedChapterStart) {
      currentChapter = { chapter: namedChapterStart, verses: [] };
      book.chapters.push(currentChapter);
      currentVerse = null;
      pendingVerseNumber = null;
      continue;
    }

    const chapterStart = line.match(/^(\d{1,3})[a-z]?\s+1(?:\s+(.+))?$/);
    if (chapterStart) {
      const chapterNumber = Number(chapterStart[1]);
      const expectedChapter = book.chapters.length + 1;
      if (chapterNumber === expectedChapter) {
        currentChapter = { chapter: chapterNumber, verses: [] };
        book.chapters.push(currentChapter);
        currentVerse = null;
        pendingVerseNumber = 1;
        const firstVerseText = chapterStart[2]?.trim();
        if (firstVerseText) {
          ({ currentVerse, pendingVerseNumber } = applyVerseLine(
            firstVerseText,
            currentChapter,
            currentVerse,
            pendingVerseNumber,
          ));
        }
      }
      continue;
    }

    if (!currentChapter && matchVerseMarker(line, 1)) {
      currentChapter = { chapter: 1, verses: [] };
      book.chapters.push(currentChapter);
      currentVerse = null;
      pendingVerseNumber = null;
    }

    if (!currentChapter) continue;

    if (shouldStartImplicitChapter(line, currentChapter)) {
      currentChapter = { chapter: book.chapters.length + 1, verses: [] };
      book.chapters.push(currentChapter);
      currentVerse = null;
      pendingVerseNumber = null;
    }

    const expectedVerse = pendingVerseNumber ?? currentChapter.verses.length + 1;
    const lineStartsExpectedVerse = matchVerseMarker(line, expectedVerse);
    if (!currentVerse && !lineStartsExpectedVerse && pendingVerseNumber === null) continue;

    ({ currentVerse, pendingVerseNumber } = applyVerseLine(
      line,
      currentChapter,
      currentVerse,
      pendingVerseNumber,
    ));
  }

  return book;
}

function buildBookRanges(lines: string[]) {
  const headingMap = new Map(BOOK_CONFIGS.map((config) => [config.start_heading, config]));
  const detected: Array<{ config: BibleBookConfig; lineIndex: number }> = [];

  for (let index = 0; index < lines.length; index += 1) {
    const line = normalizeBodyLine(lines[index]);
    const config = headingMap.get(line);
    if (!config) continue;

    const nextLine = findNextNonEmptyLine(lines, index + 1);
    if (!nextLine || isTableOfContentsLine(nextLine)) continue;

    detected.push({ config, lineIndex: index });
  }

  detected.sort((left, right) => left.config.book_number - right.config.book_number);

  const ranges = new Map<string, { startIndex: number; endIndex: number }>();
  for (let index = 0; index < detected.length; index += 1) {
    const current = detected[index];
    const next = detected[index + 1];
    ranges.set(current.config.name, {
      startIndex: current.lineIndex,
      endIndex: next?.lineIndex ?? lines.length,
    });
  }

  return ranges;
}

function findNextNonEmptyLine(lines: string[], startIndex: number) {
  for (let index = startIndex; index < lines.length; index += 1) {
    const line = normalizeBodyLine(lines[index]);
    if (line) return line;
  }
  return null;
}

function matchNamedChapterStart(line: string, bookConfig: BibleBookConfig, expectedChapter: number) {
  const escapedBookName = bookConfig.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = new RegExp(`^${escapedBookName}\\s+(\\d{1,3})$`, "i").exec(line);
  if (!match) return null;
  const chapterNumber = Number(match[1]);
  return chapterNumber === expectedChapter ? chapterNumber : null;
}

function applyVerseLine(
  line: string,
  chapter: BibleChapterSeed,
  currentVerse: BibleVerseSeed | null,
  pendingVerseNumber: number | null,
) {
  let remaining = line;
  let activeVerse = currentVerse;
  let pending = pendingVerseNumber;

  if (pending !== null) {
    activeVerse = addVerse(chapter, pending, "");
    pending = null;
  }

  while (remaining) {
    const expectedVerse = chapter.verses.length + 1;
    const marker = matchVerseMarker(remaining, expectedVerse);

    if (!marker) {
      if (activeVerse) appendVerseText(activeVerse, remaining);
      break;
    }

    const prefix = remaining.slice(0, marker.index).trim();
    if (prefix && activeVerse) appendVerseText(activeVerse, prefix);

    const verseText = stripLeadingFootnoteMarker(remaining.slice(marker.end).trim());
    activeVerse = addVerse(chapter, expectedVerse, verseText);
    remaining = "";
  }

  return { currentVerse: activeVerse, pendingVerseNumber: pending };
}

function addVerse(chapter: BibleChapterSeed, verseNumber: number, text: string) {
  const verse = { verse: verseNumber, text };
  chapter.verses.push(verse);
  return verse;
}

function appendVerseText(verse: BibleVerseSeed, text: string) {
  const nextText = verse.text ? text : stripLeadingFootnoteMarker(text);
  verse.text = `${verse.text} ${nextText}`.replace(/\s+/g, " ").trim();
}

function matchVerseMarker(line: string, verseNumber: number) {
  const pattern = new RegExp(`(^|\\s)${verseNumber}\\s+(?=[a-z]?[A-Za-zÀ-ÖØ-öø-ÿ“‘])`);
  const match = pattern.exec(line);
  if (!match) return null;
  const separatorLength = match[1]?.length ?? 0;
  return {
    index: match.index,
    end: match.index + separatorLength + String(verseNumber).length + 1,
  };
}

function shouldStartImplicitChapter(line: string, currentChapter: BibleChapterSeed) {
  return currentChapter.verses.length > 0 && /^1\s+[a-z]?[A-ZÀ-ÖØ-Ý“‘]/u.test(line);
}

function stripLeadingFootnoteMarker(value: string) {
  return value.replace(/^[a-z](?=[A-Za-zÀ-ÖØ-öø-ÿ“‘])/u, "").trim();
}

function normalizeBodyLine(line: string) {
  return line.replace(/\s+/g, " ").trim();
}

function isSingleBookNoise(line: string, bookConfig: BibleBookConfig) {
  return (
    isPageNoise(line) ||
    isBookPageHeader(line, bookConfig.name) ||
    isAnyBookPageHeader(line) ||
    isCrossReferenceHeading(line)
  );
}

function isBookPageHeader(line: string, bookName: string) {
  const escapedBookName = bookName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return (
    new RegExp(`^${escapedBookName}\\s+\\d{1,3}\\s+\\d{1,4}$`, "i").test(line) ||
    new RegExp(`^\\d{1,4}\\s+${escapedBookName}\\s+\\d{1,3}$`, "i").test(line)
  );
}

function isAnyBookPageHeader(line: string) {
  return (
    /^\d{1,4}\s+[A-Za-z0-9À-ÖØ-öø-ÿ\s]+\s+\d{1,3}$/.test(line) ||
    /^[A-Za-z0-9À-ÖØ-öø-ÿ\s]+\s+\d{1,3}\s+\d{1,4}$/.test(line)
  );
}

function isTableOfContentsLine(line: string) {
  return /\.{2,}\s*\d+$/.test(line);
}

function isFootnoteLine(line: string) {
  return /^[a-z]\s+(?:\d{1,3}:|\d+\s|…)/u.test(line);
}

function isCrossReferenceBlockStartLine(line: string) {
  return isFootnoteLine(line) || isCrossReferenceLine(line);
}

function isCrossReferenceContinuationLine(line: string) {
  return isFootnoteLine(line) || isCrossReferenceLine(line) || isReferenceWrappedLine(line);
}

function isBibleBodyLine(
  line: string,
  bookConfig: BibleBookConfig,
  book: BibleBookSeed,
  currentChapter: BibleChapterSeed | null,
  currentVerse: BibleVerseSeed | null,
  pendingVerseNumber: number | null,
) {
  if (BOOK_CONFIGS.some((config) => line === config.start_heading)) return true;
  if (matchNamedChapterStart(line, bookConfig, book.chapters.length + 1)) return true;
  if (line.match(new RegExp(`^${book.chapters.length + 1}[a-z]?\\s+1(?:\\s+.+)?$`))) return true;

  if (currentChapter) {
    if (shouldStartImplicitChapter(line, currentChapter)) return true;
    const expectedVerse = pendingVerseNumber ?? currentChapter.verses.length + 1;
    if (matchVerseMarker(line, expectedVerse)) return true;
  }

  return Boolean(currentVerse && isVerseContinuationLine(line));
}

function isVerseContinuationLine(line: string) {
  if (isCrossReferenceContinuationLine(line)) return false;
  if (/^\d/.test(line)) return false;
  return /^[a-z"“‘(]/i.test(line);
}

function isCrossReferenceLine(line: string) {
  const bibleReference = "\\d{1,3}:\\d{1,3}(?:[-–]\\d{1,3})?";
  const startsWithSourceReference = new RegExp(`^${bibleReference}(?:[;,]|\\s+)`);
  const startsWithReferenceList = new RegExp(`^[1-3]?\\s?[A-Za-zÀ-ÖØ-öø-ÿ]{2,}\\s+${bibleReference}`);
  const referenceCount = line.match(new RegExp(bibleReference, "g"))?.length ?? 0;

  return (
    (startsWithSourceReference.test(line) && referenceCount >= 2) ||
    (startsWithReferenceList.test(line) && referenceCount >= 2 && /[;,]/.test(line))
  );
}

function isReferenceWrappedLine(line: string) {
  const bibleReference = "\\d{1,3}:\\d{1,3}(?:[-–]\\d{1,3})?";
  const startsWithReferenceFragment = new RegExp(`^(?:${bibleReference}|\\d{1,3}(?:,|;)|[1-3]?\\s?[A-Za-zÀ-ÖØ-öø-ÿ]{2,}\\s+\\d{1,3})`);
  const referenceCount = line.match(new RegExp(bibleReference, "g"))?.length ?? 0;

  return startsWithReferenceFragment.test(line) && (referenceCount > 0 || /[;,]/.test(line));
}

function isCrossReferenceHeading(line: string) {
  return /^\([^)]+(?:\d|:)[^)]+\)$/.test(line);
}

function buildExtractionDiagnostics(seed: BibleSeed, requestedBook: string | null) {
  const book = requestedBook ? seed.books[0] : null;
  const chapters = requestedBook ? book?.chapters ?? [] : seed.books.flatMap((item) => item.chapters);
  const chaptersFound = chapters.length;
  const versesFound = chapters.reduce((sum, chapter) => sum + chapter.verses.length, 0);
  const expectedChapterCount = requestedBook
    ? BOOK_CONFIGS.find((config) => normalizeHeading(config.name) === normalizeHeading(requestedBook))?.expected_chapter_count
    : undefined;
  const foundChapterNumbers = new Set(chapters.map((chapter) => chapter.chapter));
  const maxChapter = expectedChapterCount ?? (foundChapterNumbers.size ? Math.max(...foundChapterNumbers) : 0);
  const missingChapters: number[] = [];
  const missingVerses: Array<{ chapter: number; verses: number[] }> = [];

  for (let chapter = 1; chapter <= maxChapter; chapter += 1) {
    if (!foundChapterNumbers.has(chapter)) missingChapters.push(chapter);
  }

  for (const chapter of chapters) {
    const foundVerses = new Set(chapter.verses.map((verse) => verse.verse));
    if (!foundVerses.size) continue;
    const maxVerse = Math.max(...foundVerses);
    const missing: number[] = [];
    for (let verse = 1; verse <= maxVerse; verse += 1) {
      if (!foundVerses.has(verse)) missing.push(verse);
    }
    if (missing.length) {
      missingVerses.push({ chapter: chapter.chapter, verses: missing });
    }
  }

  if (requestedBook && expectedChapterCount && chaptersFound !== expectedChapterCount) {
    warnings.push(`${requestedBook} expected ${expectedChapterCount} chapters; extractor found ${chaptersFound}.`);
  }

  return {
    bookName: requestedBook ? book?.name ?? requestedBook : null,
    chaptersFound,
    versesFound,
    missingChapters,
    missingVerses,
  };
}

function cleanLine(line: string) {
  return line.replace(/\s+/g, " ").trim();
}

function normalizeHeading(value: string) {
  return cleanLine(value).toLowerCase();
}

function slugify(value: string) {
  return normalizeHeading(value)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function isPageNoise(line: string) {
  return (
    /^\d+$/.test(line) ||
    /^--\s+\d+\s+of\s+\d+\s+--$/i.test(line) ||
    /^biblica/i.test(line) ||
    /^agano\s+(?:la\s+)?(?:kale|jipya)$/i.test(line)
  );
}

function parseArgs(argv: string[]) {
  const parsed: Record<string, string> = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (!arg.startsWith("--")) continue;
    const key = arg.slice(2);
    const next = argv[index + 1];
    if (next && !next.startsWith("--")) {
      parsed[key] = next;
      index += 1;
    }
  }
  return parsed;
}

function writeReport(report: ExtractionReport) {
  mkdirSync(path.dirname(reportPath), { recursive: true });
  writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
}

main();

import { createClient } from "@supabase/supabase-js";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import type { BibleBookSeed, BibleChapterSeed, BibleSeed } from "../../src/lib/bible/schema.ts";
import { summarizeBibleSeed, validateBibleSeed } from "../../src/lib/bible/schema.ts";

type ImportAction = "created" | "skipped" | "failed" | "deleted";
type ImportStage =
  | "environment"
  | "load_json"
  | "validate_json"
  | "translation_lookup"
  | "translation_delete"
  | "translation_insert"
  | "book_lookup"
  | "book_insert"
  | "chapter_lookup"
  | "chapter_insert"
  | "verse_lookup"
  | "verse_insert"
  | "rollback";

type ImportReport = {
  timestamp: string;
  status: "complete" | "failed";
  input: string;
  mode: "insert-only" | "replace";
  translation_code: string | null;
  stage: ImportStage | null;
  translation: string | null;
  book: string | null;
  chapter: number | null;
  verse: number | null;
  supabase: SupabaseErrorLike | null;
  request: SupabaseRequestDiagnostic | null;
  stack: string | null;
  books_processed: number;
  chapters_processed: number;
  verses_processed: number;
  created: number;
  skipped: number;
  deleted: number;
  failed: number;
  warnings: string[];
  errors: string[];
  duration_ms: number;
};

type SupabaseErrorLike = {
  code?: string | null;
  message?: string | null;
  details?: string | null;
  hint?: string | null;
};

type ImportContext = {
  stage: ImportStage;
  translation?: string | null;
  book?: string | null;
  chapter?: number | null;
  verse?: number | null;
  request?: SupabaseRequestDiagnostic | null;
};

type ImportDiagnostic = {
  stage: ImportStage;
  translation: string | null;
  book: string | null;
  chapter: number | null;
  verse: number | null;
  supabase: SupabaseErrorLike | null;
  request: SupabaseRequestDiagnostic | null;
  stack: string | null;
  message: string;
};

type SupabaseRequestDiagnostic = {
  url: string;
  method: string;
  table: string;
  operation: string;
  retry_count: number;
};

type SupabaseRequestContext = ImportContext & {
  method: string;
  table: string;
  operation: string;
};

type ResumeCheckpoint = {
  book: string;
  chapter: number | null;
  verse: number | null;
};

class BibleImportError extends Error {
  diagnostic: ImportDiagnostic;

  constructor(context: ImportContext, error: unknown) {
    const diagnostic = buildDiagnostic(context, error);
    super(diagnostic.message);
    this.name = "BibleImportError";
    this.diagnostic = diagnostic;
    this.stack = diagnostic.stack ?? this.stack;
  }
}

type TranslationRow = { id: string; code: string };
type BookRow = { id: string; book_number: number; name: string };
type ChapterRow = { id: string; chapter_number: number };

const startedAt = Date.now();
const args = new Set(process.argv.slice(2));
const parsedArgs = parseArgs(process.argv.slice(2));
const replaceExisting = args.has("--replace");
const inputPath =
  parsedArgs.input ??
  (existsSync("supabase/seed/bible/published/biblica-sw.json")
    ? "supabase/seed/bible/published/biblica-sw.json"
    : "supabase/seed/bible/generated/biblica-sw.json");
const reportPath = parsedArgs.report ?? "reports/bible/import-report.json";
const batchSize = Number(parsedArgs.batchSize ?? 500);

loadEnvFile();

const supabaseUrl = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
const serviceRoleKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ??
  process.env.SUPABASE_SERVICE_KEY ??
  process.env.SERVICE_ROLE_KEY;

const warnings: string[] = [];
const errors: string[] = [];
const counters: Record<ImportAction, number> = { created: 0, skipped: 0, failed: 0, deleted: 0 };
const createdTranslationIds: string[] = [];
const createdBookIds: string[] = [];
const createdChapterIds: string[] = [];
const createdVerseIds: string[] = [];
let failureDiagnostic: ImportDiagnostic | null = null;
const resumeCheckpoint = loadResumeCheckpoint();

let supabase: ReturnType<typeof createClient>;

async function main() {
  let seed: BibleSeed | null = null;

  try {
    validateEnvironment();
    supabase = createClient(supabaseUrl!, serviceRoleKey!, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    if (!existsSync(inputPath)) throw new BibleImportError({ stage: "load_json" }, new Error(`Bible JSON does not exist: ${inputPath}`));
    seed = JSON.parse(readJsonFile(inputPath)) as BibleSeed;
    const validation = validateBibleSeed(seed);
    warnings.push(...validation.warnings.map((issue) => `${issue.path}: ${issue.message}`));
    if (!validation.valid) {
      throw new BibleImportError(
        { stage: "validate_json", translation: seed.translation.code },
        new Error(`Bible JSON validation failed with ${validation.errors.length} error(s). Run npm run bible:validate for details.`),
      );
    }

    await importBible(seed);
  } catch (error) {
    counters.failed += 1;
    failureDiagnostic = getDiagnostic(error);
    errors.push(formatError(error));
    printDiagnostic(failureDiagnostic);
    await rollbackCreatedRows();
    process.exitCode = 1;
  } finally {
    const summary = seed ? summarizeBibleSeed(seed) : { books: 0, chapters: 0, verses: 0 };
    const report: ImportReport = {
      timestamp: new Date().toISOString(),
      status: counters.failed ? "failed" : "complete",
      input: inputPath,
      mode: replaceExisting ? "replace" : "insert-only",
      translation_code: seed?.translation.code ?? null,
      stage: failureDiagnostic?.stage ?? null,
      translation: failureDiagnostic?.translation ?? seed?.translation.code ?? null,
      book: failureDiagnostic?.book ?? null,
      chapter: failureDiagnostic?.chapter ?? null,
      verse: failureDiagnostic?.verse ?? null,
      supabase: failureDiagnostic?.supabase ?? null,
      request: failureDiagnostic?.request ?? null,
      stack: failureDiagnostic?.stack ?? null,
      books_processed: summary.books,
      chapters_processed: summary.chapters,
      verses_processed: summary.verses,
      created: counters.created,
      skipped: counters.skipped,
      deleted: counters.deleted,
      failed: counters.failed,
      warnings,
      errors,
      duration_ms: Date.now() - startedAt,
    };
    writeReport(report);
    printReport(report);
  }
}

async function importBible(seed: BibleSeed) {
  console.log(`Importing ${seed.translation.code} (${replaceExisting ? "replace" : "insert-only"})`);

  const existingTranslation = await findTranslation(seed.translation.code);
  if (existingTranslation && replaceExisting) {
    const { error } = await executeSupabaseQuery(
      {
        stage: "translation_delete",
        translation: seed.translation.code,
        method: "DELETE",
        table: "bible_translations",
        operation: "Delete existing translation",
      },
      () => supabase.from("bible_translations").delete().eq("id", existingTranslation.id),
    );
    if (error) throwSupabaseError({ stage: "translation_delete", translation: seed.translation.code }, error);
    counters.deleted += 1;
  }

  let translation: TranslationRow;
  if (replaceExisting || !existingTranslation) {
    translation = await insertTranslation(seed);
  } else {
    translation = existingTranslation;
  }

  if (existingTranslation && !replaceExisting) {
    counters.skipped += 1;
    warnings.push(`Translation ${seed.translation.code} already exists. Existing rows will be kept; only missing content will be inserted.`);
  }

  for (const book of getBooksForImport(seed.books)) {
    const bookRow = await ensureBook(translation.id, seed.translation.code, book);
    for (const chapter of getChaptersForImport(book)) {
      const chapterRow = await ensureChapter(translation.id, seed.translation.code, bookRow.id, book, chapter);
      await ensureVerses(translation.id, seed.translation.code, bookRow.id, book, chapterRow.id, chapter);
    }
  }
}

function getBooksForImport(books: BibleBookSeed[]) {
  if (!resumeCheckpoint) return books;
  const startIndex = books.findIndex((book) => book.name === resumeCheckpoint.book);
  if (startIndex === -1) return books;
  return books.slice(startIndex);
}

function getChaptersForImport(book: BibleBookSeed) {
  if (!resumeCheckpoint || book.name !== resumeCheckpoint.book || resumeCheckpoint.chapter === null) {
    return book.chapters;
  }

  return book.chapters.filter((chapter) => chapter.chapter >= resumeCheckpoint.chapter!);
}

async function findTranslation(code: string) {
  const { data, error } = await executeSupabaseQuery(
    {
      stage: "translation_lookup",
      translation: code,
      method: "GET",
      table: "bible_translations",
      operation: "Lookup translation",
    },
    () => supabase
      .from("bible_translations")
      .select("id, code")
      .eq("code", code)
      .maybeSingle(),
  );
  if (error) throwSupabaseError({ stage: "translation_lookup", translation: code }, error);
  return data as TranslationRow | null;
}

async function insertTranslation(seed: BibleSeed) {
  const { data, error } = await executeSupabaseQuery(
    {
      stage: "translation_insert",
      translation: seed.translation.code,
      method: "POST",
      table: "bible_translations",
      operation: "Insert translation",
    },
    () => supabase
      .from("bible_translations")
      .insert({
        code: seed.translation.code,
        name: seed.translation.name,
        language_code: seed.translation.language,
        description: seed.translation.description ?? null,
        is_active: true,
      })
      .select("id, code")
      .single(),
  );
  if (error) throwSupabaseError({ stage: "translation_insert", translation: seed.translation.code }, error);
  counters.created += 1;
  createdTranslationIds.push((data as TranslationRow).id);
  return data as TranslationRow;
}

async function ensureBook(translationId: string, translationCode: string, book: BibleBookSeed) {
  const { data: existing, error: existingError } = await executeSupabaseQuery(
    {
      stage: "book_lookup",
      translation: translationCode,
      book: book.name,
      method: "GET",
      table: "bible_books",
      operation: "Lookup book",
    },
    () => supabase
      .from("bible_books")
      .select("id, book_number, name")
      .eq("translation_id", translationId)
      .eq("book_number", book.book_number)
      .maybeSingle(),
  );
  if (existingError) throwSupabaseError({ stage: "book_lookup", translation: translationCode, book: book.name }, existingError);
  if (existing) {
    counters.skipped += 1;
    return existing as BookRow;
  }

  const { data, error } = await executeSupabaseQuery(
    {
      stage: "book_insert",
      translation: translationCode,
      book: book.name,
      method: "POST",
      table: "bible_books",
      operation: "Insert book",
    },
    () => supabase
      .from("bible_books")
      .insert({
        translation_id: translationId,
        book_number: book.book_number,
        name: book.name,
        abbreviation: book.abbreviation ?? null,
        testament: book.testament,
      })
      .select("id, book_number, name")
      .single(),
  );
  if (error) throwSupabaseError({ stage: "book_insert", translation: translationCode, book: book.name }, error);
  counters.created += 1;
  createdBookIds.push((data as BookRow).id);
  return data as BookRow;
}

async function ensureChapter(
  translationId: string,
  translationCode: string,
  bookId: string,
  book: BibleBookSeed,
  chapter: BibleChapterSeed,
) {
  const { data: existing, error: existingError } = await executeSupabaseQuery(
    {
      stage: "chapter_lookup",
      translation: translationCode,
      book: book.name,
      chapter: chapter.chapter,
      method: "GET",
      table: "bible_chapters",
      operation: "Lookup chapter",
    },
    () => supabase
      .from("bible_chapters")
      .select("id, chapter_number")
      .eq("book_id", bookId)
      .eq("chapter_number", chapter.chapter)
      .maybeSingle(),
  );
  if (existingError) {
    throwSupabaseError({ stage: "chapter_lookup", translation: translationCode, book: book.name, chapter: chapter.chapter }, existingError);
  }
  if (existing) {
    counters.skipped += 1;
    return existing as ChapterRow;
  }

  const { data, error } = await executeSupabaseQuery(
    {
      stage: "chapter_insert",
      translation: translationCode,
      book: book.name,
      chapter: chapter.chapter,
      method: "POST",
      table: "bible_chapters",
      operation: "Insert chapter",
    },
    () => supabase
      .from("bible_chapters")
      .insert({
        translation_id: translationId,
        book_id: bookId,
        chapter_number: chapter.chapter,
      })
      .select("id, chapter_number")
      .single(),
  );
  if (error) throwSupabaseError({ stage: "chapter_insert", translation: translationCode, book: book.name, chapter: chapter.chapter }, error);
  counters.created += 1;
  createdChapterIds.push((data as ChapterRow).id);
  return data as ChapterRow;
}

async function ensureVerses(
  translationId: string,
  translationCode: string,
  bookId: string,
  book: BibleBookSeed,
  chapterId: string,
  chapter: BibleChapterSeed,
) {
  const { data: existing, error: existingError } = await executeSupabaseQuery(
    {
      stage: "verse_lookup",
      translation: translationCode,
      book: book.name,
      chapter: chapter.chapter,
      method: "GET",
      table: "bible_verses",
      operation: "Lookup verses",
    },
    () => supabase
      .from("bible_verses")
      .select("verse_number")
      .eq("translation_id", translationId)
      .eq("book_id", bookId)
      .eq("chapter_number", chapter.chapter),
  );
  if (existingError) {
    throwSupabaseError({ stage: "verse_lookup", translation: translationCode, book: book.name, chapter: chapter.chapter }, existingError);
  }

  const existingVerses = new Set(((existing ?? []) as Array<{ verse_number: number | null }>).map((row) => row.verse_number).filter(Boolean));
  const missingVerses = chapter.verses.filter((verse) => !existingVerses.has(verse.verse));
  counters.skipped += chapter.verses.length - missingVerses.length;

  for (let index = 0; index < missingVerses.length; index += batchSize) {
    const batch = missingVerses.slice(index, index + batchSize).map((verse) => ({
      translation_id: translationId,
      book_id: bookId,
      chapter_id: chapterId,
      chapter_number: chapter.chapter,
      verse_number: verse.verse,
      reference: formatBibleReference(book.name, chapter.chapter, verse.verse),
      text: verse.text,
      verse_text: verse.text,
    }));
    if (!batch.length) continue;

    const { data, error } = await executeSupabaseQuery(
      {
        stage: "verse_insert",
        translation: translationCode,
        book: book.name,
        chapter: chapter.chapter,
        verse: missingVerses[index]?.verse ?? null,
        method: "POST",
        table: "bible_verses",
        operation: "Insert verses",
      },
      () => supabase.from("bible_verses").insert(batch).select("id"),
    );
    if (error) {
      throwSupabaseError(
        {
          stage: "verse_insert",
          translation: translationCode,
          book: book.name,
          chapter: chapter.chapter,
          verse: missingVerses[index]?.verse ?? null,
        },
        error,
      );
    }
    const inserted = (data ?? []) as Array<{ id: string }>;
    counters.created += inserted.length;
    createdVerseIds.push(...inserted.map((row) => row.id));
    console.log(`Imported chapter ${chapter.chapter}: ${Math.min(index + batch.length, missingVerses.length)}/${missingVerses.length} new verses`);
  }
}

async function rollbackCreatedRows() {
  if (!createdTranslationIds.length && !createdBookIds.length && !createdChapterIds.length && !createdVerseIds.length) return;

  warnings.push("Import failed. Rolling back rows created during this run.");
  await deleteIds("bible_verses", createdVerseIds);
  await deleteIds("bible_chapters", createdChapterIds);
  await deleteIds("bible_books", createdBookIds);
  await deleteIds("bible_translations", createdTranslationIds);
}

async function deleteIds(table: string, ids: string[]) {
  if (!ids.length) return;
  const { error } = await executeSupabaseQuery(
    {
      stage: "rollback",
      method: "DELETE",
      table,
      operation: "Rollback delete",
    },
    () => supabase.from(table).delete().in("id", ids),
  );
  if (error) {
    const rollbackDiagnostic = buildDiagnostic({ stage: "rollback" }, error);
    errors.push(`Rollback failed for ${table}: ${rollbackDiagnostic.message}`);
    printDiagnostic(rollbackDiagnostic);
    return;
  }
  counters.deleted += ids.length;
}

async function executeSupabaseQuery<T>(
  context: SupabaseRequestContext,
  queryFactory: () => PromiseLike<T>,
): Promise<T> {
  const maxRetries = 3;
  let lastError: unknown = null;

  for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
    try {
      const result = await queryFactory();
      const maybeError = getQueryError(result);
      if (!maybeError || !isTransientNetworkError(maybeError)) {
        return result;
      }

      lastError = maybeError;
      if (attempt === maxRetries) break;
    } catch (error) {
      lastError = error;
      if (!isTransientNetworkError(error) || attempt === maxRetries) break;
    }

    const delayMs = 1000 * 2 ** attempt;
    console.warn(`Transient Supabase network failure. Retrying in ${delayMs / 1000}s (${attempt + 1}/${maxRetries})...`);
    await delay(delayMs);
  }

  throw new BibleImportError(
    {
      ...context,
      request: buildRequestDiagnostic(context, maxRetries),
    },
    lastError,
  );
}

function buildRequestDiagnostic(context: SupabaseRequestContext, retryCount: number): SupabaseRequestDiagnostic {
  return {
    url: `${supabaseUrl?.replace(/\/$/, "")}/rest/v1/${context.table}`,
    method: context.method,
    table: context.table,
    operation: context.operation,
    retry_count: retryCount,
  };
}

function getQueryError(result: unknown) {
  if (!result || typeof result !== "object" || !("error" in result)) return null;
  return (result as { error?: unknown }).error;
}

function isTransientNetworkError(error: unknown): boolean {
  return collectErrorText(error).some((text) => /ECONNRESET|ETIMEDOUT|fetch failed/i.test(text));
}

function collectErrorText(error: unknown): string[] {
  if (!error) return [];
  if (typeof error === "string") return [error];
  if (!(error instanceof Object)) return [String(error)];

  const parts: string[] = [];
  const candidate = error as {
    code?: unknown;
    message?: unknown;
    details?: unknown;
    hint?: unknown;
    stack?: unknown;
    cause?: unknown;
  };

  for (const value of [candidate.code, candidate.message, candidate.details, candidate.hint, candidate.stack]) {
    if (typeof value === "string") parts.push(value);
  }

  parts.push(...collectErrorText(candidate.cause));
  return parts;
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function loadResumeCheckpoint(): ResumeCheckpoint | null {
  if (replaceExisting || !existsSync(reportPath)) return null;

  try {
    const report = JSON.parse(readJsonFile(reportPath)) as Partial<ImportReport>;
    if (report.status !== "failed") return null;
    if (report.mode !== "insert-only") return null;
    if (!report.book) return null;
    if (!isTransientReportFailure(report)) return null;

    warnings.push(
      `Resuming insert-only import from previous transient failure at ${report.book}${report.chapter ? ` ${report.chapter}` : ""}.`,
    );

    return {
      book: report.book,
      chapter: report.chapter ?? null,
      verse: report.verse ?? null,
    };
  } catch (error) {
    warnings.push(`Could not read previous import report for resume: ${error instanceof Error ? error.message : String(error)}`);
    return null;
  }
}

function isTransientReportFailure(report: Partial<ImportReport>) {
  const values = [
    report.supabase?.code,
    report.supabase?.message,
    report.supabase?.details,
    report.supabase?.hint,
    report.stack,
    ...(report.errors ?? []),
  ];

  return values.some((value) => typeof value === "string" && /ECONNRESET|ETIMEDOUT|fetch failed/i.test(value));
}

function formatBibleReference(bookName: string, chapterNumber: number, verseNumber: number) {
  return `${bookName} ${chapterNumber}:${verseNumber}`;
}

function validateEnvironment() {
  const missing: string[] = [];
  if (!supabaseUrl) missing.push("SUPABASE_URL or VITE_SUPABASE_URL is required.");
  if (!serviceRoleKey) missing.push("SUPABASE_SERVICE_ROLE_KEY is required.");
  if (process.env.VITE_SUPABASE_SERVICE_ROLE_KEY) {
    missing.push("VITE_SUPABASE_SERVICE_ROLE_KEY must never be set.");
  }
  if (missing.length) {
    throw new BibleImportError({ stage: "environment" }, new Error(missing.join(" ")));
  }
}

function loadEnvFile() {
  const envPath = path.resolve(".env");
  if (!existsSync(envPath)) return;

  const lines = readFileSync(envPath, "utf8").split(/\r?\n/);
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const equalsIndex = line.indexOf("=");
    if (equalsIndex <= 0) continue;
    const key = line.slice(0, equalsIndex).trim();
    let value = line.slice(equalsIndex + 1).trim();
    if (!key || process.env[key] !== undefined) continue;
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
  }
}

function readJsonFile(filePath: string) {
  return readFileSync(filePath, "utf8").replace(/^\uFEFF/, "");
}

function formatError(error: unknown) {
  if (error instanceof BibleImportError) return error.diagnostic.message;
  if (error && typeof error === "object") {
    const supabaseError = error as SupabaseErrorLike;
    const parts = [
      supabaseError.code ? `Code: ${supabaseError.code}` : null,
      supabaseError.message ? `Message: ${supabaseError.message}` : null,
      supabaseError.details ? `Details: ${supabaseError.details}` : null,
      supabaseError.hint ? `Hint: ${supabaseError.hint}` : null,
    ].filter(Boolean);
    if (parts.length) return parts.join(" | ");
  }
  return error instanceof Error ? error.message : String(error);
}

function throwSupabaseError(context: ImportContext, error: unknown): never {
  throw new BibleImportError(context, error);
}

function getDiagnostic(error: unknown): ImportDiagnostic {
  if (error instanceof BibleImportError) return error.diagnostic;
  return buildDiagnostic({ stage: "load_json" }, error);
}

function buildDiagnostic(context: ImportContext, error: unknown): ImportDiagnostic {
  const supabase = getSupabaseError(error);
  const stack = getStack(error);
  const message = [
    `Stage: ${context.stage}`,
    context.translation ? `Translation: ${context.translation}` : null,
    context.book ? `Book: ${context.book}` : null,
    context.chapter !== undefined && context.chapter !== null ? `Chapter: ${context.chapter}` : null,
    context.verse !== undefined && context.verse !== null ? `Verse: ${context.verse}` : null,
    context.request ? `URL: ${context.request.url}` : null,
    context.request ? `HTTP method: ${context.request.method}` : null,
    context.request ? `Table: ${context.request.table}` : null,
    context.request ? `Operation: ${context.request.operation}` : null,
    context.request ? `Retry count: ${context.request.retry_count}` : null,
    supabase?.code ? `Code: ${supabase.code}` : null,
    supabase?.message ? `Message: ${supabase.message}` : error instanceof Error ? `Message: ${error.message}` : `Message: ${String(error)}`,
    supabase?.details ? `Details: ${supabase.details}` : null,
    supabase?.hint ? `Hint: ${supabase.hint}` : null,
  ].filter(Boolean).join(" | ");

  return {
    stage: context.stage,
    translation: context.translation ?? null,
    book: context.book ?? null,
    chapter: context.chapter ?? null,
    verse: context.verse ?? null,
    supabase,
    request: context.request ?? null,
    stack,
    message,
  };
}

function getSupabaseError(error: unknown): SupabaseErrorLike | null {
  if (!error || typeof error !== "object") return null;
  const candidate = error as SupabaseErrorLike;
  if (candidate.code || candidate.message || candidate.details || candidate.hint) {
    return {
      code: candidate.code ?? null,
      message: candidate.message ?? null,
      details: candidate.details ?? null,
      hint: candidate.hint ?? null,
    };
  }
  return null;
}

function getStack(error: unknown) {
  if (error instanceof Error && error.stack) return error.stack;
  if (error && typeof error === "object" && "stack" in error && typeof (error as { stack?: unknown }).stack === "string") {
    return (error as { stack: string }).stack;
  }
  return null;
}

function printDiagnostic(diagnostic: ImportDiagnostic) {
  console.error("Bible import diagnostic");
  console.error(`Stage: ${diagnostic.stage}`);
  if (diagnostic.translation) console.error(`Translation: ${diagnostic.translation}`);
  if (diagnostic.book) console.error(`Book: ${diagnostic.book}`);
  if (diagnostic.chapter !== null) console.error(`Chapter: ${diagnostic.chapter}`);
  if (diagnostic.verse !== null) console.error(`Verse: ${diagnostic.verse}`);
  if (diagnostic.supabase?.code) console.error(`Code: ${diagnostic.supabase.code}`);
  if (diagnostic.supabase?.message) console.error(`Message: ${diagnostic.supabase.message}`);
  if (diagnostic.supabase?.details) console.error(`Details: ${diagnostic.supabase.details}`);
  if (diagnostic.supabase?.hint) console.error(`Hint: ${diagnostic.supabase.hint}`);
  if (diagnostic.request) {
    console.error(`URL: ${diagnostic.request.url}`);
    console.error(`HTTP method: ${diagnostic.request.method}`);
    console.error(`Table: ${diagnostic.request.table}`);
    console.error(`Operation: ${diagnostic.request.operation}`);
    console.error(`Retry count: ${diagnostic.request.retry_count}`);
  }
  if (diagnostic.stack) console.error(`Stack:\n${diagnostic.stack}`);
}

function writeReport(report: ImportReport) {
  mkdirSync(path.dirname(reportPath), { recursive: true });
  writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
}

function printReport(report: ImportReport) {
  console.log(`Bible import ${report.failed ? "failed" : "complete"}`);
  console.log(`Created: ${report.created}`);
  console.log(`Skipped: ${report.skipped}`);
  console.log(`Deleted/Rolled back: ${report.deleted}`);
  console.log(`Failed: ${report.failed}`);
  console.log(`Report: ${reportPath}`);
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

main();

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";

type ManifestEntry = {
  book_code: string;
  book_name: string;
  chapter: number;
  filename: string;
  duration_seconds: number;
  file_size: number;
  checksum: string;
  relative_path: string;
  language: string;
  translation_code: string;
  audio_source: "official";
  provider: "Open.Bible";
  license: "CC BY-SA 4.0";
};

type TranslationRow = {
  id: string;
  code: string;
  language_code: string;
  publisher?: string | null;
  source_url?: string | null;
  source?: string | null;
  attribution_text?: string | null;
  attribution?: string | null;
};

type BookRow = {
  id: string;
  book_number: number;
  name: string;
};

type AudioAssetRow = {
  id: string;
  storage_path: string | null;
  status: string;
  byte_size: number | null;
  content_hash: string | null;
};

type Failure = {
  book_code: string | null;
  book_name: string | null;
  chapter: number | null;
  stage: string;
  message: string;
};

type ImportReport = {
  generated_at: string;
  mode: "dry-run" | "import";
  manifest_path: string;
  storage_bucket: string;
  books_imported: number;
  chapters_imported: number;
  storage_uploaded: number;
  storage_skipped: number;
  rows_inserted: number;
  rows_updated: number;
  rows_skipped: number;
  failed_rows: number;
  failures: Failure[];
  elapsed_ms: number;
};

const repoRoot = process.cwd();
const audioRoot = path.join(repoRoot, "supabase", "seed", "bible", "audio1", "open bible");
const manifestPath = path.join(audioRoot, "manifests", "audio-manifest.json");
const defaultReportPath = path.join(audioRoot, "reports", "import-report.json");
const storageBucket = "bible-audio";
const officialVoiceId = "official-open-bible";
const officialAudioVersion = "official";
const officialProvider = "Open.Bible";
const officialProviderModel = "official-human";
const cacheControlOneYear = "31536000";
const bookCodes = [
  "GEN", "EXO", "LEV", "NUM", "DEU", "JOS", "JDG", "RUT", "1SA", "2SA",
  "1KI", "2KI", "1CH", "2CH", "EZR", "NEH", "EST", "JOB", "PSA", "PRO",
  "ECC", "SNG", "ISA", "JER", "LAM", "EZK", "DAN", "HOS", "JOL", "AMO",
  "OBA", "JON", "MIC", "NAM", "HAB", "ZEP", "HAG", "ZEC", "MAL", "MAT",
  "MRK", "LUK", "JHN", "ACT", "ROM", "1CO", "2CO", "GAL", "EPH", "PHP",
  "COL", "1TH", "2TH", "1TI", "2TI", "TIT", "PHM", "HEB", "JAS", "1PE",
  "2PE", "1JN", "2JN", "3JN", "JUD", "REV",
];

const startedAt = Date.now();
const parsedArgs = parseArgs(process.argv.slice(2));
const dryRun = Boolean(parsedArgs.dryRun);
const limit = parsedArgs.limit ? Number(parsedArgs.limit) : null;
const onlyChapters = parseOnlyChapters(typeof parsedArgs.only === "string" ? parsedArgs.only : null);
const reportPath = typeof parsedArgs.report === "string" ? path.resolve(repoRoot, parsedArgs.report) : defaultReportPath;
const failures: Failure[] = [];
const importedChapters = new Set<string>();
let storageUploaded = 0;
let storageSkipped = 0;
let rowsInserted = 0;
let rowsUpdated = 0;
let rowsSkipped = 0;

loadEnvFile(path.join(repoRoot, ".env"));
loadEnvFile(path.join(repoRoot, ".env.local"));
loadEnvFile(path.join(repoRoot, ".env.staging.local"));

const supabaseUrl = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
const serviceRoleKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ??
  process.env.SUPABASE_SERVICE_KEY ??
  process.env.SERVICE_ROLE_KEY;

async function main() {
  try {
    if (!supabaseUrl) throw new Error("SUPABASE_URL or VITE_SUPABASE_URL is required.");
    if (!serviceRoleKey) throw new Error("SUPABASE_SERVICE_ROLE_KEY is required.");
    if (!existsSync(manifestPath)) throw new Error(`Manifest not found: ${manifestPath}`);

    const manifest = readManifest();
    const selectedManifest = onlyChapters ? filterManifest(manifest, onlyChapters) : manifest;
    const entries = limit ? selectedManifest.slice(0, limit) : selectedManifest;
    const manifestTranslationCode = manifest[0]?.translation_code;
    if (!manifestTranslationCode) throw new Error("Manifest does not include a translation_code.");
    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const translation = await getTranslation(supabase, manifestTranslationCode);
    const books = await getBooks(supabase, translation.id);
    const optionalColumns = await getSupportedOptionalColumns(supabase);

    for (const entry of entries) {
      await importEntry(supabase, translation, books, optionalColumns, entry);
    }
  } catch (error) {
    failures.push({
      book_code: null,
      book_name: null,
      chapter: null,
      stage: "fatal",
      message: formatError(error),
    });
    process.exitCode = 1;
  } finally {
    writeReport();
  }
}

function readManifest() {
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as ManifestEntry[];
  if (!Array.isArray(manifest)) throw new Error("audio-manifest.json must contain an array.");
  return manifest.filter((entry) => {
    const failureBase = { book_code: entry?.book_code ?? null, book_name: entry?.book_name ?? null, chapter: entry?.chapter ?? null };
    if (!entry || typeof entry !== "object") {
      failures.push({ ...failureBase, stage: "manifest", message: "Invalid manifest entry." });
      return false;
    }
    if (entry.audio_source !== "official" || entry.provider !== "Open.Bible") {
      failures.push({ ...failureBase, stage: "manifest", message: "Skipping non-official Open.Bible entry." });
      return false;
    }
    if (!bookCodes.includes(entry.book_code)) {
      failures.push({ ...failureBase, stage: "manifest", message: `Unknown book code: ${entry.book_code}` });
      return false;
    }
    if (!Number.isInteger(entry.chapter) || entry.chapter < 1) {
      failures.push({ ...failureBase, stage: "manifest", message: `Invalid chapter number: ${entry.chapter}` });
      return false;
    }
    return true;
  });
}

async function importEntry(
  supabase: SupabaseClient,
  translation: TranslationRow,
  books: Map<string, BookRow>,
  optionalColumns: Set<string>,
  entry: ManifestEntry,
) {
  const failureBase = { book_code: entry.book_code, book_name: entry.book_name, chapter: entry.chapter };
  try {
    const book = books.get(entry.book_code);
    if (!book) throw new Error(`Book ${entry.book_code} is not installed for ${translation.code}.`);

    const localPath = path.join(audioRoot, entry.relative_path);
    if (!existsSync(localPath)) throw new Error(`MP3 not found: ${entry.relative_path}`);

    const actualChecksum = sha256(localPath);
    if (actualChecksum !== entry.checksum) {
      throw new Error(`Checksum mismatch for ${entry.relative_path}; expected ${entry.checksum}, got ${actualChecksum}.`);
    }

    const bytes = readFileSync(localPath);
    if (bytes.byteLength !== entry.file_size) {
      throw new Error(`File size mismatch for ${entry.relative_path}; expected ${entry.file_size}, got ${bytes.byteLength}.`);
    }
    if (bytes.byteLength === 0) throw new Error(`Zero-byte MP3: ${entry.relative_path}`);

    const storagePath = buildStoragePath(entry);
    const existingAsset = await findOfficialAsset(supabase, translation.id, book.id, entry.chapter, entry.language);
    const storageReady = existingAsset?.storage_path === storagePath && existingAsset.content_hash === entry.checksum;

    if (!storageReady) {
      await ensureStorageObject(supabase, storagePath, bytes, entry.checksum);
    } else {
      storageSkipped += 1;
    }

    if (!dryRun) {
      const existingAfterUpload = existingAsset ?? await findOfficialAsset(supabase, translation.id, book.id, entry.chapter, entry.language);
      const payload = buildAssetPayload(optionalColumns, translation, book, entry, storagePath);
      if (existingAfterUpload?.id) {
        const sameRow = existingAfterUpload.storage_path === storagePath
          && existingAfterUpload.status === "ready"
          && Number(existingAfterUpload.byte_size) === entry.file_size
          && existingAfterUpload.content_hash === entry.checksum;
        if (sameRow) {
          rowsSkipped += 1;
        } else {
          const { error } = await supabase
            .from("bible_audio_assets")
            .update(payload)
            .eq("id", existingAfterUpload.id);
          if (error) throw error;
          rowsUpdated += 1;
        }
      } else {
        const { error } = await supabase.from("bible_audio_assets").insert(payload);
        if (error) throw error;
        rowsInserted += 1;
      }

      const verified = await findOfficialAsset(supabase, translation.id, book.id, entry.chapter, entry.language);
      if (!verified || verified.storage_path !== storagePath || verified.status !== "ready") {
        throw new Error("Database row verification failed after import.");
      }
    }

    importedChapters.add(`${entry.book_code}:${entry.chapter}`);
  } catch (error) {
    failures.push({
      ...failureBase,
      stage: "entry",
      message: formatError(error),
    });
  }
}

function formatError(error: unknown) {
  if (error instanceof Error) return error.message;
  if (error && typeof error === "object") {
    const record = error as Record<string, unknown>;
    return [record.message, record.code, record.details, record.hint]
      .filter(Boolean)
      .map(String)
      .join(" | ") || JSON.stringify(record);
  }
  return String(error);
}

function isMissingColumnError(error: unknown) {
  if (!error || typeof error !== "object") return false;
  const record = error as Record<string, unknown>;
  const text = [record.message, record.code, record.details, record.hint].filter(Boolean).join(" ").toLowerCase();
  return text.includes("column") || text.includes("pgrst204") || text.includes("42703") || text.includes("schema cache");
}

async function ensureStorageObject(supabase: SupabaseClient, storagePath: string, bytes: Buffer, checksum: string) {
  if (dryRun) return;

  const existing = await supabase.storage.from(storageBucket).download(storagePath);
  if (!existing.error) {
    const existingBytes = Buffer.from(await existing.data.arrayBuffer());
    const existingChecksum = hashBuffer(existingBytes);
    if (existingChecksum === checksum) {
      storageSkipped += 1;
      return;
    }
    throw new Error(`Storage object already exists with different checksum: ${storagePath}`);
  }

  const upload = await supabase.storage.from(storageBucket).upload(storagePath, bytes, {
    contentType: "audio/mpeg",
    cacheControl: cacheControlOneYear,
    upsert: false,
  });
  if (upload.error) throw upload.error;

  const verified = await supabase.storage.from(storageBucket).download(storagePath);
  if (verified.error) throw verified.error;
  const verifiedChecksum = hashBuffer(Buffer.from(await verified.data.arrayBuffer()));
  if (verifiedChecksum !== checksum) throw new Error(`Uploaded checksum verification failed: ${storagePath}`);
  storageUploaded += 1;
}

function buildAssetPayload(
  optionalColumns: Set<string>,
  translation: TranslationRow,
  book: BookRow,
  entry: ManifestEntry,
  storagePath: string,
) {
  const payload: Record<string, unknown> = {
    translation_id: translation.id,
    book_id: book.id,
    chapter_number: entry.chapter,
    language_code: entry.language,
    voice_id: officialVoiceId,
    audio_version: officialAudioVersion,
    cache_key: buildOfficialCacheKey(translation.id, book.id, entry.chapter, entry.language),
    storage_bucket: storageBucket,
    storage_path: storagePath,
    provider: officialProvider,
    provider_model: officialProviderModel,
    status: "ready",
    duration_seconds: entry.duration_seconds,
    byte_size: entry.file_size,
    content_hash: entry.checksum,
    error_message: null,
    requested_by: null,
    generation_started_at: null,
    generated_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const optionalValues: Record<string, unknown> = {
    translation_code: entry.translation_code,
    book: entry.book_code,
    file_size: entry.file_size,
    checksum: entry.checksum,
    language: entry.language,
    audio_source: "official",
    generated_by: "import",
    generation_status: "ready",
    license: entry.license,
    publisher: "Biblica",
    source_url: "https://open.bible/",
    attribution_text: translation.attribution_text ?? translation.attribution ?? null,
    voice: null,
  };

  for (const [column, value] of Object.entries(optionalValues)) {
    if (optionalColumns.has(column)) payload[column] = value;
  }

  return payload;
}

async function findOfficialAsset(
  supabase: SupabaseClient,
  translationId: string,
  bookId: string,
  chapter: number,
  language: string,
) {
  const { data, error } = await supabase
    .from("bible_audio_assets")
    .select("id, storage_path, status, byte_size, content_hash")
    .eq("translation_id", translationId)
    .eq("book_id", bookId)
    .eq("chapter_number", chapter)
    .eq("language_code", language)
    .eq("provider", officialProvider)
    .eq("provider_model", officialProviderModel)
    .maybeSingle();

  if (error) throw error;
  return data as AudioAssetRow | null;
}

async function getTranslation(supabase: SupabaseClient, code: string) {
  const fullResult = await supabase
    .from("bible_translations")
    .select("id, code, language_code, publisher, source_url, source, attribution_text, attribution")
    .eq("code", code)
    .maybeSingle();
  if (!fullResult.error) {
    if (!fullResult.data) throw new Error(`Bible translation not found: ${code}`);
    return fullResult.data as TranslationRow;
  }

  if (!isMissingColumnError(fullResult.error)) throw fullResult.error;

  const fallbackResult = await supabase
    .from("bible_translations")
    .select("id, code, language_code")
    .eq("code", code)
    .maybeSingle();
  if (fallbackResult.error) throw fallbackResult.error;
  if (!fallbackResult.data) throw new Error(`Bible translation not found: ${code}`);
  return fallbackResult.data as TranslationRow;
}

async function getBooks(supabase: SupabaseClient, translationId: string) {
  const { data, error } = await supabase
    .from("bible_books")
    .select("id, book_number, name")
    .eq("translation_id", translationId)
    .order("book_number", { ascending: true });
  if (error) throw error;
  const books = new Map<string, BookRow>();
  for (const book of data as BookRow[]) {
    const code = bookCodes[book.book_number - 1];
    if (code) books.set(code, book);
  }
  return books;
}

async function getSupportedOptionalColumns(supabase: SupabaseClient) {
  const candidates = [
    "translation_code",
    "book",
    "file_size",
    "checksum",
    "language",
    "audio_source",
    "generated_by",
    "generation_status",
    "license",
    "publisher",
    "source_url",
    "attribution_text",
    "voice",
  ];
  const supported = new Set<string>();
  for (const column of candidates) {
    const { error } = await supabase.from("bible_audio_assets").select(column).limit(1);
    if (!error) supported.add(column);
  }
  return supported;
}

function buildStoragePath(entry: ManifestEntry) {
  return [
    "official",
    "open-bible",
    sanitize(entry.translation_code),
    sanitize(entry.book_code),
    entry.filename,
  ].join("/");
}

function buildOfficialCacheKey(translationId: string, bookId: string, chapter: number, language: string) {
  return [
    translationId,
    bookId,
    String(chapter),
    language.toLowerCase(),
    officialVoiceId,
    officialAudioVersion,
    officialProviderModel,
  ].join(":");
}

function sha256(filePath: string) {
  return hashBuffer(readFileSync(filePath));
}

function hashBuffer(buffer: Buffer) {
  const hash = createHash("sha256");
  hash.update(buffer);
  return hash.digest("hex");
}

function sanitize(value: string) {
  return value.replace(/[^a-zA-Z0-9._-]/g, "-");
}

function parseArgs(args: string[]) {
  const parsed: Record<string, string | boolean> = {};
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--dry-run") {
      parsed.dryRun = true;
    } else if (arg.startsWith("--limit=")) {
      parsed.limit = arg.slice("--limit=".length);
    } else if (arg === "--limit") {
      parsed.limit = args[index + 1];
      index += 1;
    } else if (arg.startsWith("--only=")) {
      parsed.only = arg.slice("--only=".length);
    } else if (arg === "--only") {
      parsed.only = args[index + 1];
      index += 1;
    } else if (arg.startsWith("--report=")) {
      parsed.report = arg.slice("--report=".length);
    } else if (arg === "--report") {
      parsed.report = args[index + 1];
      index += 1;
    }
  }
  return parsed;
}

function parseOnlyChapters(value: string | null) {
  if (!value) return null;
  const selected = new Set<string>();
  for (const item of value.split(",")) {
    const [rawCode, rawChapter] = item.split(":");
    const bookCode = rawCode?.trim().toUpperCase();
    const chapter = Number(rawChapter);
    if (!bookCodes.includes(bookCode) || !Number.isInteger(chapter) || chapter < 1) {
      throw new Error(`Invalid --only chapter selector: ${item}`);
    }
    selected.add(`${bookCode}:${chapter}`);
  }
  return selected;
}

function filterManifest(manifest: ManifestEntry[], selected: Set<string>) {
  const entries = manifest.filter((entry) => selected.has(`${entry.book_code}:${entry.chapter}`));
  const found = new Set(entries.map((entry) => `${entry.book_code}:${entry.chapter}`));
  const missing = [...selected].filter((key) => !found.has(key));
  if (missing.length > 0) {
    throw new Error(`Manifest is missing requested chapter(s): ${missing.join(", ")}`);
  }
  return entries;
}

function loadEnvFile(filePath: string) {
  if (!existsSync(filePath)) return;
  const text = readFileSync(filePath, "utf8");
  for (const line of text.split(/\r?\n/u)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/u);
    if (!match) continue;
    const [, key, rawValue] = match;
    if (process.env[key]) continue;
    process.env[key] = rawValue.replace(/^["']|["']$/g, "");
  }
}

function writeReport() {
  mkdirSync(path.dirname(reportPath), { recursive: true });
  const report: ImportReport = {
    generated_at: new Date().toISOString(),
    mode: dryRun ? "dry-run" : "import",
    manifest_path: path.relative(repoRoot, manifestPath).replace(/\\/g, "/"),
    storage_bucket: storageBucket,
    books_imported: new Set([...importedChapters].map((key) => key.split(":")[0])).size,
    chapters_imported: importedChapters.size,
    storage_uploaded: storageUploaded,
    storage_skipped: storageSkipped,
    rows_inserted: rowsInserted,
    rows_updated: rowsUpdated,
    rows_skipped: rowsSkipped,
    failed_rows: failures.length,
    failures,
    elapsed_ms: Date.now() - startedAt,
  };
  writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify(report, null, 2));
}

void main();

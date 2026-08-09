import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath, pathToFileURL } from "node:url";
import type { BibleBookSeed, BibleChapterSeed, BibleSeed, BibleTestament, BibleVerseSeed } from "../../src/lib/bible/schema.ts";
import { summarizeBibleSeed, validateBibleSeed } from "../../src/lib/bible/schema.ts";

type UsxMetadata = {
  dbl_version: string | null;
  id: string | null;
  revision: string | null;
  usx_version: string | null;
  name: string | null;
  name_local: string | null;
  publication_name: string | null;
  publication_name_local: string | null;
  abbreviation: string | null;
  language_iso: string | null;
  language_name: string | null;
  language_local: string | null;
  publisher: string | null;
  rights_holder: string | null;
  copyright: string | null;
  license_name: string | null;
  license_url: string | null;
  attribution: string | null;
  source: string | null;
  canonical_books: string[];
  structure: Array<{ code: string; src: string; nameId: string | null }>;
  book_names: Record<string, { long: string; short: string; abbreviation: string }>;
};

type AuditBook = {
  book_number: number;
  code: string;
  name: string;
  abbreviation: string;
  testament: BibleTestament;
  chapters: number;
  verses: number;
  chapter_counts: Array<{ chapter: number; verses: number }>;
};

type AuditReport = {
  timestamp: string;
  input: string;
  metadata_xml: string;
  output: string;
  translation: BibleSeed["translation"];
  package: Omit<UsxMetadata, "structure" | "book_names">;
  books: AuditBook[];
  totals: { books: number; chapters: number; verses: number };
  validation: ReturnType<typeof validateBibleSeed>;
  warnings: string[];
};

const CANONICAL_ORDER = [
  "GEN", "EXO", "LEV", "NUM", "DEU", "JOS", "JDG", "RUT", "1SA", "2SA", "1KI", "2KI", "1CH", "2CH", "EZR", "NEH", "EST",
  "JOB", "PSA", "PRO", "ECC", "SNG", "ISA", "JER", "LAM", "EZK", "DAN", "HOS", "JOL", "AMO", "OBA", "JON", "MIC", "NAM",
  "HAB", "ZEP", "HAG", "ZEC", "MAL", "MAT", "MRK", "LUK", "JHN", "ACT", "ROM", "1CO", "2CO", "GAL", "EPH", "PHP", "COL",
  "1TH", "2TH", "1TI", "2TI", "TIT", "PHM", "HEB", "JAS", "1PE", "2PE", "1JN", "2JN", "3JN", "JUD", "REV",
];

const NEW_TESTAMENT_START = CANONICAL_ORDER.indexOf("MAT") + 1;
const CANONICAL_INDEX = new Map(CANONICAL_ORDER.map((code, index) => [code, index + 1]));
const args = parseArgs(process.argv.slice(2));

export function buildBibleSeedFromUsx(inputDir: string): { seed: BibleSeed; audit: AuditReport } {
  const metadataPath = path.join(inputDir, "metadata.xml");
  if (!existsSync(metadataPath)) throw new Error(`metadata.xml not found in ${inputDir}`);

  const metadataXml = readTextFile(metadataPath);
  const metadata = parseMetadata(metadataXml);
  const warnings: string[] = [];

  const books = metadata.structure.map((entry) => {
    const bookNumber = CANONICAL_INDEX.get(entry.code);
    if (!bookNumber) throw new Error(`Unsupported or non-Protestant book code: ${entry.code}`);

    const filePath = path.join(inputDir, normalizeZipPath(entry.src));
    if (!existsSync(filePath)) throw new Error(`USX file not found for ${entry.code}: ${filePath}`);

    const names = metadata.book_names[entry.nameId ?? `book-${entry.code.toLowerCase()}`] ?? {
      long: entry.code,
      short: entry.code,
      abbreviation: entry.code,
    };
    const parsed = parseUsxBook(readTextFile(filePath), entry.code);
    const testament: BibleTestament = bookNumber >= NEW_TESTAMENT_START ? "new" : "old";

    return {
      book_number: bookNumber,
      name: names.long || names.short || entry.code,
      abbreviation: names.abbreviation || names.short || entry.code,
      testament,
      chapters: parsed.chapters,
      code: entry.code,
    };
  }).sort((left, right) => left.book_number - right.book_number);

  const seed: BibleSeed = {
    translation: {
      code: args.code ?? "sw-open-bible",
      name: args.name ?? "Open Kiswahili Contemporary Version",
      language: args.language ?? normalizeLanguageCode(metadata.language_iso),
      description: metadata.name ?? metadata.publication_name ?? undefined,
      canon: "PROTESTANT_66",
      canon_type: "PROTESTANT_66",
      license_name: metadata.license_name ?? undefined,
      license_url: metadata.license_url ?? undefined,
      source: metadata.source ?? undefined,
      source_url: metadata.source ?? undefined,
      publisher: metadata.publisher ?? undefined,
      copyright: metadata.copyright ?? undefined,
      copyright_notice: metadata.copyright ?? undefined,
      attribution: metadata.attribution ?? undefined,
      attribution_text: metadata.attribution ?? undefined,
      audio_generation_allowed: true,
      ai_processing_allowed: true,
      active: true,
      default_translation: true,
    },
    books: books.map(({ code: _code, ...book }) => book),
  };

  const validation = validateBibleSeed(seed);
  const totals = summarizeBibleSeed(seed);
  const auditBooks = books.map((book): AuditBook => ({
    book_number: book.book_number,
    code: book.code,
    name: book.name,
    abbreviation: book.abbreviation,
    testament: book.testament,
    chapters: book.chapters.length,
    verses: book.chapters.reduce((sum, chapter) => sum + chapter.verses.length, 0),
    chapter_counts: book.chapters.map((chapter) => ({ chapter: chapter.chapter, verses: chapter.verses.length })),
  }));

  if (metadata.license_name && metadata.license_name !== "CC BY 4.0") {
    warnings.push(`Package license is ${metadata.license_name}, not CC BY 4.0.`);
  }

  return {
    seed,
    audit: {
      timestamp: new Date().toISOString(),
      input: inputDir,
      metadata_xml: metadataPath,
      output: args.output ?? "supabase/seed/bible/published/open-bible-sw.json",
      translation: seed.translation,
      package: {
        dbl_version: metadata.dbl_version,
        id: metadata.id,
        revision: metadata.revision,
        usx_version: metadata.usx_version,
        name: metadata.name,
        name_local: metadata.name_local,
        publication_name: metadata.publication_name,
        publication_name_local: metadata.publication_name_local,
        abbreviation: metadata.abbreviation,
        language_iso: metadata.language_iso,
        language_name: metadata.language_name,
        language_local: metadata.language_local,
        publisher: metadata.publisher,
        rights_holder: metadata.rights_holder,
        copyright: metadata.copyright,
        license_name: metadata.license_name,
        license_url: metadata.license_url,
        attribution: metadata.attribution,
        source: metadata.source,
        canonical_books: metadata.canonical_books,
      },
      books: auditBooks,
      totals,
      validation,
      warnings,
    },
  };
}

function parseMetadata(xml: string): UsxMetadata {
  const publicationBlock = firstMatch(xml, /<publication\b[^>]*default="true"[^>]*>([\s\S]*?)<\/publication>/i) ?? firstMatch(xml, /<publication\b[^>]*>([\s\S]*?)<\/publication>/i) ?? "";
  const languageBlock = firstMatch(xml, /<language>([\s\S]*?)<\/language>/i) ?? "";
  const agenciesBlock = firstMatch(xml, /<agencies>([\s\S]*?)<\/agencies>/i) ?? "";
  const rightsHolderBlock = firstMatch(agenciesBlock, /<rightsHolder>([\s\S]*?)<\/rightsHolder>/i) ?? "";
  const copyrightBlock = firstMatch(xml, /<copyright>([\s\S]*?)<\/copyright>/i) ?? "";
  const promotionBlock = firstMatch(xml, /<promotion>([\s\S]*?)<\/promotion>/i) ?? "";
  const licenseUrl = normalizeLicenseUrl(firstMatch(promotionBlock, /(https?:\/\/creativecommons\.org\/licenses\/by-sa\/4[^<\s]*)/i));

  return {
    dbl_version: attr(xml, "DBLMetadata", "version"),
    id: attr(xml, "DBLMetadata", "id"),
    revision: attr(xml, "DBLMetadata", "revision"),
    usx_version: textAt(xml, "usxVersion"),
    name: textAt(firstMatch(xml, /<identification>([\s\S]*?)<\/identification>/i) ?? "", "name"),
    name_local: textAt(xml, "nameLocal"),
    publication_name: textAt(publicationBlock, "name"),
    publication_name_local: textAt(publicationBlock, "nameLocal"),
    abbreviation: textAt(publicationBlock, "abbreviation") ?? textAt(xml, "abbreviation"),
    language_iso: textAt(languageBlock, "iso"),
    language_name: textAt(languageBlock, "name"),
    language_local: textAt(languageBlock, "nameLocal"),
    publisher: textAt(rightsHolderBlock, "name") ?? textAt(agenciesBlock, "name"),
    rights_holder: textAt(rightsHolderBlock, "name"),
    copyright: extractParagraphText(copyrightBlock).join("\n").trim() || null,
    license_name: promotionBlock.includes("Attribution-ShareAlike") || promotionBlock.includes("CC BY-SA") ? "CC BY-SA 4.0" : null,
    license_url: licenseUrl,
    attribution: extractAttribution(promotionBlock),
    source: "https://open.bible/",
    canonical_books: Array.from(publicationBlock.matchAll(/<book\b[^>]*code="([^"]+)"/gi)).map((match) => match[1]),
    structure: Array.from(publicationBlock.matchAll(/<content\b([^>]*)\/>/gi)).map((match) => ({
      code: getAttrFromSource(match[1], "role") ?? "",
      src: getAttrFromSource(match[1], "src") ?? "",
      nameId: getAttrFromSource(match[1], "name"),
    })).filter((entry) => entry.code && entry.src),
    book_names: parseBookNames(xml),
  };
}

function parseBookNames(xml: string) {
  const names: UsxMetadata["book_names"] = {};
  for (const match of xml.matchAll(/<name\b[^>]*id="([^"]+)"[^>]*>([\s\S]*?)<\/name>/gi)) {
    const id = match[1];
    const block = match[2];
    names[id] = {
      long: textAt(block, "long") ?? "",
      short: textAt(block, "short") ?? "",
      abbreviation: textAt(block, "abbr") ?? "",
    };
  }
  return names;
}

function parseUsxBook(usx: string, expectedCode: string) {
  const version = attr(usx, "usx", "version");
  if (version !== "3.0") throw new Error(`${expectedCode} uses unsupported USX version ${version ?? "unknown"}`);

  const chapters = new Map<number, BibleChapterSeed>();
  let currentChapter: number | null = null;
  let activeVerse: BibleVerseSeed | null = null;
  let skipDepth = 0;

  const ensureChapter = (chapterNumber: number) => {
    const existing = chapters.get(chapterNumber);
    if (existing) return existing;
    const chapter = { chapter: chapterNumber, verses: [] };
    chapters.set(chapterNumber, chapter);
    return chapter;
  };

  for (const token of usx.matchAll(/<[^>]+>|[^<]+/g)) {
    const value = token[0];
    if (value.startsWith("<")) {
      const tag = parseTag(value);
      if (!tag) continue;

      if (skipDepth > 0) {
        if (!tag.selfClosing && !tag.closing) skipDepth += 1;
        if (tag.closing) skipDepth -= 1;
        continue;
      }

      if (tag.name === "note" && !tag.closing) {
        if (!tag.selfClosing) skipDepth = 1;
        continue;
      }

      if (tag.name === "chapter" && tag.attrs.number && !tag.attrs.eid) {
        currentChapter = Number(tag.attrs.number);
        ensureChapter(currentChapter);
        activeVerse = null;
        continue;
      }

      if (tag.name === "verse" && tag.attrs.number && !tag.attrs.eid) {
        if (!currentChapter) throw new Error(`${expectedCode} has verse before chapter.`);
        const verseNumber = Number.parseInt(tag.attrs.number, 10);
        activeVerse = { verse: verseNumber, text: "" };
        ensureChapter(currentChapter).verses.push(activeVerse);
        continue;
      }

      if (tag.name === "verse" && tag.attrs.eid) {
        activeVerse = null;
      }
      continue;
    }

    if (activeVerse && skipDepth === 0) {
      activeVerse.text += decodeXml(value);
    }
  }

  const parsedChapters = Array.from(chapters.values())
    .sort((left, right) => left.chapter - right.chapter)
    .map((chapter) => ({
      ...chapter,
      verses: chapter.verses.map((verse) => ({ ...verse, text: normalizeVerseText(verse.text) })),
    }));

  return { chapters: parsedChapters };
}

function parseTag(source: string) {
  const match = source.match(/^<\/?\s*([A-Za-z0-9:_-]+)\b([\s\S]*?)\/?>$/);
  if (!match) return null;
  return {
    name: match[1],
    attrs: Object.fromEntries(Array.from(match[2].matchAll(/([A-Za-z0-9:_-]+)="([^"]*)"/g)).map((attrMatch) => [attrMatch[1], decodeXml(attrMatch[2])])),
    closing: /^<\//.test(source),
    selfClosing: /\/>$/.test(source),
  };
}

function extractAttribution(block: string) {
  const paragraphs = extractParagraphText(block);
  const copyrightNoticeIndex = paragraphs.findIndex((paragraph) => paragraph.includes("Notice of copyright must appear"));
  if (copyrightNoticeIndex >= 0) {
    return paragraphs.slice(copyrightNoticeIndex + 1, copyrightNoticeIndex + 7).filter(Boolean).join("\n");
  }
  return paragraphs.find((paragraph) => paragraph.includes("original work by Biblica")) ?? null;
}

function extractParagraphText(block: string) {
  return Array.from(block.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi))
    .map((match) => normalizeVerseText(stripTags(match[1])))
    .filter(Boolean);
}

function textAt(block: string, tag: string) {
  const value = firstMatch(block, new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i"));
  return value ? normalizeVerseText(stripTags(value)) : null;
}

function attr(block: string, tag: string, name: string) {
  const tagSource = firstMatch(block, new RegExp(`<${tag}\\b([^>]*)>`, "i"));
  return tagSource ? getAttrFromSource(tagSource, name) : null;
}

function getAttrFromSource(source: string, name: string) {
  const match = source.match(new RegExp(`${name}="([^"]*)"`, "i"));
  return match ? decodeXml(match[1]) : null;
}

function firstMatch(source: string, pattern: RegExp) {
  return source.match(pattern)?.[1] ?? null;
}

function stripTags(value: string) {
  return value.replace(/<[^>]+>/g, "");
}

function normalizeVerseText(value: string) {
  return value.replace(/\s+/g, " ").replace(/\s+([,.;:!?])/g, "$1").trim();
}

function decodeXml(value: string) {
  return value
    .replace(/&quot;/g, "\"")
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

function normalizeLicenseUrl(value: string | null) {
  if (!value) return null;
  return value.replace(/[.\s]+$/, "").replace("http://", "https://").replace(/4(?:\u202a)?\.0$/u, "4.0/");
}

function normalizeLanguageCode(value: string | null) {
  if (!value) return "sw";
  return value.toLowerCase() === "swh" ? "sw" : value.toLowerCase();
}

function normalizeZipPath(value: string) {
  return value.replace(/\//g, path.sep);
}

function writeJson(filePath: string, value: unknown) {
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function readTextFile(filePath: string) {
  return repairUtf8Mojibake(readFileSync(filePath, "utf8").replace(/^\uFEFF/, ""));
}

function repairUtf8Mojibake(value: string) {
  if (!/[Ââ]/.test(value)) return value;
  const bytes = Array.from(value, (char) => WINDOWS_1252_BYTES.get(char) ?? char.codePointAt(0) ?? 0).map((byte) => byte & 0xff);
  return Buffer.from(bytes).toString("utf8");
}

const WINDOWS_1252_BYTES = new Map<string, number>([
  ["€", 0x80],
  ["‚", 0x82],
  ["ƒ", 0x83],
  ["„", 0x84],
  ["…", 0x85],
  ["†", 0x86],
  ["‡", 0x87],
  ["ˆ", 0x88],
  ["‰", 0x89],
  ["Š", 0x8a],
  ["‹", 0x8b],
  ["Œ", 0x8c],
  ["Ž", 0x8e],
  ["‘", 0x91],
  ["’", 0x92],
  ["“", 0x93],
  ["”", 0x94],
  ["•", 0x95],
  ["–", 0x96],
  ["—", 0x97],
  ["˜", 0x98],
  ["™", 0x99],
  ["š", 0x9a],
  ["›", 0x9b],
  ["œ", 0x9c],
  ["ž", 0x9e],
  ["Ÿ", 0x9f],
]);

function findDefaultInput() {
  const defaultDir = ".tmp/open-bible-usx";
  if (existsSync(path.join(defaultDir, "metadata.xml"))) return defaultDir;
  const candidates = readdirSync(".tmp", { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => path.join(".tmp", entry.name))
    .find((entry) => existsSync(path.join(entry, "metadata.xml")));
  return candidates ?? defaultDir;
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

function main() {
  const input = args.input ?? findDefaultInput();
  const output = args.output ?? "supabase/seed/bible/published/open-bible-sw.json";
  const report = args.report ?? "reports/bible/open-bible-usx-audit.json";
  const { seed, audit } = buildBibleSeedFromUsx(input);

  writeJson(output, seed);
  writeJson(report, { ...audit, output });

  console.log("USX import package audit complete");
  console.log(`USX version: ${audit.package.usx_version}`);
  console.log(`Translation: ${seed.translation.name} (${seed.translation.code})`);
  console.log(`Language: ${audit.package.language_iso} -> ${seed.translation.language}`);
  console.log(`License: ${audit.package.license_name ?? "unknown"}`);
  console.log(`Books: ${audit.totals.books}`);
  console.log(`Chapters: ${audit.totals.chapters}`);
  console.log(`Verses: ${audit.totals.verses}`);
  console.log(`Seed: ${output}`);
  console.log(`Report: ${report}`);
  if (!audit.validation.valid) process.exitCode = 1;
}

const currentFile = fileURLToPath(import.meta.url);
if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === pathToFileURL(currentFile).href) {
  main();
}

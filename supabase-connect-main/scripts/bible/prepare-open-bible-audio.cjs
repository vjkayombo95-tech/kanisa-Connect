const childProcess = require("node:child_process");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const repoRoot = path.resolve(__dirname, "..", "..");
const packageDir = path.join(repoRoot, "supabase", "seed", "bible", "audio1", "open bible");
const sourceDir = path.join(packageDir, "source");
const extractedDir = path.join(packageDir, "extracted");
const manifestsDir = path.join(packageDir, "manifests");
const reportsDir = path.join(packageDir, "reports");
const bibleJsonPath = path.join(repoRoot, "supabase", "seed", "bible", "published", "open-bible-sw.json");

const bookCodes = [
  "GEN", "EXO", "LEV", "NUM", "DEU", "JOS", "JDG", "RUT", "1SA", "2SA",
  "1KI", "2KI", "1CH", "2CH", "EZR", "NEH", "EST", "JOB", "PSA", "PRO",
  "ECC", "SNG", "ISA", "JER", "LAM", "EZK", "DAN", "HOS", "JOL", "AMO",
  "OBA", "JON", "MIC", "NAM", "HAB", "ZEP", "HAG", "ZEC", "MAL", "MAT",
  "MRK", "LUK", "JHN", "ACT", "ROM", "1CO", "2CO", "GAL", "EPH", "PHP",
  "COL", "1TH", "2TH", "1TI", "2TI", "TIT", "PHM", "HEB", "JAS", "1PE",
  "2PE", "1JN", "2JN", "3JN", "JUD", "REV",
];

const sourceNameToCode = new Map(Object.entries({
  "genesis": "GEN",
  "exodus": "EXO",
  "leviticus": "LEV",
  "numbers": "NUM",
  "deuternomy": "DEU",
  "deuteronomy": "DEU",
  "joshua": "JOS",
  "judges": "JDG",
  "ruth": "RUT",
  "samuel book 1": "1SA",
  "samuel book 2": "2SA",
  "kings book 1": "1KI",
  "kings book 2": "2KI",
  "chronicles book 1": "1CH",
  "chronicles book 2": "2CH",
  "ezra": "EZR",
  "nehemia": "NEH",
  "nehemiah": "NEH",
  "esther": "EST",
  "job": "JOB",
  "zaburi 1": "PSA",
  "zaburi": "PSA",
  "psalms": "PSA",
  "proverbs": "PRO",
  "ecclesiastes": "ECC",
  "songs of songs": "SNG",
  "song of songs": "SNG",
  "isaac": "ISA",
  "isaiah": "ISA",
  "jeremiah": "JER",
  "lamentations": "LAM",
  "ezekiel": "EZK",
  "daniel": "DAN",
  "hosea": "HOS",
  "joel": "JOL",
  "amos": "AMO",
  "obadiah": "OBA",
  "jonah": "JON",
  "micah": "MIC",
  "nahum": "NAM",
  "habakuki": "HAB",
  "habakkuk": "HAB",
  "zephania": "ZEP",
  "zephaniah": "ZEP",
  "hagai": "HAG",
  "haggai": "HAG",
  "zacharia": "ZEC",
  "zechariah": "ZEC",
  "malachi": "MAL",
  "mathew": "MAT",
  "matthew": "MAT",
  "mark": "MRK",
  "luke": "LUK",
  "john": "JHN",
  "acts": "ACT",
  "romans": "ROM",
  "corinthians 1": "1CO",
  "corinthians 2": "2CO",
  "galatians": "GAL",
  "ephessians": "EPH",
  "ephesians": "EPH",
  "philipines": "PHP",
  "philippians": "PHP",
  "collosians": "COL",
  "colossians": "COL",
  "thessalonians book 1": "1TH",
  "thessalonians book 2": "2TH",
  "thesalonike 2": "2TH",
  "timothy book 1": "1TI",
  "timothy book 2": "2TI",
  "titus": "TIT",
  "philemon": "PHM",
  "hebrews": "HEB",
  "james": "JAS",
  "peter book 1": "1PE",
  "peter book 2": "2PE",
  "john book 1": "1JN",
  "john book 2": "2JN",
  "john book 3": "3JN",
  "judah": "JUD",
  "jude": "JUD",
  "revelations": "REV",
  "revelation": "REV",
}));

const bitrates = {
  V1: { 1: [0, 32, 64, 96, 128, 160, 192, 224, 256, 288, 320, 352, 384, 416, 448], 2: [0, 32, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320, 384], 3: [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320] },
  V2: { 1: [0, 32, 48, 56, 64, 80, 96, 112, 128, 144, 160, 176, 192, 224, 256], 2: [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160], 3: [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160] },
};

const sampleRates = {
  0: [11025, 12000, 8000],
  2: [22050, 24000, 16000],
  3: [44100, 48000, 32000],
};

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function writeJson(filePath, value) {
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function normalizeSourceName(name) {
  return path.basename(name, path.extname(name))
    .replace(/\s+\(\d+\)$/u, "")
    .replace(/[_-]+/gu, " ")
    .replace(/\s+/gu, " ")
    .trim()
    .toLowerCase();
}

function sha256File(filePath) {
  const hash = crypto.createHash("sha256");
  hash.update(fs.readFileSync(filePath));
  return hash.digest("hex");
}

function getBibleBooks() {
  const bible = readJson(bibleJsonPath);
  const books = bible.books.map((book, index) => ({
    book_code: bookCodes[index],
    book_name: book.name,
    book_number: book.book_number,
    expected_chapters: book.chapters.length,
  }));
  return {
    translation_code: bible.translation.code,
    language: bible.translation.language,
    books,
  };
}

function testZip(zipPath) {
  const command = `Add-Type -AssemblyName System.IO.Compression.FileSystem; [System.IO.Compression.ZipFile]::OpenRead('${zipPath.replace(/'/g, "''")}').Dispose()`;
  const result = childProcess.spawnSync("powershell.exe", ["-NoProfile", "-Command", command], {
    cwd: repoRoot,
    encoding: "utf8",
    windowsHide: true,
  });
  return {
    corrupt: result.status !== 0,
    error: result.status === 0 ? null : (result.stderr || result.stdout || "Unable to open ZIP").trim(),
  };
}

function listZipMp3Entries(zipPath) {
  const command = `Add-Type -AssemblyName System.IO.Compression.FileSystem; [System.IO.Compression.ZipFile]::OpenRead('${zipPath.replace(/'/g, "''")}').Entries | Where-Object { $_.FullName -match '\\.mp3$' } | ForEach-Object { $_.FullName }`;
  const result = childProcess.spawnSync("powershell.exe", ["-NoProfile", "-Command", command], {
    cwd: repoRoot,
    encoding: "utf8",
    windowsHide: true,
  });
  if (result.status !== 0) return [];
  return result.stdout.split(/\r?\n/u).map((line) => line.trim()).filter(Boolean);
}

function inferBookCodesFromZipEntries(entries) {
  return [...new Set(entries
    .map((entry) => {
      const match = entry.match(/(?:^|[/\\])([123]?[A-Z]{2,3})_\d{3}\.mp3$/u);
      return match?.[1] || null;
    })
    .filter((code) => code && bookCodes.includes(code)))].sort();
}

function scanZips() {
  const files = fs.readdirSync(sourceDir)
    .filter((file) => file.toLowerCase().endsWith(".zip"))
    .sort((a, b) => a.localeCompare(b));
  const checksumGroups = new Map();
  const bookGroups = new Map();
  const scanned = files.map((file) => {
    const filePath = path.join(sourceDir, file);
    const normalized_name = normalizeSourceName(file);
    const filename_book_code = sourceNameToCode.get(normalized_name) || null;
    const checksum = sha256File(filePath);
    const stat = fs.statSync(filePath);
    const zipTest = testZip(filePath);
    const mp3Entries = zipTest.corrupt ? [] : listZipMp3Entries(filePath);
    const zip_entry_book_codes = inferBookCodesFromZipEntries(mp3Entries);
    const expected_book_code = zip_entry_book_codes.length === 1 ? zip_entry_book_codes[0] : filename_book_code;
    const entry = {
      filename: file,
      relative_path: path.relative(repoRoot, filePath).replace(/\\/g, "/"),
      file_size: stat.size,
      checksum,
      normalized_name,
      filename_book_code,
      zip_entry_book_codes,
      expected_book_code,
      corrupt: zipTest.corrupt,
      error: zipTest.error,
      duplicate_checksum: false,
      duplicate_book: false,
      selected_for_extraction: false,
    };
    if (!checksumGroups.has(checksum)) checksumGroups.set(checksum, []);
    checksumGroups.get(checksum).push(entry);
    if (expected_book_code) {
      if (!bookGroups.has(expected_book_code)) bookGroups.set(expected_book_code, []);
      bookGroups.get(expected_book_code).push(entry);
    }
    return entry;
  });

  for (const group of checksumGroups.values()) {
    if (group.length > 1) group.forEach((entry) => { entry.duplicate_checksum = true; });
  }
  for (const group of bookGroups.values()) {
    if (group.length > 1) group.forEach((entry) => { entry.duplicate_book = true; });
    const selected = group
      .filter((entry) => !entry.corrupt)
      .sort((a, b) => sourcePreference(a.filename) - sourcePreference(b.filename) || a.filename.localeCompare(b.filename))[0];
    if (selected) selected.selected_for_extraction = true;
  }

  return scanned;
}

function sourcePreference(filename) {
  const lower = filename.toLowerCase();
  let score = 0;
  if (/\(\d+\)/u.test(lower)) score += 100;
  if (lower.includes("thesalonike")) score += 20;
  return score;
}

function expandZip(zipPath, destination) {
  ensureDir(destination);
  const command = `Expand-Archive -LiteralPath '${zipPath.replace(/'/g, "''")}' -DestinationPath '${destination.replace(/'/g, "''")}' -Force`;
  const result = childProcess.spawnSync("powershell.exe", ["-NoProfile", "-Command", command], {
    cwd: repoRoot,
    encoding: "utf8",
    windowsHide: true,
  });
  if (result.status !== 0) {
    throw new Error((result.stderr || result.stdout || `Failed to extract ${zipPath}`).trim());
  }
}

function listFilesRecursive(dir) {
  if (!fs.existsSync(dir)) return [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  return entries.flatMap((entry) => {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) return listFilesRecursive(fullPath);
    return [fullPath];
  });
}

function extractSelectedZips(scanned) {
  ensureDir(extractedDir);
  const tempRoot = path.join(extractedDir, "_tmp");
  for (const code of bookCodes) {
    fs.rmSync(path.join(extractedDir, code), { recursive: true, force: true });
  }
  fs.rmSync(tempRoot, { recursive: true, force: true });
  ensureDir(tempRoot);
  const selected = scanned.filter((entry) => entry.selected_for_extraction);
  const extraction = [];

  for (const entry of selected) {
    console.log(`Extracting ${entry.filename} -> ${entry.expected_book_code}`);
    const bookDir = path.join(extractedDir, entry.expected_book_code);
    ensureDir(bookDir);
    const tempDir = path.join(tempRoot, entry.expected_book_code);
    fs.rmSync(tempDir, { recursive: true, force: true });
    ensureDir(tempDir);
    expandZip(path.join(sourceDir, entry.filename), tempDir);
    const mp3s = listFilesRecursive(tempDir)
      .filter((file) => file.toLowerCase().endsWith(".mp3"))
      .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

    const copied = [];
    mp3s.forEach((mp3, index) => {
      const chapter = inferChapterFromName(mp3) || index + 1;
      const destination = path.join(bookDir, `${entry.expected_book_code}_${String(chapter).padStart(3, "0")}.mp3`);
      fs.copyFileSync(mp3, destination);
      copied.push({
        source_file: path.relative(tempDir, mp3).replace(/\\/g, "/"),
        filename: path.basename(destination),
        chapter,
      });
    });
    fs.rmSync(tempDir, { recursive: true, force: true });
    extraction.push({
      zip_filename: entry.filename,
      book_code: entry.expected_book_code,
      mp3_files_found: mp3s.length,
      files_copied: copied.length,
      files: copied,
    });
  }

  return extraction;
}

function inferChapterFromName(filePath) {
  const basename = path.basename(filePath, path.extname(filePath));
  const matches = basename.match(/\d+/gu);
  if (!matches || matches.length === 0) return null;
  return Number(matches[matches.length - 1]);
}

function parseMp3Duration(filePath) {
  const buffer = fs.readFileSync(filePath);
  let offset = 0;
  if (buffer.length >= 10 && buffer.toString("ascii", 0, 3) === "ID3") {
    const size = ((buffer[6] & 0x7f) << 21) | ((buffer[7] & 0x7f) << 14) | ((buffer[8] & 0x7f) << 7) | (buffer[9] & 0x7f);
    offset = 10 + size;
  }

  let duration = 0;
  let frames = 0;
  let firstFrameOffset = null;
  let firstBitrate = null;
  for (let i = offset; i + 4 < buffer.length;) {
    if (buffer[i] !== 0xff || (buffer[i + 1] & 0xe0) !== 0xe0) {
      i += 1;
      continue;
    }

    const versionBits = (buffer[i + 1] >> 3) & 0x03;
    const layerBits = (buffer[i + 1] >> 1) & 0x03;
    const bitrateIndex = (buffer[i + 2] >> 4) & 0x0f;
    const sampleRateIndex = (buffer[i + 2] >> 2) & 0x03;
    const padding = (buffer[i + 2] >> 1) & 0x01;
    if (versionBits === 1 || layerBits === 0 || bitrateIndex === 0 || bitrateIndex === 15 || sampleRateIndex === 3) {
      i += 1;
      continue;
    }

    const versionKey = versionBits === 3 ? "V1" : "V2";
    const layer = 4 - layerBits;
    const sampleRate = sampleRates[versionBits]?.[sampleRateIndex];
    const bitrate = bitrates[versionKey]?.[layer]?.[bitrateIndex];
    if (!sampleRate || !bitrate) {
      i += 1;
      continue;
    }

    if (firstFrameOffset === null) {
      firstFrameOffset = i;
      firstBitrate = bitrate;
    }

    let frameLength;
    let samples;
    if (layer === 1) {
      frameLength = Math.floor(((12 * bitrate * 1000) / sampleRate + padding) * 4);
      samples = 384;
    } else {
      const coefficient = layer === 3 && versionKey === "V2" ? 72 : 144;
      frameLength = Math.floor((coefficient * bitrate * 1000) / sampleRate + padding);
      samples = layer === 3 && versionKey === "V2" ? 576 : 1152;
    }

    if (frameLength <= 4) {
      i += 1;
      continue;
    }

    duration += samples / sampleRate;
    frames += 1;
    i += frameLength;
  }

  if (frames === 0) {
    return { playable: false, duration_seconds: 0, mp3_frames: 0, error: "No valid MPEG audio frames found" };
  }

  return {
    playable: duration > 0,
    duration_seconds: Math.round(duration * 1000) / 1000,
    mp3_frames: frames,
    first_frame_offset: firstFrameOffset,
    first_bitrate_kbps: firstBitrate,
    error: null,
  };
}

function validateExtracted(booksMeta) {
  const manifest = [];
  const files = [];
  const duplicateMap = new Map();
  const corruptFiles = [];

  for (const book of booksMeta.books) {
    const bookDir = path.join(extractedDir, book.book_code);
    const mp3s = fs.existsSync(bookDir)
      ? fs.readdirSync(bookDir).filter((file) => file.toLowerCase().endsWith(".mp3")).sort()
      : [];

    for (const file of mp3s) {
      const filePath = path.join(bookDir, file);
      const stat = fs.statSync(filePath);
      const checksum = sha256File(filePath);
      const duration = parseMp3Duration(filePath);
      const nameMatch = file.match(new RegExp(`^${book.book_code}_(\\d{3})\\.mp3$`, "u"));
      const chapter = nameMatch ? Number(nameMatch[1]) : inferChapterFromName(file);
      const validation_errors = [];
      if (!nameMatch) validation_errors.push("Invalid naming convention");
      if (!chapter || chapter < 1) validation_errors.push("Invalid chapter number");
      if (chapter > book.expected_chapters) validation_errors.push("Chapter number exceeds installed translation");
      if (stat.size <= 0) validation_errors.push("File size is zero");
      if (!duration.playable) validation_errors.push(duration.error || "MP3 is not playable");
      if (duration.duration_seconds <= 0) validation_errors.push("Duration is zero");

      const relativePath = path.relative(packageDir, filePath).replace(/\\/g, "/");
      const record = {
        book_code: book.book_code,
        book_name: book.book_name,
        chapter,
        filename: file,
        duration_seconds: duration.duration_seconds,
        file_size: stat.size,
        checksum,
        relative_path: relativePath,
        language: booksMeta.language,
        translation_code: booksMeta.translation_code,
        audio_source: "official",
        provider: "Open.Bible",
        license: "CC BY-SA 4.0",
      };
      manifest.push(record);
      const validation = {
        ...record,
        playable: duration.playable,
        mp3_frames: duration.mp3_frames,
        naming_valid: Boolean(nameMatch),
        validation_errors,
      };
      files.push(validation);
      if (validation_errors.length > 0) corruptFiles.push(validation);
      if (!duplicateMap.has(checksum)) duplicateMap.set(checksum, []);
      duplicateMap.get(checksum).push(record);
    }
  }

  const duplicateFiles = [...duplicateMap.values()]
    .filter((group) => group.length > 1)
    .flatMap((group) => group);

  return {
    manifest: manifest.sort((a, b) => bookCodes.indexOf(a.book_code) - bookCodes.indexOf(b.book_code) || a.chapter - b.chapter),
    validationFiles: files.sort((a, b) => bookCodes.indexOf(a.book_code) - bookCodes.indexOf(b.book_code) || a.chapter - b.chapter),
    corruptFiles,
    duplicateFiles,
  };
}

function createCoverage(booksMeta, manifest) {
  const byBook = new Map();
  for (const entry of manifest) {
    if (!byBook.has(entry.book_code)) byBook.set(entry.book_code, []);
    byBook.get(entry.book_code).push(entry.chapter);
  }

  const books = booksMeta.books.map((book) => {
    const chapters = byBook.get(book.book_code) || [];
    const unique = [...new Set(chapters)].sort((a, b) => a - b);
    const missing = [];
    for (let i = 1; i <= book.expected_chapters; i += 1) {
      if (!unique.includes(i)) missing.push(i);
    }
    const extra = unique.filter((chapter) => chapter > book.expected_chapters);
    return {
      book: book.book_name,
      book_code: book.book_code,
      expected_chapters: book.expected_chapters,
      found_chapters: unique.length,
      missing_chapters: missing,
      extra_chapters: extra,
    };
  });

  return {
    generated_at: new Date().toISOString(),
    translation_code: booksMeta.translation_code,
    language: booksMeta.language,
    totals: {
      books_expected: booksMeta.books.length,
      books_found: books.filter((book) => book.found_chapters > 0).length,
      chapters_expected: books.reduce((sum, book) => sum + book.expected_chapters, 0),
      chapters_found: books.reduce((sum, book) => sum + book.found_chapters, 0),
      missing_chapters: books.reduce((sum, book) => sum + book.missing_chapters.length, 0),
      extra_chapters: books.reduce((sum, book) => sum + book.extra_chapters.length, 0),
    },
    books,
  };
}

function formatChapterRange(chapters) {
  if (chapters.length === 0) return "";
  const ranges = [];
  let start = chapters[0];
  let previous = chapters[0];

  for (let i = 1; i < chapters.length; i += 1) {
    const chapter = chapters[i];
    if (chapter === previous + 1) {
      previous = chapter;
      continue;
    }

    ranges.push(start === previous ? `${start}` : `${start}-${previous}`);
    start = chapter;
    previous = chapter;
  }

  ranges.push(start === previous ? `${start}` : `${start}-${previous}`);
  return ranges.join(",");
}

function createChapterIntegrity(booksMeta, validationFiles) {
  const byBook = new Map();
  for (const file of validationFiles) {
    if (!byBook.has(file.book_code)) byBook.set(file.book_code, []);
    byBook.get(file.book_code).push(file);
  }

  const books = booksMeta.books.map((book) => {
    const files = byBook.get(book.book_code) || [];
    const chapterCounts = new Map();
    for (const file of files) {
      if (!Number.isInteger(file.chapter)) continue;
      chapterCounts.set(file.chapter, (chapterCounts.get(file.chapter) || 0) + 1);
    }

    const foundChapters = [...chapterCounts.keys()].sort((a, b) => a - b);
    const missingChapters = [];
    for (let chapter = 1; chapter <= book.expected_chapters; chapter += 1) {
      if (!chapterCounts.has(chapter)) missingChapters.push(chapter);
    }

    const extraChapters = foundChapters.filter((chapter) => chapter > book.expected_chapters);
    const duplicateChapters = [...chapterCounts.entries()]
      .filter(([, count]) => count > 1)
      .map(([chapter, count]) => ({ chapter, count }));
    const firstChapterFound = foundChapters.length > 0 ? foundChapters[0] : null;
    const startsAtChapterOne = files.length === 0 || firstChapterFound === 1;
    const hasGaps = missingChapters.length > 0;
    const detected = files.length > 0;
    const status = detected
      && !hasGaps
      && duplicateChapters.length === 0
      && extraChapters.length === 0
      && startsAtChapterOne
      ? "PASS"
      : "FAIL";

    return {
      book: book.book_name,
      book_code: book.book_code,
      detected,
      expected_chapter_count: book.expected_chapters,
      expected_range: book.expected_chapters > 0 ? `1-${book.expected_chapters}` : "",
      found_chapter_count: foundChapters.length,
      found_range: formatChapterRange(foundChapters),
      first_chapter_found: firstChapterFound,
      starts_at_chapter_one: startsAtChapterOne,
      missing_chapters: missingChapters,
      duplicate_chapters: duplicateChapters,
      extra_chapters: extraChapters,
      has_numbering_gaps: hasGaps,
      status,
    };
  });

  const detectedBooks = books.filter((book) => book.detected);
  const failedBooks = books.filter((book) => book.status !== "PASS");
  const missingBooks = books.filter((book) => !book.detected);

  return {
    totals: {
      books_expected: booksMeta.books.length,
      books_detected: detectedBooks.length,
      books_passed: books.filter((book) => book.status === "PASS").length,
      books_failed: failedBooks.length,
      missing_books: missingBooks.length,
      chapters_expected: books.reduce((sum, book) => sum + book.expected_chapter_count, 0),
      chapters_found: books.reduce((sum, book) => sum + book.found_chapter_count, 0),
      missing_chapters: books.reduce((sum, book) => sum + book.missing_chapters.length, 0),
      duplicate_chapter_numbers: books.reduce((sum, book) => sum + book.duplicate_chapters.length, 0),
      extra_chapters: books.reduce((sum, book) => sum + book.extra_chapters.length, 0),
      numbering_gap_books: books.filter((book) => book.has_numbering_gaps).length,
      books_not_starting_at_chapter_one: books.filter((book) => book.detected && !book.starts_at_chapter_one).length,
    },
    ready_for_import_chapter_integrity: failedBooks.length === 0,
    failed_books: failedBooks.map((book) => ({
      book: book.book,
      book_code: book.book_code,
      missing_chapters: book.missing_chapters,
      duplicate_chapters: book.duplicate_chapters,
      extra_chapters: book.extra_chapters,
      first_chapter_found: book.first_chapter_found,
      starts_at_chapter_one: book.starts_at_chapter_one,
      has_numbering_gaps: book.has_numbering_gaps,
    })),
    books,
  };
}

function formatDuration(seconds) {
  const whole = Math.round(seconds);
  const h = Math.floor(whole / 3600);
  const m = Math.floor((whole % 3600) / 60);
  const s = whole % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function main() {
  ensureDir(extractedDir);
  ensureDir(manifestsDir);
  ensureDir(reportsDir);

  const booksMeta = getBibleBooks();
  const scannedZips = scanZips();
  const extraction = extractSelectedZips(scannedZips);
  const validation = validateExtracted(booksMeta);
  const coverage = createCoverage(booksMeta, validation.manifest);
  const chapterIntegrity = createChapterIntegrity(booksMeta, validation.validationFiles);
  const totalDuration = validation.manifest.reduce((sum, entry) => sum + entry.duration_seconds, 0);
  const totalStorage = validation.manifest.reduce((sum, entry) => sum + entry.file_size, 0);
  const corruptZipCount = scannedZips.filter((entry) => entry.corrupt).length;
  const duplicateZipCount = scannedZips.filter((entry) => entry.duplicate_checksum || entry.duplicate_book).length;
  const readyForImport = corruptZipCount === 0
    && validation.corruptFiles.length === 0
    && validation.duplicateFiles.length === 0
    && chapterIntegrity.totals.missing_books === 0
    && chapterIntegrity.totals.missing_chapters === 0
    && chapterIntegrity.totals.duplicate_chapter_numbers === 0
    && chapterIntegrity.totals.numbering_gap_books === 0
    && chapterIntegrity.totals.books_not_starting_at_chapter_one === 0
    && chapterIntegrity.ready_for_import_chapter_integrity
    && coverage.totals.books_found === coverage.totals.books_expected
    && coverage.totals.chapters_found === coverage.totals.chapters_expected
    && coverage.totals.missing_chapters === 0
    && coverage.totals.extra_chapters === 0;

  const validationReport = {
    generated_at: new Date().toISOString(),
    source_dir: path.relative(repoRoot, sourceDir).replace(/\\/g, "/"),
    extracted_dir: path.relative(repoRoot, extractedDir).replace(/\\/g, "/"),
    zip_scan: scannedZips,
    extraction,
    totals: {
      zip_files_found: scannedZips.length,
      zip_files_corrupt: corruptZipCount,
      duplicate_zip_files: duplicateZipCount,
      extracted_books: coverage.totals.books_found,
      extracted_chapters: validation.manifest.length,
      corrupt_files: validation.corruptFiles.length,
      duplicate_files: validation.duplicateFiles.length,
      missing_books: chapterIntegrity.totals.missing_books,
      missing_chapters: chapterIntegrity.totals.missing_chapters,
      duplicate_chapter_numbers: chapterIntegrity.totals.duplicate_chapter_numbers,
      numbering_gap_books: chapterIntegrity.totals.numbering_gap_books,
      books_not_starting_at_chapter_one: chapterIntegrity.totals.books_not_starting_at_chapter_one,
      chapter_integrity_passed: chapterIntegrity.ready_for_import_chapter_integrity,
    },
    chapter_integrity: chapterIntegrity,
    corrupt_files: validation.corruptFiles,
    duplicate_files: validation.duplicateFiles,
    files: validation.validationFiles,
  };

  const summaryReport = {
    generated_at: new Date().toISOString(),
    books: coverage.totals.books_found,
    expected_books: coverage.totals.books_expected,
    chapters: coverage.totals.chapters_found,
    expected_chapters: coverage.totals.chapters_expected,
    total_duration_seconds: Math.round(totalDuration * 1000) / 1000,
    total_duration_hhmmss: formatDuration(totalDuration),
    total_storage_size_bytes: totalStorage,
    total_storage_size_mb: Math.round((totalStorage / 1024 / 1024) * 100) / 100,
    corrupt_files: validation.corruptFiles.length,
    corrupt_zips: corruptZipCount,
    duplicate_files: validation.duplicateFiles.length,
    duplicate_zips: duplicateZipCount,
    missing_books: chapterIntegrity.totals.missing_books,
    missing_chapters: coverage.totals.missing_chapters,
    extra_chapters: coverage.totals.extra_chapters,
    duplicate_chapter_numbers: chapterIntegrity.totals.duplicate_chapter_numbers,
    numbering_gap_books: chapterIntegrity.totals.numbering_gap_books,
    books_not_starting_at_chapter_one: chapterIntegrity.totals.books_not_starting_at_chapter_one,
    chapter_integrity_passed: chapterIntegrity.ready_for_import_chapter_integrity,
    manifest_created: "supabase/seed/bible/audio1/open bible/manifests/audio-manifest.json",
    reports_created: [
      "supabase/seed/bible/audio1/open bible/reports/validation-report.json",
      "supabase/seed/bible/audio1/open bible/reports/coverage-report.json",
      "supabase/seed/bible/audio1/open bible/reports/summary-report.json",
    ],
    ready_for_import: readyForImport,
    no_import_performed: true,
  };

  writeJson(path.join(manifestsDir, "audio-manifest.json"), validation.manifest);
  writeJson(path.join(reportsDir, "validation-report.json"), validationReport);
  writeJson(path.join(reportsDir, "coverage-report.json"), coverage);
  writeJson(path.join(reportsDir, "summary-report.json"), summaryReport);

  console.log(JSON.stringify(summaryReport, null, 2));
}

main();

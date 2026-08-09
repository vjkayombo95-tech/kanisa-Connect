const fs = require("node:fs");
const path = require("node:path");

const inputPath = "supabase/seed/bible/generated/biblica-sw.json";
const reportPath = "reports/bible/CATHOLIC_CANON_AUDIT.md";
const jsonReportPath = "reports/bible/catholic-canon-audit.json";

const catholicCanon = [
  { number: 1, english: "Genesis", local: ["Mwanzo"], testament: "old", expectedChapters: 50 },
  { number: 2, english: "Exodus", local: ["Kutoka"], testament: "old", expectedChapters: 40 },
  { number: 3, english: "Leviticus", local: ["Walawi"], testament: "old", expectedChapters: 27 },
  { number: 4, english: "Numbers", local: ["Hesabu"], testament: "old", expectedChapters: 36 },
  { number: 5, english: "Deuteronomy", local: ["Kumbukumbu la Torati"], testament: "old", expectedChapters: 34 },
  { number: 6, english: "Joshua", local: ["Yoshua"], testament: "old", expectedChapters: 24 },
  { number: 7, english: "Judges", local: ["Waamuzi"], testament: "old", expectedChapters: 21 },
  { number: 8, english: "Ruth", local: ["Ruthu"], testament: "old", expectedChapters: 4 },
  { number: 9, english: "1 Samuel", local: ["1 Samweli"], testament: "old", expectedChapters: 31 },
  { number: 10, english: "2 Samuel", local: ["2 Samweli"], testament: "old", expectedChapters: 24 },
  { number: 11, english: "1 Kings", local: ["1 Wafalme"], testament: "old", expectedChapters: 22 },
  { number: 12, english: "2 Kings", local: ["2 Wafalme"], testament: "old", expectedChapters: 25 },
  { number: 13, english: "1 Chronicles", local: ["1 Nyakati"], testament: "old", expectedChapters: 29 },
  { number: 14, english: "2 Chronicles", local: ["2 Nyakati"], testament: "old", expectedChapters: 36 },
  { number: 15, english: "Ezra", local: ["Ezra"], testament: "old", expectedChapters: 10 },
  { number: 16, english: "Nehemiah", local: ["Nehemia"], testament: "old", expectedChapters: 13 },
  { number: 17, english: "Tobit", local: ["Tobit", "Tobia"], testament: "deuterocanonical", expectedChapters: 14 },
  { number: 18, english: "Judith", local: ["Judith", "Yudithi"], testament: "deuterocanonical", expectedChapters: 16 },
  { number: 19, english: "Esther", local: ["Esta"], testament: "old", expectedChapters: 10 },
  { number: 20, english: "1 Maccabees", local: ["1 Maccabees", "1 Wamakabayo"], testament: "deuterocanonical", expectedChapters: 16 },
  { number: 21, english: "2 Maccabees", local: ["2 Maccabees", "2 Wamakabayo"], testament: "deuterocanonical", expectedChapters: 15 },
  { number: 22, english: "Job", local: ["Ayubu"], testament: "old", expectedChapters: 42 },
  { number: 23, english: "Psalms", local: ["Zaburi"], testament: "old", expectedChapters: 150 },
  { number: 24, english: "Proverbs", local: ["Mithali"], testament: "old", expectedChapters: 31 },
  { number: 25, english: "Ecclesiastes", local: ["Mhubiri"], testament: "old", expectedChapters: 12 },
  { number: 26, english: "Song of Songs", local: ["Wimbo Ulio Bora"], testament: "old", expectedChapters: 8 },
  { number: 27, english: "Wisdom", local: ["Wisdom", "Hekima"], testament: "deuterocanonical", expectedChapters: 19 },
  { number: 28, english: "Sirach", local: ["Sirach", "Ecclesiasticus", "Yoshua Bin Sira"], testament: "deuterocanonical", expectedChapters: 51 },
  { number: 29, english: "Isaiah", local: ["Isaya"], testament: "old", expectedChapters: 66 },
  { number: 30, english: "Jeremiah", local: ["Yeremia"], testament: "old", expectedChapters: 52 },
  { number: 31, english: "Lamentations", local: ["Maombolezo"], testament: "old", expectedChapters: 5 },
  { number: 32, english: "Baruch", local: ["Baruch", "Baruku"], testament: "deuterocanonical", expectedChapters: 6 },
  { number: 33, english: "Ezekiel", local: ["Ezekieli"], testament: "old", expectedChapters: 48 },
  { number: 34, english: "Daniel", local: ["Danieli"], testament: "old", expectedChapters: 12 },
  { number: 35, english: "Hosea", local: ["Hosea"], testament: "old", expectedChapters: 14 },
  { number: 36, english: "Joel", local: ["Yoeli"], testament: "old", expectedChapters: 3 },
  { number: 37, english: "Amos", local: ["Amosi"], testament: "old", expectedChapters: 9 },
  { number: 38, english: "Obadiah", local: ["Obadia"], testament: "old", expectedChapters: 1 },
  { number: 39, english: "Jonah", local: ["Yona"], testament: "old", expectedChapters: 4 },
  { number: 40, english: "Micah", local: ["Mika"], testament: "old", expectedChapters: 7 },
  { number: 41, english: "Nahum", local: ["Nahumu"], testament: "old", expectedChapters: 3 },
  { number: 42, english: "Habakkuk", local: ["Habakuki"], testament: "old", expectedChapters: 3 },
  { number: 43, english: "Zephaniah", local: ["Sefania"], testament: "old", expectedChapters: 3 },
  { number: 44, english: "Haggai", local: ["Hagai"], testament: "old", expectedChapters: 2 },
  { number: 45, english: "Zechariah", local: ["Zekaria"], testament: "old", expectedChapters: 14 },
  { number: 46, english: "Malachi", local: ["Malaki"], testament: "old", expectedChapters: 4 },
  { number: 47, english: "Matthew", local: ["Mathayo"], testament: "new", expectedChapters: 28 },
  { number: 48, english: "Mark", local: ["Marko"], testament: "new", expectedChapters: 16 },
  { number: 49, english: "Luke", local: ["Luka"], testament: "new", expectedChapters: 24 },
  { number: 50, english: "John", local: ["Yohana"], testament: "new", expectedChapters: 21 },
  { number: 51, english: "Acts", local: ["Matendo"], testament: "new", expectedChapters: 28 },
  { number: 52, english: "Romans", local: ["Warumi"], testament: "new", expectedChapters: 16 },
  { number: 53, english: "1 Corinthians", local: ["1 Wakorintho"], testament: "new", expectedChapters: 16 },
  { number: 54, english: "2 Corinthians", local: ["2 Wakorintho"], testament: "new", expectedChapters: 13 },
  { number: 55, english: "Galatians", local: ["Wagalatia"], testament: "new", expectedChapters: 6 },
  { number: 56, english: "Ephesians", local: ["Waefeso"], testament: "new", expectedChapters: 6 },
  { number: 57, english: "Philippians", local: ["Wafilipi"], testament: "new", expectedChapters: 4 },
  { number: 58, english: "Colossians", local: ["Wakolosai"], testament: "new", expectedChapters: 4 },
  { number: 59, english: "1 Thessalonians", local: ["1 Wathesalonike"], testament: "new", expectedChapters: 5 },
  { number: 60, english: "2 Thessalonians", local: ["2 Wathesalonike"], testament: "new", expectedChapters: 3 },
  { number: 61, english: "1 Timothy", local: ["1 Timotheo"], testament: "new", expectedChapters: 6 },
  { number: 62, english: "2 Timothy", local: ["2 Timotheo"], testament: "new", expectedChapters: 4 },
  { number: 63, english: "Titus", local: ["Tito"], testament: "new", expectedChapters: 3 },
  { number: 64, english: "Philemon", local: ["Filemoni"], testament: "new", expectedChapters: 1 },
  { number: 65, english: "Hebrews", local: ["Waebrania"], testament: "new", expectedChapters: 13 },
  { number: 66, english: "James", local: ["Yakobo"], testament: "new", expectedChapters: 5 },
  { number: 67, english: "1 Peter", local: ["1 Petro"], testament: "new", expectedChapters: 5 },
  { number: 68, english: "2 Peter", local: ["2 Petro"], testament: "new", expectedChapters: 3 },
  { number: 69, english: "1 John", local: ["1 Yohana"], testament: "new", expectedChapters: 5 },
  { number: 70, english: "2 John", local: ["2 Yohana"], testament: "new", expectedChapters: 1 },
  { number: 71, english: "3 John", local: ["3 Yohana"], testament: "new", expectedChapters: 1 },
  { number: 72, english: "Jude", local: ["Yuda"], testament: "new", expectedChapters: 1 },
  { number: 73, english: "Revelation", local: ["Ufunuo"], testament: "new", expectedChapters: 22 },
];

function main() {
  const seed = JSON.parse(fs.readFileSync(inputPath, "utf8"));
  const importedByName = new Map(seed.books.map((book) => [normalize(book.name), book]));
  const importedByEnglishAlias = new Map();

  for (const expected of catholicCanon) {
    for (const name of [expected.english, ...expected.local]) {
      const book = importedByName.get(normalize(name));
      if (book) importedByEnglishAlias.set(expected.english, book);
    }
  }

  const rows = catholicCanon.map((expected) => {
    const imported = importedByEnglishAlias.get(expected.english) ?? null;
    const importedChapters = imported?.chapters?.length ?? 0;
    const importedVerseCount = imported ? countVerses(imported) : 0;
    return {
      bookNumber: expected.number,
      bookName: expected.english,
      importedName: imported?.name ?? null,
      testament: expected.testament,
      present: Boolean(imported),
      expectedChapters: expected.expectedChapters,
      importedChapters,
      expectedVerseCount: importedVerseCount || null,
      importedVerseCount,
      status: !imported ? "Missing" : importedChapters === expected.expectedChapters ? "Present" : "Chapter mismatch",
    };
  });

  const missing = rows.filter((row) => !row.present);
  const chapterMismatches = rows.filter((row) => row.present && row.importedChapters !== row.expectedChapters);
  const duplicateIssues = collectDuplicateIssues(seed);
  const continuityIssues = collectContinuityIssues(seed);

  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  fs.writeFileSync(reportPath, renderMarkdown(rows, missing, chapterMismatches, duplicateIssues, continuityIssues), "utf8");
  fs.writeFileSync(jsonReportPath, `${JSON.stringify({ rows, missing, chapterMismatches, duplicateIssues, continuityIssues }, null, 2)}\n`, "utf8");

  console.log(`Catholic canon audit: ${rows.length - missing.length}/${rows.length} books present`);
  console.log(`Missing: ${missing.map((row) => row.bookName).join(", ") || "none"}`);
  console.log(`Report: ${reportPath}`);
}

function normalize(value) {
  return String(value).toLowerCase().replace(/\s+/g, " ").trim();
}

function countVerses(book) {
  return book.chapters.reduce((sum, chapter) => sum + chapter.verses.length, 0);
}

function collectDuplicateIssues(seed) {
  const issues = [];
  for (const book of seed.books) {
    for (const chapter of book.chapters) {
      const seen = new Set();
      for (const verse of chapter.verses) {
        if (seen.has(verse.verse)) issues.push(`${book.name} ${chapter.chapter}:${verse.verse}`);
        seen.add(verse.verse);
      }
    }
  }
  return issues;
}

function collectContinuityIssues(seed) {
  const issues = [];
  for (const book of seed.books) {
    const chapters = new Set(book.chapters.map((chapter) => chapter.chapter));
    for (let chapter = 1; chapter <= Math.max(...chapters); chapter += 1) {
      if (!chapters.has(chapter)) issues.push(`${book.name}: missing chapter ${chapter}`);
    }

    for (const chapter of book.chapters) {
      const verses = new Set(chapter.verses.map((verse) => verse.verse));
      for (let verse = 1; verse <= Math.max(...verses); verse += 1) {
        if (!verses.has(verse)) issues.push(`${book.name} ${chapter.chapter}: missing verse ${verse}`);
      }
    }
  }
  return issues;
}

function renderMarkdown(rows, missing, chapterMismatches, duplicateIssues, continuityIssues) {
  const added = [];
  return `# Catholic Canon Audit

Generated from \`${inputPath}\`.

## Summary

- Books audited: ${rows.length}
- Books present: ${rows.length - missing.length}
- Books missing: ${missing.length}
- Chapter mismatches: ${chapterMismatches.length}
- Duplicate verse issues: ${duplicateIssues.length}
- Continuity issues: ${continuityIssues.length}

## Audit Table

| # | Book Name | Imported Name | Testament | Present / Missing | Expected Chapters | Imported Chapters | Expected Verse Count | Imported Verse Count |
|---:|---|---|---|---|---:|---:|---:|---:|
${rows
  .map(
    (row) =>
      `| ${row.bookNumber} | ${row.bookName} | ${row.importedName ?? ""} | ${row.testament} | ${row.status} | ${row.expectedChapters} | ${row.importedChapters} | ${row.expectedVerseCount ?? ""} | ${row.importedVerseCount} |`,
  )
  .join("\n")}

## Books Present

${rows.filter((row) => row.present).map((row) => `- ${row.bookName}${row.importedName ? ` (${row.importedName})` : ""}`).join("\n")}

## Books Missing

${missing.map((row) => `- ${row.bookName} (${row.expectedChapters} chapters)`).join("\n") || "- None"}

## Books Added

${added.length ? added.map((book) => `- ${book}`).join("\n") : "- None in this sprint. No approved Catholic/deuterocanonical Bible text source is present in the repository."}

## Outstanding Issues

- The local seed currently contains a 66-book Bible dataset, not the full 73-book Roman Catholic canon.
- The missing books require approved source text before production seed JSON can be generated. Do not fabricate or copy copyrighted Scripture text into the repository.
- The existing Bible import pipeline is JSON-based; no Bible workbook schema exists in this repository. The current documented format is \`supabase/seed/bible/generated/*.json\`.
- Current imported book numbers follow the existing 66-book seed ordering. A production Catholic import should decide whether to create a new 73-book translation with Catholic canonical numbering or append deuterocanonical books to the existing translation.

## Validation Notes

${duplicateIssues.length ? duplicateIssues.map((issue) => `- Duplicate verse: ${issue}`).join("\n") : "- No duplicate verse numbers detected in the current seed."}
${continuityIssues.length ? `\n\n${continuityIssues.slice(0, 100).map((issue) => `- ${issue}`).join("\n")}${continuityIssues.length > 100 ? `\n- ...${continuityIssues.length - 100} additional continuity issue(s) omitted.` : ""}` : "\n- Chapter and verse numbering is continuous in the current seed."}
`;
}

main();

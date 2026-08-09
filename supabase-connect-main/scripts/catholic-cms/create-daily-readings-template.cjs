const fs = require("fs");
const path = require("path");
const XLSX = require("xlsx");

const outputDir = path.join("supabase", "seed", "catholic-cms", "daily-readings", "templates");
const outputPath = path.join(outputDir, "Kanisa-Connect-Daily-Readings-Template.xlsx");

const columns = [
  "Date",
  "Liturgical Year",
  "Liturgical Season",
  "Celebration",
  "Liturgical Color",
  "First Reading",
  "Psalm",
  "Second Reading",
  "Gospel Acclamation",
  "Gospel",
  "Reflection",
  "Prayer",
  "Meditation Questions",
  "Daily Challenge",
  "Language",
  "Status",
  "Visibility",
  "Source",
  "Editorial Notes",
];

const instructions = [
  ["Kanisa Connect Daily Readings CMS Template"],
  [""],
  ["Production Policy", "Do not invent official liturgical reading schedules. Production references must come from a verified Catholic source."],
  ["Bible Text Policy", "Do not paste Bible text into this workbook. Enter references only; the Bible module provides Bible text."],
  ["Required Liturgical Data", "Date, First Reading, Psalm, Gospel, Language, Status, Visibility."],
  ["Optional Editorial Enrichment", "Reflection, Prayer, Meditation Questions, Daily Challenge, Second Reading, Gospel Acclamation."],
  ["Dry Run", "Run Dry Run in Kanisa Connect before importing. No data is written during dry run."],
  ["Conflict Default", "Create Draft Revision is the default. Existing CMS records are never silently overwritten."],
  ["Small Batch Process", "Validate the full workbook, then import a verified date range such as one month before importing a full year."],
  ["Example Rows", "Rows in the Example Rows sheet are development examples only and are not production liturgical data."],
];

const validationReference = [
  ["Field", "Required", "Notes"],
  ["Date", "Yes", "YYYY-MM-DD"],
  ["First Reading", "Yes", "Bible reference only, for example Isaiah 55:10-11"],
  ["Psalm", "Yes", "Bible reference only"],
  ["Gospel", "Yes", "Bible reference only"],
  ["Second Reading", "No", "Use only when the verified source provides one"],
  ["Gospel Acclamation", "No", "Reference only"],
  ["Reflection", "No", "Original or properly licensed editorial content"],
  ["Prayer", "No", "Original or properly licensed editorial content"],
  ["Language", "Yes", "Use a configured CMS language such as English, Swahili, or Latin"],
  ["Status", "Yes", "draft, review, published, featured, archived"],
  ["Visibility", "Yes", "public, member, pastoral, admin"],
  ["Source", "Recommended", "Name the verified source or batch source"],
  ["Editorial Notes", "No", "Internal notes for editors"],
];

const exampleRows = [
  columns,
  [
    "DEVELOPMENT EXAMPLE ONLY - replace before import",
    "A",
    "Ordinary Time",
    "Development Example Celebration",
    "Green",
    "Isaiah 55:10-11",
    "Psalm 65:10-14",
    "",
    "",
    "Matthew 13:1-9",
    "Development example reflection. Not production liturgical content.",
    "Development example prayer. Not production liturgical content.",
    "What word from the Gospel stays with you today?",
    "Spend five minutes in quiet prayer.",
    "English",
    "draft",
    "member",
    "Development example only",
    "Replace with verified Catholic source data.",
  ],
];

fs.mkdirSync(outputDir, { recursive: true });

const workbook = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(instructions), "Instructions");
XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([columns]), "Daily Readings");
XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(validationReference), "Validation Reference");
XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(exampleRows), "Example Rows");

workbook.Sheets["Instructions"]["!cols"] = [{ wch: 28 }, { wch: 120 }];
workbook.Sheets["Daily Readings"]["!cols"] = columns.map(() => ({ wch: 24 }));
workbook.Sheets["Validation Reference"]["!cols"] = [{ wch: 28 }, { wch: 14 }, { wch: 90 }];
workbook.Sheets["Example Rows"]["!cols"] = columns.map(() => ({ wch: 28 }));

XLSX.writeFile(workbook, outputPath);
console.log(`Created ${outputPath}`);

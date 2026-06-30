import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import { validateBibleSeed } from "../../src/lib/bible/schema.ts";

const startedAt = Date.now();
const args = parseArgs(process.argv.slice(2));
const inputPath = args.input ?? "supabase/seed/bible/generated/biblica-sw.json";
const reportPath = args.report ?? "reports/bible/validation-report.json";

type ValidationReport = {
  timestamp: string;
  input: string;
  valid: boolean;
  books_processed: number;
  chapters_processed: number;
  verses_processed: number;
  warnings: Array<{ path: string; message: string }>;
  errors: Array<{ path: string; message: string }>;
  duration_ms: number;
};

function main() {
  const rawErrors: Array<{ path: string; message: string }> = [];

  try {
    if (!existsSync(inputPath)) {
      throw new Error(`Bible JSON does not exist: ${inputPath}`);
    }

    const json = JSON.parse(readJsonFile(inputPath)) as unknown;
    const validation = validateBibleSeed(json);
    const report: ValidationReport = {
      timestamp: new Date().toISOString(),
      input: inputPath,
      valid: validation.valid,
      books_processed: validation.books,
      chapters_processed: validation.chapters,
      verses_processed: validation.verses,
      warnings: validation.warnings.map(({ path, message }) => ({ path, message })),
      errors: validation.errors.map(({ path, message }) => ({ path, message })),
      duration_ms: Date.now() - startedAt,
    };

    writeReport(report);
    printReport(report);
    if (!validation.valid) process.exitCode = 1;
  } catch (error) {
    rawErrors.push({ path: "$", message: error instanceof Error ? error.message : String(error) });
    const report: ValidationReport = {
      timestamp: new Date().toISOString(),
      input: inputPath,
      valid: false,
      books_processed: 0,
      chapters_processed: 0,
      verses_processed: 0,
      warnings: [],
      errors: rawErrors,
      duration_ms: Date.now() - startedAt,
    };
    writeReport(report);
    printReport(report);
    process.exitCode = 1;
  }
}

function writeReport(report: ValidationReport) {
  mkdirSync(path.dirname(reportPath), { recursive: true });
  writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
}

function readJsonFile(filePath: string) {
  return readFileSync(filePath, "utf8").replace(/^\uFEFF/, "");
}

function printReport(report: ValidationReport) {
  console.log(`Bible JSON validation: ${report.valid ? "PASS" : "FAIL"}`);
  console.log(`Books: ${report.books_processed}`);
  console.log(`Chapters: ${report.chapters_processed}`);
  console.log(`Verses: ${report.verses_processed}`);
  if (report.warnings.length) {
    console.log("\nWarnings:");
    for (const warning of report.warnings) console.log(`- ${warning.path}: ${warning.message}`);
  }
  if (report.errors.length) {
    console.log("\nErrors:");
    for (const error of report.errors) console.log(`- ${error.path}: ${error.message}`);
  }
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

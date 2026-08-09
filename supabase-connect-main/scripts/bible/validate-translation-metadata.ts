import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import type { BibleSeed } from "../../src/lib/bible/schema.ts";

type TranslationMetadataIssue = {
  input: string;
  translation_code: string | null;
  translation_name: string | null;
  missing: string[];
};

type TranslationMetadataValidationReport = {
  timestamp: string;
  input: string;
  valid: boolean;
  translations_checked: number;
  issues: TranslationMetadataIssue[];
};

const args = parseArgs(process.argv.slice(2));
const inputPath = args.input ?? "supabase/seed/bible/published";
const reportPath = args.report ?? "reports/bible/translation-metadata-validation-report.json";

function main() {
  const files = collectJsonFiles(inputPath);
  const issues: TranslationMetadataIssue[] = [];

  for (const file of files) {
    const seed = JSON.parse(readFileSync(file, "utf8").replace(/^\uFEFF/, "")) as Partial<BibleSeed>;
    const translation = seed.translation;
    const missing: string[] = [];

    if (!translation?.name) missing.push("translation name");
    if (!translation?.language) missing.push("language");
    if (!translation?.license_name) missing.push("license");
    if (!translation?.attribution_text && !translation?.attribution) missing.push("attribution");
    if (!translation?.source_url && !translation?.source) missing.push("source");

    if (missing.length) {
      issues.push({
        input: file,
        translation_code: translation?.code ?? null,
        translation_name: translation?.name ?? null,
        missing,
      });
    }
  }

  const report: TranslationMetadataValidationReport = {
    timestamp: new Date().toISOString(),
    input: inputPath,
    valid: issues.length === 0,
    translations_checked: files.length,
    issues,
  };

  mkdirSync(path.dirname(reportPath), { recursive: true });
  writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");

  console.log(`Bible translation metadata validation: ${report.valid ? "PASS" : "FAIL"}`);
  console.log(`Translations checked: ${report.translations_checked}`);
  if (issues.length) {
    console.log("Issues:");
    for (const issue of issues) {
      console.log(`- ${issue.translation_code ?? issue.input}: missing ${issue.missing.join(", ")}`);
    }
  }
  console.log(`Report: ${reportPath}`);
  if (!report.valid) process.exitCode = 1;
}

function collectJsonFiles(target: string): string[] {
  if (!existsSync(target)) throw new Error(`Input does not exist: ${target}`);
  const stat = statSync(target);
  if (stat.isFile()) return target.endsWith(".json") ? [target] : [];

  return readdirSync(target)
    .flatMap((entry) => {
      const fullPath = path.join(target, entry);
      const entryStat = statSync(fullPath);
      if (entryStat.isDirectory()) return collectJsonFiles(fullPath);
      return fullPath.endsWith(".json") ? [fullPath] : [];
    })
    .sort();
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

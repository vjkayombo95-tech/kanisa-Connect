import { generateWorkbook } from "./export/excel/workbook-writer.ts";
import { runImport } from "./import/import-runner.ts";
import { USCCBProvider } from "./providers/usccb/provider.ts";
import { parseImportDate, parseImportYear } from "./utils/dates.ts";
import { logger } from "./utils/logger.ts";

type ParsedCliArgs = {
  values: Record<string, string>;
  flags: Set<string>;
};

function parseCliArgs(argv: string[]): ParsedCliArgs {
  const values: Record<string, string> = {};
  const flags = new Set<string>();

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (!arg.startsWith("--")) continue;

    const inlineValueIndex = arg.indexOf("=");
    if (inlineValueIndex > 0) {
      values[arg.slice(2, inlineValueIndex)] = arg.slice(inlineValueIndex + 1);
      continue;
    }

    const key = arg.slice(2);
    const next = argv[index + 1];
    if (next && !next.startsWith("--")) {
      values[key] = next;
      index += 1;
      continue;
    }

    flags.add(key);
  }

  return { values, flags };
}

function getArg(parsedArgs: ParsedCliArgs, key: string): string | undefined {
  return parsedArgs.values[key] ?? process.env[`npm_config_${key}`];
}

async function main() {
  const parsedArgs = parseCliArgs(process.argv.slice(2));

  if (parsedArgs.flags.has("generate")) {
    const result = await generateWorkbook({
      output: getArg(parsedArgs, "output"),
    });
    logger.info("Workbook generated successfully.");
    logger.info(`Output:\n${result.outputPath}`);
    return;
  }

  if (parsedArgs.flags.has("import")) {
    const summary = await runImport({
      input: getArg(parsedArgs, "input"),
      report: getArg(parsedArgs, "report"),
      dryRun: parsedArgs.flags.has("dry-run"),
      preview: parsedArgs.flags.has("preview"),
    });
    if (summary.status === "failed") process.exitCode = 1;
    return;
  }

  const dateArg = getArg(parsedArgs, "date");
  if (dateArg) {
    const provider = new USCCBProvider();
    const reading = await provider.getReading(parseImportDate(dateArg));
    logger.info(JSON.stringify(reading, null, 2));
    return;
  }

  const year = parseImportYear(getArg(parsedArgs, "year"));
  logger.info(`Starting Liturgical Calendar Import for ${year}...`);
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  logger.error(`Liturgical Calendar Import failed: ${message}`);
  process.exitCode = 1;
});

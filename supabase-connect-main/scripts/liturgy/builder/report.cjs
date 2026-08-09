const fs = require("node:fs");
const path = require("node:path");

function buildValidationReport(definition, validation) {
  return {
    workbook: definition.outputPath,
    liturgicalYear: definition.metadata.liturgicalYear,
    ...(definition.metadata.weekdayCycle ? { weekdayCycle: definition.metadata.weekdayCycle } : {}),
    dateRange: definition.dateRange,
    rows: definition.rows.length,
    ...(definition.extraReportFields ?? {}),
    uniqueDates: validation.uniqueDates,
    valid: validation.errors.length === 0,
    errors: validation.errors,
    notes: validation.notes,
  };
}

function writeJsonReport(reportPath, report) {
  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
}

function printGenerationSummary(definition, validationReport) {
  console.log(`Wrote ${definition.outputPath}`);
  console.log(`Rows: ${definition.rows.length}`);
  if (definition.printDateRange !== false) console.log(`Date range: ${validationReport.dateRange}`);
  console.log(`Workbook validation: ${validationReport.valid ? definition.successLabel ?? "PASS" : "FAIL"}`);
  console.log(`Report: ${definition.reportPath}`);
}

module.exports = {
  buildValidationReport,
  printGenerationSummary,
  writeJsonReport,
};

const { writeWorkbook } = require("./workbook.cjs");
const { validatePackDefinition } = require("./validation.cjs");
const { buildValidationReport, printGenerationSummary, writeJsonReport } = require("./report.cjs");

function generateDailyReadingsPack(definition) {
  writeWorkbook(definition);

  const validation = validatePackDefinition(definition);
  const validationReport = definition.createReport
    ? definition.createReport(definition, validation)
    : buildValidationReport(definition, validation);

  writeJsonReport(definition.reportPath, validationReport);
  printGenerationSummary(definition, validationReport);

  return validationReport;
}

module.exports = {
  ...require("./calendar.cjs"),
  ...require("./preview.cjs"),
  ...require("./references.cjs"),
  ...require("./report.cjs"),
  ...require("./validation.cjs"),
  ...require("./workbook.cjs"),
  generateDailyReadingsPack,
};

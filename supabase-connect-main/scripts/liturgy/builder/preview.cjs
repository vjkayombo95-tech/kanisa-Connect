function buildPreviewCommand(inputPath, reportPath) {
  return [
    "cmd",
    "/c",
    "npm",
    "run",
    "import:liturgy",
    "--",
    "--import",
    "--preview",
    "--input",
    inputPath,
    "--report",
    reportPath,
  ];
}

function buildPreviewSummary(report) {
  return {
    status: report.status,
    mode: report.mode,
    input: report.input,
    inserted: report.inserted,
    updated: report.updated,
    skipped: report.skipped,
    errors: report.errors,
  };
}

module.exports = {
  buildPreviewCommand,
  buildPreviewSummary,
};

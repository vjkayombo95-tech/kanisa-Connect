const fs = require("node:fs");
const path = require("node:path");
const XLSX = require("xlsx");
const {
  calendarHeaders,
  readingHeaders,
  validationHeaders,
  validationLists,
  toCalendarRow,
  toReadingRow,
} = require("./calendar.cjs");

function worksheet(headers, dataRows) {
  const sheet = XLSX.utils.aoa_to_sheet([headers, ...dataRows]);
  sheet["!cols"] = headers.map((header) => ({ wch: Math.max(14, header.length + 4) }));
  sheet["!autofilter"] = {
    ref: XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: dataRows.length, c: headers.length - 1 } }),
  };
  sheet["!freeze"] = { xSplit: 0, ySplit: 1, topLeftCell: "A2", activePane: "bottomLeft", state: "frozen" };
  return sheet;
}

function validationWorksheet() {
  const maxRows = Math.max(...validationHeaders.map((header) => validationLists[header].length));
  return worksheet(
    validationHeaders,
    Array.from({ length: maxRows }, (_, index) => validationHeaders.map((header) => validationLists[header][index] ?? "")),
  );
}

function writeWorkbook({ outputPath, rows, metadata, supplementalSheets = [] }) {
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet(calendarHeaders, rows.map((row) => toCalendarRow(row, metadata))), "Liturgical Calendar");
  XLSX.utils.book_append_sheet(workbook, worksheet(readingHeaders, rows.map(toReadingRow)), "Daily Readings");

  for (const sheet of supplementalSheets) {
    XLSX.utils.book_append_sheet(workbook, worksheet(sheet.headers, sheet.rows), sheet.name);
  }

  XLSX.utils.book_append_sheet(workbook, validationWorksheet(), "Validation Lists");

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  XLSX.writeFile(workbook, outputPath, { bookType: "xlsx", compression: true });
}

module.exports = {
  validationWorksheet,
  worksheet,
  writeWorkbook,
};

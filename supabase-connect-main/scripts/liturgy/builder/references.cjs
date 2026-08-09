const scriptureReferencePattern =
  /^(?:[1-3]\s)?[A-Z][A-Za-z .]+(?:\s\d{1,3}:\d{1,3}[a-d]*(?:-\d{1,3}[a-d]*)?(?:,\s?\d{1,3}[a-d]*(?:-\d{1,3}[a-d]*)?)*|\s\d{1,3}:\d{1,3}[a-d]*-\d{1,3}:\d{1,3}[a-d]*|\s\d{1,3}(?:-\d{1,3})?)$/;

function isImporterCompatibleReference(reference) {
  return scriptureReferencePattern.test(reference.trim());
}

function getRowReferences(row) {
  return [row.first, row.psalm, row.second, row.gospelAcclamation, row.gospel].filter(Boolean);
}

function validateReferences(rows, errors, notes) {
  for (const row of rows) {
    for (const reference of getRowReferences(row)) {
      if (!isImporterCompatibleReference(reference)) {
        errors.push(`${row.date}: Importer-incompatible reference: ${reference}`);
      }

      if (reference.startsWith("Sirach ")) {
        notes.push(`${row.date}: ${reference} is official for the day but requires a Catholic/deuterocanonical Bible import.`);
      }
    }
  }
}

function validateSupplementalReferences(rows, errors, labelKey = "mass") {
  for (const row of rows) {
    for (const reference of [row.first, row.psalm, row.second, row.gospel].filter(Boolean)) {
      if (!isImporterCompatibleReference(reference)) {
        errors.push(`${row[labelKey] ?? row.date}: Importer-incompatible reference: ${reference}`);
      }
    }
  }
}

module.exports = {
  getRowReferences,
  isImporterCompatibleReference,
  validateReferences,
  validateSupplementalReferences,
};

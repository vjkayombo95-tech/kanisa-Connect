const { validateReferences, validateSupplementalReferences } = require("./references.cjs");

function validateDuplicateDates(rows, errors) {
  const dates = new Set();

  for (const row of rows) {
    if (dates.has(row.date)) errors.push(`Duplicate date: ${row.date}`);
    dates.add(row.date);
  }

  return dates;
}

function validateRequiredDates(dates, requiredDates, errors, label) {
  for (const requiredDate of requiredDates) {
    if (!dates.has(requiredDate.date)) {
      errors.push(requiredDate.message ?? `Missing required ${label} date: ${requiredDate.date}`);
    }
  }
}

function validateExpectedRowCount(rows, expectedRows, errors, label) {
  if (typeof expectedRows !== "number") return;
  if (rows.length !== expectedRows) errors.push(`Expected ${expectedRows} ${label} rows but found ${rows.length}.`);
}

function validatePackDefinition(definition) {
  const errors = [];
  const notes = [];
  const dates = validateDuplicateDates(definition.rows, errors);

  validateReferences(definition.rows, errors, notes);
  validateRequiredDates(dates, definition.requiredDates ?? [], errors, definition.requiredDateLabel ?? definition.metadata.season);
  validateExpectedRowCount(definition.rows, definition.expectedRows, errors, definition.rowCountLabel ?? definition.metadata.season);

  for (const supplementalValidation of definition.supplementalValidations ?? []) {
    validateSupplementalReferences(supplementalValidation.rows, errors, supplementalValidation.labelKey);
  }

  notes.push(...(definition.notes ?? []));

  return {
    errors,
    notes,
    uniqueDates: dates.size,
  };
}

module.exports = {
  validateDuplicateDates,
  validateExpectedRowCount,
  validatePackDefinition,
  validateRequiredDates,
};

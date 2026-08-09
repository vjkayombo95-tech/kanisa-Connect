export function parseImportYear(value: string | undefined): number {
  const currentYear = new Date().getFullYear();
  if (!value) return currentYear;

  const year = Number(value);
  if (!Number.isInteger(year) || year < 1900 || year > 2200) {
    throw new Error(`Invalid liturgical calendar year: ${value}`);
  }

  return year;
}

export function parseImportDate(value: string): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error(`Invalid liturgical calendar date: ${value}. Expected YYYY-MM-DD.`);
  }

  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
    throw new Error(`Invalid liturgical calendar date: ${value}.`);
  }

  return date;
}

export function getCalendarYearRange(year: number): { start: Date; end: Date } {
  return {
    start: new Date(Date.UTC(year, 0, 1)),
    end: new Date(Date.UTC(year, 11, 31)),
  };
}

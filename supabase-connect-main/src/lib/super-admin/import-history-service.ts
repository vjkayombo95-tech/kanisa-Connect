export type ImportHistoryRecord = {
  id: string;
  workbookName: string;
  importDate: string;
  recordsImported: number;
  recordsUpdated: number;
  recordsSkipped: number;
  recordsFailed: number;
  duration: string;
  importedBy: string;
};

const placeholderHistory: ImportHistoryRecord[] = [];

export async function fetchImportHistory() {
  return placeholderHistory;
}

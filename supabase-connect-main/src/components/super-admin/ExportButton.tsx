import { Download } from "lucide-react";

import { Button } from "@/components/ui/button";

type CsvCell = string | number | boolean | null | undefined;

type ExportButtonProps<T> = {
  rows: T[];
  filename: string;
  columns: Array<{
    header: string;
    value: (row: T) => CsvCell;
  }>;
  disabled?: boolean;
};

function escapeCsvCell(value: CsvCell) {
  const text = value === null || value === undefined ? "" : String(value);
  if (/[",\n\r]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

export function ExportButton<T>({ rows, filename, columns, disabled = false }: ExportButtonProps<T>) {
  const handleExport = () => {
    const csv = [
      columns.map((column) => escapeCsvCell(column.header)).join(","),
      ...rows.map((row) => columns.map((column) => escapeCsvCell(column.value(row))).join(",")),
    ].join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Button type="button" variant="outline" onClick={handleExport} disabled={disabled || rows.length === 0}>
      <Download className="mr-2 h-4 w-4" />
      Export CSV
    </Button>
  );
}

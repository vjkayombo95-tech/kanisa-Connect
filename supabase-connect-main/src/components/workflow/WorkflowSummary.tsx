import { AlertCircle } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type { WorkflowSummaryField } from "./types";

type WorkflowSummaryProps<TRecord = unknown> = {
  fields: WorkflowSummaryField<TRecord>[];
  record: TRecord;
  isLoading?: boolean;
  isError?: boolean;
  emptyMessage?: string;
  className?: string;
};

function resolveFieldValue<TRecord>(field: WorkflowSummaryField<TRecord>, record: TRecord) {
  const value = typeof field.value === "function" ? field.value(record) : field.value;
  return value ?? field.emptyValue ?? "-";
}

export function WorkflowSummary<TRecord = unknown>({
  fields,
  record,
  isLoading,
  isError,
  emptyMessage = "No summary details available.",
  className,
}: WorkflowSummaryProps<TRecord>) {
  if (isLoading) {
    return (
      <div className={cn("grid gap-4 sm:grid-cols-2 lg:grid-cols-3", className)} aria-label="Loading workflow summary">
        {Array.from({ length: 3 }).map((_, index) => (
          <div key={index} className="space-y-2">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-5 w-32" />
          </div>
        ))}
      </div>
    );
  }

  if (isError) {
    return (
      <div className={cn("flex items-center gap-2 text-sm text-destructive", className)} role="alert">
        <AlertCircle className="h-4 w-4" aria-hidden="true" />
        Summary could not be loaded.
      </div>
    );
  }

  if (fields.length === 0) {
    return <p className={cn("text-sm text-muted-foreground", className)}>{emptyMessage}</p>;
  }

  return (
    <dl className={cn("grid gap-4 sm:grid-cols-2 lg:grid-cols-3", className)}>
      {fields.map((field) => (
        <div key={field.id} className="min-w-0 space-y-1">
          <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{field.label}</dt>
          <dd className="truncate text-sm font-medium text-foreground">{resolveFieldValue(field, record)}</dd>
        </div>
      ))}
    </dl>
  );
}

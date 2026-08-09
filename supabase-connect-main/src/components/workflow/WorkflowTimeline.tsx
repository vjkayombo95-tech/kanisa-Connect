import { AlertCircle, Circle } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type { WorkflowTimelineEvent, WorkflowTimelineLabelConfig } from "./types";
import { defaultWorkflowTimelineLabels, formatWorkflowLabel } from "./workflowDefaults";

type WorkflowTimelineProps = {
  events: WorkflowTimelineEvent[];
  labels?: WorkflowTimelineLabelConfig;
  isLoading?: boolean;
  isError?: boolean;
  emptyMessage?: string;
  className?: string;
};

function formatTimelineDate(date: WorkflowTimelineEvent["date"]) {
  if (!date) {
    return "Date unavailable";
  }

  const parsedDate = typeof date === "string" ? new Date(date) : date;

  if (Number.isNaN(parsedDate.getTime())) {
    return "Date unavailable";
  }

  return parsedDate.toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export function WorkflowTimeline({
  events,
  labels,
  isLoading,
  isError,
  emptyMessage = "No timeline activity yet.",
  className,
}: WorkflowTimelineProps) {
  if (isLoading) {
    return (
      <div className={cn("space-y-4", className)} aria-label="Loading workflow timeline">
        {Array.from({ length: 3 }).map((_, index) => (
          <div key={index} className="flex gap-3">
            <Skeleton className="mt-1 h-3 w-3 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-3 w-56" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (isError) {
    return (
      <div className={cn("flex items-center gap-2 text-sm text-destructive", className)} role="alert">
        <AlertCircle className="h-4 w-4" aria-hidden="true" />
        Timeline could not be loaded.
      </div>
    );
  }

  if (events.length === 0) {
    return <p className={cn("text-sm text-muted-foreground", className)}>{emptyMessage}</p>;
  }

  const timelineLabels = { ...defaultWorkflowTimelineLabels, ...labels };

  return (
    <ol className={cn("space-y-4", className)} aria-label="Workflow timeline">
      {events.map((event) => {
        const label = timelineLabels[event.type] ?? event.action ?? formatWorkflowLabel(event.type);

        return (
          <li key={event.id} className="flex gap-3">
            <Circle className="mt-1 h-3 w-3 fill-primary text-primary" aria-hidden="true" />
            <div className="min-w-0 flex-1 space-y-1">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <p className="text-sm font-medium text-foreground">{label}</p>
                <time className="text-xs text-muted-foreground">{formatTimelineDate(event.date)}</time>
              </div>
              <p className="text-sm text-muted-foreground">
                {event.actor ? `By ${event.actor}` : "Actor unavailable"}
                {event.action && event.action !== label ? ` - ${event.action}` : ""}
              </p>
              {event.description ? <p className="text-sm text-muted-foreground">{event.description}</p> : null}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

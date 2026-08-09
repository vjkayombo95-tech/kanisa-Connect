import type { ReactNode } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { WorkflowActionBar } from "./WorkflowActionBar";
import { WorkflowStatusBadge } from "./WorkflowStatusBadge";
import { WorkflowSummary } from "./WorkflowSummary";
import { WorkflowTimeline } from "./WorkflowTimeline";
import type { WorkflowConfig, WorkflowState, WorkflowTimelineEvent } from "./types";

type WorkflowCardProps<TRecord = unknown, TContext = unknown> = {
  config: WorkflowConfig<TRecord, TContext>;
  record: TRecord;
  state: WorkflowState | string;
  actionContext: TContext;
  timelineEvents: WorkflowTimelineEvent[];
  title?: ReactNode;
  description?: ReactNode;
  statusLabel?: string;
  isLoading?: boolean;
  isError?: boolean;
  errorMessage?: string;
  className?: string;
};

export function WorkflowCard<TRecord = unknown, TContext = unknown>({
  config,
  record,
  state,
  actionContext,
  timelineEvents,
  title,
  description,
  statusLabel,
  isLoading,
  isError,
  errorMessage = "Workflow details could not be loaded.",
  className,
}: WorkflowCardProps<TRecord, TContext>) {
  return (
    <Card className={cn("overflow-hidden", className)}>
      <CardHeader className="gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1.5">
          <CardTitle>{title ?? config.title}</CardTitle>
          {(description || config.description) && (
            <CardDescription>{description ?? config.description}</CardDescription>
          )}
        </div>
        <WorkflowStatusBadge state={state} label={statusLabel} />
      </CardHeader>
      <CardContent className="space-y-6">
        {isError ? (
          <p className="text-sm text-destructive" role="alert">
            {errorMessage}
          </p>
        ) : (
          <>
            <WorkflowSummary
              fields={config.summaryFields}
              record={record}
              isLoading={isLoading}
              isError={isError}
            />
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-foreground">Timeline</h3>
              <WorkflowTimeline
                events={timelineEvents}
                labels={config.timelineLabels}
                isLoading={isLoading}
                isError={isError}
              />
            </div>
          </>
        )}
      </CardContent>
      {!isError && config.actions.length > 0 ? (
        <CardFooter>
          <WorkflowActionBar actions={config.actions} context={actionContext} />
        </CardFooter>
      ) : null}
    </Card>
  );
}

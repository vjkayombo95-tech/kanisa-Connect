import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { formatWorkflowLabel, normalizeWorkflowState, workflowStateLabels } from "./workflowDefaults";
import type { WorkflowState } from "./types";

type WorkflowStatusBadgeProps = {
  state: WorkflowState | string;
  label?: string;
  className?: string;
};

const stateClassNames: Partial<Record<WorkflowState, string>> = {
  pending: "border-warning/30 bg-warning/10 text-warning",
  submitted: "border-primary/30 bg-primary/10 text-primary",
  under_review: "border-warning/30 bg-warning/10 text-warning",
  approved: "border-success/30 bg-success/10 text-success",
  rejected: "border-destructive/30 bg-destructive/10 text-destructive",
  scheduled: "border-info/30 bg-info/10 text-info",
  completed: "border-success/30 bg-success/10 text-success",
  cancelled: "border-muted-foreground/30 bg-muted text-muted-foreground",
};

export function WorkflowStatusBadge({ state, label, className }: WorkflowStatusBadgeProps) {
  const normalizedState = normalizeWorkflowState(state);
  const displayLabel =
    label ??
    workflowStateLabels[normalizedState as WorkflowState] ??
    formatWorkflowLabel(normalizedState);

  return (
    <Badge
      variant="outline"
      className={cn(
        "shrink-0 whitespace-nowrap font-medium",
        stateClassNames[normalizedState as WorkflowState],
        className,
      )}
      aria-label={`Workflow status: ${displayLabel}`}
    >
      {displayLabel}
    </Badge>
  );
}

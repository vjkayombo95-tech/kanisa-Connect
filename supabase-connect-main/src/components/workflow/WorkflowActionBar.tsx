import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { WorkflowAction } from "./types";

type WorkflowActionBarProps<TContext = unknown> = {
  actions: WorkflowAction<TContext>[];
  context: TContext;
  className?: string;
};

export function WorkflowActionBar<TContext = unknown>({
  actions,
  context,
  className,
}: WorkflowActionBarProps<TContext>) {
  const visibleActions = actions.filter((action) => action.visible !== false);

  if (visibleActions.length === 0) {
    return null;
  }

  return (
    <div
      role="toolbar"
      aria-label="Workflow actions"
      className={cn("flex flex-wrap items-center gap-2", className)}
    >
      {visibleActions.map((action) => (
        <Button
          key={action.id}
          type="button"
          variant={action.variant ?? "default"}
          size="sm"
          aria-label={action.ariaLabel ?? action.label}
          disabled={action.disabled || action.loading}
          onClick={() => action.onSelect?.(context)}
        >
          {action.loading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : action.icon}
          {action.label}
        </Button>
      ))}
    </div>
  );
}

import { AlertCircle, CheckCircle2, Circle } from "lucide-react";

import { AppLink } from "@/components/AppLink";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { AssistantTask } from "@/lib/assistant";

type AssistantTaskCardProps = {
  task: AssistantTask;
};

const priorityStyles = {
  high: "border-destructive/30 bg-destructive/10 text-destructive",
  medium: "border-amber-500/30 bg-amber-500/10 text-amber-600",
  low: "border-primary/30 bg-primary/10 text-primary",
};

const priorityIcons = {
  high: AlertCircle,
  medium: Circle,
  low: CheckCircle2,
};

export function AssistantTaskCard({ task }: AssistantTaskCardProps) {
  const Icon = priorityIcons[task.priority];
  const content = (
    <div className="flex min-h-24 items-start gap-3 rounded-lg border border-border/70 bg-background/55 p-3 transition-colors hover:border-primary/30">
      <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
        <Icon className="h-4 w-4" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm font-semibold text-foreground">{task.title}</p>
          <Badge variant="outline" className={cn("capitalize", priorityStyles[task.priority])}>
            {task.priority}
          </Badge>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">{task.detail}</p>
      </div>
    </div>
  );

  return task.to ? (
    <AppLink to={task.to} className="block">
      {content}
    </AppLink>
  ) : (
    content
  );
}


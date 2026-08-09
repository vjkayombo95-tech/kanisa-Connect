import { Bot, CornerDownLeft, Lock, Route } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { CommandCenterResult } from "./command-types";

type CommandResultItemProps = {
  result: CommandCenterResult;
  active: boolean;
  onExecute: (result: CommandCenterResult) => void;
  onHover: () => void;
};

export function CommandResultItem({ result, active, onExecute, onHover }: CommandResultItemProps) {
  const Icon = result.requiresAI ? Bot : result.route ? Route : Lock;

  return (
    <button
      type="button"
      role="option"
      aria-selected={active}
      onMouseEnter={onHover}
      onClick={() => onExecute(result)}
      className={cn(
        "flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left transition-colors",
        active ? "bg-primary/10 text-foreground" : "hover:bg-muted/70",
      )}
    >
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
        <Icon className="h-4 w-4" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium">{result.title}</span>
        <span className="mt-0.5 block truncate text-xs text-muted-foreground">{result.subtitle}</span>
      </span>
      {result.requiresAI ? (
        <Badge variant="outline" className="shrink-0 rounded-full">
          AI required
        </Badge>
      ) : null}
      {active ? <CornerDownLeft className="h-4 w-4 shrink-0 text-muted-foreground" /> : null}
    </button>
  );
}

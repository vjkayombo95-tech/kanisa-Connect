import { Clock } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { RecentCommand } from "./command-types";

type RecentCommandsProps = {
  commands: RecentCommand[];
  title?: string;
  onSelect: (command: RecentCommand) => void;
};

export function RecentCommands({ commands, title = "Recent", onSelect }: RecentCommandsProps) {
  if (!commands.length) return null;

  return (
    <section className="space-y-2">
      <p className="flex items-center gap-2 text-xs font-semibold uppercase text-muted-foreground">
        <Clock className="h-3.5 w-3.5" />
        {title}
      </p>
      <div className="flex flex-wrap gap-2">
        {commands.slice(0, 6).map((command) => (
          <Button key={command.id} type="button" variant="secondary" size="sm" onClick={() => onSelect(command)}>
            {command.title}
          </Button>
        ))}
      </div>
    </section>
  );
}

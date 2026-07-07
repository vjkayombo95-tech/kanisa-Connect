import { LayoutDashboard } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import type { CommandCenterResult } from "./command-types";

type WorkspaceSuggestionsProps = {
  commands: CommandCenterResult[];
  onSelect: (command: CommandCenterResult) => void;
};

export function WorkspaceSuggestions({ commands, onSelect }: WorkspaceSuggestionsProps) {
  const { t } = useTranslation();
  if (!commands.length) return null;

  return (
    <section className="space-y-2">
      <p className="flex items-center gap-2 text-xs font-semibold uppercase text-muted-foreground">
        <LayoutDashboard className="h-3.5 w-3.5" />
        {t("command_center.workspace_shortcuts")}
      </p>
      <div className="grid gap-2 sm:grid-cols-2">
        {commands.slice(0, 6).map((command) => (
          <Button
            key={command.id}
            type="button"
            variant="ghost"
            className="justify-start rounded-lg"
            onClick={() => onSelect(command)}
          >
            {command.title}
          </Button>
        ))}
      </div>
    </section>
  );
}

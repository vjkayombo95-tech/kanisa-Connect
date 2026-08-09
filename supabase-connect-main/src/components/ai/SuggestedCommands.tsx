import { Sparkles } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";

type SuggestedCommandsProps = {
  suggestions: string[];
  onSelect: (value: string) => void;
};

export function SuggestedCommands({ suggestions, onSelect }: SuggestedCommandsProps) {
  const { t } = useTranslation();
  if (!suggestions.length) return null;

  return (
    <section className="space-y-2">
      <p className="flex items-center gap-2 text-xs font-semibold uppercase text-muted-foreground">
        <Sparkles className="h-3.5 w-3.5" />
        {t("command_center.suggested")}
      </p>
      <div className="flex flex-wrap gap-2">
        {suggestions.map((suggestion) => (
          <Button key={suggestion} type="button" variant="outline" size="sm" onClick={() => onSelect(suggestion)}>
            {suggestion}
          </Button>
        ))}
      </div>
    </section>
  );
}

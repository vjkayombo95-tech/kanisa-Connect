import { ArrowRight } from "lucide-react";

import { AppLink } from "@/components/AppLink";
import type { AssistantSuggestion } from "@/lib/assistant";

type AssistantSuggestionsProps = {
  suggestions: AssistantSuggestion[];
};

export function AssistantSuggestions({ suggestions }: AssistantSuggestionsProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {suggestions.map((suggestion) => (
        <AppLink
          key={suggestion.id}
          to={suggestion.to}
          className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-background/60 px-3 py-1.5 text-sm font-medium text-foreground transition-colors hover:border-primary/30 hover:text-primary"
          title={suggestion.reason}
        >
          {suggestion.label}
          <ArrowRight className="h-3.5 w-3.5" />
        </AppLink>
      ))}
    </div>
  );
}


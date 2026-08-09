import { Sparkles } from "lucide-react";

import type { AssistantGreetingModel } from "@/lib/assistant";

type AssistantGreetingProps = {
  greeting: AssistantGreetingModel;
};

export function AssistantGreeting({ greeting }: AssistantGreetingProps) {
  return (
    <div className="flex items-start gap-3">
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
        <Sparkles className="h-5 w-5" />
      </span>
      <div className="min-w-0">
        <p className="text-lg font-semibold text-foreground">{greeting.salutation}</p>
        <p className="mt-1 text-sm text-muted-foreground">{greeting.detail}</p>
      </div>
    </div>
  );
}


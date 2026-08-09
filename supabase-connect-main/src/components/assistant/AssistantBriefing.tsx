import { ArrowRight } from "lucide-react";

import { AppLink } from "@/components/AppLink";
import type { AssistantBriefingItem } from "@/lib/assistant";

type AssistantBriefingProps = {
  items: AssistantBriefingItem[];
};

export function AssistantBriefing({ items }: AssistantBriefingProps) {
  return (
    <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
      {items.slice(0, 8).map((item) => {
        const content = (
          <div className="flex min-h-24 flex-col justify-between rounded-lg border border-border/70 bg-background/55 p-3 transition-colors hover:border-primary/30">
            <div>
              <p className="text-xs text-muted-foreground">{item.label}</p>
              <p className="mt-1 line-clamp-2 text-sm font-semibold text-foreground">{item.value}</p>
              {item.detail ? <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{item.detail}</p> : null}
            </div>
            {item.to ? (
              <span className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-primary">
                Open <ArrowRight className="h-3 w-3" />
              </span>
            ) : null}
          </div>
        );

        return item.to ? (
          <AppLink key={item.id} to={item.to} className="block">
            {content}
          </AppLink>
        ) : (
          <div key={item.id}>{content}</div>
        );
      })}
    </div>
  );
}


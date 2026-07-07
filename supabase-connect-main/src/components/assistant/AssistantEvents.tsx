import { ArrowRight } from "lucide-react";

import { AppLink } from "@/components/AppLink";
import { Badge } from "@/components/ui/badge";
import { eventPriorityStyles } from "@/lib/assistant/events";
import { cn } from "@/lib/utils";
import type { AssistantEvent } from "@/lib/assistant";

type AssistantEventsProps = {
  events: AssistantEvent[];
};

export function AssistantEvents({ events }: AssistantEventsProps) {
  if (events.length === 0) {
    return (
      <div className="rounded-lg border border-border/70 bg-background/55 p-3 text-sm text-muted-foreground">
        No urgent events right now.
      </div>
    );
  }

  return (
    <div className="grid gap-2 lg:grid-cols-5">
      {events.map((event) => {
        const content = (
          <div className="flex min-h-32 flex-col justify-between rounded-lg border border-border/70 bg-background/55 p-3 transition-colors hover:border-primary/30">
            <div>
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <Badge variant="outline" className={cn("capitalize", eventPriorityStyles[event.priority])}>
                  {event.priority}
                </Badge>
                <span className="text-xs capitalize text-muted-foreground">{event.category}</span>
              </div>
              <p className="line-clamp-2 text-sm font-semibold text-foreground">{event.title}</p>
              <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{event.detail}</p>
            </div>
            {event.to ? (
              <span className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-primary">
                {event.actionLabel || "Open"} <ArrowRight className="h-3 w-3" />
              </span>
            ) : null}
          </div>
        );

        return event.to ? (
          <AppLink key={event.id} to={event.to} className="block">
            {content}
          </AppLink>
        ) : (
          <div key={event.id}>{content}</div>
        );
      })}
    </div>
  );
}


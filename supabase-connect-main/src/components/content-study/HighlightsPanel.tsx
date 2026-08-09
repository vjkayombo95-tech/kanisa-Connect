import { Highlighter } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import type { ContentHighlight, HighlightColor } from "@/lib/content-study";
import { cn } from "@/lib/utils";

const dotClass: Record<HighlightColor, string> = {
  yellow: "bg-yellow-300",
  green: "bg-emerald-300",
  blue: "bg-sky-300",
  purple: "bg-violet-300",
  pink: "bg-rose-300",
  orange: "bg-orange-300",
};

export function HighlightsPanel({ highlights, onSelect }: { highlights: ContentHighlight[]; onSelect?: (segmentId: string | null) => void }) {
  return (
    <section className="rounded-lg border border-border/70 bg-card p-4" aria-label="Highlights">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold">Highlights</h2>
        <Badge variant="secondary">{highlights.length}</Badge>
      </div>
      <div className="mt-3 space-y-2">
        {highlights.slice(0, 6).map((highlight) => (
          <button
            key={highlight.id}
            type="button"
            onClick={() => onSelect?.(highlight.segmentId ?? null)}
            className="flex w-full items-start gap-2 rounded-md p-2 text-left text-sm outline-none transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-primary"
          >
            <span className={cn("mt-1 h-3 w-3 shrink-0 rounded-full", dotClass[highlight.color])} aria-hidden="true" />
            <span className="min-w-0">
              <span className="block truncate font-medium">{highlight.reference ?? "Highlighted content"}</span>
              {highlight.excerpt ? <span className="line-clamp-2 text-xs text-muted-foreground">{highlight.excerpt}</span> : null}
            </span>
          </button>
        ))}
        {!highlights.length ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Highlighter className="h-4 w-4" aria-hidden="true" />
            No highlights yet.
          </p>
        ) : null}
      </div>
    </section>
  );
}

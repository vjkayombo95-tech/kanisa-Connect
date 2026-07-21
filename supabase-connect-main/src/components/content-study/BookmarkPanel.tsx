import { Bookmark } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import type { ContentBookmark } from "@/lib/content-study";

export function BookmarkPanel({ bookmarks, onSelect }: { bookmarks: ContentBookmark[]; onSelect?: (segmentId: string | null) => void }) {
  return (
    <section className="rounded-lg border border-border/70 bg-card p-4" aria-label="Bookmarks">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold">Bookmarks</h2>
        <Badge variant="secondary">{bookmarks.length}</Badge>
      </div>
      <div className="mt-3 space-y-2">
        {bookmarks.slice(0, 6).map((bookmark) => (
          <button
            key={bookmark.id}
            type="button"
            onClick={() => onSelect?.(bookmark.segmentId ?? null)}
            className="flex w-full items-start gap-2 rounded-md p-2 text-left text-sm outline-none transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-primary"
          >
            <Bookmark className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
            <span className="min-w-0">
              <span className="block truncate font-medium">{bookmark.reference ?? bookmark.label ?? "Bookmarked content"}</span>
              {bookmark.excerpt ? <span className="line-clamp-2 text-xs text-muted-foreground">{bookmark.excerpt}</span> : null}
            </span>
          </button>
        ))}
        {!bookmarks.length ? <p className="text-sm text-muted-foreground">No bookmarks yet.</p> : null}
      </div>
    </section>
  );
}

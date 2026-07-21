import { Bookmark, Copy, FileText, Heart, Highlighter, MessageSquarePlus, MoreHorizontal, Play, Share2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { HIGHLIGHT_COLORS, type ContentStudySegmentState, type HighlightColor } from "@/lib/content-study";
import { cn } from "@/lib/utils";

const colorClass: Record<HighlightColor, string> = {
  yellow: "bg-yellow-300",
  green: "bg-emerald-300",
  blue: "bg-sky-300",
  purple: "bg-violet-300",
  pink: "bg-rose-300",
  orange: "bg-orange-300",
};

type VerseActionMenuProps = {
  reference: string;
  excerpt: string;
  state?: ContentStudySegmentState;
  onBookmark?: () => void;
  onHighlight?: (color: HighlightColor) => void;
  onClearHighlight?: () => void;
  onNote?: () => void;
  onFavorite?: () => void;
  onShare?: () => void;
  onCopy?: () => void;
  onPlayFromHere?: () => void;
};

export function VerseActionMenu({
  reference,
  excerpt,
  state,
  onBookmark,
  onHighlight,
  onClearHighlight,
  onNote,
  onFavorite,
  onShare,
  onCopy,
  onPlayFromHere,
}: VerseActionMenuProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8 rounded-lg"
          aria-label={`Open study actions for ${reference}`}
        >
          <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel>
          <span className="block truncate">{reference}</span>
          <span className="mt-1 line-clamp-2 text-xs font-normal text-muted-foreground">{excerpt}</span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={onBookmark} className="gap-2">
          <Bookmark className="h-4 w-4" aria-hidden="true" />
          {state?.bookmarked ? "Remove bookmark" : "Bookmark"}
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={onFavorite} className="gap-2">
          <Heart className={cn("h-4 w-4", state?.favorite && "fill-current text-rose-600")} aria-hidden="true" />
          {state?.favorite ? "Remove favorite" : "Favorite"}
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={onNote} className="gap-2">
          <MessageSquarePlus className="h-4 w-4" aria-hidden="true" />
          {state?.noteCount ? `Notes (${state.noteCount})` : "Add note"}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuLabel className="flex items-center gap-2 text-xs">
          <Highlighter className="h-3.5 w-3.5" aria-hidden="true" />
          Highlight
        </DropdownMenuLabel>
        <div className="grid grid-cols-6 gap-1 px-2 py-1" role="group" aria-label="Highlight colors">
          {HIGHLIGHT_COLORS.map((color) => (
            <button
              key={color}
              type="button"
              className={cn(
                "h-7 rounded-md border border-border outline-none transition-transform focus-visible:ring-2 focus-visible:ring-primary",
                colorClass[color],
                state?.highlightColor === color && "scale-90 ring-2 ring-foreground",
              )}
              aria-label={`Highlight ${reference} ${color}`}
              onClick={() => onHighlight?.(color)}
            />
          ))}
        </div>
        {state?.highlightColor ? (
          <DropdownMenuItem onSelect={onClearHighlight} className="gap-2">
            <Highlighter className="h-4 w-4" aria-hidden="true" />
            Clear highlight
          </DropdownMenuItem>
        ) : null}
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={onPlayFromHere} className="gap-2">
          <Play className="h-4 w-4" aria-hidden="true" />
          Play from here
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={onCopy} className="gap-2">
          <Copy className="h-4 w-4" aria-hidden="true" />
          Copy reference
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={onShare} className="gap-2">
          <Share2 className="h-4 w-4" aria-hidden="true" />
          Share
        </DropdownMenuItem>
        <DropdownMenuItem disabled className="gap-2 text-muted-foreground">
          <FileText className="h-4 w-4" aria-hidden="true" />
          Report issue
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

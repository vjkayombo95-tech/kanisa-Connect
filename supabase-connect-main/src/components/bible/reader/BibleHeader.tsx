import { Bookmark, ChevronLeft, ChevronRight, MoreHorizontal, Share2 } from "lucide-react";
import { Link } from "react-router-dom";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type { BibleTranslationRow } from "./types";

type BibleHeaderProps = {
  bookName: string;
  chapterNumber: number;
  translation: BibleTranslationRow | null;
  translations: BibleTranslationRow[];
  previousPath: string | null;
  nextPath: string | null;
  bookmarked: boolean;
  onTranslationChange: (translationId: string) => void;
  onShare: () => void;
  onBookmarkToggle: () => void;
};

export function BibleHeader({
  bookName,
  chapterNumber,
  translation,
  translations,
  previousPath,
  nextPath,
  bookmarked,
  onTranslationChange,
  onShare,
  onBookmarkToggle,
}: BibleHeaderProps) {
  return (
    <header className="sticky top-0 z-40 -mx-4 border-b border-border/70 bg-background/95 px-4 py-3 backdrop-blur supports-[backdrop-filter]:bg-background/80 sm:mx-0 sm:rounded-b-lg sm:border-x lg:top-4 lg:rounded-lg">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-3">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <Button asChild={!!previousPath} variant="ghost" size="icon" className="h-11 w-11 rounded-lg" disabled={!previousPath} aria-label="Previous chapter">
            {previousPath ? (
              <Link to={previousPath}>
                <ChevronLeft className="h-5 w-5" aria-hidden="true" />
              </Link>
            ) : (
              <span>
                <ChevronLeft className="h-5 w-5" aria-hidden="true" />
              </span>
            )}
          </Button>

          <div className="min-w-0">
            <p className="truncate text-xl font-semibold leading-tight text-foreground sm:text-2xl">{bookName}</p>
            <p className="text-sm font-medium text-muted-foreground">Chapter {chapterNumber}</p>
          </div>

          <Button asChild={!!nextPath} variant="ghost" size="icon" className="h-11 w-11 rounded-lg" disabled={!nextPath} aria-label="Next chapter">
            {nextPath ? (
              <Link to={nextPath}>
                <ChevronRight className="h-5 w-5" aria-hidden="true" />
              </Link>
            ) : (
              <span>
                <ChevronRight className="h-5 w-5" aria-hidden="true" />
              </span>
            )}
          </Button>
        </div>

        <div className="flex w-full items-center gap-2 sm:w-auto">
          <Select value={translation?.id ?? ""} onValueChange={onTranslationChange}>
            <SelectTrigger className="h-11 flex-1 rounded-lg sm:w-48" aria-label="Select Bible translation">
              <SelectValue placeholder="Translation" />
            </SelectTrigger>
            <SelectContent>
              {(translations.length ? translations : translation ? [translation] : []).map((item) => (
                <SelectItem key={item.id} value={item.id}>
                  {item.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button type="button" variant="outline" size="icon" className="h-11 w-11 rounded-lg" onClick={onShare} aria-label="Share chapter">
            <Share2 className="h-5 w-5" aria-hidden="true" />
          </Button>

          <Button
            type="button"
            variant="outline"
            size="icon"
            className={cn("h-11 w-11 rounded-lg", bookmarked && "border-primary text-primary")}
            onClick={onBookmarkToggle}
            aria-pressed={bookmarked}
            aria-label={bookmarked ? "Remove bookmark" : "Bookmark chapter"}
          >
            <Bookmark className={cn("h-5 w-5", bookmarked && "fill-current")} aria-hidden="true" />
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button type="button" variant="outline" size="icon" className="h-11 w-11 rounded-lg" aria-label="More Bible options">
                <MoreHorizontal className="h-5 w-5" aria-hidden="true" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              <DropdownMenuLabel>Reader</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={onShare}>Share this chapter</DropdownMenuItem>
              <DropdownMenuItem onSelect={onBookmarkToggle}>{bookmarked ? "Remove bookmark" : "Bookmark chapter"}</DropdownMenuItem>
              <DropdownMenuItem disabled>Study panel coming soon</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}

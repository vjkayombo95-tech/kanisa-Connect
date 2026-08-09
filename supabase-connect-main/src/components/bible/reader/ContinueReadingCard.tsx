import { BookOpen, Headphones } from "lucide-react";
import { Link } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";

type ContinueReadingCardProps = {
  bookName: string;
  chapterNumber: number;
  path: string;
  readingProgress: number;
  listeningProgress: number;
};

export function ContinueReadingCard({ bookName, chapterNumber, path, readingProgress, listeningProgress }: ContinueReadingCardProps) {
  return (
    <section className="rounded-lg border border-border/70 bg-card/95 p-4 shadow-sm" aria-label="Continue reading" data-testid="continue-reading-card">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-primary/20 bg-primary/10 text-primary">
            <BookOpen className="h-5 w-5" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-foreground">{bookName} {chapterNumber}</p>
            <p className="text-sm text-muted-foreground">Last opened chapter</p>
          </div>
        </div>

        <div className="grid min-w-0 flex-1 gap-3 sm:max-w-sm">
          <div className="grid gap-1">
            <div className="flex items-center justify-between gap-3 text-xs font-medium text-muted-foreground">
              <span>Reading</span>
              <span>{Math.round(readingProgress)}%</span>
            </div>
            <Progress value={readingProgress} aria-label="Reading progress" />
          </div>
          <div className="grid gap-1">
            <div className="flex items-center justify-between gap-3 text-xs font-medium text-muted-foreground">
              <span className="inline-flex items-center gap-1"><Headphones className="h-3.5 w-3.5" aria-hidden="true" /> Listening</span>
              <span>{Math.round(listeningProgress)}%</span>
            </div>
            <Progress value={listeningProgress} aria-label="Listening progress" />
          </div>
        </div>

        <Button asChild className="h-11 rounded-lg">
          <Link to={path}>Continue</Link>
        </Button>
      </div>
    </section>
  );
}

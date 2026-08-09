import { BookOpen, Palette } from "lucide-react";

import { AppLink } from "@/components/AppLink";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatLiturgicalDate } from "@/lib/liturgy";

type TodaysLiturgyCardProps = {
  todayDate: string;
  todayLiturgy: any | null;
  liturgyLoading: boolean;
  liturgyError: boolean;
  readingsPath?: string;
};

export function TodaysLiturgyCard({
  todayDate,
  todayLiturgy,
  liturgyLoading,
  liturgyError,
  readingsPath = "/portal/daily-readings",
}: TodaysLiturgyCardProps) {
  return (
    <Card className="rounded-[28px] border-border/70 bg-card/85 shadow-sm">
      <CardContent className="space-y-4 p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="flex items-center gap-2 text-sm font-medium text-primary">
              <BookOpen className="h-4 w-4" />
              Today's Liturgy
            </p>
            <p className="mt-1 text-sm text-muted-foreground">{formatLiturgicalDate(todayDate)}</p>
          </div>
          <Button asChild variant="outline" className="h-11 rounded-2xl">
            <AppLink to={readingsPath}>Read Today's Readings</AppLink>
          </Button>
        </div>

        {liturgyLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-7 w-2/3 rounded-md" />
            <Skeleton className="h-16 rounded-2xl" />
          </div>
        ) : null}

        {liturgyError ? (
          <div className="rounded-2xl border border-destructive/20 bg-destructive/5 p-4">
            <p className="text-sm font-semibold text-destructive">Unable to load today's liturgy.</p>
            <p className="mt-1 text-xs text-muted-foreground">Open Daily Readings to try again.</p>
          </div>
        ) : null}

        {!liturgyLoading && !liturgyError && !todayLiturgy ? (
          <div className="rounded-2xl border border-border/60 bg-background/50 p-4">
            <p className="text-sm font-semibold text-foreground">No liturgy available for today.</p>
            <p className="mt-1 text-xs text-muted-foreground">Today's readings have not been published yet.</p>
          </div>
        ) : null}

        {!liturgyLoading && !liturgyError && todayLiturgy ? (
          <div className="space-y-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Celebration</p>
              <h2 className="mt-1 text-2xl font-bold text-foreground">{todayLiturgy.celebration}</h2>
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge variant="secondary" className="rounded-full">
                {todayLiturgy.season}
              </Badge>
              <Badge variant="outline" className="rounded-full">
                <Palette className="mr-1 h-3.5 w-3.5" />
                {todayLiturgy.liturgical_color}
              </Badge>
              {todayLiturgy.rank ? (
                <Badge variant="outline" className="rounded-full">
                  {todayLiturgy.rank.replace(/_/g, " ")}
                </Badge>
              ) : null}
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

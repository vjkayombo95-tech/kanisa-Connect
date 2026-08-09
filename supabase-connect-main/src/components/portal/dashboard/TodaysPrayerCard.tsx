import { HeartHandshake } from "lucide-react";

import { AppLink } from "@/components/AppLink";
import { ScriptureText } from "@/components/bible";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

import { truncatePreview } from "./utils";

type TodaysPrayerCardProps = {
  todayPrayer: any | null;
  prayerLoading: boolean;
  prayerError: boolean;
  prayerPath?: (prayerId: string) => string;
};

export function TodaysPrayerCard({
  todayPrayer,
  prayerLoading,
  prayerError,
  prayerPath = (prayerId) => `/portal/prayers/${prayerId}`,
}: TodaysPrayerCardProps) {
  return (
    <Card className="rounded-[28px] border-border/70 bg-card/85 shadow-sm">
      <CardContent className="space-y-4 p-5">
        <p className="flex items-center gap-2 text-sm font-medium text-primary">
          <HeartHandshake className="h-4 w-4" />
          Today's Prayer
        </p>

        {prayerLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-6 w-2/3 rounded-md" />
            <Skeleton className="h-16 rounded-2xl" />
          </div>
        ) : null}

        {prayerError ? (
          <div className="rounded-2xl border border-destructive/20 bg-destructive/5 p-4">
            <p className="text-sm font-semibold text-destructive">Unable to load today's prayer.</p>
          </div>
        ) : null}

        {!prayerLoading && !prayerError && !todayPrayer ? (
          <div className="rounded-2xl border border-border/60 bg-background/50 p-4">
            <p className="text-sm font-semibold text-foreground">No prayer available.</p>
          </div>
        ) : null}

        {!prayerLoading && !prayerError && todayPrayer ? (
          <>
            <div>
              <h2 className="text-xl font-bold text-foreground">{todayPrayer.title}</h2>
              <p className="mt-2 line-clamp-3 text-sm leading-6 text-muted-foreground">
                <ScriptureText text={truncatePreview(todayPrayer.text, 180)} />
              </p>
            </div>
            <Button asChild variant="outline" className="h-11 rounded-2xl">
              <AppLink to={prayerPath(todayPrayer.id)}>Continue Reading</AppLink>
            </Button>
          </>
        ) : null}
      </CardContent>
    </Card>
  );
}

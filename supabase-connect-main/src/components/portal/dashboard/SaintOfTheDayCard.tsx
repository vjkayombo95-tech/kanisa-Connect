import { Sparkles } from "lucide-react";

import { AppLink } from "@/components/AppLink";
import { ScriptureText } from "@/components/bible";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

type SaintOfTheDayCardProps = {
  saintOfDay: any | null;
  saintFeastTitle: string;
  saintLoading: boolean;
  saintError: boolean;
  saintPath?: (saintId: string) => string;
};

function formatFeastDay(month: number | null | undefined, day: number | null | undefined) {
  if (!month || !day) return null;

  return new Intl.DateTimeFormat("en-TZ", {
    month: "long",
    day: "numeric",
  }).format(new Date(2026, month - 1, day));
}

export function SaintOfTheDayCard({
  saintOfDay,
  saintFeastTitle,
  saintLoading,
  saintError,
  saintPath = (saintId) => `/portal/saints/${saintId}`,
}: SaintOfTheDayCardProps) {
  return (
    <Card className="overflow-hidden rounded-[28px] border-primary/20 bg-card/85 shadow-sm">
      <CardContent className="p-0">
        {saintLoading ? (
          <div className="p-5">
            <Skeleton className="h-36 rounded-3xl" />
          </div>
        ) : saintError ? (
          <div className="flex items-start gap-4 p-5">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-destructive/10 text-destructive">
              <Sparkles className="h-6 w-6" />
            </div>
            <div>
              <p className="flex items-center gap-2 text-sm font-medium text-destructive">
                <Sparkles className="h-4 w-4" aria-hidden="true" />
                Saint of the Day
              </p>
              <p className="mt-2 text-sm text-muted-foreground">Unable to load today's saint.</p>
            </div>
          </div>
        ) : saintOfDay ? (
          <div className="grid gap-0 md:grid-cols-[220px_1fr]">
            {saintOfDay.image_url ? (
              <img
                src={saintOfDay.image_url}
                alt={saintOfDay.name}
                loading="lazy"
                decoding="async"
                sizes="(min-width: 768px) 220px, 100vw"
                className="h-56 w-full object-cover md:h-full"
              />
            ) : (
              <div className="flex h-56 w-full items-center justify-center bg-primary/10 text-primary md:h-full">
                <Sparkles className="h-12 w-12" />
              </div>
            )}
            <div className="space-y-4 p-5">
              <div>
                <p className="flex items-center gap-2 text-sm font-medium text-primary">
                  <Sparkles className="h-4 w-4" aria-hidden="true" />
                  Saint of the Day
                </p>
                <h2 className="mt-1 text-2xl font-bold text-foreground">{saintOfDay.name}</h2>
                <p className="mt-1 text-sm font-medium text-muted-foreground">
                  Feast: {formatFeastDay(saintOfDay.feast_month, saintOfDay.feast_day) ?? saintFeastTitle}
                </p>
              </div>
              <p className="line-clamp-3 text-sm leading-6 text-muted-foreground">
                <ScriptureText text={saintOfDay.biography_short} />
              </p>
              <Button asChild variant="outline" className="h-11 rounded-2xl">
                <AppLink to={saintPath(saintOfDay.id)}>Read More</AppLink>
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex items-start gap-4 p-5">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <Sparkles className="h-6 w-6" />
            </div>
            <div>
              <p className="flex items-center gap-2 text-sm font-medium text-primary">
                <Sparkles className="h-4 w-4" aria-hidden="true" />
                Saint of the Day
              </p>
              <p className="mt-2 text-sm text-muted-foreground">No saint is linked to today's liturgy yet.</p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

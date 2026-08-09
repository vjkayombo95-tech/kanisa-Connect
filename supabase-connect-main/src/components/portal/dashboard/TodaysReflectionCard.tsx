import { MessageCircle } from "lucide-react";

import { AppLink } from "@/components/AppLink";
import { ScriptureText } from "@/components/bible";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

import { truncatePreview } from "./utils";

type TodaysReflectionCardProps = {
  todayReflection: any | null;
  reflectionLoading: boolean;
  reflectionError: boolean;
  reflectionPath?: (reflectionId: string) => string;
};

export function TodaysReflectionCard({
  todayReflection,
  reflectionLoading,
  reflectionError,
  reflectionPath = (reflectionId) => `/portal/reflections/${reflectionId}`,
}: TodaysReflectionCardProps) {
  return (
    <Card className="rounded-[28px] border-border/70 bg-card/85 shadow-sm">
      <CardContent className="space-y-4 p-5">
        <p className="flex items-center gap-2 text-sm font-medium text-primary">
          <MessageCircle className="h-4 w-4" />
          Today's Reflection
        </p>

        {reflectionLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-6 w-2/3 rounded-md" />
            <Skeleton className="h-16 rounded-2xl" />
          </div>
        ) : null}

        {reflectionError ? (
          <div className="rounded-2xl border border-destructive/20 bg-destructive/5 p-4">
            <p className="text-sm font-semibold text-destructive">Unable to load today's reflection.</p>
          </div>
        ) : null}

        {!reflectionLoading && !reflectionError && !todayReflection ? (
          <div className="rounded-2xl border border-border/60 bg-background/50 p-4">
            <p className="text-sm font-semibold text-foreground">No reflection available.</p>
          </div>
        ) : null}

        {!reflectionLoading && !reflectionError && todayReflection ? (
          <>
            <div>
              <h2 className="text-xl font-bold text-foreground">{todayReflection.title}</h2>
              <p className="mt-2 line-clamp-3 text-sm leading-6 text-muted-foreground">
                <ScriptureText text={truncatePreview(todayReflection.text, 200)} />
              </p>
            </div>
            <Button asChild variant="outline" className="h-11 rounded-2xl">
              <AppLink to={reflectionPath(todayReflection.id)}>Continue Reading</AppLink>
            </Button>
          </>
        ) : null}
      </CardContent>
    </Card>
  );
}

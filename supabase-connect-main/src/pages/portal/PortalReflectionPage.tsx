import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, MessageCircle } from "lucide-react";
import { Link, useParams } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ScriptureText } from "@/components/bible";
import { dailyCatholicQueryOptions } from "@/lib/portal-performance";
import { fetchReflectionById, fetchTodayReflection, getTodayReflectionQueryKey } from "@/lib/reflections";

export default function PortalReflectionPage() {
  const { reflectionId } = useParams();

  const {
    data: reflection,
    isLoading,
    isError,
    error,
  } = useQuery({
    queryKey: reflectionId ? ["portal-reflection", reflectionId] : getTodayReflectionQueryKey(),
    queryFn: async () => {
      return reflectionId ? fetchReflectionById(reflectionId) : fetchTodayReflection();
    },
    ...dailyCatholicQueryOptions,
  });

  return (
    <main className="min-h-full bg-[linear-gradient(180deg,hsl(var(--background)),hsl(var(--muted)/0.35))] px-4 py-6 pb-28 lg:px-8 lg:pb-10">
      <div className="mx-auto max-w-3xl space-y-5">
        <Button asChild variant="ghost" className="hidden rounded-xl lg:inline-flex">
          <Link to="/portal">
            <ArrowLeft className="mr-2 h-4 w-4" aria-hidden="true" />
            Back
          </Link>
        </Button>

        {isLoading ? (
          <Card className="rounded-2xl border-border/70 bg-card/95 shadow-sm">
            <CardContent className="space-y-4 p-6">
              <Skeleton className="h-8 w-2/3 rounded-md" />
              <Skeleton className="h-48 rounded-2xl" />
            </CardContent>
          </Card>
        ) : null}

        {isError ? (
          <Card className="rounded-2xl border-destructive/25 bg-destructive/5">
            <CardContent className="p-6 text-sm text-destructive">
              Unable to load this reflection: {error instanceof Error ? error.message : "Please try again."}
            </CardContent>
          </Card>
        ) : null}

        {!isLoading && !isError && !reflection ? (
          <Card className="rounded-2xl border-border/70 bg-card/95 shadow-sm">
            <CardContent className="flex flex-col items-center justify-center px-6 py-16 text-center">
              <MessageCircle className="h-12 w-12 text-muted-foreground" aria-hidden="true" />
              <h1 className="mt-4 text-lg font-semibold">Reflection not found.</h1>
              <p className="mt-2 max-w-sm text-sm text-muted-foreground">The reflection may have been unpublished or moved. Return to your dashboard for today&apos;s reflection.</p>
            </CardContent>
          </Card>
        ) : null}

        {!isLoading && !isError && reflection ? (
          <Card className="rounded-2xl border-border/70 bg-card/95 shadow-sm">
            <CardContent className="space-y-5 p-6 sm:p-8">
              <p className="flex items-center gap-2 text-sm font-medium text-primary">
                <MessageCircle className="h-4 w-4" aria-hidden="true" />
                Today's Reflection
              </p>
              <h1 className="text-3xl font-bold tracking-tight text-foreground">{reflection.title}</h1>
              <p className="whitespace-pre-wrap text-base leading-8 text-muted-foreground">
                <ScriptureText text={reflection.text} />
              </p>
            </CardContent>
          </Card>
        ) : null}
      </div>
    </main>
  );
}

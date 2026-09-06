import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, ScrollText } from "lucide-react";
import { Link, useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { fetchPublishedPrayer } from "@/lib/content-display";

export default function PrayerDetailPage() {
  const { slug } = useParams();
  const { data, isLoading, isError } = useQuery({
    queryKey: ["published-prayer", slug],
    queryFn: () => fetchPublishedPrayer(slug!),
    enabled: !!slug,
  });

  if (isLoading) {
    return (
      <main className="min-h-full px-4 py-6 pb-28 lg:px-8" data-sala-loading>
        <article className="mx-auto max-w-3xl space-y-4">
          <Skeleton className="h-11 w-24 rounded-2xl" />
          <Card className="min-w-0 rounded-3xl">
            <CardContent className="space-y-5 p-6 sm:p-10">
              <Skeleton className="h-9 w-4/5 rounded-xl" />
              <Skeleton className="h-5 w-2/3 rounded-xl" />
              <div className="space-y-3 pt-4">
                <Skeleton className="h-4 w-full rounded-xl" />
                <Skeleton className="h-4 w-full rounded-xl" />
                <Skeleton className="h-4 w-11/12 rounded-xl" />
                <Skeleton className="h-4 w-3/4 rounded-xl" />
              </div>
            </CardContent>
          </Card>
        </article>
      </main>
    );
  }

  if (isError || !data) {
    return (
      <main className="min-h-full px-4 py-8 pb-28 lg:px-8">
        <Card className="mx-auto max-w-3xl min-w-0 rounded-3xl">
          <CardContent className="flex flex-col items-center px-5 py-12 text-center">
            <ScrollText className="h-10 w-10 text-muted-foreground" />
            <h1 className="mt-4 break-words text-xl font-bold">Sala haijapatikana.</h1>
            <p className="mt-2 max-w-md break-words text-sm leading-6 text-muted-foreground">
              Huenda sala hii haijachapishwa au haipatikani tena.
            </p>
            <Button asChild className="mt-5 min-h-11 rounded-2xl">
              <Link to="/portal/prayers">Rudi kwenye sala</Link>
            </Button>
          </CardContent>
        </Card>
      </main>
    );
  }

  return (
    <main className="min-h-full px-4 py-5 pb-28 lg:px-8">
      <article className="mx-auto max-w-3xl min-w-0">
        <Button asChild variant="ghost" className="min-h-11 rounded-2xl">
          <Link to="/portal/prayers">
            <ArrowLeft className="mr-2 h-4 w-4 shrink-0" />
            Rudi
          </Link>
        </Button>
        <Card className="mt-3 min-w-0 rounded-3xl">
          <CardContent className="min-w-0 p-6 sm:p-10">
            <h1 className="break-words text-3xl font-bold leading-tight sm:text-4xl">{data.title}</h1>
            {data.summary ? (
              <p className="mt-3 break-words text-base leading-7 text-muted-foreground sm:text-lg">
                {data.summary}
              </p>
            ) : null}
            <div className="my-7 h-px bg-border" />
            <p className="whitespace-pre-wrap break-words text-base leading-8 text-foreground/90">{data.body}</p>
          </CardContent>
        </Card>
      </article>
    </main>
  );
}

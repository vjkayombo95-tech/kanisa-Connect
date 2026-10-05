import { useQuery } from "@tanstack/react-query";
import { ArrowRight, ScrollText } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { fetchPublishedPrayers } from "@/lib/content-display";

export default function PrayersPage() {
  const { t } = useTranslation();
  const { data = [], isLoading, isError, refetch } = useQuery({
    queryKey: ["published-prayers"],
    queryFn: fetchPublishedPrayers,
    staleTime: 10 * 60 * 1000,
  });

  return (
    <main className="min-h-full px-4 py-5 pb-28 lg:px-8">
      <div className="mx-auto max-w-4xl space-y-5">
        <header className="min-w-0 rounded-3xl border border-primary/15 bg-primary/5 p-5 sm:p-7">
          <p className="text-sm font-bold text-primary">Kanisa Connect</p>
          <h1 className="mt-2 break-words text-3xl font-bold sm:text-4xl">{t("member_prayers.title")}</h1>
          <p className="mt-2 max-w-2xl break-words text-sm leading-6 text-muted-foreground sm:text-base">
            {t("member_prayers.subtitle")}
          </p>
        </header>

        {isLoading ? (
          <section className="grid gap-4 sm:grid-cols-2" data-sala-loading aria-label={t("member_prayers.loading")}>
            {[0, 1].map((item) => (
              <Card key={item} className="min-w-0 rounded-3xl">
                <CardContent className="space-y-4 p-5">
                  <Skeleton className="h-5 w-24 rounded-full" />
                  <Skeleton className="h-7 w-4/5 rounded-xl" />
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-full rounded-xl" />
                    <Skeleton className="h-4 w-11/12 rounded-xl" />
                    <Skeleton className="h-4 w-2/3 rounded-xl" />
                  </div>
                  <Skeleton className="h-11 w-full rounded-2xl" />
                </CardContent>
              </Card>
            ))}
          </section>
        ) : isError ? (
          <Card className="min-w-0 rounded-3xl">
            <CardContent className="space-y-4 p-5">
              <p className="break-words text-sm leading-6 text-muted-foreground">
                {t("member_prayers.error")}
              </p>
              <Button type="button" variant="outline" className="min-h-11 rounded-2xl" onClick={() => refetch()}>
                {t("shared.actions.retry")}
              </Button>
            </CardContent>
          </Card>
        ) : data.length === 0 ? (
          <Card className="min-w-0 rounded-3xl">
            <CardContent className="flex flex-col items-center px-5 py-12 text-center">
              <ScrollText className="h-10 w-10 text-muted-foreground" />
              <p className="mt-4 break-words font-semibold">{t("member_prayers.empty")}</p>
            </CardContent>
          </Card>
        ) : (
          <section className="grid grid-cols-1 gap-4 sm:grid-cols-2" aria-label={t("member_prayers.list_aria")}>
            {data.map((prayer) => (
              <Card key={prayer.id} className="min-w-0 rounded-3xl">
                <CardContent className="flex h-full min-w-0 flex-col p-5">
                  {prayer.featured ? <Badge className="w-fit">{t("member_prayers.featured")}</Badge> : null}
                  <h2 className="mt-3 break-words text-xl font-bold leading-7">{prayer.title}</h2>
                  <p className="mt-2 line-clamp-4 break-words text-sm leading-6 text-muted-foreground">
                    {prayer.summary || prayer.body}
                  </p>
                  <Button asChild variant="outline" className="mt-5 min-h-11 w-full rounded-2xl">
                    <Link className="inline-flex min-w-0 items-center justify-center" to={`/portal/prayers/${prayer.slug}`}>
                      <span className="min-w-0 truncate">{t("member_prayers.actions.read")}</span>
                      <ArrowRight className="ml-2 h-4 w-4 shrink-0" />
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            ))}
          </section>
        )}
      </div>
    </main>
  );
}

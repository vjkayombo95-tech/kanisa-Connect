import { useQuery } from "@tanstack/react-query";
import { ArrowRight, BookOpen, Sparkles } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { fetchPublishedReflections } from "@/lib/content-display";
import { formatAppDate } from "@/lib/localization";

function formatReflectionDate(value: string, language: string) {
  return formatAppDate(value, language, { dateStyle: "long" });
}

export default function ReflectionsPage() {
  const { t, i18n } = useTranslation();
  const { data = [], isLoading, isError, refetch } = useQuery({
    queryKey: ["published-reflections"],
    queryFn: fetchPublishedReflections,
    staleTime: 10 * 60 * 1000,
  });

  return (
    <main className="min-h-full px-4 py-6 pb-28 lg:px-8 lg:pb-10">
      <div className="mx-auto max-w-5xl space-y-6">
        <header className="rounded-[32px] border border-primary/15 bg-primary/5 p-6 sm:p-8">
          <p className="flex items-center gap-2 text-sm font-bold text-primary">
            <Sparkles className="h-4 w-4" aria-hidden="true" />
            Kanisa Connect
          </p>
          <h1 className="mt-2 text-4xl font-bold tracking-tight">{t("member_reflections.title")}</h1>
          <p className="mt-2 text-muted-foreground">{t("member_reflections.subtitle")}</p>
        </header>

        {isLoading ? (
          <div className="space-y-3" aria-label={t("member_reflections.loading")}>
            <Skeleton className="h-40 rounded-3xl" />
            <Skeleton className="h-40 rounded-3xl" />
          </div>
        ) : isError ? (
          <Card>
            <CardContent className="space-y-4 p-6">
              <p>{t("member_reflections.error")}</p>
              <Button type="button" variant="outline" className="min-h-11 rounded-2xl" onClick={() => refetch()}>
                {t("shared.actions.retry")}
              </Button>
            </CardContent>
          </Card>
        ) : data.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center py-14 text-center">
              <BookOpen className="h-10 w-10 text-muted-foreground" />
              <p className="mt-4 font-semibold">{t("member_reflections.empty")}</p>
            </CardContent>
          </Card>
        ) : (
          <section className="grid gap-4 sm:grid-cols-2" aria-label={t("member_reflections.list_aria")}>
            {data.map((item) => {
              const date = formatReflectionDate(item.reading_date, i18n.language);
              return (
                <Card key={item.id} className="rounded-3xl">
                  <CardContent className="p-5">
                    <div className="flex flex-wrap gap-2">
                      <Badge variant="outline">{date}</Badge>
                      {item.liturgical_season ? <Badge>{item.liturgical_season}</Badge> : null}
                    </div>
                    <h2 className="mt-4 text-xl font-bold">{t("member_reflections.card_title", { date })}</h2>
                    <p className="mt-2 line-clamp-4 text-sm leading-6 text-muted-foreground">{item.reflection}</p>
                    <Button asChild variant="outline" className="mt-5 min-h-11 w-full rounded-2xl">
                      <Link to={`/portal/reflections/${item.id}`}>
                        {t("member_reflections.actions.read")}
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </Link>
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </section>
        )}
      </div>
    </main>
  );
}

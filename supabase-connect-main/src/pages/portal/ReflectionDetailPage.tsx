import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, BookOpen } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Link, useParams } from "react-router-dom";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { fetchPublishedReflection } from "@/lib/content-display";
import { formatAppDate } from "@/lib/localization";

function formatReflectionDate(value: string, language: string) {
  return formatAppDate(value, language, { dateStyle: "long" });
}

export default function ReflectionDetailPage() {
  const { t, i18n } = useTranslation();
  const { reflectionId } = useParams();
  const { data, isLoading, isError } = useQuery({
    queryKey: ["published-reflection", reflectionId],
    queryFn: () => fetchPublishedReflection(reflectionId!),
    enabled: !!reflectionId,
  });

  if (isLoading) {
    return (
      <main className="mx-auto max-w-4xl px-4 py-8" aria-label={t("member_reflections.loading_detail")}>
        <Skeleton className="h-96 rounded-3xl" />
      </main>
    );
  }

  if (isError || !data) {
    return (
      <main className="px-4 py-10">
        <Card className="mx-auto max-w-3xl">
          <CardContent className="flex flex-col items-center py-14 text-center">
            <BookOpen className="h-10 w-10 text-muted-foreground" />
            <h1 className="mt-4 text-xl font-bold">{t("member_reflections.not_found.title")}</h1>
            <p className="mt-2 max-w-md text-sm leading-6 text-muted-foreground">{t("member_reflections.not_found.description")}</p>
            <Button asChild className="mt-5 min-h-11">
              <Link to="/portal/reflections">{t("member_reflections.actions.back_to_reflections")}</Link>
            </Button>
          </CardContent>
        </Card>
      </main>
    );
  }

  const date = formatReflectionDate(data.reading_date, i18n.language);

  return (
    <main className="min-h-full px-4 py-6 pb-28 lg:px-8">
      <article className="mx-auto max-w-4xl">
        <Button asChild variant="ghost" className="min-h-11">
          <Link to="/portal/reflections">
            <ArrowLeft className="mr-2 h-4 w-4" />
            {t("member_reflections.actions.back")}
          </Link>
        </Button>
        <Card className="mt-3 rounded-[32px]">
          <CardContent className="p-6 sm:p-10">
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline">{date}</Badge>
              {data.liturgical_season ? <Badge>{data.liturgical_season}</Badge> : null}
            </div>
            <h1 className="mt-5 text-3xl font-bold sm:text-4xl">{t("member_reflections.card_title", { date })}</h1>
            {data.gospel ? (
              <section className="mt-6 rounded-2xl bg-muted/60 p-5">
                <h2 className="font-bold">{t("member_reflections.sections.gospel")}</h2>
                <p className="mt-2 whitespace-pre-wrap text-sm leading-7 text-muted-foreground">{data.gospel}</p>
              </section>
            ) : null}
            <section className="mt-7">
              <h2 className="text-xl font-bold">{t("member_reflections.sections.reflection")}</h2>
              <p className="mt-3 whitespace-pre-wrap text-base leading-8 text-foreground/85">{data.reflection}</p>
            </section>
          </CardContent>
        </Card>
      </article>
    </main>
  );
}

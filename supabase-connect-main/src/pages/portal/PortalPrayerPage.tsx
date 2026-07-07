import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Copy, Heart, HeartHandshake, Printer, Share2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Link, useParams } from "react-router-dom";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ScriptureText } from "@/components/bible";
import { useToast } from "@/hooks/use-toast";
import { fetchMemberCmsPrayerByIdOrSlug } from "@/lib/catholic-cms";
import { getLiturgicalDisplayKey } from "@/lib/liturgical-display";
import { dailyCatholicQueryOptions } from "@/lib/portal-performance";
import { fetchPrayerById } from "@/lib/prayers";
import { getPrayerLibraryRoot } from "@/lib/prayer-routing";
import { useWorkspacePage } from "@/components/workspace";

export default function PortalPrayerPage() {
  const { prayerId } = useParams();
  const page = useWorkspacePage();
  const { toast } = useToast();
  const { t, i18n } = useTranslation();
  const libraryPath = getPrayerLibraryRoot(page.workspaceId);
  const identifier = prayerId?.trim() ?? "";

  const {
    data,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ["portal-prayer", identifier],
    queryFn: async () => {
      if (!identifier) return null;
      const cmsPrayer = await fetchMemberCmsPrayerByIdOrSlug(identifier);
      if (cmsPrayer) return { kind: "cms" as const, prayer: cmsPrayer };
      const fallback = await fetchPrayerById(identifier);
      return fallback ? { kind: "legacy" as const, prayer: fallback } : null;
    },
    enabled: !!identifier,
    ...dailyCatholicQueryOptions,
  });

  const title = data?.prayer.title ?? "";
  const body = data?.kind === "cms" ? data.prayer.body : data?.prayer.text ?? "";
  const activeLanguage = i18n.language === "sw" ? "sw" : "en";
  const prayerLanguageCode = data?.kind === "cms" ? data.prayer.language?.code : null;
  const prayerLanguageLabel = prayerLanguageCode === "sw"
    ? t("member_portal.content_language.swahili_content")
    : prayerLanguageCode === "en"
      ? t("member_portal.content_language.english_fallback")
      : null;
  const liturgicalSeasonKey = data?.kind === "cms" ? getLiturgicalDisplayKey(data.prayer.liturgical_season) : null;

  const copyPrayer = async () => {
    await navigator.clipboard.writeText(`${title}\n\n${body}`);
    toast({
      title: t("member_portal.prayer_detail.copied_title"),
      description: t("member_portal.prayer_detail.copied_description"),
    });
  };

  const sharePrayer = async () => {
    if (navigator.share) {
      await navigator.share({ title, text: body });
      return;
    }
    await copyPrayer();
  };

  return (
    <main className="min-h-full bg-[linear-gradient(180deg,hsl(var(--background)),hsl(var(--muted)/0.35))] px-4 py-6 pb-28 lg:px-8 lg:pb-10">
      <div className="mx-auto max-w-4xl space-y-5">
        <Button asChild variant="ghost" className="rounded-xl">
          <Link to={libraryPath}>
            <ArrowLeft className="mr-2 h-4 w-4" aria-hidden="true" />
            {t("member_portal.common.back_to_library")}
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
            <CardContent className="space-y-4 p-6">
              <div>
                <h1 className="text-lg font-semibold text-destructive">{t("member_portal.prayer_detail.error_title")}</h1>
                <p className="mt-2 text-sm text-destructive/90">{t("member_portal.prayer_detail.error_description")}</p>
              </div>
              <Button asChild variant="outline" className="rounded-xl">
                <Link to={libraryPath}>{t("member_portal.prayer_detail.browse")}</Link>
              </Button>
            </CardContent>
          </Card>
        ) : null}

        {!isLoading && !isError && !data ? (
          <Card className="rounded-2xl border-border/70 bg-card/95 shadow-sm">
            <CardContent className="flex flex-col items-center justify-center px-6 py-16 text-center">
              <HeartHandshake className="h-12 w-12 text-muted-foreground" aria-hidden="true" />
              <h1 className="mt-4 text-lg font-semibold">{t("member_portal.prayer_detail.not_found_title")}</h1>
              <p className="mt-2 max-w-sm text-sm text-muted-foreground">{t("member_portal.prayer_detail.not_found_description")}</p>
              <Button asChild className="mt-4 rounded-xl"><Link to={libraryPath}>{t("member_portal.prayer_detail.browse")}</Link></Button>
            </CardContent>
          </Card>
        ) : null}

        {!isLoading && !isError && data ? (
          <Card className="rounded-2xl border-border/70 bg-card/95 shadow-sm">
            <CardContent className="space-y-6 p-6 sm:p-8">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <p className="flex items-center gap-2 text-sm font-medium text-primary">
                    <HeartHandshake className="h-4 w-4" aria-hidden="true" />
                    {t("member_portal.prayer_detail.library")}
                  </p>
                  <h1 className="mt-3 text-3xl font-bold tracking-tight text-foreground">{title}</h1>
                  {data.kind === "cms" && data.prayer.summary ? <p className="mt-3 text-base text-muted-foreground">{data.prayer.summary}</p> : null}
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button type="button" variant="outline" className="rounded-xl" onClick={sharePrayer}><Share2 className="mr-2 h-4 w-4" />{t("member_portal.common.share")}</Button>
                  <Button type="button" variant="outline" className="rounded-xl" onClick={copyPrayer}><Copy className="mr-2 h-4 w-4" />{t("member_portal.common.copy")}</Button>
                  <Button type="button" variant="outline" className="rounded-xl" onClick={() => window.print()}><Printer className="mr-2 h-4 w-4" />{t("member_portal.common.print")}</Button>
                </div>
              </div>

              {data.kind === "cms" ? (
                <div className="flex flex-wrap gap-2">
                  {data.prayer.category ? <Badge variant="outline" className="rounded-full">{t("member_portal.prayer_detail.category")}: {data.prayer.category.name}</Badge> : null}
                  {data.prayer.language ? <Badge variant="outline" className="rounded-full">{t("member_portal.prayer_detail.language")}: {data.prayer.language.name}</Badge> : null}
                  {prayerLanguageLabel && prayerLanguageCode !== activeLanguage ? <Badge variant="secondary" className="rounded-full">{prayerLanguageLabel}</Badge> : null}
                  {data.prayer.liturgical_season ? <Badge variant="outline" className="rounded-full">{liturgicalSeasonKey ? t(liturgicalSeasonKey) : data.prayer.liturgical_season}</Badge> : null}
                  {data.prayer.scripture_reference ? <Badge variant="outline" className="rounded-full">{data.prayer.scripture_reference}</Badge> : null}
                  {(data.prayer.tags ?? []).map((tag) => <Badge key={tag.id} variant="outline" className="rounded-full">{t("member_portal.prayer_detail.tag")}: {tag.name}</Badge>)}
                </div>
              ) : null}

              <div className="rounded-2xl border border-border/70 bg-background/45 p-5">
                <p className="whitespace-pre-wrap text-base leading-8 text-muted-foreground">
                  <ScriptureText text={body} />
                </p>
              </div>

              {data.kind === "cms" ? (
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="rounded-2xl border border-border/70 p-4">
                    <h2 className="font-semibold">{t("member_portal.prayer_detail.source")}</h2>
                    <p className="mt-2 text-sm text-muted-foreground">{[data.prayer.author, data.prayer.source].filter(Boolean).join(" - ") || t("member_portal.prayer_detail.source_missing")}</p>
                  </div>
                  <div className="rounded-2xl border border-border/70 p-4">
                    <h2 className="font-semibold">{t("member_portal.prayer_detail.collections")}</h2>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {(data.prayer.collections ?? []).length ? data.prayer.collections?.map((collection) => <Badge key={collection.id} variant="outline">{collection.title}</Badge>) : <span className="text-sm text-muted-foreground">{t("member_portal.prayer_detail.no_collection")}</span>}
                    </div>
                  </div>
                  <div className="rounded-2xl border border-dashed border-border/70 p-4 md:col-span-2">
                    <h2 className="flex items-center gap-2 font-semibold"><Heart className="h-4 w-4 text-primary" />{t("member_portal.prayer_detail.favorites")}</h2>
                    <p className="mt-2 text-sm text-muted-foreground">{t("member_portal.prayer_detail.favorites_future")}</p>
                  </div>
                </div>
              ) : null}
            </CardContent>
          </Card>
        ) : null}
      </div>
    </main>
  );
}

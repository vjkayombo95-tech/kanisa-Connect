import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, BookOpen, Copy, MapPin, Sparkles } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Link, useParams } from "react-router-dom";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ScriptureLink, ScriptureText } from "@/components/bible";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspacePage } from "@/components/workspace/useWorkspacePage";
import {
  SAINT_SELECT,
  formatFeastDay,
  getSaintImageAlt,
  normalizeTags,
  type LibrarySaint,
} from "@/lib/catholic-library";
import { normalizeAppLanguage, type AppLanguage } from "@/lib/localization";
import { dailyCatholicQueryOptions } from "@/lib/portal-performance";

function DetailSkeleton() {
  return (
    <div className="mx-auto max-w-6xl space-y-5 px-4 py-6 lg:px-8">
      <Skeleton className="h-80 rounded-2xl" />
      <div className="grid gap-5 lg:grid-cols-[1fr_340px]">
        <Skeleton className="h-96 rounded-2xl" />
        <Skeleton className="h-96 rounded-2xl" />
      </div>
    </div>
  );
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function getSaintsRoot(workspaceId: string) {
  if (workspaceId === "pastoral") return "/pastoral/saints";
  if (workspaceId === "church_admin") return "/church-admin/saints";
  if (workspaceId === "finance") return "/finance/saints";
  if (workspaceId === "super_admin") return "/super-admin/catholic-content/saints";
  return "/portal/library";
}

export default function MemberSaintDetailsPage() {
  const { slug, saintId } = useParams();
  const { toast } = useToast();
  const { t, i18n } = useTranslation();
  const appLanguage = (normalizeAppLanguage(i18n.language) ?? "en") as AppLanguage;
  const page = useWorkspacePage();
  const saintIdentifier = saintId ?? slug;
  const lookupMode = saintId && UUID_PATTERN.test(saintId) ? "id" : "slug";
  const saintsRoot = getSaintsRoot(page.workspaceId);

  const { data: saint, isLoading, isError } = useQuery({
    queryKey: ["member-catholic-library-saint", lookupMode, saintIdentifier],
    queryFn: async () => {
      if (!saintIdentifier) throw new Error("Saint identifier is required.");

      let query = supabase
        .from("saints" as never)
        .select(SAINT_SELECT)
        .eq("is_active", true);

      query = lookupMode === "id" ? query.eq("id", saintIdentifier) : query.eq("slug", saintIdentifier);

      const { data, error } = await query.maybeSingle();

      if (error) throw error;
      return (data ?? null) as unknown as LibrarySaint | null;
    },
    enabled: !!saintIdentifier,
    ...dailyCatholicQueryOptions,
  });

  const { data: activeSaints = [] } = useQuery({
    queryKey: ["member-catholic-library-related-saints"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("saints" as never)
        .select(SAINT_SELECT)
        .eq("is_active", true)
        .order("is_featured", { ascending: false })
        .order("name", { ascending: true })
        .limit(500);

      if (error) throw error;
      return (data ?? []) as unknown as LibrarySaint[];
    },
    ...dailyCatholicQueryOptions,
  });

  const relatedSaints = useMemo(() => {
    if (!saint) return [];
    const currentTags = new Set(normalizeTags(saint.tags));
    if (currentTags.size === 0) {
      return activeSaints.filter((item) => item.id !== saint.id).slice(0, 3);
    }

    return activeSaints
      .filter((item) => item.id !== saint.id)
      .map((item) => {
        const score = normalizeTags(item.tags).filter((tag) => currentTags.has(tag)).length;
        return { item, score };
      })
      .filter((entry) => entry.score > 0)
      .sort((a, b) => b.score - a.score || a.item.name.localeCompare(b.item.name))
      .slice(0, 3)
      .map((entry) => entry.item);
  }, [activeSaints, saint]);

  const shareSaint = async () => {
    if (!saint) return;
    const url = window.location.href;

    if (navigator.share) {
      await navigator.share({
        title: saint.name,
        text: t("member_portal.catholic_content.share_saint_text", { name: saint.name }),
        url,
      });
      return;
    }

    await navigator.clipboard.writeText(url);
    toast({ title: t("member_portal.catholic_content.link_copied"), description: t("member_portal.catholic_content.saint_share_ready", { name: saint.name }) });
  };

  if (isLoading) return <DetailSkeleton />;

  if (isError) {
    return (
      <main className="min-h-full px-4 py-10 lg:px-8">
        <Card className="mx-auto max-w-3xl rounded-2xl border-destructive/25 bg-destructive/5">
          <CardContent className="p-6 text-sm text-destructive">
            {t("member_portal.catholic_content.unable_saint")}
          </CardContent>
        </Card>
      </main>
    );
  }

  if (!saint) {
    return (
      <main className="min-h-full px-4 py-10 lg:px-8">
        <Card className="mx-auto max-w-3xl rounded-2xl border-border/70 bg-card/95 shadow-sm">
          <CardContent className="flex flex-col items-center justify-center px-6 py-16 text-center">
            <BookOpen className="h-12 w-12 text-muted-foreground" aria-hidden="true" />
            <p className="mt-4 text-lg font-semibold">{t("member_portal.catholic_content.saint_not_found")}</p>
            <p className="mt-2 max-w-sm text-sm text-muted-foreground">{t("member_portal.catholic_content.saint_not_found_description")}</p>
            <Button asChild className="mt-5 rounded-xl">
              <Link to={saintsRoot}>{t("member_portal.catholic_content.back_to_library")}</Link>
            </Button>
          </CardContent>
        </Card>
      </main>
    );
  }

  return (
    <main className="min-h-full bg-[linear-gradient(180deg,hsl(var(--background)),hsl(var(--muted)/0.35))] px-4 py-6 pb-28 lg:px-8 lg:pb-10">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Button asChild variant="ghost" className="rounded-xl">
            <Link to={saintsRoot}>
              <ArrowLeft className="mr-2 h-4 w-4" aria-hidden="true" />
              {t("member_portal.catholic_content.back_to_saints")}
            </Link>
          </Button>
          <Button type="button" variant="outline" className="rounded-xl" onClick={shareSaint} aria-label={t("member_portal.catholic_content.share_saint", { name: saint.name })}>
            <Copy className="mr-2 h-4 w-4" aria-hidden="true" />
            {t("member_portal.common.share")}
          </Button>
        </div>

        <section className="overflow-hidden rounded-2xl border border-primary/15 bg-card shadow-sm">
          <div className="grid lg:grid-cols-[420px_1fr]">
            <div className="min-h-80 bg-primary/10">
              {saint.image_url ? (
                <img
                  src={saint.image_url}
                  alt={getSaintImageAlt(saint)}
                  loading="lazy"
                  decoding="async"
                  sizes="(min-width: 1024px) 420px, 100vw"
                  className="h-full min-h-80 w-full object-cover"
                />
              ) : (
                <div className="flex h-full min-h-80 w-full items-center justify-center text-primary">
                  <Sparkles className="h-16 w-16" aria-hidden="true" />
                </div>
              )}
            </div>
            <div className="space-y-5 p-6 sm:p-8">
              <div className="space-y-2">
                <Badge className="rounded-full">{t("member_portal.catholic_content.today_saint_library")}</Badge>
                <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">{saint.name}</h1>
                {saint.title ? <p className="text-lg text-muted-foreground">{saint.title}</p> : null}
              </div>
              <p className="text-base leading-7 text-muted-foreground">{saint.biography_short}</p>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl border border-border/60 bg-background/55 p-4">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">{t("member_portal.catholic_content.feast_day")}</p>
                  <p className="mt-1 font-semibold">{formatFeastDay(saint.feast_month, saint.feast_day, appLanguage) ?? t("member_portal.catholic_content.feast_day_not_set")}</p>
                </div>
                <div className="rounded-xl border border-border/60 bg-background/55 p-4">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">{t("member_portal.catholic_content.patronage")}</p>
                  <p className="mt-1 font-semibold">{saint.patron_of || t("member_portal.catholic_content.not_listed")}</p>
                </div>
                <div className="rounded-xl border border-border/60 bg-background/55 p-4">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">{t("member_portal.catholic_content.country")}</p>
                  <p className="mt-1 flex items-center gap-2 font-semibold">
                    <MapPin className="h-4 w-4 text-primary" aria-hidden="true" />
                    {saint.country || t("member_portal.catholic_content.not_listed")}
                  </p>
                </div>
                <div className="rounded-xl border border-border/60 bg-background/55 p-4">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">{t("member_portal.catholic_content.scripture")}</p>
                  <p className="mt-1 font-semibold">
                    {saint.scripture_reference ? <ScriptureLink reference={saint.scripture_reference} /> : t("member_portal.catholic_content.not_listed")}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
          <div className="space-y-6">
            <Card className="rounded-2xl border-border/70 bg-card/95 shadow-sm">
              <CardHeader>
                <CardTitle>{t("member_portal.catholic_content.biography")}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="whitespace-pre-wrap text-sm leading-7 text-muted-foreground">
                  <ScriptureText text={saint.biography_long} />
                </p>
              </CardContent>
            </Card>

            {saint.quote ? (
              <blockquote className="rounded-2xl border-l-4 border-primary bg-primary/8 p-6 text-base italic leading-7 text-foreground">
                "{saint.quote}"
              </blockquote>
            ) : null}

            <Card className="rounded-2xl border-border/70 bg-card/95 shadow-sm">
              <CardHeader>
                <CardTitle>{t("member_portal.catholic_content.reflection")}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="whitespace-pre-wrap text-sm leading-7 text-muted-foreground">
                  <ScriptureText text={saint.reflection} />
                </p>
              </CardContent>
            </Card>

            <Card className="rounded-2xl border-primary/20 bg-primary/5 shadow-sm">
              <CardHeader>
                <CardTitle>{t("member_portal.catholic_content.prayer")}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="whitespace-pre-wrap text-sm leading-7 text-muted-foreground">
                  <ScriptureText text={saint.prayer} />
                </p>
              </CardContent>
            </Card>
          </div>

          <aside className="space-y-6">
            <Card className="rounded-2xl border-border/70 bg-card/95 shadow-sm">
              <CardHeader>
                <CardTitle>{t("member_portal.prayer_detail.tags")}</CardTitle>
              </CardHeader>
              <CardContent>
                {saint.tags?.length ? (
                  <div className="flex flex-wrap gap-2">
                    {saint.tags.map((tag) => (
                      <Badge key={tag} variant="outline" className="rounded-full">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">{t("member_portal.catholic_content.no_tags")}</p>
                )}
              </CardContent>
            </Card>

            <Card className="rounded-2xl border-border/70 bg-card/95 shadow-sm">
              <CardHeader>
                <CardTitle>{t("member_portal.catholic_content.related_saints")}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {relatedSaints.length ? (
                  relatedSaints.map((item) => (
                    <Link
                      key={item.id}
                      to={`${saintsRoot}/${item.slug || item.id}`}
                      className="block rounded-2xl border border-border/60 bg-background/50 p-3 transition-colors hover:border-primary/25 hover:bg-primary/5"
                    >
                      <p className="font-medium">{item.name}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{formatFeastDay(item.feast_month, item.feast_day, appLanguage) ?? t("member_portal.catholic_content.feast_day_not_set")}</p>
                    </Link>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground">{t("member_portal.catholic_content.related_saints_empty")}</p>
                )}
              </CardContent>
            </Card>
          </aside>
        </div>
      </div>
    </main>
  );
}


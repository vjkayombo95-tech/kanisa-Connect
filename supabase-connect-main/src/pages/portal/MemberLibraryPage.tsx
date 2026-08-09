import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, BookOpen, HeartHandshake, Search, Sparkles } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import {
  SAINT_CATEGORIES,
  SAINT_SELECT,
  formatFeastDay,
  getSaintImageAlt,
  saintMatchesCategory,
  saintMatchesSearch,
  type LibrarySaint,
} from "@/lib/catholic-library";
import { dailyCatholicQueryOptions } from "@/lib/portal-performance";
import { fetchPublishedCmsPrayers, filterMemberPrayers, type CatholicPrayerContent } from "@/lib/catholic-cms";
import { PageToolbar, getWorkspacePageActions, useWorkspacePage } from "@/components/workspace";
import { normalizeAppLanguage, type AppLanguage } from "@/lib/localization";
import { getLiturgicalDisplayKey } from "@/lib/liturgical-display";
import { getPrayerDetailPath } from "@/lib/prayer-routing";

const PAGE_SIZE = 12;

function getSaintsRoot(workspaceId: string) {
  if (workspaceId === "pastoral") return "/pastoral/saints";
  if (workspaceId === "church_admin") return "/church-admin/saints";
  if (workspaceId === "finance") return "/finance/saints";
  return "/portal/library";
}

function SaintCard({ saint }: { saint: LibrarySaint }) {
  const page = useWorkspacePage();
  const { t, i18n } = useTranslation();
  const saintsRoot = getSaintsRoot(page.workspaceId);
  const appLanguage = (normalizeAppLanguage(i18n.language) ?? "en") as AppLanguage;

  return (
    <Card className="group overflow-hidden rounded-[28px] border-border/70 bg-card/85 shadow-sm transition-all hover:-translate-y-1 hover:border-primary/25 hover:shadow-lg">
      <div className="aspect-[4/3] overflow-hidden bg-primary/10">
        {saint.image_url ? (
          <img
            src={saint.image_url}
            alt={getSaintImageAlt(saint)}
            loading="lazy"
            decoding="async"
            sizes="(min-width: 1280px) 25vw, (min-width: 640px) 50vw, 100vw"
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-primary">
            <Sparkles className="h-12 w-12" aria-hidden="true" />
          </div>
        )}
      </div>
      <CardContent className="space-y-4 p-5">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            {saint.is_featured ? <Badge className="rounded-full">{t("member_portal.catholic_content.featured")}</Badge> : null}
            <Badge variant="outline" className="rounded-full">
              {formatFeastDay(saint.feast_month, saint.feast_day, appLanguage) ?? t("member_portal.catholic_content.feast_day_not_set")}
            </Badge>
          </div>
          <div>
            <h2 className="line-clamp-2 text-xl font-bold tracking-tight">{saint.name}</h2>
            {saint.title ? <p className="mt-1 line-clamp-1 text-sm text-muted-foreground">{saint.title}</p> : null}
          </div>
        </div>
        <p className="line-clamp-4 text-sm leading-6 text-muted-foreground">{saint.biography_short}</p>
        <Button asChild variant="outline" className="h-11 w-full rounded-2xl">
          <Link to={`${saintsRoot}/${saint.slug}`}>
            {t("member_portal.catholic_content.view_saint")}
            <ArrowRight className="ml-2 h-4 w-4" aria-hidden="true" />
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}

function PrayerCard({ prayer }: { prayer: CatholicPrayerContent }) {
  const page = useWorkspacePage();
  const { t, i18n } = useTranslation();
  const appLanguage = normalizeAppLanguage(i18n.language) ?? "en";
  const contentLanguage = normalizeAppLanguage(prayer.language?.code);
  const showLanguageBadge = Boolean(contentLanguage && contentLanguage !== appLanguage);
  const liturgicalSeasonKey = getLiturgicalDisplayKey(prayer.liturgical_season);

  return (
    <Card className="rounded-[24px] border-border/70 bg-card/85 shadow-sm transition hover:border-primary/25">
      <CardContent className="space-y-3 p-5">
        <div className="flex flex-wrap items-center gap-2">
          {prayer.featured ? <Badge className="rounded-full">{t("member_portal.catholic_content.featured")}</Badge> : null}
          {showLanguageBadge ? <Badge variant="secondary" className="rounded-full">{t("member_portal.catholic_content.content_available_in", { language: prayer.language?.native_name || prayer.language?.name || prayer.language?.code })}</Badge> : null}
          {prayer.category ? <Badge variant="outline" className="rounded-full">{prayer.category.name}</Badge> : null}
          {prayer.liturgical_season ? <Badge variant="outline" className="rounded-full">{liturgicalSeasonKey ? t(liturgicalSeasonKey) : prayer.liturgical_season}</Badge> : null}
        </div>
        <div>
          <h2 className="line-clamp-2 text-xl font-bold tracking-tight">{prayer.title}</h2>
          {prayer.summary ? <p className="mt-2 line-clamp-3 text-sm leading-6 text-muted-foreground">{prayer.summary}</p> : null}
        </div>
        <div className="flex flex-wrap gap-1">
          {(prayer.tags ?? []).slice(0, 4).map((tag) => <Badge key={tag.id} variant="outline" className="rounded-full">{tag.name}</Badge>)}
        </div>
        <Button asChild variant="outline" className="h-11 w-full rounded-2xl">
          <Link to={getPrayerDetailPath(page.workspaceId, prayer)}>
            {t("member_portal.catholic_content.open_prayer")}
            <ArrowRight className="ml-2 h-4 w-4" aria-hidden="true" />
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}

function LibrarySkeleton() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {Array.from({ length: 8 }).map((_, index) => (
        <Skeleton key={index} className="h-96 rounded-[28px]" />
      ))}
    </div>
  );
}

export default function MemberLibraryPage() {
  const workspacePage = useWorkspacePage();
  const { t } = useTranslation();
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [prayerCategory, setPrayerCategory] = useState("all");
  const [collection, setCollection] = useState("all");
  const [page, setPage] = useState(1);

  const { data: saints = [], isLoading, isError, error } = useQuery({
    queryKey: ["member-catholic-library-saints"],
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

  const { data: prayers = [], isLoading: prayersLoading, isError: prayersError } = useQuery({
    queryKey: ["member-catholic-library-prayers"],
    queryFn: () => fetchPublishedCmsPrayers(250),
    ...dailyCatholicQueryOptions,
  });

  const filteredSaints = useMemo(() => {
    return saints.filter((saint) => saintMatchesCategory(saint, category) && saintMatchesSearch(saint, search));
  }, [category, saints, search]);

  const filteredPrayers = useMemo(() => filterMemberPrayers(prayers, { search, categoryId: prayerCategory, collectionId: collection }), [collection, prayerCategory, prayers, search]);
  const featuredPrayers = filteredPrayers.filter((prayer) => prayer.featured || prayer.status === "featured").slice(0, 4);
  const recentPrayers = [...filteredPrayers].sort((left, right) => new Date(right.created_at).getTime() - new Date(left.created_at).getTime()).slice(0, 4);
  const seasonalPrayers = filteredPrayers.filter((prayer) => prayer.liturgical_season).slice(0, 4);
  const prayerCategories = useMemo(() => {
    const seen = new Map<string, NonNullable<CatholicPrayerContent["category"]>>();
    prayers.forEach((prayer) => {
      if (prayer.category) seen.set(prayer.category.id, prayer.category);
    });
    return Array.from(seen.values());
  }, [prayers]);
  const prayerCollections = useMemo(() => {
    const seen = new Map<string, NonNullable<CatholicPrayerContent["collections"]>[number]>();
    prayers.forEach((prayer) => (prayer.collections ?? []).forEach((item) => seen.set(item.id, item)));
    return Array.from(seen.values());
  }, [prayers]);

  const totalPages = Math.max(1, Math.ceil(filteredSaints.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pagedSaints = filteredSaints.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  const toolbarActions = useMemo(() => getWorkspacePageActions("saints", workspacePage), [workspacePage]);

  const updateSearch = (value: string) => {
    setSearch(value);
    setPage(1);
  };

  const updateCategory = (value: string) => {
    setCategory(value);
    setPage(1);
  };

  return (
    <main className="min-h-full bg-[linear-gradient(180deg,hsl(var(--background)),hsl(var(--muted)/0.35))] px-4 py-6 pb-28 lg:px-8 lg:pb-10">
      <div className="mx-auto max-w-7xl space-y-6">
        <PageToolbar title={t("member_portal.catholic_content.library_title")} description={t("member_portal.catholic_content.library_description")} actions={toolbarActions} />
        <section className="rounded-[32px] border border-primary/15 bg-[linear-gradient(135deg,hsl(var(--primary)/0.14),hsl(var(--card))_55%,hsl(var(--card)))] p-5 shadow-sm sm:p-8">
          <div className="max-w-3xl">
            <p className="flex items-center gap-2 text-sm font-medium text-primary">
              <BookOpen className="h-4 w-4" aria-hidden="true" />
              {t("member_portal.catholic_content.formation")}
            </p>
            <h1 className="mt-3 text-4xl font-bold tracking-tight text-foreground sm:text-5xl">{t("member_portal.catholic_content.library_title")}</h1>
            <p className="mt-3 text-base text-muted-foreground">{t("member_portal.catholic_content.library_hero_description")}</p>
          </div>
          <div className="mt-6 max-w-2xl">
            <label htmlFor="saint-search" className="sr-only">
              {t("member_portal.catholic_content.search_saints")}
            </label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
              <Input
                id="saint-search"
                value={search}
                onChange={(event) => updateSearch(event.target.value)}
                placeholder={t("member_portal.catholic_content.search_saints_placeholder")}
                className="h-12 rounded-2xl border-border/70 bg-background/70 pl-12 text-base"
              />
            </div>
          </div>
        </section>

        <section className="grid gap-4 lg:grid-cols-[1fr_260px_260px]">
          <div className="relative">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
            <Input
              value={search}
              onChange={(event) => updateSearch(event.target.value)}
              placeholder={t("member_portal.catholic_content.search_library_placeholder")}
              className="h-12 rounded-2xl border-border/70 bg-background/70 pl-12 text-base"
            />
          </div>
          <select value={prayerCategory} onChange={(event) => setPrayerCategory(event.target.value)} className="h-12 rounded-2xl border border-border bg-background px-4 text-sm">
            <option value="all">{t("member_portal.catholic_content.all_prayer_categories")}</option>
            {prayerCategories.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
          <select value={collection} onChange={(event) => setCollection(event.target.value)} className="h-12 rounded-2xl border border-border bg-background px-4 text-sm">
            <option value="all">{t("member_portal.catholic_content.all_collections")}</option>
            {prayerCollections.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}
          </select>
        </section>

        {prayersLoading ? (
          <LibrarySkeleton />
        ) : prayersError ? (
          <Card className="rounded-[28px] border-destructive/25 bg-destructive/5">
            <CardContent className="p-6 text-sm text-destructive">{t("member_portal.catholic_content.unable_prayers")}</CardContent>
          </Card>
        ) : (
          <section className="space-y-6">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="flex items-center gap-2 text-2xl font-bold tracking-tight"><HeartHandshake className="h-5 w-5 text-primary" />{t("member_portal.catholic_content.prayer_library")}</h2>
                <p className="mt-1 text-sm text-muted-foreground">{t("member_portal.catholic_content.prayers_available", { count: filteredPrayers.length })}</p>
              </div>
            </div>
            {featuredPrayers.length ? (
              <div>
                <h3 className="mb-3 text-lg font-semibold">{t("member_portal.catholic_content.featured_prayers")}</h3>
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">{featuredPrayers.map((prayer) => <PrayerCard key={prayer.id} prayer={prayer} />)}</div>
              </div>
            ) : null}
            {seasonalPrayers.length ? (
              <div>
                <h3 className="mb-3 text-lg font-semibold">{t("member_portal.catholic_content.seasonal_prayers")}</h3>
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">{seasonalPrayers.map((prayer) => <PrayerCard key={prayer.id} prayer={prayer} />)}</div>
              </div>
            ) : null}
            <div>
              <h3 className="mb-3 text-lg font-semibold">{t("member_portal.catholic_content.recent_prayers")}</h3>
              {recentPrayers.length ? (
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">{recentPrayers.map((prayer) => <PrayerCard key={prayer.id} prayer={prayer} />)}</div>
              ) : (
                <Card className="rounded-[28px] border-border/70 bg-card/85">
                  <CardContent className="p-6 text-sm text-muted-foreground">{t("member_portal.catholic_content.prayers_empty")}</CardContent>
                </Card>
              )}
            </div>
          </section>
        )}

        <section aria-label={t("member_portal.catholic_content.saint_categories")} className="flex gap-2 overflow-x-auto pb-1">
          {SAINT_CATEGORIES.map((item) => (
            <Button
              key={item.id}
              type="button"
              variant={category === item.id ? "default" : "outline"}
              className="h-10 shrink-0 rounded-full"
              onClick={() => updateCategory(item.id)}
            >
              {t(`member_portal.catholic_content.saint_category.${item.id}`)}
            </Button>
          ))}
        </section>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground" aria-live="polite">
            {t("member_portal.catholic_content.saints_found", { count: filteredSaints.length })}
          </p>
          {search || category !== "all" ? (
            <Button
              type="button"
              variant="ghost"
              className="rounded-xl"
              onClick={() => {
                setSearch("");
                setCategory("all");
                setPage(1);
              }}
            >
              {t("member_portal.catholic_content.clear_filters")}
            </Button>
          ) : null}
        </div>

        {isLoading ? (
          <LibrarySkeleton />
        ) : isError ? (
          <Card className="rounded-[28px] border-destructive/25 bg-destructive/5">
            <CardContent className="p-6 text-sm text-destructive">
              {t("member_portal.catholic_content.unable_library", { message: (error as Error)?.message || t("member_portal.common.please_try_again") })}
            </CardContent>
          </Card>
        ) : saints.length === 0 ? (
          <Card className="rounded-[28px] border-border/70 bg-card/85">
            <CardContent className="flex flex-col items-center justify-center px-6 py-16 text-center">
              <BookOpen className="h-12 w-12 text-muted-foreground" aria-hidden="true" />
              <p className="mt-4 text-lg font-semibold">{t("member_portal.catholic_content.no_saints_published")}</p>
            </CardContent>
          </Card>
        ) : filteredSaints.length === 0 ? (
          <Card className="rounded-[28px] border-border/70 bg-card/85">
            <CardContent className="flex flex-col items-center justify-center px-6 py-16 text-center">
              <Search className="h-12 w-12 text-muted-foreground" aria-hidden="true" />
              <p className="mt-4 text-lg font-semibold">{t("member_portal.catholic_content.no_saints_match")}</p>
            </CardContent>
          </Card>
        ) : (
          <>
            <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-label={t("member_portal.catholic_content.saints")}>
              {pagedSaints.map((saint) => (
                <SaintCard key={saint.id} saint={saint} />
              ))}
            </section>

            {totalPages > 1 ? (
              <nav className="flex items-center justify-center gap-3" aria-label="Saints pagination">
                <Button
                  type="button"
                  variant="outline"
                  className="rounded-xl"
                  disabled={safePage === 1}
                  onClick={() => setPage((current) => Math.max(1, current - 1))}
                >
                  {t("member_portal.common.previous")}
                </Button>
                <span className="text-sm text-muted-foreground">
                  {t("member_portal.catholic_content.page_of", { page: safePage, total: totalPages })}
                </span>
                <Button
                  type="button"
                  variant="outline"
                  className="rounded-xl"
                  disabled={safePage === totalPages}
                  onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
                >
                  {t("member_portal.common.next")}
                </Button>
              </nav>
            ) : null}
          </>
        )}
      </div>
    </main>
  );
}

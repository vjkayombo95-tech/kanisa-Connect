import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { BookHeart, Bookmark, Clock3, Search, Sparkles } from "lucide-react";
import { Link } from "react-router-dom";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/contexts/AuthContext";
import { getFavoriteIds, getRecentPrayerIds, listPrayerCategories, prayerLibraryKeys, searchPublishedPrayers } from "@/lib/prayer-library";
import type { PrayerSummary } from "@/types/prayer-library";

function PrayerCard({ prayer }: { prayer: PrayerSummary }) {
  return (
    <Card className="h-full rounded-2xl border-border/70 bg-card/95 transition hover:border-primary/35 hover:shadow-md">
      <CardContent className="flex h-full flex-col p-5">
        <div className="flex flex-wrap gap-2">
          {prayer.featured ? <Badge>Imependekezwa</Badge> : null}
          {prayer.category ? <Badge variant="outline">{prayer.category.name}</Badge> : null}
        </div>
        <h3 className="mt-3 text-lg font-semibold">{prayer.title}</h3>
        <p className="mt-2 line-clamp-3 flex-1 text-sm leading-6 text-muted-foreground">{prayer.summary || "Fungua sala ili uisome."}</p>
        <Button asChild className="mt-4 min-h-11 rounded-xl"><Link to={`/portal/prayers/${prayer.slug}`}>Soma sala</Link></Button>
      </CardContent>
    </Card>
  );
}

function PrayerGrid({ prayers, empty }: { prayers: PrayerSummary[]; empty: string }) {
  if (!prayers.length) return <Card className="rounded-2xl border-dashed"><CardContent className="py-10 text-center text-sm text-muted-foreground">{empty}</CardContent></Card>;
  return <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{prayers.map((prayer) => <PrayerCard key={prayer.id} prayer={prayer} />)}</div>;
}

export default function MemberPrayerLibraryPage() {
  const { user, churchId } = useAuth();
  const [search, setSearch] = useState("");
  const [categoryId, setCategoryId] = useState("all");
  const prayers = useQuery({ queryKey: [...prayerLibraryKeys.published(churchId), search], queryFn: () => searchPublishedPrayers(search), staleTime: 60_000 });
  const categories = useQuery({ queryKey: prayerLibraryKeys.categories, queryFn: listPrayerCategories, staleTime: 5 * 60_000 });
  const favorites = useQuery({ queryKey: prayerLibraryKeys.favorites(user?.id ?? null), queryFn: () => getFavoriteIds(user!.id), enabled: !!user?.id });
  const recent = useQuery({ queryKey: prayerLibraryKeys.recent(user?.id ?? null), queryFn: () => getRecentPrayerIds(user!.id), enabled: !!user?.id });

  const visible = useMemo(() => (prayers.data ?? []).filter((prayer) => categoryId === "all" || prayer.category_id === categoryId), [categoryId, prayers.data]);
  const roots = visible.filter((prayer) => !prayer.parent_prayer_id);
  const featured = roots.filter((prayer) => prayer.featured).slice(0, 6);
  const favoritePrayers = (prayers.data ?? []).filter((prayer) => favorites.data?.includes(prayer.id));
  const recentPrayers = (recent.data ?? []).map((id) => (prayers.data ?? []).find((prayer) => prayer.id === id)).filter(Boolean) as PrayerSummary[];
  const counts = new Map<string, number>();
  (prayers.data ?? []).forEach((prayer) => { if (!prayer.parent_prayer_id && prayer.category_id) counts.set(prayer.category_id, (counts.get(prayer.category_id) ?? 0) + 1); });

  return (
    <main className="min-h-full bg-[linear-gradient(180deg,hsl(var(--background)),hsl(var(--muted)/0.3))] px-4 py-6 pb-28 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-8">
        <header className="rounded-3xl border border-primary/15 bg-card/95 p-6 shadow-sm sm:p-8">
          <div className="flex items-center gap-3 text-primary"><BookHeart className="h-6 w-6" /><span className="text-sm font-semibold">Kanisa Connect</span></div>
          <h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">Maktaba ya Sala</h1>
          <p className="mt-3 max-w-2xl text-muted-foreground">Pata sala za Kikatoliki zilizohakikiwa kwa maisha ya kila siku, mafundisho na ibada.</p>
          <label className="relative mt-6 block max-w-2xl">
            <span className="sr-only">Tafuta sala</span><Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
            <Input value={search} onChange={(event) => setSearch(event.target.value)} className="h-12 rounded-xl pl-12" placeholder="Tafuta kwa kichwa au maneno ya sala..." />
          </label>
        </header>

        {featured.length ? <section aria-labelledby="featured-prayers"><h2 id="featured-prayers" className="mb-4 flex items-center gap-2 text-xl font-semibold"><Sparkles className="h-5 w-5 text-primary" />Sala Zilizopendekezwa</h2><PrayerGrid prayers={featured} empty="Hakuna sala zilizopendekezwa kwa sasa." /></section> : null}

        <section aria-labelledby="prayer-categories">
          <h2 id="prayer-categories" className="mb-4 text-xl font-semibold">Makundi ya Sala</h2>
          {categories.isLoading ? <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{Array.from({ length: 6 }).map((_, index) => <Skeleton key={index} className="h-24 rounded-2xl" />)}</div> : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <button type="button" onClick={() => setCategoryId("all")} className={`min-h-24 rounded-2xl border p-4 text-left outline-none focus-visible:ring-2 focus-visible:ring-primary ${categoryId === "all" ? "border-primary bg-primary/10" : "bg-card"}`}><BookHeart className="h-5 w-5 text-primary" /><span className="mt-2 block font-semibold">Sala Zote</span><span className="text-sm text-muted-foreground">{(prayers.data ?? []).filter((item) => !item.parent_prayer_id).length} sala</span></button>
              {(categories.data ?? []).filter((category) => counts.has(category.id)).map((category) => <button key={category.id} type="button" onClick={() => setCategoryId(category.id)} className={`min-h-24 rounded-2xl border p-4 text-left outline-none focus-visible:ring-2 focus-visible:ring-primary ${categoryId === category.id ? "border-primary bg-primary/10" : "bg-card"}`}><BookHeart className="h-5 w-5 text-primary" /><span className="mt-2 block font-semibold">{category.name}</span><span className="text-sm text-muted-foreground">{counts.get(category.id)} sala</span></button>)}
            </div>
          )}
        </section>

        <section aria-labelledby="all-prayers"><div className="mb-4 flex items-center justify-between gap-3"><h2 id="all-prayers" className="text-xl font-semibold">Sala</h2>{categoryId !== "all" ? <Button variant="ghost" onClick={() => setCategoryId("all")}>Ondoa kichujio</Button> : null}</div>
          {prayers.isLoading ? <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{Array.from({ length: 6 }).map((_, index) => <Skeleton key={index} className="h-56 rounded-2xl" />)}</div> : prayers.isError ? <Card className="border-destructive/30"><CardContent className="py-10 text-center text-destructive">Imeshindikana kupakia sala. Tafadhali jaribu tena.</CardContent></Card> : <PrayerGrid prayers={roots} empty="Hakuna sala zilizochapishwa zinazolingana na utafutaji huu." />}
        </section>

        <section aria-labelledby="saved-prayers"><h2 id="saved-prayers" className="mb-4 flex items-center gap-2 text-xl font-semibold"><Bookmark className="h-5 w-5 text-primary" />Sala Zilizohifadhiwa</h2><PrayerGrid prayers={favoritePrayers} empty="Bado hujahifadhi sala yoyote." /></section>
        <section aria-labelledby="recent-prayers"><h2 id="recent-prayers" className="mb-4 flex items-center gap-2 text-xl font-semibold"><Clock3 className="h-5 w-5 text-primary" />Zilizosomwa Hivi Karibuni</h2><PrayerGrid prayers={recentPrayers} empty="Sala ulizosoma hivi karibuni zitaonekana hapa." /></section>
      </div>
    </main>
  );
}

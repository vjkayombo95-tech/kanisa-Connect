import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, ChevronLeft, ChevronRight, Heart, Minus, Plus, Share2, Volume2 } from "lucide-react";
import { Link, useParams } from "react-router-dom";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { getFavoriteIds, getPrayerById, getPrayerBySlug, listCollectionChildren, listPublishedTranslations, prayerLibraryKeys, togglePrayerFavorite, updatePrayerReadingHistory } from "@/lib/prayer-library";

export default function MemberPrayerDetailPage() {
  const { slug = "" } = useParams();
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [fontSize, setFontSize] = useState(18);
  const prayer = useQuery({ queryKey: prayerLibraryKeys.detail(slug), queryFn: () => getPrayerBySlug(slug), enabled: !!slug });
  const parent = useQuery({ queryKey: ["prayer-library", "parent", prayer.data?.parent_prayer_id], queryFn: () => getPrayerById(prayer.data!.parent_prayer_id!), enabled: !!prayer.data?.parent_prayer_id });
  const collectionId = prayer.data?.parent_prayer_id ?? (prayer.data && prayer.data.prayer_type !== "single" ? prayer.data.id : null);
  const children = useQuery({ queryKey: ["prayer-library", "children", collectionId], queryFn: () => listCollectionChildren(collectionId!), enabled: !!collectionId });
  const favorites = useQuery({ queryKey: prayerLibraryKeys.favorites(user?.id ?? null), queryFn: () => getFavoriteIds(user!.id), enabled: !!user?.id });
  const translations = useQuery({ queryKey: ["prayer-library", "translations", prayer.data?.translation_group_id], queryFn: () => listPublishedTranslations(prayer.data!), enabled: !!prayer.data?.translation_group_id });
  const isFavorite = !!prayer.data && !!favorites.data?.includes(prayer.data.id);
  const favoriteMutation = useMutation({ mutationFn: () => togglePrayerFavorite(user!.id, prayer.data!.id, isFavorite), onSuccess: () => queryClient.invalidateQueries({ queryKey: prayerLibraryKeys.favorites(user?.id ?? null) }), onError: (error: Error) => toast({ title: "Imeshindikana kuhifadhi", description: error.message, variant: "destructive" }) });

  useEffect(() => {
    if (!user?.id || !prayer.data?.id) return;
    void updatePrayerReadingHistory(user.id, prayer.data.id).then(() => queryClient.invalidateQueries({ queryKey: prayerLibraryKeys.recent(user.id) })).catch(() => undefined);
  }, [prayer.data?.id, queryClient, user?.id]);

  const position = useMemo(() => (children.data ?? []).findIndex((item) => item.id === prayer.data?.id), [children.data, prayer.data?.id]);
  const previous = position > 0 ? children.data?.[position - 1] : null;
  const next = position >= 0 ? children.data?.[position + 1] : null;
  const progress = position >= 0 && children.data?.length ? ((position + 1) / children.data.length) * 100 : 0;

  const share = async () => {
    if (!prayer.data) return;
    const payload = { title: prayer.data.title, text: prayer.data.body ?? "", url: window.location.href };
    try {
      if (navigator.share) await navigator.share(payload);
      else { await navigator.clipboard.writeText(`${payload.title}\n\n${payload.text}\n${payload.url}`); toast({ title: "Kiungo kimenakiliwa" }); }
    } catch (error) { if ((error as DOMException).name !== "AbortError") toast({ title: "Imeshindikana kushiriki", variant: "destructive" }); }
  };

  if (prayer.isLoading) return <main className="mx-auto max-w-4xl space-y-4 px-4 py-6"><Skeleton className="h-12 w-40" /><Skeleton className="h-[28rem] rounded-3xl" /></main>;
  if (prayer.isError || !prayer.data) return <main className="mx-auto max-w-3xl px-4 py-12"><Card><CardContent className="py-12 text-center"><h1 className="text-xl font-semibold">Sala haipatikani</h1><p className="mt-2 text-muted-foreground">Sala hii haijachapishwa au huna ruhusa ya kuisoma.</p><Button asChild className="mt-5"><Link to="/portal/prayers">Rudi kwenye maktaba</Link></Button></CardContent></Card></main>;

  return (
    <main className="min-h-full px-4 py-6 pb-28 lg:px-8">
      <div className="mx-auto max-w-4xl space-y-5">
        <Button asChild variant="ghost"><Link to="/portal/prayers"><ArrowLeft className="mr-2 h-4 w-4" />Maktaba ya Sala</Link></Button>
        <Card className="rounded-3xl border-border/70 shadow-sm"><CardContent className="p-6 sm:p-9">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
            <div><div className="flex flex-wrap gap-2">{prayer.data.category ? <Badge variant="outline">{prayer.data.category.name}</Badge> : null}{parent.data ? <Badge variant="secondary">{parent.data.title}</Badge> : null}</div><h1 className="mt-4 text-3xl font-bold tracking-tight sm:text-4xl">{prayer.data.title}</h1>{prayer.data.summary ? <p className="mt-3 leading-7 text-muted-foreground">{prayer.data.summary}</p> : null}</div>
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant={isFavorite ? "default" : "outline"} className="min-h-11" onClick={() => favoriteMutation.mutate()} disabled={!user || favoriteMutation.isPending}><Heart className={`mr-2 h-4 w-4 ${isFavorite ? "fill-current" : ""}`} />{isFavorite ? "Imehifadhiwa" : "Hifadhi"}</Button>
              <Button type="button" variant="outline" className="min-h-11" onClick={share}><Share2 className="mr-2 h-4 w-4" />Shiriki</Button>
            </div>
          </div>

          <div className="mt-6 flex items-center justify-between gap-3 border-y py-3"><span className="text-sm text-muted-foreground">Ukubwa wa maandishi</span><div className="flex gap-2"><Button type="button" size="icon" variant="outline" aria-label="Punguza maandishi" onClick={() => setFontSize((size) => Math.max(16, size - 2))}><Minus className="h-4 w-4" /></Button><Button type="button" size="icon" variant="outline" aria-label="Ongeza maandishi" onClick={() => setFontSize((size) => Math.min(28, size + 2))}><Plus className="h-4 w-4" /></Button></div></div>
          <article className="whitespace-pre-wrap py-8 font-serif leading-[1.9] text-foreground" style={{ fontSize }}>{prayer.data.body}</article>
          {prayer.data.audio_url ? <div className="rounded-2xl border p-4"><h2 className="mb-3 flex items-center gap-2 font-semibold"><Volume2 className="h-5 w-5" />Sikiliza sala</h2><audio controls preload="none" className="w-full" src={prayer.data.audio_url}>Kivinjari chako hakitumii sauti.</audio></div> : null}
          {(translations.data?.length ?? 0) > 0 ? <section className="mt-6 rounded-2xl border p-4" aria-labelledby="prayer-translations"><h2 id="prayer-translations" className="font-semibold">Lugha nyingine</h2><div className="mt-3 flex flex-wrap gap-2">{translations.data?.map((variant) => <Button key={variant.id} asChild variant="outline" size="sm"><Link to={`/portal/prayers/${variant.slug}`}>{variant.language?.native_name || variant.language?.name || variant.title}</Link></Button>)}</div></section> : null}
          {(prayer.data.source_title || prayer.data.source_organization || prayer.data.content_edition || prayer.data.copyright_notice || ["attribution_required", "licensed"].includes(prayer.data.license_type ?? "")) ? <section className="mt-6 border-t pt-5" aria-labelledby="prayer-source"><h2 id="prayer-source" className="text-sm font-semibold">Chanzo</h2><p className="mt-2 text-sm text-muted-foreground">{[prayer.data.source_title, prayer.data.source_organization, prayer.data.content_edition].filter(Boolean).join(" · ")}</p>{prayer.data.copyright_notice ? <p className="mt-1 text-xs text-muted-foreground">{prayer.data.copyright_notice}</p> : null}{["attribution_required", "licensed"].includes(prayer.data.license_type ?? "") ? <p className="mt-1 text-xs text-muted-foreground">{prayer.data.license_type?.replace(/_/g, " ")}</p> : null}</section> : null}

          {collectionId && (children.data?.length ?? 0) > 0 ? <section className="mt-8" aria-labelledby="collection-sections"><div className="flex items-center justify-between"><h2 id="collection-sections" className="text-lg font-semibold">Sehemu za sala</h2>{position >= 0 ? <span className="text-sm text-muted-foreground">{position + 1} / {children.data?.length}</span> : null}</div>{position >= 0 ? <Progress value={progress} className="mt-3" /> : null}<div className="mt-4 grid gap-2">{children.data?.map((child, index) => <Button key={child.id} asChild variant={child.id === prayer.data?.id ? "default" : "outline"} className="h-auto min-h-11 justify-start whitespace-normal py-3 text-left"><Link to={`/portal/prayers/${child.slug}`}><span className="mr-3 text-xs opacity-70">{index + 1}</span>{child.title}</Link></Button>)}</div></section> : null}
        </CardContent></Card>
      </div>
      {position >= 0 ? <nav className="fixed inset-x-0 bottom-0 z-20 border-t bg-background/95 p-3 backdrop-blur" aria-label="Urambazaji wa mkusanyiko"><div className="mx-auto flex max-w-4xl justify-between gap-3"><Button asChild={!!previous} variant="outline" disabled={!previous} className="min-h-11 flex-1">{previous ? <Link to={`/portal/prayers/${previous.slug}`}><ChevronLeft className="mr-2 h-4 w-4" />Iliyotangulia</Link> : <span>Iliyotangulia</span>}</Button><Button asChild={!!next} disabled={!next} className="min-h-11 flex-1">{next ? <Link to={`/portal/prayers/${next.slug}`}>Inayofuata<ChevronRight className="ml-2 h-4 w-4" /></Link> : <span>Inayofuata</span>}</Button></div></nav> : null}
    </main>
  );
}

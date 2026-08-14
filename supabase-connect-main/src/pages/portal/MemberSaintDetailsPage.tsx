import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, BookOpen, Copy, MapPin, Sparkles } from "lucide-react";
import { Link, useParams } from "react-router-dom";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import {
  SAINT_SELECT,
  formatFeastDay,
  getSaintImageAlt,
  normalizeTags,
  type LibrarySaint,
} from "@/lib/catholic-library";

function DetailSkeleton() {
  return (
    <div className="mx-auto max-w-6xl space-y-5 px-4 py-6 lg:px-8">
      <Skeleton className="h-80 rounded-[32px]" />
      <div className="grid gap-5 lg:grid-cols-[1fr_340px]">
        <Skeleton className="h-96 rounded-[28px]" />
        <Skeleton className="h-96 rounded-[28px]" />
      </div>
    </div>
  );
}

export default function MemberSaintDetailsPage() {
  const { slug, saintId } = useParams();
  const saintKey = saintId ?? slug;
  const { toast } = useToast();

  const { data: saint, isLoading, isError, error } = useQuery({
    queryKey: ["member-catholic-library-saint", saintKey],
    queryFn: async () => {
      if (!saintKey) throw new Error("Saint identifier is required.");

      let query = supabase
        .from("saints" as never)
        .select(SAINT_SELECT)
        .eq("is_active", true);
      query = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(saintKey)
        ? query.eq("id", saintKey)
        : query.eq("slug", saintKey);
      const { data, error } = await query.maybeSingle();

      if (error) throw error;
      return (data ?? null) as unknown as LibrarySaint | null;
    },
    enabled: !!saintKey,
    staleTime: 10 * 60 * 1000,
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
    staleTime: 10 * 60 * 1000,
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
        text: `Read about ${saint.name} in the Kanisa Connect Catholic Library.`,
        url,
      });
      return;
    }

    await navigator.clipboard.writeText(url);
    toast({ title: "Link copied", description: `${saint.name} can now be shared.` });
  };

  if (isLoading) return <DetailSkeleton />;

  if (isError) {
    return (
      <main className="min-h-full px-4 py-10 lg:px-8">
        <Card className="mx-auto max-w-3xl rounded-[28px] border-destructive/25 bg-destructive/5">
          <CardContent className="p-6 text-sm text-destructive">
            Unable to load this saint: {(error as Error)?.message || "Please try again."}
          </CardContent>
        </Card>
      </main>
    );
  }

  if (!saint) {
    return (
      <main className="min-h-full px-4 py-10 lg:px-8">
        <Card className="mx-auto max-w-3xl rounded-[28px] border-border/70 bg-card/85">
          <CardContent className="flex flex-col items-center justify-center px-6 py-16 text-center">
            <BookOpen className="h-12 w-12 text-muted-foreground" aria-hidden="true" />
            <p className="mt-4 text-lg font-semibold">Saint not found.</p>
            <Button asChild className="mt-5 rounded-2xl">
              <Link to="/member/library">Back to Catholic Library</Link>
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
            <Link to="/member/library">
              <ArrowLeft className="mr-2 h-4 w-4" aria-hidden="true" />
              Back
            </Link>
          </Button>
          <Button type="button" variant="outline" className="rounded-xl" onClick={shareSaint}>
            <Copy className="mr-2 h-4 w-4" aria-hidden="true" />
            Share
          </Button>
        </div>

        <section className="overflow-hidden rounded-[32px] border border-primary/15 bg-card shadow-sm">
          <div className="grid lg:grid-cols-[420px_1fr]">
            <div className="min-h-80 bg-primary/10">
              {saint.image_url ? (
                <img
                  src={saint.image_url}
                  alt={getSaintImageAlt(saint)}
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
                <Badge className="rounded-full">Today's saint and Catholic library</Badge>
                <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">{saint.name}</h1>
                {saint.title ? <p className="text-lg text-muted-foreground">{saint.title}</p> : null}
              </div>
              <p className="text-base leading-7 text-muted-foreground">{saint.biography_short}</p>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl border border-border/60 bg-background/55 p-4">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Feast Day</p>
                  <p className="mt-1 font-semibold">{formatFeastDay(saint.feast_month, saint.feast_day)}</p>
                </div>
                <div className="rounded-2xl border border-border/60 bg-background/55 p-4">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Patron Of</p>
                  <p className="mt-1 font-semibold">{saint.patron_of || "Not listed"}</p>
                </div>
                <div className="rounded-2xl border border-border/60 bg-background/55 p-4">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Country</p>
                  <p className="mt-1 flex items-center gap-2 font-semibold">
                    <MapPin className="h-4 w-4 text-primary" aria-hidden="true" />
                    {saint.country || "Not listed"}
                  </p>
                </div>
                <div className="rounded-2xl border border-border/60 bg-background/55 p-4">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Scripture</p>
                  <p className="mt-1 font-semibold">{saint.scripture_reference || "Not listed"}</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
          <div className="space-y-6">
            <Card className="rounded-[28px] border-border/70 bg-card/85">
              <CardHeader>
                <CardTitle>Long Biography</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="whitespace-pre-wrap text-sm leading-7 text-muted-foreground">{saint.biography_long}</p>
              </CardContent>
            </Card>

            {saint.quote ? (
              <blockquote className="rounded-[28px] border-l-4 border-primary bg-primary/8 p-6 text-base italic leading-7 text-foreground">
                "{saint.quote}"
              </blockquote>
            ) : null}

            <Card className="rounded-[28px] border-border/70 bg-card/85">
              <CardHeader>
                <CardTitle>Reflection</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="whitespace-pre-wrap text-sm leading-7 text-muted-foreground">{saint.reflection}</p>
              </CardContent>
            </Card>

            <Card className="rounded-[28px] border-primary/20 bg-primary/5">
              <CardHeader>
                <CardTitle>Prayer</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="whitespace-pre-wrap text-sm leading-7 text-muted-foreground">{saint.prayer}</p>
              </CardContent>
            </Card>
          </div>

          <aside className="space-y-6">
            <Card className="rounded-[28px] border-border/70 bg-card/85">
              <CardHeader>
                <CardTitle>Tags</CardTitle>
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
                  <p className="text-sm text-muted-foreground">No tags listed.</p>
                )}
              </CardContent>
            </Card>

            <Card className="rounded-[28px] border-border/70 bg-card/85">
              <CardHeader>
                <CardTitle>Related Saints</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {relatedSaints.length ? (
                  relatedSaints.map((item) => (
                    <Link
                      key={item.id}
                      to={`/member/library/${item.slug}`}
                      className="block rounded-2xl border border-border/60 bg-background/50 p-3 transition-colors hover:border-primary/25 hover:bg-primary/5"
                    >
                      <p className="font-medium">{item.name}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{formatFeastDay(item.feast_month, item.feast_day)}</p>
                    </Link>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground">Related saints will appear as the library grows.</p>
                )}
              </CardContent>
            </Card>
          </aside>
        </div>
      </div>
    </main>
  );
}


import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, BookOpen, Search, Sparkles } from "lucide-react";
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

const PAGE_SIZE = 12;

function SaintCard({ saint }: { saint: LibrarySaint }) {
  return (
    <Card className="group overflow-hidden rounded-[28px] border-border/70 bg-card/85 shadow-sm transition-all hover:-translate-y-1 hover:border-primary/25 hover:shadow-lg">
      <div className="aspect-[4/3] overflow-hidden bg-primary/10">
        {saint.image_url ? (
          <img
            src={saint.image_url}
            alt={getSaintImageAlt(saint)}
            loading="lazy"
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
            {saint.is_featured ? <Badge className="rounded-full">Featured</Badge> : null}
            <Badge variant="outline" className="rounded-full">
              {formatFeastDay(saint.feast_month, saint.feast_day)}
            </Badge>
          </div>
          <div>
            <h2 className="line-clamp-2 text-xl font-bold tracking-tight">{saint.name}</h2>
            {saint.title ? <p className="mt-1 line-clamp-1 text-sm text-muted-foreground">{saint.title}</p> : null}
          </div>
        </div>
        <p className="line-clamp-4 text-sm leading-6 text-muted-foreground">{saint.biography_short}</p>
        <Button asChild variant="outline" className="h-11 w-full rounded-2xl">
          <Link to={`/member/library/${saint.slug}`}>
            Read More
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
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
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
    staleTime: 10 * 60 * 1000,
  });

  const filteredSaints = useMemo(() => {
    return saints.filter((saint) => saintMatchesCategory(saint, category) && saintMatchesSearch(saint, search));
  }, [category, saints, search]);

  const totalPages = Math.max(1, Math.ceil(filteredSaints.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pagedSaints = filteredSaints.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

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
        <section className="rounded-[32px] border border-primary/15 bg-[linear-gradient(135deg,hsl(var(--primary)/0.14),hsl(var(--card))_55%,hsl(var(--card)))] p-5 shadow-sm sm:p-8">
          <div className="max-w-3xl">
            <p className="flex items-center gap-2 text-sm font-medium text-primary">
              <BookOpen className="h-4 w-4" aria-hidden="true" />
              Catholic formation
            </p>
            <h1 className="mt-3 text-4xl font-bold tracking-tight text-foreground sm:text-5xl">Watakatifu</h1>
            <p className="mt-3 text-base text-muted-foreground">Grow in faith through the lives of the saints.</p>
          </div>
          <div className="mt-6 max-w-2xl">
            <label htmlFor="saint-search" className="sr-only">
              Search saints
            </label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
              <Input
                id="saint-search"
                value={search}
                onChange={(event) => updateSearch(event.target.value)}
                placeholder="Search by name, title, patronage, country, or tags..."
                className="h-12 rounded-2xl border-border/70 bg-background/70 pl-12 text-base"
              />
            </div>
          </div>
        </section>

        <section aria-label="Saint categories" className="flex gap-2 overflow-x-auto pb-1">
          {SAINT_CATEGORIES.map((item) => (
            <Button
              key={item.id}
              type="button"
              variant={category === item.id ? "default" : "outline"}
              className="h-10 shrink-0 rounded-full"
              onClick={() => updateCategory(item.id)}
            >
              {item.label}
            </Button>
          ))}
        </section>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground" aria-live="polite">
            {filteredSaints.length} saint{filteredSaints.length === 1 ? "" : "s"} found
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
              Clear filters
            </Button>
          ) : null}
        </div>

        {isLoading ? (
          <LibrarySkeleton />
        ) : isError ? (
          <Card className="rounded-[28px] border-destructive/25 bg-destructive/5">
            <CardContent className="p-6 text-sm text-destructive">
              Imeshindikana kupakia Watakatifu: {(error as Error)?.message || "Jaribu tena."}
            </CardContent>
          </Card>
        ) : saints.length === 0 ? (
          <Card className="rounded-[28px] border-border/70 bg-card/85">
            <CardContent className="flex flex-col items-center justify-center px-6 py-16 text-center">
              <BookOpen className="h-12 w-12 text-muted-foreground" aria-hidden="true" />
              <p className="mt-4 text-lg font-semibold">No saints have been published yet.</p>
            </CardContent>
          </Card>
        ) : filteredSaints.length === 0 ? (
          <Card className="rounded-[28px] border-border/70 bg-card/85">
            <CardContent className="flex flex-col items-center justify-center px-6 py-16 text-center">
              <Search className="h-12 w-12 text-muted-foreground" aria-hidden="true" />
              <p className="mt-4 text-lg font-semibold">No saints match your search.</p>
            </CardContent>
          </Card>
        ) : (
          <>
            <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-label="Saints">
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
                  Previous
                </Button>
                <span className="text-sm text-muted-foreground">
                  Page {safePage} of {totalPages}
                </span>
                <Button
                  type="button"
                  variant="outline"
                  className="rounded-xl"
                  disabled={safePage === totalPages}
                  onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
                >
                  Next
                </Button>
              </nav>
            ) : null}
          </>
        )}
      </div>
    </main>
  );
}

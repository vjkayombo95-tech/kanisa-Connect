import { useQuery } from "@tanstack/react-query";
import { ArrowRight, BookOpen, Sparkles } from "lucide-react";
import { Link } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { fetchPublishedReflections } from "@/lib/content-display";

function formatDate(value: string) { return new Intl.DateTimeFormat("sw-KE", { dateStyle: "long", timeZone: "UTC" }).format(new Date(`${value}T00:00:00Z`)); }

export default function ReflectionsPage() {
  const { data = [], isLoading, isError } = useQuery({ queryKey: ["published-reflections"], queryFn: fetchPublishedReflections, staleTime: 10 * 60 * 1000 });
  return <main className="min-h-full px-4 py-6 pb-28 lg:px-8 lg:pb-10"><div className="mx-auto max-w-5xl space-y-6">
    <header className="rounded-[32px] border border-primary/15 bg-primary/5 p-6 sm:p-8"><p className="flex items-center gap-2 text-sm font-bold text-primary"><Sparkles className="h-4 w-4" />Kanisa Connect</p><h1 className="mt-2 text-4xl font-bold tracking-tight">Tafakari</h1><p className="mt-2 text-muted-foreground">Tafakari zilizochapishwa pamoja na masomo ya kila siku.</p></header>
    {isLoading ? <div className="space-y-3"><Skeleton className="h-40 rounded-3xl"/><Skeleton className="h-40 rounded-3xl"/></div> : isError ? <Card><CardContent className="p-6">Tafakari hazikuweza kupakiwa. Tafadhali jaribu tena.</CardContent></Card> : data.length === 0 ? <Card><CardContent className="flex flex-col items-center py-14 text-center"><BookOpen className="h-10 w-10 text-muted-foreground"/><p className="mt-4 font-semibold">Hakuna tafakari iliyochapishwa kwa sasa.</p></CardContent></Card> : <section className="grid gap-4 sm:grid-cols-2" aria-label="Tafakari zilizochapishwa">{data.map((item) => <Card key={item.id} className="rounded-3xl"><CardContent className="p-5"><div className="flex flex-wrap gap-2"><Badge variant="outline">{formatDate(item.reading_date)}</Badge>{item.liturgical_season ? <Badge>{item.liturgical_season}</Badge> : null}</div><h2 className="mt-4 text-xl font-bold">Tafakari ya {formatDate(item.reading_date)}</h2><p className="mt-2 line-clamp-4 text-sm leading-6 text-muted-foreground">{item.reflection}</p><Button asChild variant="outline" className="mt-5 min-h-11 w-full rounded-2xl"><Link to={`/portal/reflections/${item.id}`}>Soma tafakari<ArrowRight className="ml-2 h-4 w-4"/></Link></Button></CardContent></Card>)}</section>}
  </div></main>;
}

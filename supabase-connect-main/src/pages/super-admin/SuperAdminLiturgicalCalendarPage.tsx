import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { CalendarDays, ExternalLink, Search } from "lucide-react";
import { Link } from "react-router-dom";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { SAINT_SELECT, formatFeastDay, saintMatchesSearch, type LibrarySaint } from "@/lib/catholic-library";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export default function SuperAdminLiturgicalCalendarPage() {
  const [month, setMonth] = useState(String(new Date().getMonth() + 1));
  const [search, setSearch] = useState("");

  const { data: saints = [], isLoading, isError, error } = useQuery({
    queryKey: ["super-admin-liturgical-calendar", month],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("saints" as never)
        .select(`${SAINT_SELECT}, is_active`)
        .eq("feast_month", Number(month))
        .order("feast_day", { ascending: true })
        .order("name", { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as (LibrarySaint & { is_active: boolean })[];
    },
  });

  const filtered = useMemo(() => saints.filter((saint) => saintMatchesSearch(saint, search)), [saints, search]);
  const byDay = filtered.reduce<Record<number, typeof filtered>>((groups, saint) => {
    groups[saint.feast_day] = [...(groups[saint.feast_day] ?? []), saint];
    return groups;
  }, {});

  return (
    <main className="space-y-6 p-4 lg:p-6">
      <section className="rounded-[28px] border border-border/70 bg-card/85 p-5">
        <p className="flex items-center gap-2 text-sm font-medium text-primary"><CalendarDays className="h-4 w-4" />Catholic Content</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight">Liturgical Calendar Manager</h1>
        <p className="mt-1 text-sm text-muted-foreground">Review monthly feast days, preview records, and link feast edits back to saints.</p>
      </section>

      <Card className="rounded-[24px] border-border/70 bg-card/85">
        <CardContent className="space-y-4 p-5">
          <div className="grid gap-3 lg:grid-cols-[220px_1fr_auto]">
            <Select value={month} onValueChange={setMonth}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{MONTHS.map((item, index) => <SelectItem key={item} value={String(index + 1)}>{item}</SelectItem>)}</SelectContent>
            </Select>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search feast, saint, patron, country, or tags..." className="pl-10" />
            </div>
            <Button asChild variant="outline"><Link to="/super-admin/catholic-content/saints">Open Saints Manager <ExternalLink className="ml-2 h-4 w-4" /></Link></Button>
          </div>

          {isError ? <p className="text-sm text-destructive">{(error as Error).message}</p> : null}

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {Array.from({ length: 31 }, (_, index) => index + 1).map((day) => {
              const daySaints = byDay[day] ?? [];
              return (
                <div key={day} className="min-h-28 rounded-2xl border border-border/60 bg-background/45 p-3">
                  <p className="text-sm font-semibold">{day}</p>
                  <div className="mt-2 space-y-1">
                    {daySaints.map((saint) => (
                      <Link key={saint.id} to="/super-admin/catholic-content/saints" className="block truncate rounded-lg text-xs text-primary hover:underline">
                        &bull; {saint.name}
                      </Link>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-[24px] border-border/70 bg-card/85">
        <CardContent className="p-5">
          <h2 className="text-xl font-bold">{MONTHS[Number(month) - 1]} Feast Preview</h2>
          <Table>
            <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Saint</TableHead><TableHead>Rank</TableHead><TableHead>Status</TableHead><TableHead>Actions</TableHead></TableRow></TableHeader>
            <TableBody>
              {isLoading ? <TableRow><TableCell colSpan={5}>Loading calendar...</TableCell></TableRow> : filtered.length ? filtered.map((saint) => (
                <TableRow key={saint.id}>
                  <TableCell>{formatFeastDay(saint.feast_month, saint.feast_day)}</TableCell>
                  <TableCell className="font-medium">{saint.name}</TableCell>
                  <TableCell>{saint.liturgical_rank || "-"}</TableCell>
                  <TableCell><Badge variant={saint.is_active ? "default" : "outline"}>{saint.is_active ? "Published" : "Draft"}</Badge></TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-2">
                      <Button asChild size="sm" variant="outline"><Link to={`/portal/library/${saint.slug}`}>Preview</Link></Button>
                      <Button asChild size="sm" variant="ghost"><Link to="/super-admin/catholic-content/saints">Edit Feast Date</Link></Button>
                    </div>
                  </TableCell>
                </TableRow>
              )) : <TableRow><TableCell colSpan={5}>No feast days match this view.</TableCell></TableRow>}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </main>
  );
}

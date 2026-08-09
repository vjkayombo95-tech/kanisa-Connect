import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Eye, Pencil, Plus, Search, Trash2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import {
  createEmptyReadingDraft,
  deleteDailyReadingDraft,
  fetchDailyReadingDrafts,
  saveDailyReadingDraft,
  type ReadingDraft,
} from "@/lib/super-admin/daily-readings-service";

export default function SuperAdminDailyReadingsPage() {
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<ReadingDraft | null>(null);
  const [preview, setPreview] = useState<ReadingDraft | null>(null);
  const queryClient = useQueryClient();

  const { data: items = [] } = useQuery({
    queryKey: ["super-admin-daily-readings-drafts"],
    queryFn: fetchDailyReadingDrafts,
  });

  const saveMutation = useMutation({
    mutationFn: saveDailyReadingDraft,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["super-admin-daily-readings-drafts"] });
      setEditing(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteDailyReadingDraft,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["super-admin-daily-readings-drafts"] }),
  });

  const filtered = items.filter((item) =>
    [item.date, item.season, item.firstReading, item.psalm, item.secondReading, item.gospel, item.reflection, item.prayer]
      .join(" ")
      .toLowerCase()
      .includes(search.toLowerCase()),
  );

  return (
    <main className="space-y-6 p-4 lg:p-6">
      <section className="flex flex-col gap-4 rounded-[28px] border border-border/70 bg-card/85 p-5 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Daily Readings Manager</h1>
          <p className="mt-1 text-sm text-muted-foreground">Create, edit, preview, and stage daily reading content. Persistence is future-ready pending schema.</p>
        </div>
        <Button className="rounded-2xl" onClick={() => setEditing(createEmptyReadingDraft())}><Plus className="mr-2 h-4 w-4" />Create Reading</Button>
      </section>

      <Card className="rounded-[24px] border-border/70 bg-card/85">
        <CardContent className="space-y-4 p-5">
          <div className="relative max-w-xl">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search by date, season, reference, or keyword..." className="pl-10" />
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Reading Date</TableHead>
                <TableHead>Season</TableHead>
                <TableHead>First Reading</TableHead>
                <TableHead>Psalm</TableHead>
                <TableHead>Second Reading</TableHead>
                <TableHead>Gospel</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length ? filtered.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>{item.date}</TableCell>
                  <TableCell>{item.season || <Badge variant="outline">Pending</Badge>}</TableCell>
                  <TableCell>{item.firstReading || "-"}</TableCell>
                  <TableCell>{item.psalm || "-"}</TableCell>
                  <TableCell>{item.secondReading || "-"}</TableCell>
                  <TableCell>{item.gospel || "-"}</TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-2">
                      <Button size="icon" variant="ghost" onClick={() => setPreview(item)}><Eye className="h-4 w-4" /></Button>
                      <Button size="icon" variant="ghost" onClick={() => setEditing(item)}><Pencil className="h-4 w-4" /></Button>
                      <Button size="icon" variant="ghost" onClick={() => deleteMutation.mutate(item.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                    </div>
                  </TableCell>
                </TableRow>
              )) : (
                <TableRow><TableCell colSpan={7}>No daily readings have been staged yet.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={!!editing} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
          <DialogHeader><DialogTitle>{items.some((item) => item.id === editing?.id) ? "Edit Reading" : "Create Reading"}</DialogTitle></DialogHeader>
          {editing ? (
            <div className="grid gap-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div><Label>Date</Label><Input type="date" value={editing.date} onChange={(event) => setEditing({ ...editing, date: event.target.value })} /></div>
                <div><Label>Season</Label><Input value={editing.season} onChange={(event) => setEditing({ ...editing, season: event.target.value })} /></div>
              </div>
              <div><Label>First Reading</Label><Textarea value={editing.firstReading} onChange={(event) => setEditing({ ...editing, firstReading: event.target.value })} /></div>
              <div><Label>Psalm</Label><Textarea value={editing.psalm} onChange={(event) => setEditing({ ...editing, psalm: event.target.value })} /></div>
              <div><Label>Second Reading</Label><Textarea value={editing.secondReading} onChange={(event) => setEditing({ ...editing, secondReading: event.target.value })} /></div>
              <div><Label>Gospel</Label><Textarea value={editing.gospel} onChange={(event) => setEditing({ ...editing, gospel: event.target.value })} /></div>
              <div><Label>Reflection</Label><Textarea value={editing.reflection} onChange={(event) => setEditing({ ...editing, reflection: event.target.value })} /></div>
              <div><Label>Prayer</Label><Textarea value={editing.prayer} onChange={(event) => setEditing({ ...editing, prayer: event.target.value })} /></div>
              <Button disabled={saveMutation.isPending} onClick={() => saveMutation.mutate(editing)}>
                {saveMutation.isPending ? "Saving..." : "Save Draft"}
              </Button>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog open={!!preview} onOpenChange={(open) => !open && setPreview(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Reading Preview</DialogTitle></DialogHeader>
          <div className="space-y-3 text-sm">
            <p><strong>Date:</strong> {preview?.date}</p>
            <p><strong>Season:</strong> {preview?.season || "Pending"}</p>
            <p><strong>First Reading:</strong> {preview?.firstReading || "-"}</p>
            <p><strong>Psalm:</strong> {preview?.psalm || "-"}</p>
            <p><strong>Second Reading:</strong> {preview?.secondReading || "-"}</p>
            <p><strong>Gospel:</strong> {preview?.gospel || "-"}</p>
            <p><strong>Reflection:</strong> {preview?.reflection || "-"}</p>
            <p><strong>Prayer:</strong> {preview?.prayer || "-"}</p>
          </div>
        </DialogContent>
      </Dialog>
    </main>
  );
}

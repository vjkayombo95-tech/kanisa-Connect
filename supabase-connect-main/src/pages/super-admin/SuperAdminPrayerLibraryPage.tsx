import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Eye, Pencil, Plus, Search, Trash2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import {
  createEmptyPrayerDraft,
  deletePrayerDraft,
  fetchPrayerDrafts,
  PRAYER_CATEGORIES,
  savePrayerDraft,
  type PrayerDraft,
} from "@/lib/super-admin/prayer-library-service";

export default function SuperAdminPrayerLibraryPage() {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [editing, setEditing] = useState<PrayerDraft | null>(null);
  const [preview, setPreview] = useState<PrayerDraft | null>(null);
  const queryClient = useQueryClient();

  const { data: items = [] } = useQuery({
    queryKey: ["super-admin-prayer-library-drafts"],
    queryFn: fetchPrayerDrafts,
  });

  const saveMutation = useMutation({
    mutationFn: savePrayerDraft,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["super-admin-prayer-library-drafts"] });
      setEditing(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deletePrayerDraft,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["super-admin-prayer-library-drafts"] }),
  });

  const filtered = items.filter((item) => {
    const categoryMatch = category === "all" || item.category === category;
    const searchMatch = [item.title, item.category, item.text].join(" ").toLowerCase().includes(search.toLowerCase());
    return categoryMatch && searchMatch;
  });

  return (
    <main className="space-y-6 p-4 lg:p-6">
      <section className="flex flex-col gap-4 rounded-[28px] border border-border/70 bg-card/85 p-5 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Prayer Library Manager</h1>
          <p className="mt-1 text-sm text-muted-foreground">Prepare global prayers by category. Persistence is future-ready pending schema.</p>
        </div>
        <Button className="rounded-2xl" onClick={() => setEditing(createEmptyPrayerDraft())}><Plus className="mr-2 h-4 w-4" />Create Prayer</Button>
      </section>

      <Card className="rounded-[24px] border-border/70 bg-card/85">
        <CardContent className="space-y-4 p-5">
          <div className="grid gap-3 lg:grid-cols-[1fr_220px]">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search prayers..." className="pl-10" />
            </div>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {PRAYER_CATEGORIES.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-wrap gap-2">
            {PRAYER_CATEGORIES.map((item) => <Badge key={item} variant="outline" className="rounded-full">{item}</Badge>)}
          </div>
          <Table>
            <TableHeader><TableRow><TableHead>Title</TableHead><TableHead>Category</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
            <TableBody>
              {filtered.length ? filtered.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="font-medium">{item.title || "Untitled Prayer"}</TableCell>
                  <TableCell>{item.category}</TableCell>
                  <TableCell><Badge variant={item.isPublished ? "default" : "outline"}>{item.isPublished ? "Published" : "Draft"}</Badge></TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-2">
                      <Button size="icon" variant="ghost" onClick={() => setPreview(item)}><Eye className="h-4 w-4" /></Button>
                      <Button size="icon" variant="ghost" onClick={() => setEditing(item)}><Pencil className="h-4 w-4" /></Button>
                      <Button size="icon" variant="ghost" onClick={() => deleteMutation.mutate(item.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                    </div>
                  </TableCell>
                </TableRow>
              )) : <TableRow><TableCell colSpan={4}>No prayers have been staged yet.</TableCell></TableRow>}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={!!editing} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{items.some((item) => item.id === editing?.id) ? "Edit Prayer" : "Create Prayer"}</DialogTitle></DialogHeader>
          {editing ? (
            <div className="space-y-4">
              <div><Label>Title</Label><Input value={editing.title} onChange={(event) => setEditing({ ...editing, title: event.target.value })} /></div>
              <div>
                <Label>Category</Label>
                <Select value={editing.category} onValueChange={(value) => setEditing({ ...editing, category: value })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{PRAYER_CATEGORIES.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Prayer Text</Label><Textarea value={editing.text} onChange={(event) => setEditing({ ...editing, text: event.target.value })} /></div>
              <Button disabled={saveMutation.isPending} onClick={() => saveMutation.mutate(editing)}>
                {saveMutation.isPending ? "Saving..." : "Save Draft"}
              </Button>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog open={!!preview} onOpenChange={(open) => !open && setPreview(null)}>
        <DialogContent><DialogHeader><DialogTitle>{preview?.title || "Prayer Preview"}</DialogTitle></DialogHeader><p className="whitespace-pre-wrap text-sm text-muted-foreground">{preview?.text || "No prayer text."}</p></DialogContent>
      </Dialog>
    </main>
  );
}

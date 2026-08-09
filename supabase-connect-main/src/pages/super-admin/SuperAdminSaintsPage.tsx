import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Copy, ExternalLink, Eye, Pencil, Search, Trash2 } from "lucide-react";
import { Link } from "react-router-dom";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/use-toast";
import { formatFeastDay, getSaintImageAlt, saintMatchesSearch } from "@/lib/catholic-library";
import { recordCatholicAuditEvent } from "@/lib/super-admin/catholic-audit-service";
import {
  duplicateSaintRecord,
  fetchSaintsForAdmin,
  softDeleteSaint,
  updateSaint,
  type AdminSaint,
  type SaintEditorPayload,
} from "@/lib/super-admin/saints-cms-service";
import { validateSaintImage, type SaintImageValidation } from "@/lib/super-admin/saints-data-quality";

const PAGE_SIZE = 10;

type SaintEditorForm = SaintEditorPayload & {
  tagsText: string;
};

function toNullableText(value: string) {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function toEditorForm(saint: AdminSaint): SaintEditorForm {
  return {
    name: saint.name,
    title: saint.title,
    country: saint.country,
    feast_month: saint.feast_month,
    feast_day: saint.feast_day,
    patron_of: saint.patron_of,
    biography_short: saint.biography_short,
    biography_long: saint.biography_long,
    quote: saint.quote,
    reflection: saint.reflection,
    prayer: saint.prayer,
    tags: saint.tags,
    tagsText: (saint.tags ?? []).join(", "),
    is_featured: saint.is_featured,
    is_active: saint.is_active,
  };
}

function formToPayload(form: SaintEditorForm): SaintEditorPayload {
  return {
    name: form.name.trim(),
    title: toNullableText(form.title ?? ""),
    country: toNullableText(form.country ?? ""),
    feast_month: Number(form.feast_month),
    feast_day: Number(form.feast_day),
    patron_of: toNullableText(form.patron_of ?? ""),
    biography_short: form.biography_short.trim(),
    biography_long: form.biography_long.trim(),
    quote: toNullableText(form.quote ?? ""),
    reflection: form.reflection.trim(),
    prayer: form.prayer.trim(),
    tags: form.tagsText.split(",").map((tag) => tag.trim()).filter(Boolean),
    is_featured: form.is_featured,
    is_active: form.is_active,
  };
}

function PreviewDialog({ saint, onClose }: { saint: AdminSaint | null; onClose: () => void }) {
  return (
    <Dialog open={!!saint} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{saint?.name}</DialogTitle>
          <DialogDescription>{saint?.title || "Saint preview"}</DialogDescription>
        </DialogHeader>
        {saint ? (
          <div className="space-y-5">
            {saint.image_url ? (
              <img src={saint.image_url} alt={getSaintImageAlt(saint)} className="h-56 w-full rounded-2xl object-cover" />
            ) : null}
            <div className="grid gap-3 text-sm sm:grid-cols-2">
              <p><span className="font-medium text-foreground">Feast:</span> {formatFeastDay(saint.feast_month, saint.feast_day)}</p>
              <p><span className="font-medium text-foreground">Country:</span> {saint.country || "-"}</p>
              <p><span className="font-medium text-foreground">Patron of:</span> {saint.patron_of || "-"}</p>
              <p><span className="font-medium text-foreground">Scripture:</span> {saint.scripture_reference || "-"}</p>
            </div>
            <div className="space-y-3 text-sm text-muted-foreground">
              <p>{saint.biography_short}</p>
              <p className="whitespace-pre-wrap">{saint.biography_long}</p>
              {saint.quote ? <blockquote className="rounded-2xl border-l-4 border-primary bg-primary/5 p-4 text-foreground">{saint.quote}</blockquote> : null}
              <div>
                <h3 className="font-semibold text-foreground">Reflection</h3>
                <p className="mt-1 whitespace-pre-wrap">{saint.reflection}</p>
              </div>
              <div>
                <h3 className="font-semibold text-foreground">Prayer</h3>
                <p className="mt-1 whitespace-pre-wrap">{saint.prayer}</p>
              </div>
            </div>
            <Button asChild variant="outline" className="rounded-2xl">
              <Link to={`/portal/library/${saint.slug}`}>
                Open member detail page
                <ExternalLink className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

export default function SuperAdminSaintsPage() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [sort, setSort] = useState("name");
  const [page, setPage] = useState(1);
  const [previewSaint, setPreviewSaint] = useState<AdminSaint | null>(null);
  const [editingSaint, setEditingSaint] = useState<AdminSaint | null>(null);
  const [editorForm, setEditorForm] = useState<SaintEditorForm | null>(null);
  const [imageValidation, setImageValidation] = useState<SaintImageValidation | null>(null);
  const queryClient = useQueryClient();

  const { data: saints = [], isLoading, isError, error } = useQuery({
    queryKey: ["super-admin-saints-manager"],
    queryFn: fetchSaintsForAdmin,
  });

  const editorIsDirty = useMemo(() => {
    if (!editingSaint || !editorForm) return false;
    return JSON.stringify(toEditorForm(editingSaint)) !== JSON.stringify(editorForm);
  }, [editingSaint, editorForm]);

  const closeEditor = () => {
    if (editorIsDirty && !window.confirm("Discard unsaved saint changes?")) return;
    setEditingSaint(null);
    setEditorForm(null);
    setImageValidation(null);
  };

  const openEditor = (saint: AdminSaint) => {
    setEditingSaint(saint);
    setEditorForm(toEditorForm(saint));
  };

  useEffect(() => {
    let cancelled = false;
    if (!editingSaint) return undefined;

    setImageValidation({ status: "warning", message: "Checking image..." });
    validateSaintImage(editingSaint).then((result) => {
      if (!cancelled) setImageValidation(result);
    });

    return () => {
      cancelled = true;
    };
  }, [editingSaint]);

  const saveSaint = useMutation({
    mutationFn: async () => {
      if (!editingSaint || !editorForm) return;
      const payload = formToPayload(editorForm);
      await updateSaint(editingSaint.id, payload);
      await recordCatholicAuditEvent({
        action: editingSaint.is_active === false && payload.is_active === true ? "saint_restored" : "saint_updated",
        recordId: editingSaint.id,
        description: `${editingSaint.name} was updated in the Catholic CMS.`,
        metadata: { slug: editingSaint.slug, is_active: payload.is_active, is_featured: payload.is_featured },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["super-admin-saints-manager"] });
      queryClient.invalidateQueries({ queryKey: ["super-admin-catholic-dashboard"] });
      toast({ title: "Saint saved", description: "The saint record has been updated." });
      setEditingSaint(null);
      setEditorForm(null);
    },
    onError: (err) => toast({ title: "Save failed", description: (err as Error).message, variant: "destructive" }),
  });

  const archiveSaint = useMutation({
    mutationFn: async (saint: AdminSaint) => {
      const confirmed = window.confirm(`Archive ${saint.name}? This will hide the saint from member pages without deleting the record.`);
      if (!confirmed) return;
      await softDeleteSaint(saint.id);
      await recordCatholicAuditEvent({
        action: "saint_soft_deleted",
        recordId: saint.id,
        description: `${saint.name} was archived in the Catholic CMS.`,
        metadata: { slug: saint.slug },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["super-admin-saints-manager"] });
      queryClient.invalidateQueries({ queryKey: ["super-admin-catholic-dashboard"] });
      toast({ title: "Saint archived", description: "The saint is now inactive." });
    },
    onError: (err) => toast({ title: "Archive failed", description: (err as Error).message, variant: "destructive" }),
  });

  const duplicateSaint = useMutation({
    mutationFn: async (saint: AdminSaint) => {
      const created = await duplicateSaintRecord(saint);
      await recordCatholicAuditEvent({
        action: "saint_created",
        recordId: created.id,
        description: `${saint.name} was duplicated as ${created.slug}.`,
        metadata: { source_id: saint.id, source_slug: saint.slug, copied_slug: created.slug },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["super-admin-saints-manager"] });
      queryClient.invalidateQueries({ queryKey: ["super-admin-catholic-dashboard"] });
      toast({ title: "Saint duplicated", description: "A draft copy was created with publishing disabled." });
    },
    onError: (err) => toast({ title: "Duplicate failed", description: (err as Error).message, variant: "destructive" }),
  });

  const filteredSaints = useMemo(() => {
    const filtered = saints.filter((saint) => {
      const statusMatch =
        status === "all" ||
        (status === "published" && saint.is_active) ||
        (status === "draft" && !saint.is_active) ||
        (status === "featured" && saint.is_featured);
      return statusMatch && saintMatchesSearch(saint, search);
    });

    return [...filtered].sort((a, b) => {
      if (sort === "feast") return a.feast_month - b.feast_month || a.feast_day - b.feast_day || a.name.localeCompare(b.name);
      if (sort === "country") return (a.country ?? "").localeCompare(b.country ?? "") || a.name.localeCompare(b.name);
      if (sort === "updated") return String(b.updated_at ?? "").localeCompare(String(a.updated_at ?? ""));
      return a.name.localeCompare(b.name);
    });
  }, [saints, search, sort, status]);

  const totalPages = Math.max(1, Math.ceil(filteredSaints.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageRows = filteredSaints.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  return (
    <main className="space-y-6 p-4 lg:p-6">
      <section className="flex flex-col gap-4 rounded-[28px] border border-border/70 bg-card/85 p-5 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Saints Manager</h1>
          <p className="mt-1 text-sm text-muted-foreground">Search, sort, edit, duplicate, publish, and archive saint records from Supabase.</p>
        </div>
        <Button asChild className="rounded-2xl">
          <Link to="/super-admin/catholic-content/saints/cms">
            Open Importer
            <ExternalLink className="ml-2 h-4 w-4" />
          </Link>
        </Button>
      </section>

      <Card className="rounded-[24px] border-border/70 bg-card/85">
        <CardContent className="space-y-4 p-5">
          <div className="grid gap-3 lg:grid-cols-[1fr_180px_180px]">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} placeholder="Search saints..." className="pl-10" />
            </div>
            <Select value={status} onValueChange={(value) => { setStatus(value); setPage(1); }}>
              <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="published">Published</SelectItem>
                <SelectItem value="draft">Inactive</SelectItem>
                <SelectItem value="featured">Featured</SelectItem>
              </SelectContent>
            </Select>
            <Select value={sort} onValueChange={setSort}>
              <SelectTrigger><SelectValue placeholder="Sort" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="name">Name</SelectItem>
                <SelectItem value="feast">Feast Day</SelectItem>
                <SelectItem value="country">Country</SelectItem>
                <SelectItem value="updated">Latest Updated</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {isError ? <p className="text-sm text-destructive">{(error as Error).message}</p> : null}

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Image</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Title</TableHead>
                <TableHead>Feast Day</TableHead>
                <TableHead>Country</TableHead>
                <TableHead>Featured</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, index) => (
                  <TableRow key={index}>
                    <TableCell colSpan={8}><Skeleton className="h-12 rounded-xl" /></TableCell>
                  </TableRow>
                ))
              ) : pageRows.length ? (
                pageRows.map((saint) => (
                  <TableRow key={saint.id}>
                    <TableCell>
                      {saint.image_url ? (
                        <img src={saint.image_url} alt={getSaintImageAlt(saint)} className="h-12 w-12 rounded-xl object-cover" loading="lazy" />
                      ) : (
                        <div className="h-12 w-12 rounded-xl bg-primary/10" />
                      )}
                    </TableCell>
                    <TableCell className="font-medium">{saint.name}</TableCell>
                    <TableCell>{saint.title || "-"}</TableCell>
                    <TableCell>{formatFeastDay(saint.feast_month, saint.feast_day)}</TableCell>
                    <TableCell>{saint.country || "-"}</TableCell>
                    <TableCell><Badge variant={saint.is_featured ? "default" : "outline"}>{saint.is_featured ? "Yes" : "No"}</Badge></TableCell>
                    <TableCell><Badge variant={saint.is_active ? "default" : "outline"}>{saint.is_active ? "Published" : "Inactive"}</Badge></TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-2">
                        <Button size="icon" variant="ghost" onClick={() => setPreviewSaint(saint)} aria-label={`View ${saint.name}`}><Eye className="h-4 w-4" /></Button>
                        <Button size="icon" variant="ghost" onClick={() => openEditor(saint)} aria-label={`Edit ${saint.name}`}><Pencil className="h-4 w-4" /></Button>
                        <Button size="icon" variant="ghost" disabled={duplicateSaint.isPending} onClick={() => duplicateSaint.mutate(saint)} aria-label={`Duplicate ${saint.name}`}><Copy className="h-4 w-4" /></Button>
                        <Button size="icon" variant="ghost" disabled={archiveSaint.isPending || !saint.is_active} onClick={() => archiveSaint.mutate(saint)} aria-label={`Archive ${saint.name}`}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow><TableCell colSpan={8}>No saints match your filters.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>

          <div className="flex items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground">{filteredSaints.length} result{filteredSaints.length === 1 ? "" : "s"}</p>
            <div className="flex items-center gap-2">
              <Button variant="outline" disabled={safePage === 1} onClick={() => setPage((current) => Math.max(1, current - 1))}>Previous</Button>
              <span className="text-sm text-muted-foreground">Page {safePage} of {totalPages}</span>
              <Button variant="outline" disabled={safePage === totalPages} onClick={() => setPage((current) => Math.min(totalPages, current + 1))}>Next</Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <PreviewDialog saint={previewSaint} onClose={() => setPreviewSaint(null)} />

      <Dialog open={!!editingSaint} onOpenChange={(open) => !open && closeEditor()}>
        <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Saint</DialogTitle>
            <DialogDescription>Changes are saved directly to public.saints.</DialogDescription>
          </DialogHeader>
          {editorForm ? (
            <div className="grid gap-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div><Label>Name</Label><Input value={editorForm.name} onChange={(event) => setEditorForm({ ...editorForm, name: event.target.value })} /></div>
                <div><Label>Title</Label><Input value={editorForm.title ?? ""} onChange={(event) => setEditorForm({ ...editorForm, title: event.target.value })} /></div>
                <div><Label>Country</Label><Input value={editorForm.country ?? ""} onChange={(event) => setEditorForm({ ...editorForm, country: event.target.value })} /></div>
                <div><Label>Patron Of</Label><Input value={editorForm.patron_of ?? ""} onChange={(event) => setEditorForm({ ...editorForm, patron_of: event.target.value })} /></div>
                <div><Label>Feast Month</Label><Input type="number" min={1} max={12} value={editorForm.feast_month} onChange={(event) => setEditorForm({ ...editorForm, feast_month: Number(event.target.value) })} /></div>
                <div><Label>Feast Day</Label><Input type="number" min={1} max={31} value={editorForm.feast_day} onChange={(event) => setEditorForm({ ...editorForm, feast_day: Number(event.target.value) })} /></div>
              </div>
              <div><Label>Short Biography</Label><Textarea value={editorForm.biography_short} onChange={(event) => setEditorForm({ ...editorForm, biography_short: event.target.value })} /></div>
              <div><Label>Long Biography</Label><Textarea className="min-h-36" value={editorForm.biography_long} onChange={(event) => setEditorForm({ ...editorForm, biography_long: event.target.value })} /></div>
              <div><Label>Quote</Label><Textarea value={editorForm.quote ?? ""} onChange={(event) => setEditorForm({ ...editorForm, quote: event.target.value })} /></div>
              <div><Label>Reflection</Label><Textarea value={editorForm.reflection} onChange={(event) => setEditorForm({ ...editorForm, reflection: event.target.value })} /></div>
              <div><Label>Prayer</Label><Textarea value={editorForm.prayer} onChange={(event) => setEditorForm({ ...editorForm, prayer: event.target.value })} /></div>
              <div><Label>Tags</Label><Input value={editorForm.tagsText} onChange={(event) => setEditorForm({ ...editorForm, tagsText: event.target.value })} placeholder="apostle, martyr, rome" /></div>
              <div className="rounded-2xl border border-border/70 bg-background/45 p-4">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="font-medium">Image validation</p>
                    <p className="text-sm text-muted-foreground">{imageValidation?.message ?? "Image has not been checked yet."}</p>
                  </div>
                  <Badge
                    variant={imageValidation?.status === "ok" ? "default" : imageValidation?.status === "broken" ? "destructive" : "outline"}
                    className="w-fit"
                  >
                    {imageValidation?.status ?? "pending"}
                  </Badge>
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="flex items-center justify-between rounded-2xl border border-border/70 p-4">
                  <span><span className="block font-medium">Featured</span><span className="text-sm text-muted-foreground">Highlight in member experiences</span></span>
                  <Switch checked={editorForm.is_featured} onCheckedChange={(checked) => setEditorForm({ ...editorForm, is_featured: checked })} />
                </label>
                <label className="flex items-center justify-between rounded-2xl border border-border/70 p-4">
                  <span><span className="block font-medium">Active</span><span className="text-sm text-muted-foreground">Publish to member pages</span></span>
                  <Switch checked={editorForm.is_active} onCheckedChange={(checked) => setEditorForm({ ...editorForm, is_active: checked })} />
                </label>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={closeEditor}>Cancel</Button>
                <Button disabled={saveSaint.isPending || !editorForm.name.trim()} onClick={() => saveSaint.mutate()}>
                  {saveSaint.isPending ? "Saving..." : "Save Saint"}
                </Button>
              </DialogFooter>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </main>
  );
}

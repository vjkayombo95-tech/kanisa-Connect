import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Archive, BookHeart, Copy, Edit3, Eye, Plus, Search, Trash2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { fetchCatholicCmsReferenceData } from "@/lib/super-admin/prayer-library-service";
import { archiveChurchPrayer, createChurchPrayer, deleteChurchPrayer, listAdminPrayers, prayerLibraryKeys, prayerToAdminInput, updateChurchPrayer, validatePrayerPublish, type AdminPrayerFilters } from "@/lib/prayer-library";
import type { PrayerAdminInput, PrayerDetail, PrayerStatus, PrayerType } from "@/types/prayer-library";

const PAGE_SIZE = 20;
const STATUSES: PrayerStatus[] = ["draft", "review", "published", "featured", "archived"];
const TYPES: PrayerType[] = ["single", "collection", "section", "litany", "rosary", "stations_of_cross", "mass_collection"];

function slugify(value: string) {
  return value.trim().toLocaleLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-2"><Label>{label}</Label>{children}</div>;
}

export default function PrayerLibraryPage() {
  const { churchId, isSuperAdmin } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState<AdminPrayerFilters>({ source: "all" });
  const [editing, setEditing] = useState<PrayerDetail | null | undefined>(undefined);
  const [draft, setDraft] = useState<PrayerAdminInput>(prayerToAdminInput());
  const [viewOnly, setViewOnly] = useState(false);
  const [deleting, setDeleting] = useState<PrayerDetail | null>(null);

  const reference = useQuery({ queryKey: ["prayer-library", "reference"], queryFn: fetchCatholicCmsReferenceData, staleTime: 5 * 60_000 });
  const prayers = useQuery({ queryKey: prayerLibraryKeys.admin(churchId ?? "", page, filters), queryFn: () => listAdminPrayers(churchId!, page, PAGE_SIZE, filters), enabled: !!churchId });
  const allForStats = useQuery({ queryKey: ["prayer-library", "admin-stats", churchId], queryFn: () => listAdminPrayers(churchId!, 1, 1000, { source: "all" }), enabled: !!churchId, staleTime: 30_000 });

  const invalidate = async () => {
    await queryClient.invalidateQueries({ queryKey: prayerLibraryKeys.all });
    await queryClient.invalidateQueries({ queryKey: ["prayer-library", "admin-stats", churchId] });
  };
  const save = useMutation({
    mutationFn: () => editing ? updateChurchPrayer(editing.id, churchId!, draft) : createChurchPrayer(churchId!, draft),
    onSuccess: async () => { await invalidate(); setEditing(undefined); toast({ title: editing ? "Prayer updated" : "Prayer created" }); },
    onError: (error: Error) => toast({ title: "Unable to save prayer", description: error.message, variant: "destructive" }),
  });
  const lifecycle = useMutation({ mutationFn: ({ prayer, status }: { prayer: PrayerDetail; status: PrayerStatus }) => updateChurchPrayer(prayer.id, churchId!, { ...prayerToAdminInput(prayer), status, featured: status === "featured" }), onSuccess: invalidate, onError: (error: Error) => toast({ title: "Unable to update status", description: error.message, variant: "destructive" }) });
  const archive = useMutation({ mutationFn: (prayer: PrayerDetail) => archiveChurchPrayer(prayer.id, churchId!), onSuccess: invalidate, onError: (error: Error) => toast({ title: "Unable to archive", description: error.message, variant: "destructive" }) });
  const remove = useMutation({ mutationFn: (prayer: PrayerDetail) => deleteChurchPrayer(prayer.id, churchId!), onSuccess: async () => { await invalidate(); setDeleting(null); toast({ title: "Prayer deleted" }); }, onError: (error: Error) => toast({ title: "Unable to delete", description: error.message, variant: "destructive" }) });

  const rows = prayers.data?.rows ?? [];
  const stats = useMemo(() => allForStats.data?.rows ?? [], [allForStats.data?.rows]);
  const categoryCount = new Set(stats.map((item) => item.category_id).filter(Boolean)).size;
  const totalPages = Math.max(1, Math.ceil((prayers.data?.count ?? 0) / PAGE_SIZE));
  const collections = useMemo(() => stats.filter((item) => ["collection", "rosary", "stations_of_cross", "mass_collection"].includes(item.prayer_type)), [stats]);

  const openEditor = (prayer?: PrayerDetail, readOnly = false) => {
    setEditing(prayer ?? null); setDraft(prayerToAdminInput(prayer)); setViewOnly(readOnly); setDeleting(null);
  };
  const duplicate = (prayer: PrayerDetail) => {
    setEditing(null); setViewOnly(false); setDraft({ ...prayerToAdminInput(prayer), title: `${prayer.title} (Copy)`, slug: `${prayer.slug}-copy-${Date.now().toString().slice(-5)}`, status: "draft", featured: false });
  };

  if (!churchId) return <Card><CardContent className="py-12 text-center text-muted-foreground">Select a church workspace to manage its prayer library.</CardContent></Card>;

  return (
    <main className="space-y-6 p-4 lg:p-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"><div><h1 className="flex items-center gap-2 text-2xl font-bold"><BookHeart className="h-6 w-6 text-primary" />Prayer Library</h1><p className="mt-1 text-sm text-muted-foreground">Create and review prayers owned by this church. Global prayers are read-only here.</p></div><div className="flex gap-2">{isSuperAdmin ? <Button asChild variant="outline"><a href="/super-admin/catholic-content/prayer-library">Global CMS</a></Button> : null}<Button onClick={() => openEditor()}><Plus className="mr-2 h-4 w-4" />New prayer</Button></div></header>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label="Prayer summary">
        {[{ label: "Total prayers", value: stats.length }, { label: "Published", value: stats.filter((item) => ["published", "featured"].includes(item.status)).length }, { label: "Drafts", value: stats.filter((item) => item.status === "draft").length }, { label: "Categories", value: categoryCount }].map((item) => <Card key={item.label}><CardContent className="p-5"><p className="text-sm text-muted-foreground">{item.label}</p><p className="mt-2 text-3xl font-bold">{item.value}</p></CardContent></Card>)}
      </section>

      <Card><CardHeader><CardTitle className="text-lg">Filters</CardTitle></CardHeader><CardContent className="grid gap-3 md:grid-cols-5"><label className="relative md:col-span-2"><span className="sr-only">Search prayers</span><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input className="pl-9" value={filters.search ?? ""} onChange={(event) => { setPage(1); setFilters({ ...filters, search: event.target.value }); }} placeholder="Search title or summary" /></label>
        <select aria-label="Category" className="h-10 rounded-md border bg-background px-3 text-sm" value={filters.categoryId ?? ""} onChange={(event) => { setPage(1); setFilters({ ...filters, categoryId: event.target.value || undefined }); }}><option value="">All categories</option>{reference.data?.categories.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select>
        <select aria-label="Status" className="h-10 rounded-md border bg-background px-3 text-sm" value={filters.status ?? ""} onChange={(event) => { setPage(1); setFilters({ ...filters, status: (event.target.value || undefined) as PrayerStatus | undefined }); }}><option value="">All statuses</option>{STATUSES.map((status) => <option key={status} value={status}>{status}</option>)}</select>
        <select aria-label="Source" className="h-10 rounded-md border bg-background px-3 text-sm" value={filters.source ?? "all"} onChange={(event) => { setPage(1); setFilters({ ...filters, source: event.target.value as AdminPrayerFilters["source"] }); }}><option value="all">Global + church</option><option value="church">Church only</option><option value="global">Global only</option></select>
      </CardContent></Card>

      <Card><CardContent className="p-0">{prayers.isLoading ? <div className="space-y-2 p-5">{Array.from({ length: 6 }).map((_, index) => <Skeleton key={index} className="h-12" />)}</div> : prayers.isError ? <p className="p-8 text-center text-destructive">Unable to load prayers.</p> : rows.length === 0 ? <p className="p-12 text-center text-muted-foreground">No prayers match these filters.</p> : <div className="overflow-x-auto"><table className="w-full text-sm"><thead className="border-b bg-muted/40 text-left"><tr><th className="p-4">Title</th><th className="p-4">Category</th><th className="p-4">Type</th><th className="p-4">Language</th><th className="p-4">Status</th><th className="p-4">Updated</th><th className="p-4">Actions</th></tr></thead><tbody>{rows.map((prayer) => { const editable = !prayer.is_global && prayer.church_id === churchId; return <tr key={prayer.id} className="border-b last:border-0"><td className="p-4"><span className="font-medium">{prayer.title}</span><span className="mt-1 block text-xs text-muted-foreground">{prayer.is_global ? "Global" : "Church"}</span></td><td className="p-4">{prayer.category?.name ?? "—"}</td><td className="p-4">{prayer.prayer_type.replace(/_/g, " ")}</td><td className="p-4">{prayer.language?.code ?? "—"}</td><td className="p-4"><Badge variant={prayer.status === "published" || prayer.status === "featured" ? "default" : "secondary"}>{prayer.status}</Badge></td><td className="p-4 whitespace-nowrap">{new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(new Date(prayer.updated_at))}</td><td className="p-4"><div className="flex flex-wrap gap-1"><Button size="icon" variant="ghost" aria-label={`View ${prayer.title}`} onClick={() => openEditor(prayer, true)}><Eye className="h-4 w-4" /></Button>{editable ? <><Button size="icon" variant="ghost" aria-label={`Edit ${prayer.title}`} onClick={() => openEditor(prayer)}><Edit3 className="h-4 w-4" /></Button><Button size="icon" variant="ghost" aria-label={`Duplicate ${prayer.title}`} onClick={() => duplicate(prayer)}><Copy className="h-4 w-4" /></Button>{["published", "featured"].includes(prayer.status) ? <Button size="sm" variant="ghost" onClick={() => lifecycle.mutate({ prayer, status: "draft" })}>Unpublish</Button> : <Button size="sm" variant="ghost" onClick={() => lifecycle.mutate({ prayer, status: "published" })}>Publish</Button>}<Button size="icon" variant="ghost" aria-label={`Archive ${prayer.title}`} onClick={() => archive.mutate(prayer)}><Archive className="h-4 w-4" /></Button><Button size="icon" variant="ghost" className="text-destructive" aria-label={`Delete ${prayer.title}`} onClick={() => setDeleting(prayer)}><Trash2 className="h-4 w-4" /></Button></> : null}</div></td></tr>; })}</tbody></table></div>}
        <div className="flex items-center justify-between border-t p-4"><span className="text-sm text-muted-foreground">Page {page} of {totalPages}</span><div className="flex gap-2"><Button variant="outline" disabled={page <= 1} onClick={() => setPage((value) => value - 1)}>Previous</Button><Button variant="outline" disabled={page >= totalPages} onClick={() => setPage((value) => value + 1)}>Next</Button></div></div>
      </CardContent></Card>

      <Dialog open={editing !== undefined} onOpenChange={(open) => { if (!open) setEditing(undefined); }}><DialogContent className="max-h-[92vh] max-w-4xl overflow-y-auto"><DialogHeader><DialogTitle>{viewOnly ? "View prayer" : editing ? "Edit prayer" : "Create prayer"}</DialogTitle></DialogHeader><div className="grid gap-4 sm:grid-cols-2">
        <Field label="Title *"><Input disabled={viewOnly} value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value, slug: editing ? draft.slug : slugify(event.target.value) })} /></Field><Field label="Slug *"><Input disabled={viewOnly} value={draft.slug} onChange={(event) => setDraft({ ...draft, slug: slugify(event.target.value) })} /></Field>
        <Field label="Category *"><select disabled={viewOnly} className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={draft.category_id} onChange={(event) => setDraft({ ...draft, category_id: event.target.value })}><option value="">Select category</option>{reference.data?.categories.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></Field><Field label="Language *"><select disabled={viewOnly} className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={draft.language_id} onChange={(event) => setDraft({ ...draft, language_id: event.target.value })}><option value="">Select language</option>{reference.data?.languages.map((item) => <option key={item.id} value={item.id}>{item.native_name || item.name}</option>)}</select></Field>
        <Field label="Parent collection"><select disabled={viewOnly} className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={draft.parent_prayer_id ?? ""} onChange={(event) => setDraft({ ...draft, parent_prayer_id: event.target.value || null })}><option value="">No parent</option>{collections.filter((item) => item.id !== editing?.id).map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}</select></Field><Field label="Prayer type"><select disabled={viewOnly} className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={draft.prayer_type} onChange={(event) => setDraft({ ...draft, prayer_type: event.target.value as PrayerType })}>{TYPES.map((type) => <option key={type} value={type}>{type.replace(/_/g, " ")}</option>)}</select></Field>
        <div className="sm:col-span-2"><Field label="Summary"><Textarea disabled={viewOnly} value={draft.summary} onChange={(event) => setDraft({ ...draft, summary: event.target.value })} /></Field></div><div className="sm:col-span-2"><Field label="Prayer body"><Textarea disabled={viewOnly} className="min-h-56 font-serif leading-7" value={draft.body} onChange={(event) => setDraft({ ...draft, body: event.target.value })} placeholder="Paste reviewed prayer text here. Plain text and paragraph breaks are preserved safely." /></Field></div>
        <Field label="Status"><select disabled={viewOnly} className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={draft.status} onChange={(event) => setDraft({ ...draft, status: event.target.value as PrayerStatus })}>{STATUSES.map((status) => <option key={status} value={status}>{status}</option>)}</select></Field><Field label="Sort order"><Input disabled={viewOnly} type="number" value={draft.sort_order} onChange={(event) => setDraft({ ...draft, sort_order: Number(event.target.value) })} /></Field>
        <Field label="Recommended time"><Input disabled={viewOnly} value={draft.recommended_time} onChange={(event) => setDraft({ ...draft, recommended_time: event.target.value })} /></Field><Field label="Scripture reference"><Input disabled={viewOnly} value={draft.scripture_reference} onChange={(event) => setDraft({ ...draft, scripture_reference: event.target.value })} /></Field><Field label="Liturgical season"><Input disabled={viewOnly} value={draft.liturgical_season} onChange={(event) => setDraft({ ...draft, liturgical_season: event.target.value })} /></Field><Field label="Audio URL"><Input disabled={viewOnly} type="url" value={draft.audio_url} onChange={(event) => setDraft({ ...draft, audio_url: event.target.value })} /></Field>
        <section className="space-y-4 rounded-2xl border p-4 sm:col-span-2" aria-labelledby="church-provenance-heading"><h3 id="church-provenance-heading" className="font-semibold">Chanzo na Uidhinishaji</h3><div className="grid gap-4 sm:grid-cols-2">
          <Field label="Source Type"><select disabled={viewOnly} className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={draft.source_type} onChange={(event) => setDraft({ ...draft, source_type: event.target.value as PrayerAdminInput["source_type"] })}><option value="">Chagua aina</option>{["roman_missal","catechism","bishops_conference","diocesan_publication","parish_publication","approved_prayer_book","scripture","public_domain","original_parish_content","user_submitted","other"].map((value) => <option key={value} value={value}>{value.replace(/_/g, " ")}</option>)}</select></Field>
          <Field label="Source Title"><Input disabled={viewOnly} value={draft.source_title} onChange={(event) => setDraft({ ...draft, source_title: event.target.value })} /></Field>
          <Field label="Source Organization"><Input disabled={viewOnly} value={draft.source_organization} onChange={(event) => setDraft({ ...draft, source_organization: event.target.value })} /></Field><Field label="Source Reference"><Input disabled={viewOnly} value={draft.source_reference} onChange={(event) => setDraft({ ...draft, source_reference: event.target.value })} /></Field>
          <Field label="Source URL"><Input disabled={viewOnly} type="url" value={draft.source_url} onChange={(event) => setDraft({ ...draft, source_url: event.target.value })} /></Field><Field label="Copyright Holder"><Input disabled={viewOnly} value={draft.copyright_holder} onChange={(event) => setDraft({ ...draft, copyright_holder: event.target.value })} /></Field>
          <div className="sm:col-span-2"><Field label="Source Notes"><Textarea disabled={viewOnly} value={draft.source_notes} onChange={(event) => setDraft({ ...draft, source_notes: event.target.value })} /></Field></div><div className="sm:col-span-2"><Field label="Copyright Notice"><Textarea disabled={viewOnly} value={draft.copyright_notice} onChange={(event) => setDraft({ ...draft, copyright_notice: event.target.value })} /></Field></div>
          <Field label="License Type"><select disabled={viewOnly} className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={draft.license_type} onChange={(event) => setDraft({ ...draft, license_type: event.target.value as PrayerAdminInput["license_type"] })}><option value="">Chagua leseni</option>{["public_domain","permission_granted","licensed","attribution_required","internal_church_use","copyright_restricted","unknown"].map((value) => <option key={value} value={value}>{value.replace(/_/g, " ")}</option>)}</select></Field><Field label="License Reference"><Input disabled={viewOnly} value={draft.license_reference} onChange={(event) => setDraft({ ...draft, license_reference: event.target.value })} /></Field>
          <Field label="Content Edition"><Input disabled={viewOnly} value={draft.content_edition} onChange={(event) => setDraft({ ...draft, content_edition: event.target.value })} /></Field><Field label="Content Version"><Input disabled={viewOnly} value={draft.content_version_label} onChange={(event) => setDraft({ ...draft, content_version_label: event.target.value })} /></Field>
          <Field label="Reviewed By"><Input disabled={viewOnly} value={draft.reviewed_by} onChange={(event) => setDraft({ ...draft, reviewed_by: event.target.value })} /></Field><Field label="Review Date"><Input disabled={viewOnly} type="date" value={draft.reviewed_at} onChange={(event) => setDraft({ ...draft, reviewed_at: event.target.value })} /></Field>
          <Field label="Ecclesial Approval Status"><select disabled={viewOnly} className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={draft.ecclesial_approval_status} onChange={(event) => setDraft({ ...draft, ecclesial_approval_status: event.target.value as PrayerAdminInput["ecclesial_approval_status"] })}>{["pending","under_review","approved","rejected","revision_required"].map((value) => <option key={value} value={value}>{value.replace(/_/g, " ")}</option>)}</select></Field><Field label="Ecclesial Approval Authority"><Input disabled={viewOnly} value={draft.ecclesial_approval_authority} onChange={(event) => setDraft({ ...draft, ecclesial_approval_authority: event.target.value })} /></Field><div className="sm:col-span-2"><Field label="Ecclesial Approval Reference"><Input disabled={viewOnly} value={draft.ecclesial_approval_reference} onChange={(event) => setDraft({ ...draft, ecclesial_approval_reference: event.target.value })} /></Field></div>
        </div></section>
        {editing ? <section className="rounded-2xl border p-4 sm:col-span-2" aria-labelledby="church-translations-heading"><h3 id="church-translations-heading" className="font-semibold">Translations</h3><p className="mt-2 text-sm">Translation Key: {editing.translation_key || "Not assigned"}</p><p className="mt-1 text-sm text-muted-foreground">Available: {stats.filter((item) => item.translation_group_id === editing.translation_group_id).map((item) => item.language?.code).filter(Boolean).join(", ") || "none"}</p><p className="mt-1 text-sm text-muted-foreground">Missing: {["sw","en","la"].filter((code) => !stats.some((item) => item.translation_group_id === editing.translation_group_id && item.language?.code === code)).join(", ") || "none"}. Global translation attachment is managed by super-admin.</p><div className="mt-3 flex flex-wrap gap-2">{stats.filter((item) => item.translation_group_id === editing.translation_group_id && item.id !== editing.id).map((item) => <Button key={item.id} type="button" size="sm" variant="outline" onClick={() => openEditor(item, item.is_global)}>{item.language?.code || item.title}</Button>)}</div></section> : null}
        <label className="flex min-h-10 items-center gap-3"><Checkbox disabled={viewOnly} checked={draft.featured} onCheckedChange={(checked) => setDraft({ ...draft, featured: checked === true })} /><span className="text-sm font-medium">Featured prayer</span></label>
      </div>{!viewOnly ? <DialogFooter><Button variant="outline" onClick={() => setEditing(undefined)}>Cancel</Button><Button disabled={save.isPending} onClick={() => { const error = validatePrayerPublish(draft); if (error) toast({ title: "Check prayer details", description: error, variant: "destructive" }); else save.mutate(); }}>{save.isPending ? "Saving…" : "Save prayer"}</Button></DialogFooter> : null}</DialogContent></Dialog>

      <Dialog open={!!deleting} onOpenChange={(open) => { if (!open) setDeleting(null); }}><DialogContent><DialogHeader><DialogTitle>Delete prayer?</DialogTitle></DialogHeader><p className="text-sm text-muted-foreground">This permanently deletes “{deleting?.title}” and its reading history. This action cannot be undone.</p><DialogFooter><Button variant="outline" onClick={() => setDeleting(null)}>Cancel</Button><Button variant="destructive" disabled={remove.isPending} onClick={() => deleting && remove.mutate(deleting)}>Delete permanently</Button></DialogFooter></DialogContent></Dialog>
    </main>
  );
}

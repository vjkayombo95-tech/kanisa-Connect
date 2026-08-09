import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Archive, BookOpen, CheckSquare, Eye, FileSpreadsheet, FolderPlus, GitCompare, Languages, Link2, Pencil, Plus, RotateCcw, Search, Send, Tags, Trash2 } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import {
  CMS_CONTENT_STATUSES,
  CMS_VISIBILITIES,
  createContentCategory,
  createContentCollection,
  createEmptyPrayerDraft,
  deletePrayerDraft,
  addPrayerRelationship,
  bulkUpdatePrayerLifecycleStatus,
  fetchCatholicCmsReferenceData,
  fetchPrayerRelationships,
  fetchPrayerDrafts,
  fetchPrayerVersions,
  prayerToEditorDraft,
  removePrayerRelationship,
  restorePrayerVersion,
  savePrayerDraft,
  searchRelationshipTargets,
  updatePrayerLifecycleStatus,
  validatePrayerForEditorialReview,
  validatePrayerForPublication,
  type CatholicPrayerContent,
  type CatholicPrayerRelationship,
  type CatholicPrayerVersion,
  type PrayerEditorDraft,
} from "@/lib/super-admin/prayer-library-service";

const SEASONS = ["", "Advent", "Christmas", "Ordinary Time", "Lent", "Holy Week", "Easter", "Pentecost"];
const RELATIONSHIP_TYPES = ["related_to", "recommended_with", "prayer_for", "associated_with", "seasonal", "scripture_context"];
const RELATIONSHIP_TARGET_TYPES = ["prayer", "saint", "collection", "daily_reading", "liturgical_season", "scripture_reference"];

function statusLabel(status: string) {
  return status.replace(/(^|_)(\w)/g, (_, space, letter) => `${space ? " " : ""}${letter.toUpperCase()}`);
}

function StatCard({ label, value, icon: Icon }: { label: string; value: number | string; icon: typeof BookOpen }) {
  return (
    <Card className="rounded-2xl border-border/70 bg-card/85">
      <CardContent className="flex items-center justify-between gap-4 p-4">
        <div>
          <p className="text-xs uppercase text-muted-foreground">{label}</p>
          <p className="mt-1 text-2xl font-bold">{value}</p>
        </div>
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Icon className="h-5 w-5" aria-hidden="true" />
        </span>
      </CardContent>
    </Card>
  );
}

export default function SuperAdminPrayerLibraryPage() {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [status, setStatus] = useState("all");
  const [language, setLanguage] = useState("all");
  const [collection, setCollection] = useState("all");
  const [tag, setTag] = useState("all");
  const [editing, setEditing] = useState<PrayerEditorDraft | null>(null);
  const [preview, setPreview] = useState<CatholicPrayerContent | null>(null);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [newCollectionTitle, setNewCollectionTitle] = useState("");
  const [versionPreview, setVersionPreview] = useState<CatholicPrayerVersion | null>(null);
  const [relationshipDraft, setRelationshipDraft] = useState({ targetType: "prayer", relationshipType: "related_to", query: "", targetId: "", targetLabel: "" });
  const [selectedPrayerIds, setSelectedPrayerIds] = useState<string[]>([]);
  const [bulkSummary, setBulkSummary] = useState("");
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const referenceQuery = useQuery({
    queryKey: ["catholic-cms-reference-data"],
    queryFn: fetchCatholicCmsReferenceData,
  });

  const prayersQuery = useQuery({
    queryKey: ["super-admin-prayer-library-drafts"],
    queryFn: fetchPrayerDrafts,
  });

  const reference = referenceQuery.data;
  const items = useMemo(() => prayersQuery.data ?? [], [prayersQuery.data]);
  const currentPrayer = useMemo(() => (editing && !editing.id.startsWith("draft-") && !editing.id.startsWith("draft-import-") ? items.find((item) => item.id === editing.id) ?? null : null), [editing, items]);

  const versionsQuery = useQuery({
    queryKey: ["cms-prayer-versions", currentPrayer?.id],
    queryFn: () => fetchPrayerVersions(currentPrayer!.id),
    enabled: !!currentPrayer?.id,
  });

  const relationshipsQuery = useQuery({
    queryKey: ["cms-prayer-relationships", currentPrayer?.id],
    queryFn: () => fetchPrayerRelationships(currentPrayer!.id),
    enabled: !!currentPrayer?.id,
  });

  const relationshipTargetsQuery = useQuery({
    queryKey: ["cms-relationship-targets", relationshipDraft.targetType, relationshipDraft.query],
    queryFn: () => searchRelationshipTargets(relationshipDraft.targetType, relationshipDraft.query),
    enabled: !!currentPrayer?.id && relationshipDraft.query.trim().length >= 2 && ["prayer", "saint", "collection"].includes(relationshipDraft.targetType),
  });

  const saveMutation = useMutation({
    mutationFn: savePrayerDraft,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["super-admin-prayer-library-drafts"] });
      queryClient.invalidateQueries({ queryKey: ["super-admin-catholic-cms-dashboard"] });
      setEditing(null);
      toast({ title: "Prayer saved", description: "The CMS version history has been updated." });
    },
    onError: (error) => toast({ title: "Unable to save prayer", description: (error as Error).message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: deletePrayerDraft,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["super-admin-prayer-library-drafts"] });
      queryClient.invalidateQueries({ queryKey: ["super-admin-catholic-cms-dashboard"] });
      toast({ title: "Prayer archived", description: "The prayer record was removed from the CMS library." });
    },
    onError: (error) => toast({ title: "Unable to delete prayer", description: (error as Error).message, variant: "destructive" }),
  });

  const lifecycleMutation = useMutation({
    mutationFn: ({ prayer, nextStatus }: { prayer: CatholicPrayerContent; nextStatus: PrayerEditorDraft["status"] }) => updatePrayerLifecycleStatus(prayer, nextStatus),
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: ["super-admin-prayer-library-drafts"] });
      queryClient.invalidateQueries({ queryKey: ["super-admin-catholic-cms-dashboard"] });
      toast({ title: "Prayer updated", description: `${updated.title} moved to ${statusLabel(updated.status)}.` });
    },
    onError: (error) => toast({ title: "Unable to update prayer", description: (error as Error).message, variant: "destructive" }),
  });

  const bulkLifecycleMutation = useMutation({
    mutationFn: ({ prayers, nextStatus }: { prayers: CatholicPrayerContent[]; nextStatus: PrayerEditorDraft["status"] }) => bulkUpdatePrayerLifecycleStatus(prayers, nextStatus),
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: ["super-admin-prayer-library-drafts"] });
      queryClient.invalidateQueries({ queryKey: ["super-admin-catholic-cms-dashboard"] });
      setSelectedPrayerIds([]);
      setBulkSummary(`${updated.length} prayer${updated.length === 1 ? "" : "s"} moved through the editorial workflow.`);
      toast({ title: "Bulk action complete", description: `${updated.length} prayer${updated.length === 1 ? "" : "s"} updated.` });
    },
    onError: (error) => toast({ title: "Bulk action blocked", description: (error as Error).message, variant: "destructive" }),
  });

  const createCategoryMutation = useMutation({
    mutationFn: createContentCategory,
    onSuccess: (created) => {
      queryClient.invalidateQueries({ queryKey: ["catholic-cms-reference-data"] });
      setNewCategoryName("");
      toast({ title: "Category ready", description: `${created.name} is available for CMS content.` });
    },
    onError: (error) => toast({ title: "Unable to create category", description: (error as Error).message, variant: "destructive" }),
  });

  const createCollectionMutation = useMutation({
    mutationFn: createContentCollection,
    onSuccess: (created) => {
      queryClient.invalidateQueries({ queryKey: ["catholic-cms-reference-data"] });
      setNewCollectionTitle("");
      toast({ title: "Collection ready", description: `${created.title} can now receive prayers.` });
    },
    onError: (error) => toast({ title: "Unable to create collection", description: (error as Error).message, variant: "destructive" }),
  });

  const restoreMutation = useMutation({
    mutationFn: async (version: CatholicPrayerVersion) => {
      if (!currentPrayer) throw new Error("Open a saved prayer before restoring a version.");
      return restorePrayerVersion(currentPrayer, version);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["super-admin-prayer-library-drafts"] });
      queryClient.invalidateQueries({ queryKey: ["cms-prayer-versions"] });
      setVersionPreview(null);
      toast({ title: "Version restored", description: "A new version was created from the restored content." });
    },
    onError: (error) => toast({ title: "Unable to restore version", description: (error as Error).message, variant: "destructive" }),
  });

  const addRelationshipMutation = useMutation({
    mutationFn: () => {
      if (!currentPrayer) throw new Error("Save the prayer before adding relationships.");
      return addPrayerRelationship({
        sourceId: currentPrayer.id,
        targetType: relationshipDraft.targetType,
        targetId: relationshipDraft.targetId || relationshipDraft.query,
        relationshipType: relationshipDraft.relationshipType,
        targetLabel: relationshipDraft.targetLabel || relationshipDraft.query,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cms-prayer-relationships", currentPrayer?.id] });
      setRelationshipDraft((current) => ({ ...current, query: "", targetId: "", targetLabel: "" }));
      toast({ title: "Relationship added", description: "The prayer relationship is now part of the CMS graph." });
    },
    onError: (error) => toast({ title: "Unable to add relationship", description: (error as Error).message, variant: "destructive" }),
  });

  const removeRelationshipMutation = useMutation({
    mutationFn: removePrayerRelationship,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cms-prayer-relationships", currentPrayer?.id] });
      toast({ title: "Relationship removed", description: "The CMS relationship was removed." });
    },
    onError: (error) => toast({ title: "Unable to remove relationship", description: (error as Error).message, variant: "destructive" }),
  });

  const filtered = useMemo(() => {
    const term = search.toLowerCase();
    return items.filter((item) => {
      const categoryMatch = category === "all" || item.category_id === category;
      const statusMatch = status === "all" || item.status === status;
      const languageMatch = language === "all" || item.language_id === language;
      const collectionMatch = collection === "all" || (item.collections ?? []).some((entry) => entry.id === collection);
      const tagMatch = tag === "all" || (item.tags ?? []).some((entry) => entry.id === tag);
      const searchMatch = [
        item.title,
        item.summary,
        item.body,
        item.author,
        item.source,
        item.scripture_reference,
        item.liturgical_season,
        item.category?.name,
        item.language?.name,
        ...(item.tags ?? []).map((tag) => tag.name),
        ...(item.collections ?? []).map((collection) => collection.title),
      ]
        .join(" ")
        .toLowerCase()
        .includes(term);

      return categoryMatch && statusMatch && languageMatch && collectionMatch && tagMatch && searchMatch;
    });
  }, [category, collection, items, language, search, status, tag]);

  const selectedPrayers = useMemo(() => items.filter((item) => selectedPrayerIds.includes(item.id)), [items, selectedPrayerIds]);
  const allVisibleSelected = filtered.length > 0 && filtered.every((item) => selectedPrayerIds.includes(item.id));
  const publicationSafety = useMemo(() => validatePrayerForPublication(selectedPrayers, reference ?? {}, items), [items, reference, selectedPrayers]);

  const stats = useMemo(() => ({
    published: items.filter((item) => ["published", "featured"].includes(item.status)).length,
    drafts: items.filter((item) => item.status === "draft").length,
    categories: reference?.categories.length ?? 0,
    collections: reference?.collections.length ?? 0,
  }), [items, reference]);

  const openNewPrayer = () => setEditing(createEmptyPrayerDraft(reference));
  const isLoading = referenceQuery.isLoading || prayersQuery.isLoading;
  const error = referenceQuery.error || prayersQuery.error;

  const togglePrayerSelection = (prayerId: string, checked: boolean) => {
    setSelectedPrayerIds((current) => checked ? Array.from(new Set([...current, prayerId])) : current.filter((id) => id !== prayerId));
  };

  const toggleVisibleSelection = (checked: boolean) => {
    setSelectedPrayerIds((current) => {
      const visibleIds = filtered.map((item) => item.id);
      if (!checked) return current.filter((id) => !visibleIds.includes(id));
      return Array.from(new Set([...current, ...visibleIds]));
    });
  };

  const handleBulkLifecycle = (nextStatus: PrayerEditorDraft["status"]) => {
    if (!selectedPrayers.length) return;

    if (nextStatus === "published" || nextStatus === "featured") {
      const summary = [
        `Selected Records: ${publicationSafety.selectedRecords}`,
        `Valid Records: ${publicationSafety.validRecords.length}`,
        `Warnings: ${publicationSafety.warnings.length}`,
        `Blocked Records: ${publicationSafety.blockedRecords.length}`,
      ].join("\n");

      if (!publicationSafety.canPublish) {
        toast({ title: "Publication blocked", description: summary, variant: "destructive" });
        setBulkSummary(summary);
        return;
      }

      if (!window.confirm(`${summary}\n\nPublish selected prayers?`)) return;
    }

    bulkLifecycleMutation.mutate({ prayers: selectedPrayers, nextStatus });
  };

  const handleSingleLifecycle = (prayer: CatholicPrayerContent, nextStatus: PrayerEditorDraft["status"]) => {
    if (nextStatus === "published" || nextStatus === "featured") {
      const safety = validatePrayerForPublication([prayer], reference ?? {}, items);
      const summary = [
        `Selected Records: ${safety.selectedRecords}`,
        `Valid Records: ${safety.validRecords.length}`,
        `Warnings: ${safety.warnings.length}`,
        `Blocked Records: ${safety.blockedRecords.length}`,
      ].join("\n");

      if (!safety.canPublish) {
        toast({ title: "Publication blocked", description: summary, variant: "destructive" });
        return;
      }

      if (!window.confirm(`${summary}\n\nPublish ${prayer.title}?`)) return;
    }

    lifecycleMutation.mutate({ prayer, nextStatus });
  };

  return (
    <main className="space-y-6 p-4 lg:p-6">
      <section className="flex flex-col gap-4 rounded-[28px] border border-border/70 bg-card/85 p-5 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <Badge variant="outline" className="rounded-full">Catholic CMS</Badge>
          <h1 className="mt-3 text-3xl font-bold tracking-tight">Prayer Library</h1>
          <p className="mt-1 text-sm text-muted-foreground">Manage prayers with categories, tags, collections, languages, publishing workflow, and version history.</p>
        </div>
        <Button className="rounded-2xl" onClick={openNewPrayer} disabled={!reference}>
          <Plus className="mr-2 h-4 w-4" aria-hidden="true" />
          Create Prayer
        </Button>
      </section>

      {error ? (
        <Alert variant="destructive">
          <Archive className="h-4 w-4" />
          <AlertTitle>Catholic CMS is not ready</AlertTitle>
          <AlertDescription>{(error as Error).message || "Apply the Catholic CMS migration, then try again."}</AlertDescription>
        </Alert>
      ) : null}

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => <Skeleton key={index} className="h-24 rounded-2xl" />)}
        </div>
      ) : (
        <section className="grid gap-4 md:grid-cols-4">
          <StatCard label="Published" value={stats.published} icon={BookOpen} />
          <StatCard label="Drafts" value={stats.drafts} icon={Archive} />
          <StatCard label="Categories" value={stats.categories} icon={Tags} />
          <StatCard label="Collections" value={stats.collections} icon={FolderPlus} />
        </section>
      )}

      <Card className="rounded-[24px] border-border/70 bg-card/85">
        <CardContent className="space-y-4 p-5">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="flex items-center gap-2 text-xl font-bold">
                <FileSpreadsheet className="h-5 w-5 text-primary" aria-hidden="true" />
                Prayer Library Excel Import
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">Workbook preview remains available here. Database import is intentionally restricted to the staging-only, prayer-code-matched CLI workflow with backup and dry-run evidence.</p>
            </div>
            <Badge variant="outline">Staging CLI Required</Badge>
          </div>
          <Alert>
            <AlertTitle>Controlled content workflow</AlertTitle>
            <AlertDescription className="space-y-2">
              <p>Export and edit <code>.tmp/catholic-prayer-content-import-template.xlsx</code>, then validate it without database writes.</p>
              <p><code>npm run prayer:dry-run</code></p>
              <p>Only an authorized staging operator may run the explicitly confirmed import command after reviewing both dry-run reports.</p>
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
        <Card className="rounded-[24px] border-border/70 bg-card/85">
          <CardContent className="space-y-4 p-5">
            <div className="grid gap-3 lg:grid-cols-[1fr_180px_160px_160px_160px_160px]">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
                <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search title, tag, season, scripture, collection..." className="pl-10" />
              </div>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger><SelectValue placeholder="Category" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {(reference?.categories ?? []).map((item) => <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  {CMS_CONTENT_STATUSES.map((item) => <SelectItem key={item} value={item}>{statusLabel(item)}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={language} onValueChange={setLanguage}>
                <SelectTrigger><SelectValue placeholder="Language" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Languages</SelectItem>
                  {(reference?.languages ?? []).map((item) => <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={collection} onValueChange={setCollection}>
                <SelectTrigger><SelectValue placeholder="Collection" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Collections</SelectItem>
                  {(reference?.collections ?? []).map((item) => <SelectItem key={item.id} value={item.id}>{item.title}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={tag} onValueChange={setTag}>
                <SelectTrigger><SelectValue placeholder="Tag" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Tags</SelectItem>
                  {(reference?.tags ?? []).map((item) => <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border/70 bg-background/45 p-3">
              <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                <CheckSquare className="h-4 w-4 text-primary" aria-hidden="true" />
                <span>{selectedPrayers.length} selected</span>
                {bulkSummary ? <span className="text-primary">{bulkSummary}</span> : null}
              </div>
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="outline" size="sm" disabled={!selectedPrayers.length || bulkLifecycleMutation.isPending} onClick={() => handleBulkLifecycle("review")}>
                  <Send className="mr-2 h-4 w-4" />
                  Submit Selected for Review
                </Button>
                <Button type="button" variant="outline" size="sm" disabled={!selectedPrayers.length || bulkLifecycleMutation.isPending} onClick={() => handleBulkLifecycle("published")}>
                  Publish Selected
                </Button>
                <Button type="button" variant="outline" size="sm" disabled={!selectedPrayers.length || bulkLifecycleMutation.isPending} onClick={() => handleBulkLifecycle("archived")}>
                  Archive Selected
                </Button>
              </div>
            </div>

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">
                    <Checkbox
                      checked={allVisibleSelected}
                      onCheckedChange={(value) => toggleVisibleSelection(value === true)}
                      aria-label="Select visible prayers"
                    />
                  </TableHead>
                  <TableHead>Prayer</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Language</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length ? filtered.map((item) => {
                  const editorialIssues = validatePrayerForEditorialReview(item, reference ?? {}, items);
                  const errorCount = editorialIssues.filter((issue) => issue.severity === "error").length;
                  const warningCount = editorialIssues.filter((issue) => issue.severity === "warning").length;

                  return (
                  <TableRow key={item.id}>
                    <TableCell>
                      <Checkbox
                        checked={selectedPrayerIds.includes(item.id)}
                        onCheckedChange={(value) => togglePrayerSelection(item.id, value === true)}
                        aria-label={`Select ${item.title}`}
                      />
                    </TableCell>
                    <TableCell>
                      <div className="font-medium">{item.title || "Untitled Prayer"}</div>
                      <div className="mt-1 line-clamp-1 text-xs text-muted-foreground">{item.summary || item.scripture_reference || item.source || "No summary yet."}</div>
                      <div className="mt-2 flex flex-wrap gap-1">
                        {(item.tags ?? []).slice(0, 3).map((tag) => <Badge key={tag.id} variant="outline" className="rounded-full">{tag.name}</Badge>)}
                        {errorCount ? <Badge variant="destructive" className="rounded-full">{errorCount} error{errorCount === 1 ? "" : "s"}</Badge> : null}
                        {!errorCount && warningCount ? <Badge variant="outline" className="rounded-full">{warningCount} warning{warningCount === 1 ? "" : "s"}</Badge> : null}
                      </div>
                    </TableCell>
                    <TableCell>{item.category?.name ?? "Uncategorized"}</TableCell>
                    <TableCell>{item.language?.name ?? "Default"}</TableCell>
                    <TableCell>
                      <Badge variant={["published", "featured"].includes(item.status) ? "default" : "outline"} className="rounded-full">
                        {statusLabel(item.status)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-2">
                        <Button aria-label={`Preview ${item.title}`} size="icon" variant="ghost" onClick={() => setPreview(item)}><Eye className="h-4 w-4" /></Button>
                        <Button aria-label={`Submit ${item.title} for review`} size="icon" variant="ghost" onClick={() => handleSingleLifecycle(item, "review")}><Send className="h-4 w-4" /></Button>
                        <Button aria-label={`Publish ${item.title}`} size="icon" variant="ghost" onClick={() => handleSingleLifecycle(item, "published")}><BookOpen className="h-4 w-4" /></Button>
                        <Button aria-label={`Edit ${item.title}`} size="icon" variant="ghost" onClick={() => setEditing(prayerToEditorDraft(item))}><Pencil className="h-4 w-4" /></Button>
                        <Button aria-label={`Archive ${item.title}`} size="icon" variant="ghost" onClick={() => handleSingleLifecycle(item, "archived")}><Archive className="h-4 w-4 text-destructive" /></Button>
                        <Button aria-label={`Delete ${item.title}`} size="icon" variant="ghost" onClick={() => deleteMutation.mutate(item.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                      </div>
                    </TableCell>
                  </TableRow>
                  );
                }) : (
                  <TableRow>
                    <TableCell colSpan={6} className="py-10 text-center text-sm text-muted-foreground">
                      No prayers match these filters. Create a prayer or adjust the search.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <aside className="space-y-4">
          <Card className="rounded-[24px] border-border/70 bg-card/85">
            <CardContent className="space-y-3 p-5">
              <div>
                <h2 className="font-semibold">Add Category</h2>
                <p className="text-xs text-muted-foreground">Categories are reusable across future Catholic CMS content.</p>
              </div>
              <Input value={newCategoryName} onChange={(event) => setNewCategoryName(event.target.value)} placeholder="Example: Exams" />
              <Button className="w-full" variant="outline" disabled={!newCategoryName.trim() || createCategoryMutation.isPending} onClick={() => createCategoryMutation.mutate({ name: newCategoryName })}>
                <FolderPlus className="mr-2 h-4 w-4" />
                Add Category
              </Button>
            </CardContent>
          </Card>

          <Card className="rounded-[24px] border-border/70 bg-card/85">
            <CardContent className="space-y-3 p-5">
              <div>
                <h2 className="font-semibold">Add Collection</h2>
                <p className="text-xs text-muted-foreground">Collections curate prayers for member portal experiences.</p>
              </div>
              <Input value={newCollectionTitle} onChange={(event) => setNewCollectionTitle(event.target.value)} placeholder="Example: Exam Prayers" />
              <Button className="w-full" variant="outline" disabled={!newCollectionTitle.trim() || createCollectionMutation.isPending} onClick={() => createCollectionMutation.mutate({ title: newCollectionTitle, featured: false })}>
                <Plus className="mr-2 h-4 w-4" />
                Add Collection
              </Button>
            </CardContent>
          </Card>
        </aside>
      </section>

      <Dialog open={!!editing} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader><DialogTitle>{items.some((item) => item.id === editing?.id) ? "Edit Prayer" : "Create Prayer"}</DialogTitle></DialogHeader>
          {editing ? (
            <div className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div><Label>Title</Label><Input value={editing.title} onChange={(event) => setEditing({ ...editing, title: event.target.value })} /></div>
                <div><Label>Slug</Label><Input value={editing.slug} onChange={(event) => setEditing({ ...editing, slug: event.target.value })} placeholder="Auto-generated if blank" /></div>
              </div>

              <div><Label>Summary</Label><Textarea value={editing.summary ?? ""} onChange={(event) => setEditing({ ...editing, summary: event.target.value })} rows={2} /></div>
              <div><Label>Prayer Body</Label><Textarea value={editing.body} onChange={(event) => setEditing({ ...editing, body: event.target.value })} rows={8} /></div>

              <div className="grid gap-4 md:grid-cols-3">
                <div>
                  <Label>Category</Label>
                  <Select value={editing.category_id ?? "none"} onValueChange={(value) => setEditing({ ...editing, category_id: value === "none" ? null : value })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Uncategorized</SelectItem>
                      {(reference?.categories ?? []).map((item) => <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Language</Label>
                  <Select value={editing.language_id ?? "none"} onValueChange={(value) => setEditing({ ...editing, language_id: value === "none" ? null : value })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Default</SelectItem>
                      {(reference?.languages ?? []).map((item) => <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Status</Label>
                  <Select value={editing.status} onValueChange={(value) => setEditing({ ...editing, status: value as PrayerEditorDraft["status"] })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{CMS_CONTENT_STATUSES.map((item) => <SelectItem key={item} value={item}>{statusLabel(item)}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                <div>
                  <Label>Visibility</Label>
                  <Select value={editing.visibility} onValueChange={(value) => setEditing({ ...editing, visibility: value as PrayerEditorDraft["visibility"] })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{CMS_VISIBILITIES.map((item) => <SelectItem key={item} value={item}>{statusLabel(item)}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Liturgical Season</Label>
                  <Select value={editing.liturgical_season || "none"} onValueChange={(value) => setEditing({ ...editing, liturgical_season: value === "none" ? "" : value })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{SEASONS.map((item) => <SelectItem key={item || "none"} value={item || "none"}>{item || "Any Season"}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div><Label>Scripture</Label><Input value={editing.scripture_reference ?? ""} onChange={(event) => setEditing({ ...editing, scripture_reference: event.target.value })} placeholder="John 3:16" /></div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div><Label>Author</Label><Input value={editing.author ?? ""} onChange={(event) => setEditing({ ...editing, author: event.target.value })} /></div>
                <div><Label>Source</Label><Input value={editing.source ?? ""} onChange={(event) => setEditing({ ...editing, source: event.target.value })} /></div>
              </div>

              <section className="space-y-4 rounded-2xl border border-border/70 p-4" aria-labelledby="provenance-heading">
                <h3 id="provenance-heading" className="font-semibold">Chanzo na Uidhinishaji</h3>
                <div className="grid gap-4 md:grid-cols-2">
                  <div><Label>Source Type</Label><Select value={editing.source_type || "none"} onValueChange={(value) => setEditing({ ...editing, source_type: value === "none" ? null : value })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">Not supplied</SelectItem>{["roman_missal","catechism","bishops_conference","diocesan_publication","parish_publication","approved_prayer_book","scripture","public_domain","original_parish_content","user_submitted","other"].map((value) => <SelectItem key={value} value={value}>{value.replace(/_/g, " ")}</SelectItem>)}</SelectContent></Select></div>
                  <div><Label>Source Title</Label><Input value={editing.source_title ?? ""} onChange={(event) => setEditing({ ...editing, source_title: event.target.value })} /></div>
                  <div><Label>Source Organization</Label><Input value={editing.source_organization ?? ""} onChange={(event) => setEditing({ ...editing, source_organization: event.target.value })} /></div>
                  <div><Label>Source Reference</Label><Input value={editing.source_reference ?? ""} onChange={(event) => setEditing({ ...editing, source_reference: event.target.value })} /></div>
                  <div><Label>Source URL</Label><Input type="url" value={editing.source_url ?? ""} onChange={(event) => setEditing({ ...editing, source_url: event.target.value })} /></div>
                  <div><Label>Copyright Holder</Label><Input value={editing.copyright_holder ?? ""} onChange={(event) => setEditing({ ...editing, copyright_holder: event.target.value })} /></div>
                  <div className="md:col-span-2"><Label>Source Notes</Label><Textarea value={editing.source_notes ?? ""} onChange={(event) => setEditing({ ...editing, source_notes: event.target.value })} rows={2} /></div>
                  <div className="md:col-span-2"><Label>Copyright Notice</Label><Textarea value={editing.copyright_notice ?? ""} onChange={(event) => setEditing({ ...editing, copyright_notice: event.target.value })} rows={2} /></div>
                  <div><Label>License Type</Label><Select value={editing.license_type || "none"} onValueChange={(value) => setEditing({ ...editing, license_type: value === "none" ? null : value })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">Not supplied</SelectItem>{["public_domain","permission_granted","licensed","attribution_required","internal_church_use","copyright_restricted","unknown"].map((value) => <SelectItem key={value} value={value}>{value.replace(/_/g, " ")}</SelectItem>)}</SelectContent></Select></div>
                  <div><Label>License Reference</Label><Input value={editing.license_reference ?? ""} onChange={(event) => setEditing({ ...editing, license_reference: event.target.value })} /></div>
                  <div><Label>Content Edition</Label><Input value={editing.content_edition ?? ""} onChange={(event) => setEditing({ ...editing, content_edition: event.target.value })} /></div>
                  <div><Label>Content Version</Label><Input value={editing.content_version_label ?? ""} onChange={(event) => setEditing({ ...editing, content_version_label: event.target.value })} /></div>
                  <div><Label>Reviewed By</Label><Input value={editing.reviewed_by ?? ""} onChange={(event) => setEditing({ ...editing, reviewed_by: event.target.value })} /></div>
                  <div><Label>Review Date</Label><Input type="date" value={editing.reviewed_at ?? ""} onChange={(event) => setEditing({ ...editing, reviewed_at: event.target.value })} /></div>
                  <div><Label>Ecclesial Approval Status</Label><Select value={editing.ecclesial_approval_status} onValueChange={(value) => setEditing({ ...editing, ecclesial_approval_status: value })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{["pending","under_review","approved","rejected","revision_required"].map((value) => <SelectItem key={value} value={value}>{value.replace(/_/g, " ")}</SelectItem>)}</SelectContent></Select></div>
                  <div><Label>Ecclesial Approval Authority</Label><Input value={editing.ecclesial_approval_authority ?? ""} onChange={(event) => setEditing({ ...editing, ecclesial_approval_authority: event.target.value })} /></div>
                  <div className="md:col-span-2"><Label>Ecclesial Approval Reference</Label><Input value={editing.ecclesial_approval_reference ?? ""} onChange={(event) => setEditing({ ...editing, ecclesial_approval_reference: event.target.value })} /></div>
                </div>
              </section>

              <section className="rounded-2xl border border-border/70 p-4" aria-labelledby="translations-heading">
                <h3 id="translations-heading" className="font-semibold">Translations</h3>
                <dl className="mt-3 grid gap-2 text-sm md:grid-cols-2"><div><dt className="text-muted-foreground">Translation Key</dt><dd>{editing.translation_key || "Not assigned"}</dd></div><div><dt className="text-muted-foreground">Translation Group ID</dt><dd className="break-all">{editing.translation_group_id}</dd></div></dl>
                <p className="mt-3 text-sm text-muted-foreground">Available languages: {items.filter((item) => item.translation_group_id === editing.translation_group_id).map((item) => item.language?.code).filter(Boolean).join(", ") || "none"}</p>
                <p className="mt-1 text-sm text-muted-foreground">Missing languages: {["sw","en","la"].filter((code) => !items.some((item) => item.translation_group_id === editing.translation_group_id && item.language?.code === code)).join(", ") || "none"}</p>
                <div className="mt-3 flex flex-wrap gap-2">{items.filter((item) => item.translation_group_id === editing.translation_group_id && item.id !== editing.id).map((item) => <Button key={item.id} type="button" size="sm" variant="outline" onClick={() => setEditing(prayerToEditorDraft(item))}>{item.language?.code || item.title}</Button>)}</div>
              </section>

              <div><Label>Cover Image</Label><Input value={editing.cover_image ?? ""} onChange={(event) => setEditing({ ...editing, cover_image: event.target.value })} placeholder="https://..." /></div>
              <div><Label>Tags</Label><Input value={editing.tag_names} onChange={(event) => setEditing({ ...editing, tag_names: event.target.value })} placeholder="Hope, Mercy, Family" /></div>

              <div className="rounded-2xl border border-border/70 p-4">
                <div className="mb-3 flex items-center gap-2">
                  <Languages className="h-4 w-4 text-primary" />
                  <Label>Collections</Label>
                </div>
                <div className="grid gap-2 md:grid-cols-2">
                  {(reference?.collections ?? []).map((collection) => {
                    const checked = editing.collection_ids.includes(collection.id);
                    return (
                      <label key={collection.id} className="flex items-center gap-2 rounded-xl border border-border/60 p-3 text-sm">
                        <Checkbox
                          checked={checked}
                          onCheckedChange={(value) => setEditing({
                            ...editing,
                            collection_ids: value
                              ? [...editing.collection_ids, collection.id]
                              : editing.collection_ids.filter((id) => id !== collection.id),
                          })}
                        />
                        <span>{collection.title}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              {currentPrayer ? (
                <div className="grid gap-4 lg:grid-cols-2">
                  <div className="rounded-2xl border border-border/70 p-4">
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <div>
                        <Label className="flex items-center gap-2">
                          <GitCompare className="h-4 w-4 text-primary" />
                          Version History
                        </Label>
                        <p className="mt-1 text-xs text-muted-foreground">Restoring creates a new version and keeps history intact.</p>
                      </div>
                    </div>
                    <div className="max-h-64 space-y-2 overflow-y-auto">
                      {(versionsQuery.data ?? []).length ? (versionsQuery.data ?? []).map((version) => (
                        <div key={version.id} className="rounded-xl border border-border/60 bg-background/45 p-3">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="font-medium">Version {version.version_number}</p>
                              <p className="text-xs text-muted-foreground">{new Date(version.created_at).toLocaleString()} • {version.snapshot?.status ?? "draft"}</p>
                            </div>
                            <div className="flex gap-1">
                              <Button type="button" size="sm" variant="outline" onClick={() => setVersionPreview(version)}>Preview</Button>
                              <Button
                                type="button"
                                size="icon"
                                variant="ghost"
                                aria-label={`Restore version ${version.version_number}`}
                                onClick={() => {
                                  if (window.confirm(`Restore version ${version.version_number}? A new version will be created.`)) {
                                    restoreMutation.mutate(version);
                                  }
                                }}
                              >
                                <RotateCcw className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                          <p className="mt-2 line-clamp-2 text-xs text-muted-foreground">{version.snapshot?.summary || version.snapshot?.body || "No change summary available."}</p>
                        </div>
                      )) : (
                        <p className="text-sm text-muted-foreground">{versionsQuery.isLoading ? "Loading versions..." : "No version history yet."}</p>
                      )}
                    </div>
                  </div>

                  <div className="rounded-2xl border border-border/70 p-4">
                    <Label className="flex items-center gap-2">
                      <Link2 className="h-4 w-4 text-primary" />
                      Relationships
                    </Label>
                    <p className="mt-1 text-xs text-muted-foreground">Link this prayer to saints, readings, scripture, seasons, collections, or other prayers.</p>
                    <div className="mt-3 grid gap-2">
                      <div className="grid gap-2 sm:grid-cols-2">
                        <Select value={relationshipDraft.targetType} onValueChange={(value) => setRelationshipDraft({ ...relationshipDraft, targetType: value, targetId: "", targetLabel: "", query: "" })}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>{RELATIONSHIP_TARGET_TYPES.map((item) => <SelectItem key={item} value={item}>{statusLabel(item)}</SelectItem>)}</SelectContent>
                        </Select>
                        <Select value={relationshipDraft.relationshipType} onValueChange={(value) => setRelationshipDraft({ ...relationshipDraft, relationshipType: value })}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>{RELATIONSHIP_TYPES.map((item) => <SelectItem key={item} value={item}>{statusLabel(item)}</SelectItem>)}</SelectContent>
                        </Select>
                      </div>
                      <Input
                        value={relationshipDraft.query}
                        onChange={(event) => setRelationshipDraft({ ...relationshipDraft, query: event.target.value, targetId: ["scripture_reference", "liturgical_season", "daily_reading"].includes(relationshipDraft.targetType) ? event.target.value : relationshipDraft.targetId })}
                        placeholder={["scripture_reference", "liturgical_season", "daily_reading"].includes(relationshipDraft.targetType) ? "Enter reference, season, or reading id" : "Search target..."}
                      />
                      {(relationshipTargetsQuery.data ?? []).length ? (
                        <div className="max-h-32 overflow-y-auto rounded-xl border border-border/60">
                          {relationshipTargetsQuery.data?.map((target) => (
                            <button
                              key={target.id}
                              type="button"
                              className="block w-full px-3 py-2 text-left text-sm hover:bg-muted"
                              onClick={() => setRelationshipDraft({ ...relationshipDraft, targetId: target.id, targetLabel: target.label, query: target.label })}
                            >
                              <span className="font-medium">{target.label}</span>
                              {target.subtitle ? <span className="block text-xs text-muted-foreground">{target.subtitle}</span> : null}
                            </button>
                          ))}
                        </div>
                      ) : null}
                      <Button type="button" variant="outline" disabled={!relationshipDraft.query.trim() || addRelationshipMutation.isPending} onClick={() => addRelationshipMutation.mutate()}>
                        Add Relationship
                      </Button>
                    </div>
                    <div className="mt-4 max-h-40 space-y-2 overflow-y-auto">
                      {(relationshipsQuery.data ?? []).length ? (relationshipsQuery.data ?? []).map((relationship: CatholicPrayerRelationship) => (
                        <div key={relationship.id} className="flex items-center justify-between gap-2 rounded-xl border border-border/60 bg-background/45 p-2 text-sm">
                          <div>
                            <p className="font-medium">{relationship.target_label ?? relationship.target_id}</p>
                            <p className="text-xs text-muted-foreground">{relationship.relationship_type} • {relationship.target_type}</p>
                          </div>
                          <Button type="button" size="icon" variant="ghost" aria-label="Remove relationship" onClick={() => removeRelationshipMutation.mutate(relationship.id)}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      )) : (
                        <p className="text-sm text-muted-foreground">{relationshipsQuery.isLoading ? "Loading relationships..." : "No relationships yet."}</p>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <Alert>
                  <Archive className="h-4 w-4" />
                  <AlertTitle>Save before relationships</AlertTitle>
                  <AlertDescription>Version history and relationships appear after the prayer has a saved CMS record.</AlertDescription>
                </Alert>
              )}

              <div className="flex items-center justify-between rounded-2xl border border-border/70 p-4">
                <div>
                  <Label>Featured</Label>
                  <p className="text-xs text-muted-foreground">Highlights this prayer in CMS and member experiences.</p>
                </div>
                <Switch checked={editing.featured} onCheckedChange={(value) => setEditing({ ...editing, featured: value })} />
              </div>

              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
                <Button disabled={saveMutation.isPending || !editing.title.trim() || !editing.body.trim()} onClick={() => saveMutation.mutate(editing)}>
                  {saveMutation.isPending ? "Saving..." : "Save Prayer"}
                </Button>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog open={!!preview} onOpenChange={(open) => !open && setPreview(null)}>
        <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader><DialogTitle>{preview?.title || "Prayer Preview"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2">
              <Badge>{preview ? statusLabel(preview.status) : "Draft"}</Badge>
              {preview?.category ? <Badge variant="outline">{preview.category.name}</Badge> : null}
              {preview?.language ? <Badge variant="outline">{preview.language.name}</Badge> : null}
            </div>
            {preview?.summary ? <p className="text-sm text-muted-foreground">{preview.summary}</p> : null}
            <p className="whitespace-pre-wrap text-sm leading-7">{preview?.body || "No prayer text."}</p>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!versionPreview} onOpenChange={(open) => !open && setVersionPreview(null)}>
        <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader><DialogTitle>Version {versionPreview?.version_number} Preview</DialogTitle></DialogHeader>
          {versionPreview ? (
            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-2xl border border-border/70 p-4">
                <h3 className="font-semibold">Version Snapshot</h3>
                <p className="mt-1 text-xs text-muted-foreground">{new Date(versionPreview.created_at).toLocaleString()}</p>
                <h4 className="mt-4 text-lg font-bold">{versionPreview.snapshot.title}</h4>
                <p className="mt-2 text-sm text-muted-foreground">{versionPreview.snapshot.summary}</p>
                <p className="mt-4 max-h-72 overflow-y-auto whitespace-pre-wrap text-sm leading-7">{versionPreview.snapshot.body}</p>
              </div>
              <div className="rounded-2xl border border-border/70 p-4">
                <h3 className="font-semibold">Current Prayer</h3>
                <p className="mt-1 text-xs text-muted-foreground">Compare before restoring.</p>
                <h4 className="mt-4 text-lg font-bold">{currentPrayer?.title}</h4>
                <p className="mt-2 text-sm text-muted-foreground">{currentPrayer?.summary}</p>
                <p className="mt-4 max-h-72 overflow-y-auto whitespace-pre-wrap text-sm leading-7">{currentPrayer?.body}</p>
              </div>
              <div className="flex justify-end gap-2 md:col-span-2">
                <Button type="button" variant="outline" onClick={() => setVersionPreview(null)}>Close</Button>
                <Button
                  type="button"
                  disabled={restoreMutation.isPending}
                  onClick={() => {
                    if (window.confirm(`Restore version ${versionPreview.version_number}? A new version will be created.`)) {
                      restoreMutation.mutate(versionPreview);
                    }
                  }}
                >
                  Restore Version
                </Button>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </main>
  );
}

import { type ChangeEvent, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Archive, BookOpen, CalendarDays, Download, Eye, FileSpreadsheet, GitCompare, Pencil, Plus, RotateCcw, Search, ShieldCheck, Trash2, Upload } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import {
  DAILY_READING_STATUSES,
  DAILY_READING_VISIBILITIES,
  createEmptyReadingDraft,
  deleteDailyReadingDraft,
  dryRunDailyReadingImport,
  fetchDailyReadingVersions,
  fetchDailyReadingImportBatches,
  fetchDailyReadingsDashboardStats,
  fetchDailyReadingsReferenceData,
  fetchDailyReadingDrafts,
  importDailyReadingRows,
  publishDailyReadingDateRange,
  readingToEditorDraft,
  restoreDailyReadingVersion,
  saveDailyReadingDraft,
  validateDailyReadingImport,
  type DailyReadingConflictStrategy,
  type DailyReadingDryRunReport,
  type DailyReadingImportBatchMetadata,
  type CmsDailyReading,
  type CmsDailyReadingImportRow,
  type CmsDailyReadingImportValidation,
  type CmsDailyReadingVersion,
  type ReadingDraft,
} from "@/lib/super-admin/daily-readings-service";
import { dailyReadingMatchesSearch } from "@/lib/catholic-cms";

function statusLabel(status: string) {
  return status.replace(/(^|_)(\w)/g, (_, space, letter) => `${space ? " " : ""}${letter.toUpperCase()}`);
}

function normalizeImportHeader(value: unknown) {
  return String(value ?? "").toLowerCase().replace(/[^a-z0-9]+/g, "");
}

const importColumnMap: Record<string, keyof Omit<CmsDailyReadingImportRow, "rowNumber">> = {
  date: "date",
  readingdate: "date",
  liturgicalyear: "liturgicalYear",
  year: "liturgicalYear",
  liturgicalseason: "liturgicalSeason",
  season: "liturgicalSeason",
  celebration: "celebration",
  liturgicalcolor: "liturgicalColor",
  color: "liturgicalColor",
  firstreading: "firstReading",
  firstreadingreference: "firstReading",
  psalm: "psalm",
  responsorialpsalm: "psalm",
  responsorialpsalmreference: "psalm",
  secondreading: "secondReading",
  secondreadingreference: "secondReading",
  gospelacclamation: "gospelAcclamation",
  gospelacclamationreference: "gospelAcclamation",
  gospel: "gospel",
  gospelreference: "gospel",
  reflection: "reflection",
  prayer: "prayer",
  meditationquestions: "meditationQuestions",
  dailychallenge: "dailyChallenge",
  language: "language",
  status: "status",
  visibility: "visibility",
  source: "sourceAttribution",
  sourceattribution: "sourceAttribution",
  editorialnotes: "editorialNotes",
};

async function parseDailyReadingsWorkbook(file: File): Promise<CmsDailyReadingImportRow[]> {
  const XLSX = await import("xlsx");
  const workbook = XLSX.read(await file.arrayBuffer(), { type: "array", cellDates: true });
  const sheetName = workbook.SheetNames.includes("Daily Readings") ? "Daily Readings" : workbook.SheetNames[0];
  if (!sheetName) throw new Error("Workbook has no sheets.");

  const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { header: 1, defval: "" }) as unknown[][];
  const headers = (rows[0] ?? []).map((header) => importColumnMap[normalizeImportHeader(header)] ?? null);

  return rows
    .slice(1)
    .map((row, index) => {
      const result: CmsDailyReadingImportRow = { rowNumber: index + 2 };
      row.forEach((cell, cellIndex) => {
        const key = headers[cellIndex];
        if (key) (result as Record<string, unknown>)[key] = cell;
      });
      return result;
    })
    .filter((row) => Object.entries(row).some(([key, value]) => key !== "rowNumber" && String(value ?? "").trim()));
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

function defaultMetadata(): DailyReadingImportBatchMetadata {
  return {
    filename: "",
    sourceOrganization: "",
    sourcePublication: "",
    sourceYear: new Date().getFullYear(),
    sourceEdition: "",
    dateObtained: new Date().toISOString().slice(0, 10),
    language: "English",
    importDate: new Date().toISOString(),
    notes: "",
  };
}

function csvEscape(value: unknown) {
  const text = String(value ?? "");
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function downloadValidationCsv(validation: CmsDailyReadingImportValidation) {
  const headers = ["Row", "Date", "Field", "Severity", "Message", "Current Value", "Suggested Action"];
  const lines = [
    headers.join(","),
    ...validation.issues.map((issue) =>
      [
        issue.rowNumber,
        issue.date ?? "",
        issue.field,
        issue.severity,
        issue.message,
        issue.currentValue ?? "",
        issue.suggestedAction ?? "",
      ].map(csvEscape).join(","),
    ),
  ];
  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "daily-readings-validation-report.csv";
  link.click();
  URL.revokeObjectURL(url);
}

export default function SuperAdminDailyReadingsPage() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [editing, setEditing] = useState<ReadingDraft | null>(null);
  const [preview, setPreview] = useState<CmsDailyReading | null>(null);
  const [versionPreview, setVersionPreview] = useState<CmsDailyReadingVersion | null>(null);
  const [importRows, setImportRows] = useState<CmsDailyReadingImportRow[]>([]);
  const [importValidation, setImportValidation] = useState<CmsDailyReadingImportValidation | null>(null);
  const [dryRunReport, setDryRunReport] = useState<DailyReadingDryRunReport | null>(null);
  const [importSummary, setImportSummary] = useState("");
  const [validationFilter, setValidationFilter] = useState("all");
  const [conflictStrategy, setConflictStrategy] = useState<DailyReadingConflictStrategy>("create_draft_revision");
  const [metadata, setMetadata] = useState<DailyReadingImportBatchMetadata>(() => defaultMetadata());
  const [range, setRange] = useState({ from: "", to: "" });
  const [publishRange, setPublishRange] = useState({ from: "", to: "", status: "published" as "review" | "published" | "featured" });
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const referenceQuery = useQuery({
    queryKey: ["daily-readings-reference-data"],
    queryFn: fetchDailyReadingsReferenceData,
  });

  const readingsQuery = useQuery({
    queryKey: ["super-admin-daily-readings-drafts"],
    queryFn: fetchDailyReadingDrafts,
  });

  const statsQuery = useQuery({
    queryKey: ["super-admin-daily-readings-dashboard"],
    queryFn: () => fetchDailyReadingsDashboardStats(new Date().getFullYear()),
  });

  const batchesQuery = useQuery({
    queryKey: ["daily-reading-import-batches"],
    queryFn: () => fetchDailyReadingImportBatches(8),
  });

  const items = readingsQuery.data ?? [];
  const reference = referenceQuery.data;
  const currentReading = useMemo(() => (editing && !editing.id.startsWith("draft-") && !editing.id.startsWith("draft-import-") ? items.find((item) => item.id === editing.id) ?? null : null), [editing, items]);

  const versionsQuery = useQuery({
    queryKey: ["cms-daily-reading-versions", currentReading?.id],
    queryFn: () => fetchDailyReadingVersions(currentReading!.id),
    enabled: !!currentReading?.id,
  });

  const saveMutation = useMutation({
    mutationFn: saveDailyReadingDraft,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["super-admin-daily-readings-drafts"] });
      queryClient.invalidateQueries({ queryKey: ["super-admin-daily-readings-dashboard"] });
      setEditing(null);
      toast({ title: "Daily reading saved", description: "CMS version history has been updated." });
    },
    onError: (error) => toast({ title: "Unable to save daily reading", description: (error as Error).message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteDailyReadingDraft,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["super-admin-daily-readings-drafts"] });
      queryClient.invalidateQueries({ queryKey: ["super-admin-daily-readings-dashboard"] });
      toast({ title: "Daily reading removed", description: "The CMS reading record was deleted." });
    },
    onError: (error) => toast({ title: "Unable to remove daily reading", description: (error as Error).message, variant: "destructive" }),
  });

  const restoreMutation = useMutation({
    mutationFn: async (version: CmsDailyReadingVersion) => {
      if (!currentReading) throw new Error("Open a saved daily reading before restoring a version.");
      return restoreDailyReadingVersion(currentReading, version);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["super-admin-daily-readings-drafts"] });
      queryClient.invalidateQueries({ queryKey: ["cms-daily-reading-versions"] });
      setVersionPreview(null);
      toast({ title: "Version restored", description: "A new daily reading version was created from the snapshot." });
    },
    onError: (error) => toast({ title: "Unable to restore version", description: (error as Error).message, variant: "destructive" }),
  });

  const confirmImportMutation = useMutation({
    mutationFn: () => importDailyReadingRows({
      rows: importRows,
      metadata,
      conflictStrategy,
      range: { from: range.from || undefined, to: range.to || undefined },
    }),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["super-admin-daily-readings-drafts"] });
      queryClient.invalidateQueries({ queryKey: ["super-admin-daily-readings-dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["daily-reading-import-batches"] });
      setImportSummary(`${result.imported.length} imported, ${result.updatedRows} updated, ${result.skippedRows} skipped.`);
      toast({ title: "Daily readings import complete", description: `${result.imported.length} CMS reading records were processed.` });
    },
    onError: (error) => toast({ title: "Unable to import daily readings", description: (error as Error).message, variant: "destructive" }),
  });

  const dryRunMutation = useMutation({
    mutationFn: () => dryRunDailyReadingImport({
      rows: importRows,
      metadata,
      conflictStrategy,
      range: { from: range.from || undefined, to: range.to || undefined },
    }),
    onSuccess: (report) => {
      setDryRunReport(report);
      setImportValidation(report.validation);
      setImportSummary("Dry run complete. No data was written.");
      queryClient.invalidateQueries({ queryKey: ["daily-reading-import-batches"] });
      toast({ title: "Dry run complete", description: "Validation finished with zero database writes." });
    },
    onError: (error) => toast({ title: "Dry run failed", description: (error as Error).message, variant: "destructive" }),
  });

  const publishRangeMutation = useMutation({
    mutationFn: () => {
      if (!publishRange.from || !publishRange.to) throw new Error("Select a publication date range first.");
      return publishDailyReadingDateRange({
        range: { from: publishRange.from, to: publishRange.to },
        status: publishRange.status,
      });
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["super-admin-daily-readings-drafts"] });
      queryClient.invalidateQueries({ queryKey: ["super-admin-daily-readings-dashboard"] });
      toast({ title: "Date range updated", description: `${result.readings.length} readings moved to ${publishRange.status}.` });
    },
    onError: (error) => toast({ title: "Publication blocked", description: (error as Error).message, variant: "destructive" }),
  });

  const filtered = useMemo(() => items.filter((item) => (status === "all" || item.status === status) && dailyReadingMatchesSearch(item, search)), [items, search, status]);
  const stats = statsQuery.data;
  const isLoading = referenceQuery.isLoading || readingsQuery.isLoading;
  const error = referenceQuery.error || readingsQuery.error || statsQuery.error;

  const openNewReading = () => setEditing(createEmptyReadingDraft(reference));

  const handleImportFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    try {
      const rows = await parseDailyReadingsWorkbook(file);
      const nextMetadata = { ...metadata, filename: file.name };
      const validation = await validateDailyReadingImport(rows, { from: range.from || undefined, to: range.to || undefined });
      setImportRows(rows);
      setImportValidation(validation);
      setDryRunReport(null);
      setMetadata(nextMetadata);
      setImportSummary("");
      toast({ title: "Workbook parsed", description: `${rows.length} row${rows.length === 1 ? "" : "s"} ready for validation review.` });
    } catch (parseError) {
      setImportRows([]);
      setImportValidation(null);
      toast({
        title: "Unable to read workbook",
        description: parseError instanceof Error ? parseError.message : "Please upload a valid .xlsx file.",
        variant: "destructive",
      });
    }
  };

  const filteredIssues = useMemo(() => {
    if (!importValidation) return [];
    if (validationFilter === "all") return importValidation.issues;
    if (validationFilter === "existing") return importValidation.issues.filter((issue) => issue.code === "existing_record");
    if (validationFilter === "missing") return [
      ...importValidation.issues.filter((issue) => issue.code?.includes("missing")),
      ...(dryRunReport?.coverage.missingDates ?? []).slice(0, 60).map((date) => ({
        rowNumber: 0,
        date,
        field: "Date",
        severity: "warning" as const,
        message: "Date missing from this dataset.",
        suggestedAction: "Add this date before full-year publication.",
      })),
    ];
    return importValidation.issues.filter((issue) => issue.severity === validationFilter);
  }, [dryRunReport, importValidation, validationFilter]);

  return (
    <main className="space-y-6 p-4 lg:p-6">
      <section className="flex flex-col gap-4 rounded-[28px] border border-border/70 bg-card/85 p-5 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <Badge variant="outline" className="rounded-full">Catholic CMS</Badge>
          <h1 className="mt-3 text-3xl font-bold tracking-tight">Daily Readings Manager</h1>
          <p className="mt-1 text-sm text-muted-foreground">Manage daily readings, reflections, publishing status, coverage, imports, and version history. Bible text remains in the Bible module.</p>
        </div>
        <Button className="rounded-2xl" onClick={openNewReading} disabled={!reference}>
          <Plus className="mr-2 h-4 w-4" aria-hidden="true" />
          Create Reading
        </Button>
      </section>

      {error ? (
        <Alert variant="destructive">
          <Archive className="h-4 w-4" />
          <AlertTitle>Daily Readings CMS is not ready</AlertTitle>
          <AlertDescription>{(error as Error).message || "Apply the Daily Readings CMS migration, then try again."}</AlertDescription>
        </Alert>
      ) : null}

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-5">
          {Array.from({ length: 5 }).map((_, index) => <Skeleton key={index} className="h-24 rounded-2xl" />)}
        </div>
      ) : (
        <section className="grid gap-4 md:grid-cols-5">
          <StatCard label="Total" value={stats?.total ?? 0} icon={BookOpen} />
          <StatCard label="Published" value={stats?.published ?? 0} icon={CalendarDays} />
          <StatCard label="Review" value={stats?.review ?? 0} icon={Eye} />
          <StatCard label="Drafts" value={stats?.drafts ?? 0} icon={Archive} />
          <StatCard label={`${new Date().getFullYear()} Coverage`} value={`${stats?.coverage.datasetReadings ?? 0}/${stats?.coverage.totalDays ?? 365}`} icon={GitCompare} />
        </section>
      )}

      <Card className="rounded-[24px] border-border/70 bg-card/85">
        <CardContent className="space-y-4 p-5">
          <Alert>
            <ShieldCheck className="h-4 w-4" />
            <AlertTitle>Dry Run Safety</AlertTitle>
            <AlertDescription>NO DATA WILL BE WRITTEN DURING DRY RUN. Imports require validation review and explicit confirmation.</AlertDescription>
          </Alert>
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="flex items-center gap-2 text-xl font-bold">
                <FileSpreadsheet className="h-5 w-5 text-primary" aria-hidden="true" />
                Daily Readings Excel Import
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">Upload .xlsx with Date, Liturgical Year, Season, Celebration, Color, First Reading, Psalm, Second Reading, Gospel Acclamation, Gospel, Reflection, Prayer, Language, Status, and Visibility.</p>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <Input type="file" accept=".xlsx" onChange={handleImportFile} className="max-w-sm" aria-label="Upload Daily Readings workbook" />
              <Button type="button" variant="outline" disabled={!importRows.length || dryRunMutation.isPending} onClick={() => dryRunMutation.mutate()} className="gap-2">
                <ShieldCheck className="h-4 w-4" aria-hidden="true" />
                Dry Run
              </Button>
              <Button
                type="button"
                disabled={!importRows.length || importValidation?.hasErrors || confirmImportMutation.isPending}
                onClick={() => {
                  if (conflictStrategy === "update_existing" && !window.confirm("Update Existing will overwrite matching CMS records while preserving version history. Continue?")) return;
                  confirmImportMutation.mutate();
                }}
                className="gap-2"
              >
                <Upload className="h-4 w-4" aria-hidden="true" />
                Confirm Import
              </Button>
            </div>
          </div>

          <div className="grid gap-3 lg:grid-cols-4">
            <div><Label>Source Organization</Label><Input value={metadata.sourceOrganization} onChange={(event) => setMetadata({ ...metadata, sourceOrganization: event.target.value })} placeholder="Verified Catholic source" /></div>
            <div><Label>Source Publication</Label><Input value={metadata.sourcePublication} onChange={(event) => setMetadata({ ...metadata, sourcePublication: event.target.value })} placeholder="Lectionary / Ordo / document" /></div>
            <div><Label>Source Year</Label><Input type="number" value={metadata.sourceYear} onChange={(event) => setMetadata({ ...metadata, sourceYear: Number(event.target.value) || new Date().getFullYear() })} /></div>
            <div><Label>Date Obtained</Label><Input type="date" value={metadata.dateObtained ?? ""} onChange={(event) => setMetadata({ ...metadata, dateObtained: event.target.value })} /></div>
            <div><Label>Source Edition</Label><Input value={metadata.sourceEdition ?? ""} onChange={(event) => setMetadata({ ...metadata, sourceEdition: event.target.value })} /></div>
            <div><Label>Language</Label><Input value={metadata.language ?? ""} onChange={(event) => setMetadata({ ...metadata, language: event.target.value })} /></div>
            <div><Label>Import From</Label><Input type="date" value={range.from} onChange={(event) => setRange({ ...range, from: event.target.value })} /></div>
            <div><Label>Import To</Label><Input type="date" value={range.to} onChange={(event) => setRange({ ...range, to: event.target.value })} /></div>
            <div className="lg:col-span-2">
              <Label>Conflict Strategy</Label>
              <Select value={conflictStrategy} onValueChange={(value) => setConflictStrategy(value as DailyReadingConflictStrategy)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="create_draft_revision">Create Draft Revision (Default)</SelectItem>
                  <SelectItem value="skip_existing">Skip Existing</SelectItem>
                  <SelectItem value="update_existing">Update Existing</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="lg:col-span-2"><Label>Notes</Label><Input value={metadata.notes ?? ""} onChange={(event) => setMetadata({ ...metadata, notes: event.target.value })} placeholder="Source notes or editorial caveats" /></div>
          </div>

          {importValidation ? (
            <div className="rounded-2xl border border-border/70 bg-background/45 p-4">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant={importValidation.hasErrors ? "destructive" : "default"}>{importValidation.hasErrors ? "Errors found" : "Ready to import"}</Badge>
                <Badge variant="outline">{importValidation.summary.totalRows} total row{importValidation.summary.totalRows === 1 ? "" : "s"}</Badge>
                <Badge variant="outline">{importValidation.summary.validRows} valid</Badge>
                <Badge variant={importValidation.summary.errorCount ? "destructive" : "outline"}>{importValidation.summary.errorCount} errors</Badge>
                <Badge variant="outline">{importValidation.summary.warningCount} warnings</Badge>
                <Badge variant="outline">{importValidation.summary.informationCount} info</Badge>
                <Badge variant="outline">{importValidation.summary.existingRecordCount} existing</Badge>
              </div>
              {dryRunReport ? (
                <div className="mt-4 grid gap-3 md:grid-cols-4">
                  <div className="rounded-xl border border-border/60 p-3"><p className="text-xs text-muted-foreground">Dataset Coverage</p><p className="text-xl font-bold">{dryRunReport.coverage.datasetCoveragePercent}%</p></div>
                  <div className="rounded-xl border border-border/60 p-3"><p className="text-xs text-muted-foreground">Published Coverage</p><p className="text-xl font-bold">{dryRunReport.coverage.publishedCoveragePercent}%</p></div>
                  <div className="rounded-xl border border-border/60 p-3"><p className="text-xs text-muted-foreground">Liturgical Complete</p><p className="text-xl font-bold">{dryRunReport.coverage.completeLiturgicalReadings}/{dryRunReport.coverage.totalDays}</p></div>
                  <div className="rounded-xl border border-border/60 p-3"><p className="text-xs text-muted-foreground">Editorial Enriched</p><p className="text-xl font-bold">{dryRunReport.coverage.editorialEnrichmentPercent}%</p></div>
                </div>
              ) : null}
              <div className="mt-4 flex flex-wrap items-center gap-2">
                <Select value={validationFilter} onValueChange={setValidationFilter}>
                  <SelectTrigger className="w-52"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    <SelectItem value="error">Errors</SelectItem>
                    <SelectItem value="warning">Warnings</SelectItem>
                    <SelectItem value="information">Information</SelectItem>
                    <SelectItem value="existing">Existing Records</SelectItem>
                    <SelectItem value="missing">Missing Dates</SelectItem>
                  </SelectContent>
                </Select>
                <Button type="button" variant="outline" size="sm" onClick={() => downloadValidationCsv(importValidation)} className="gap-2">
                  <Download className="h-4 w-4" />
                  Export CSV
                </Button>
              </div>
              {filteredIssues.length ? (
                <div className="mt-3 max-h-48 overflow-y-auto rounded-xl border border-border/60">
                  <Table>
                    <TableHeader><TableRow><TableHead>Row</TableHead><TableHead>Date</TableHead><TableHead>Field</TableHead><TableHead>Issue</TableHead><TableHead>Severity</TableHead><TableHead>Suggested Action</TableHead></TableRow></TableHeader>
                    <TableBody>
                      {filteredIssues.map((issue, index) => (
                        <TableRow key={`${issue.rowNumber}-${issue.field}-${index}`}>
                          <TableCell>{issue.rowNumber || "-"}</TableCell>
                          <TableCell>{issue.date ?? "-"}</TableCell>
                          <TableCell>{issue.field}</TableCell>
                          <TableCell>{issue.message}</TableCell>
                          <TableCell><Badge variant={issue.severity === "error" ? "destructive" : "outline"}>{issue.severity}</Badge></TableCell>
                          <TableCell>{issue.suggestedAction ?? "-"}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : null}
            </div>
          ) : null}
          {importSummary ? <p className="text-sm font-medium text-primary">{importSummary}</p> : null}
        </CardContent>
      </Card>

      <Card className="rounded-[24px] border-border/70 bg-card/85">
        <CardContent className="space-y-4 p-5">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h2 className="text-xl font-bold">Publication Safety</h2>
              <p className="mt-1 text-sm text-muted-foreground">Bulk publication is blocked when required references or dates are missing.</p>
            </div>
            <div className="grid gap-2 sm:grid-cols-[160px_160px_180px_auto]">
              <Input type="date" value={publishRange.from} onChange={(event) => setPublishRange({ ...publishRange, from: event.target.value })} aria-label="Publish from date" />
              <Input type="date" value={publishRange.to} onChange={(event) => setPublishRange({ ...publishRange, to: event.target.value })} aria-label="Publish to date" />
              <Select value={publishRange.status} onValueChange={(value) => setPublishRange({ ...publishRange, status: value as "review" | "published" | "featured" })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="review">Submit for Review</SelectItem>
                  <SelectItem value="published">Publish Range</SelectItem>
                  <SelectItem value="featured">Feature Range</SelectItem>
                </SelectContent>
              </Select>
              <Button type="button" disabled={publishRangeMutation.isPending || !publishRange.from || !publishRange.to} onClick={() => publishRangeMutation.mutate()}>
                Apply
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-[24px] border-border/70 bg-card/85">
        <CardContent className="space-y-3 p-5">
          <h2 className="text-xl font-bold">Recent Import Batches</h2>
          {(batchesQuery.data ?? []).length ? (
            <div className="grid gap-3 lg:grid-cols-2">
              {batchesQuery.data?.map((batch) => (
                <div key={batch.id} className="rounded-2xl border border-border/60 bg-background/45 p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium">{batch.filename}</p>
                      <p className="text-xs text-muted-foreground">{batch.source_organization || "Unknown source"} - {batch.source_year || "No year"}</p>
                    </div>
                    <Badge variant={batch.status.includes("Failed") ? "destructive" : "outline"}>{batch.status}</Badge>
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">{batch.imported_rows} imported - {batch.updated_rows} updated - {batch.skipped_rows} skipped - {batch.invalid_rows} errors</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">{batchesQuery.isLoading ? "Loading import batches..." : "No Daily Readings import batches have been recorded yet."}</p>
          )}
        </CardContent>
      </Card>

      <Card className="rounded-[24px] border-border/70 bg-card/85">
        <CardContent className="space-y-4 p-5">
          <div className="grid gap-3 lg:grid-cols-[1fr_180px]">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search date, celebration, season, reference, reflection..." className="pl-10" />
            </div>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                {DAILY_READING_STATUSES.map((item) => <SelectItem key={item} value={item}>{statusLabel(item)}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Celebration</TableHead>
                  <TableHead>Season</TableHead>
                  <TableHead>First</TableHead>
                  <TableHead>Psalm</TableHead>
                  <TableHead>Second</TableHead>
                  <TableHead>Gospel</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length ? filtered.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>{item.reading_date}</TableCell>
                    <TableCell className="min-w-48">{item.celebration || <span className="text-muted-foreground">Untitled</span>}</TableCell>
                    <TableCell>{item.liturgical_season || "-"}</TableCell>
                    <TableCell>{item.first_reading_reference || "-"}</TableCell>
                    <TableCell>{item.responsorial_psalm_reference || "-"}</TableCell>
                    <TableCell>{item.second_reading_reference || "-"}</TableCell>
                    <TableCell>{item.gospel_reference || "-"}</TableCell>
                    <TableCell><Badge variant={["published", "featured"].includes(item.status) ? "default" : "outline"}>{statusLabel(item.status)}</Badge></TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-2">
                        <Button size="icon" variant="ghost" aria-label="Preview reading" onClick={() => setPreview(item)}><Eye className="h-4 w-4" /></Button>
                        <Button size="icon" variant="ghost" aria-label="Edit reading" onClick={() => setEditing(readingToEditorDraft(item))}><Pencil className="h-4 w-4" /></Button>
                        <Button size="icon" variant="ghost" aria-label="Delete reading" onClick={() => deleteMutation.mutate(item.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                      </div>
                    </TableCell>
                  </TableRow>
                )) : (
                  <TableRow><TableCell colSpan={9}>No CMS daily readings match this view.</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={!!editing} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent className="max-h-[92vh] max-w-4xl overflow-y-auto">
          <DialogHeader><DialogTitle>{items.some((item) => item.id === editing?.id) ? "Edit Daily Reading" : "Create Daily Reading"}</DialogTitle></DialogHeader>
          {editing ? (
            <div className="space-y-4">
              <div className="grid gap-4 md:grid-cols-4">
                <div><Label>Date</Label><Input type="date" value={editing.reading_date} onChange={(event) => setEditing({ ...editing, reading_date: event.target.value })} /></div>
                <div><Label>Liturgical Year</Label><Input value={editing.liturgical_year} onChange={(event) => setEditing({ ...editing, liturgical_year: event.target.value })} /></div>
                <div><Label>Season</Label><Input value={editing.liturgical_season} onChange={(event) => setEditing({ ...editing, liturgical_season: event.target.value })} /></div>
                <div><Label>Color</Label><Input value={editing.liturgical_color} onChange={(event) => setEditing({ ...editing, liturgical_color: event.target.value })} /></div>
              </div>
              <div><Label>Celebration</Label><Input value={editing.celebration} onChange={(event) => setEditing({ ...editing, celebration: event.target.value })} /></div>
              <div className="grid gap-4 md:grid-cols-2">
                <div><Label>First Reading Reference</Label><Input value={editing.first_reading_reference} onChange={(event) => setEditing({ ...editing, first_reading_reference: event.target.value })} placeholder="Isaiah 55:10-11" /></div>
                <div><Label>Responsorial Psalm Reference</Label><Input value={editing.responsorial_psalm_reference} onChange={(event) => setEditing({ ...editing, responsorial_psalm_reference: event.target.value })} placeholder="Psalm 65:10-14" /></div>
                <div><Label>Second Reading Reference</Label><Input value={editing.second_reading_reference ?? ""} onChange={(event) => setEditing({ ...editing, second_reading_reference: event.target.value })} placeholder="Romans 8:18-23" /></div>
                <div><Label>Gospel Acclamation Reference</Label><Input value={editing.gospel_acclamation_reference ?? ""} onChange={(event) => setEditing({ ...editing, gospel_acclamation_reference: event.target.value })} /></div>
                <div className="md:col-span-2"><Label>Gospel Reference</Label><Input value={editing.gospel_reference} onChange={(event) => setEditing({ ...editing, gospel_reference: event.target.value })} placeholder="Matthew 13:1-23" /></div>
              </div>
              <div className="grid gap-4 md:grid-cols-3">
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
                  <Select value={editing.status} onValueChange={(value) => setEditing({ ...editing, status: value as ReadingDraft["status"] })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{DAILY_READING_STATUSES.map((item) => <SelectItem key={item} value={item}>{statusLabel(item)}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Visibility</Label>
                  <Select value={editing.visibility} onValueChange={(value) => setEditing({ ...editing, visibility: value as ReadingDraft["visibility"] })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{DAILY_READING_VISIBILITIES.map((item) => <SelectItem key={item} value={item}>{statusLabel(item)}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
              <div><Label>Reflection</Label><Textarea value={editing.reflection ?? ""} onChange={(event) => setEditing({ ...editing, reflection: event.target.value })} rows={4} /></div>
              <div><Label>Prayer</Label><Textarea value={editing.prayer ?? ""} onChange={(event) => setEditing({ ...editing, prayer: event.target.value })} rows={4} /></div>
              <div className="grid gap-4 md:grid-cols-2">
                <div><Label>Meditation Questions</Label><Textarea value={editing.meditation_questions ?? ""} onChange={(event) => setEditing({ ...editing, meditation_questions: event.target.value })} rows={3} /></div>
                <div><Label>Daily Challenge</Label><Textarea value={editing.daily_challenge ?? ""} onChange={(event) => setEditing({ ...editing, daily_challenge: event.target.value })} rows={3} /></div>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div><Label>Source Attribution</Label><Input value={editing.source_attribution ?? ""} onChange={(event) => setEditing({ ...editing, source_attribution: event.target.value })} /></div>
                <div><Label>Editorial Notes</Label><Input value={editing.editorial_notes ?? ""} onChange={(event) => setEditing({ ...editing, editorial_notes: event.target.value })} /></div>
              </div>

              {currentReading ? (
                <div className="rounded-2xl border border-border/70 p-4">
                  <Label className="flex items-center gap-2"><GitCompare className="h-4 w-4 text-primary" />Version History</Label>
                  <div className="mt-3 max-h-52 space-y-2 overflow-y-auto">
                    {(versionsQuery.data ?? []).length ? versionsQuery.data?.map((version) => (
                      <div key={version.id} className="flex items-start justify-between gap-3 rounded-xl border border-border/60 bg-background/45 p-3">
                        <div>
                          <p className="font-medium">Version {version.version_number}</p>
                          <p className="text-xs text-muted-foreground">{new Date(version.created_at).toLocaleString()} - {version.snapshot?.status ?? "draft"}</p>
                          <p className="mt-1 line-clamp-1 text-xs text-muted-foreground">{version.snapshot?.celebration || version.snapshot?.gospel_reference || "No snapshot summary."}</p>
                        </div>
                        <div className="flex gap-1">
                          <Button type="button" size="sm" variant="outline" onClick={() => setVersionPreview(version)}>Preview</Button>
                          <Button type="button" size="icon" variant="ghost" aria-label={`Restore version ${version.version_number}`} onClick={() => restoreMutation.mutate(version)}>
                            <RotateCcw className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    )) : (
                      <p className="text-sm text-muted-foreground">{versionsQuery.isLoading ? "Loading versions..." : "No version history yet."}</p>
                    )}
                  </div>
                </div>
              ) : null}

              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
                <Button disabled={saveMutation.isPending || !editing.reading_date || !editing.first_reading_reference || !editing.responsorial_psalm_reference || !editing.gospel_reference} onClick={() => saveMutation.mutate(editing)}>
                  {saveMutation.isPending ? "Saving..." : "Save Reading"}
                </Button>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog open={!!preview} onOpenChange={(open) => !open && setPreview(null)}>
        <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader><DialogTitle>{preview?.celebration || "Daily Reading Preview"}</DialogTitle></DialogHeader>
          <div className="space-y-3 text-sm">
            <div className="flex flex-wrap gap-2">
              <Badge>{preview ? statusLabel(preview.status) : "Draft"}</Badge>
              <Badge variant="outline">{preview?.reading_date}</Badge>
              {preview?.liturgical_season ? <Badge variant="outline">{preview.liturgical_season}</Badge> : null}
            </div>
            <p><strong>First Reading:</strong> {preview?.first_reading_reference || "-"}</p>
            <p><strong>Psalm:</strong> {preview?.responsorial_psalm_reference || "-"}</p>
            <p><strong>Second Reading:</strong> {preview?.second_reading_reference || "-"}</p>
            <p><strong>Gospel:</strong> {preview?.gospel_reference || "-"}</p>
            {preview?.reflection ? <p className="whitespace-pre-wrap"><strong>Reflection:</strong> {preview.reflection}</p> : null}
            {preview?.prayer ? <p className="whitespace-pre-wrap"><strong>Prayer:</strong> {preview.prayer}</p> : null}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!versionPreview} onOpenChange={(open) => !open && setVersionPreview(null)}>
        <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader><DialogTitle>Version {versionPreview?.version_number} Preview</DialogTitle></DialogHeader>
          {versionPreview ? (
            <div className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-2xl border border-border/70 p-4">
                  <h3 className="font-semibold">Version Snapshot</h3>
                  <p className="mt-1 text-xs text-muted-foreground">{new Date(versionPreview.created_at).toLocaleString()}</p>
                  <p className="mt-4 text-lg font-bold">{versionPreview.snapshot.celebration || versionPreview.snapshot.reading_date}</p>
                  <p className="mt-2 text-sm">Gospel: {versionPreview.snapshot.gospel_reference}</p>
                  <p className="mt-4 max-h-64 overflow-y-auto whitespace-pre-wrap text-sm leading-7">{versionPreview.snapshot.reflection || "No reflection."}</p>
                </div>
                <div className="rounded-2xl border border-border/70 p-4">
                  <h3 className="font-semibold">Current Reading</h3>
                  <p className="mt-1 text-xs text-muted-foreground">Compare before restoring.</p>
                  <p className="mt-4 text-lg font-bold">{currentReading?.celebration || currentReading?.reading_date}</p>
                  <p className="mt-2 text-sm">Gospel: {currentReading?.gospel_reference}</p>
                  <p className="mt-4 max-h-64 overflow-y-auto whitespace-pre-wrap text-sm leading-7">{currentReading?.reflection || "No reflection."}</p>
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setVersionPreview(null)}>Close</Button>
                <Button type="button" disabled={restoreMutation.isPending} onClick={() => restoreMutation.mutate(versionPreview)}>Restore Version</Button>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </main>
  );
}

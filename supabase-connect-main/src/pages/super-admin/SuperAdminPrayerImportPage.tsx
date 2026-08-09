import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { AlertTriangle, CheckCircle2, Download, FileSpreadsheet, ShieldCheck, Upload } from "lucide-react";
import { Navigate } from "react-router-dom";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { appEnvironment, supabaseProjectRef } from "@/lib/environment";
import {
  PRAYER_IMPORT_CONFIRMATION,
  applyApprovedPrayerImport,
  fetchPrayerImportHistory,
  runPrayerWorkbookDryRun,
  type PrayerImportDryRun,
  type PrayerImportHistoryRecord,
} from "@/lib/super-admin/prayer-import-service";

function formatSize(size: number) {
  return size < 1024 * 1024 ? `${(size / 1024).toFixed(1)} KB` : `${(size / 1024 / 1024).toFixed(1)} MB`;
}

function formatImportDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

export default function SuperAdminPrayerImportPage() {
  const { isSuperAdmin } = useAuth();
  const { toast } = useToast();
  const [file, setFile] = useState<File | null>(null);
  const [dryRun, setDryRun] = useState<PrayerImportDryRun | null>(null);
  const [confirmation, setConfirmation] = useState("");
  const history = useQuery({ queryKey: ["prayer-import-history"], queryFn: () => fetchPrayerImportHistory() });
  const validate = useMutation({
    mutationFn: () => runPrayerWorkbookDryRun(file!),
    onSuccess: (result) => { setDryRun(result); setConfirmation(""); toast({ title: "Dry-run complete", description: `${result.validRows} valid; ${result.invalidRows} invalid; no database writes.` }); },
    onError: (error: Error) => { setDryRun(null); toast({ title: "Workbook validation failed", description: error.message, variant: "destructive" }); },
  });
  const apply = useMutation({
    mutationFn: () => applyApprovedPrayerImport(dryRun!, confirmation),
    onSuccess: (result) => { toast({ title: "Staging import complete", description: `${result.updated} prayers updated and forced to draft.` }); void history.refetch(); },
    onError: (error: Error) => toast({ title: "Staging import failed", description: error.message, variant: "destructive" }),
  });
  const canImport = !!dryRun && dryRun.plan.errors.length === 0 && dryRun.plan.changes.length > 0 && confirmation === PRAYER_IMPORT_CONFIRMATION;
  const summary = useMemo(() => dryRun ? [
    ["Valid rows", dryRun.validRows], ["Invalid rows", dryRun.invalidRows], ["Updates", dryRun.plan.recordsThatWouldUpdate],
    ["Unchanged", dryRun.plan.unchangedRecords], ["Missing", dryRun.missingRecords], ["Warnings", dryRun.warnings], ["Errors", dryRun.plan.validationFailures],
  ] : [], [dryRun]);

  if (!isSuperAdmin) return <Navigate to="/" replace />;

  const downloadReport = () => {
    if (!dryRun) return;
    const blob = new Blob([JSON.stringify({ environment: appEnvironment, projectRef: supabaseProjectRef, filename: dryRun.parsed.filename, checksum: dryRun.parsed.checksum, report: dryRun.report, preview: dryRun.preview }, null, 2)], { type: "application/json" });
    const link = document.createElement("a"); link.href = URL.createObjectURL(blob); link.download = "prayer-import-validation-report.json"; link.click(); URL.revokeObjectURL(link.href);
  };

  return <main className="space-y-6 p-4 lg:p-6">
    <header><p className="flex items-center gap-2 text-sm font-medium text-primary"><ShieldCheck className="h-4 w-4" />Super Admin · Catholic Content</p><h1 className="mt-2 text-3xl font-bold">Import Prayers</h1><p className="mt-1 text-sm text-muted-foreground">Update-only controlled XLSX workflow. Every imported prayer is forced to draft.</p></header>
    <Card className="border-amber-300/60"><CardContent className="flex flex-wrap items-center gap-3 p-4"><Badge variant={appEnvironment === "staging" ? "default" : "destructive"}>{appEnvironment}</Badge><code className="text-xs">{supabaseProjectRef || "unknown project"}</code><span className="text-sm text-muted-foreground">Imports are accepted only by the approved staging RPC.</span></CardContent></Card>

    <Card><CardHeader><CardTitle>1. Upload and validate workbook</CardTitle></CardHeader><CardContent className="space-y-4"><Input aria-label="Prayer workbook" type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" onChange={(event) => { const selected = event.target.files?.[0] ?? null; setFile(selected); setDryRun(null); }} />{file ? <p className="flex items-center gap-2 text-sm"><FileSpreadsheet className="h-4 w-4" />{file.name} · {formatSize(file.size)}</p> : null}<Button disabled={!file || validate.isPending} onClick={() => validate.mutate()}><Upload className="mr-2 h-4 w-4" />{validate.isPending ? "Running dry-run…" : "Validate and run dry-run"}</Button><p className="text-xs text-muted-foreground">The dry-run is mandatory and performs no database writes.</p></CardContent></Card>

    {dryRun ? <><section id="validation" className="grid scroll-mt-6 gap-3 sm:grid-cols-2 xl:grid-cols-7">{summary.map(([label, value]) => <Card key={String(label)}><CardContent className="p-4"><p className="text-xs text-muted-foreground">{label}</p><p className="mt-1 text-2xl font-bold">{value}</p></CardContent></Card>)}</section><Card><CardHeader className="flex-row items-center justify-between"><CardTitle>Preview</CardTitle><Button variant="outline" onClick={downloadReport}><Download className="mr-2 h-4 w-4" />JSON report</Button></CardHeader><CardContent className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead>Prayer Code</TableHead><TableHead>Title</TableHead><TableHead>Language</TableHead><TableHead>Action</TableHead><TableHead>Current</TableHead><TableHead>Incoming</TableHead><TableHead>Validation</TableHead><TableHead>Notes</TableHead></TableRow></TableHeader><TableBody>{dryRun.preview.map((row) => <TableRow key={row.rowNumber}><TableCell className="font-mono text-xs">{row.prayerCode}</TableCell><TableCell>{row.title}</TableCell><TableCell>{row.language}</TableCell><TableCell>{row.action}</TableCell><TableCell>{row.currentState}</TableCell><TableCell>{row.incomingState}</TableCell><TableCell>{row.validationStatus === "valid" ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : <AlertTriangle className="h-4 w-4 text-destructive" />}</TableCell><TableCell className="max-w-xs text-xs">{row.notes}</TableCell></TableRow>)}</TableBody></Table></CardContent></Card>
    <Card><CardHeader><CardTitle>2. Approval-gated staging import</CardTitle></CardHeader><CardContent className="space-y-3"><p className="text-sm text-muted-foreground">Reconfirm the exact workbook after reviewing its dry-run report. The RPC checks Super Admin authorization, staging JWT issuer, checksum, prayer code, ID, concurrency timestamp, and allowed fields in one transaction.</p><Input aria-label="Staging confirmation" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} placeholder={PRAYER_IMPORT_CONFIRMATION} /><Button disabled={!canImport || apply.isPending} onClick={() => apply.mutate()}>{apply.isPending ? "Importing…" : "Import to staging as draft"}</Button>{dryRun.plan.errors.length ? <p className="text-sm text-destructive">Import blocked: resolve every validation error and rerun the dry-run.</p> : null}</CardContent></Card></> : null}

    <Card id="history" className="scroll-mt-6"><CardHeader><CardTitle>Import History</CardTitle></CardHeader><CardContent>{history.data?.length ? <div className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead>Batch ID</TableHead><TableHead>Initiated By</TableHead><TableHead>Executed By</TableHead><TableHead>Environment</TableHead><TableHead>Workbook</TableHead><TableHead>Checksum</TableHead><TableHead>Updated</TableHead><TableHead>Skipped</TableHead><TableHead>Failed</TableHead><TableHead>Status</TableHead><TableHead>Date</TableHead></TableRow></TableHeader><TableBody>{history.data.map((item: PrayerImportHistoryRecord) => <TableRow key={item.id}><TableCell className="font-mono text-xs" title={item.id}>{item.id.slice(0, 8)}…</TableCell><TableCell><div className="font-medium">{item.initiatedByDisplayName ?? item.initiatedByEmail ?? "CLI import"}</div>{item.initiatedByEmail && item.initiatedByDisplayName ? <div className="text-xs text-muted-foreground">{item.initiatedByEmail}</div> : null}</TableCell><TableCell className="font-mono text-xs">{item.executedBy}</TableCell><TableCell>{item.environment}</TableCell><TableCell className="max-w-52 truncate" title={item.filename}>{item.filename}</TableCell><TableCell className="font-mono text-xs" title={item.checksum}>{item.checksum ? `${item.checksum.slice(0, 12)}…` : "—"}</TableCell><TableCell>{item.updated}</TableCell><TableCell>{item.skipped}</TableCell><TableCell>{item.failed}</TableCell><TableCell><Badge variant={item.status === "Imported" ? "default" : "secondary"}>{item.status}</Badge></TableCell><TableCell className="whitespace-nowrap"><div>Started: {formatImportDate(item.startedAt)}</div><div className="text-xs text-muted-foreground">Completed: {item.completedAt ? formatImportDate(item.completedAt) : "—"}</div></TableCell></TableRow>)}</TableBody></Table></div> : <p className="text-sm text-muted-foreground">No Prayer Library imports recorded.</p>}</CardContent></Card>
  </main>;
}

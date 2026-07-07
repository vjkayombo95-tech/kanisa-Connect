import { CheckCircle2, Clock, FileSpreadsheet, History, RotateCcw, ShieldCheck, Upload } from "lucide-react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { fetchImportHistory } from "@/lib/super-admin/import-history-service";

const importCards = [
  { title: "Import Saints Workbook", description: "Excel, CSV, and JSON saint content imports.", to: "/super-admin/catholic-content/saints/cms", ready: true },
  { title: "Import Daily Readings", description: "Dry-run, validate, and import verified Daily Readings into the Catholic CMS.", to: "/super-admin/catholic-content/daily-readings", ready: true },
  { title: "Import Prayer Library", description: "CMS-ready columns: Title, Category, Tags, Prayer, Season, Language, Status, Collection.", to: "/super-admin/catholic-content/prayer-library", ready: true },
  { title: "Import Liturgical Calendar", description: "Future calendar import pipeline.", to: "/super-admin/catholic-content/liturgical-calendar", ready: false },
  { title: "Import Catechism", description: "Future Catholic resources import.", to: "#", ready: false },
  { title: "Import Novenas", description: "Future devotional content import.", to: "#", ready: false },
];

const importReadinessChecks = [
  { title: "Duplicate detection", detail: "Importer validates duplicate slugs inside the uploaded file before import." },
  { title: "Slug conflicts", detail: "Existing records are matched by slug so imports update instead of duplicating saints." },
  { title: "Import duration", detail: "Workflow surfaces progress; persistent timing is prepared in the history shape." },
  { title: "Success rate", detail: "History model tracks imported, updated, skipped, and failed rows for rate calculation." },
  { title: "Rollback message", detail: "Imports are row-resilient, so failed rows are reported instead of hiding partial results." },
  { title: "Validation summary", detail: "Validation reports errors and warnings before records are written." },
];

export default function SuperAdminImportCenter() {
  const { data: history = [] } = useQuery({
    queryKey: ["super-admin-catholic-import-history"],
    queryFn: fetchImportHistory,
  });

  return (
    <main className="space-y-6 p-4 lg:p-6">
      <section className="rounded-[28px] border border-border/70 bg-card/85 p-5">
        <p className="flex items-center gap-2 text-sm font-medium text-primary"><Upload className="h-4 w-4" />Catholic CMS</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight">Import Center</h1>
        <p className="mt-1 text-sm text-muted-foreground">Centralized import workflows for global Catholic CMS content.</p>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {importCards.map((card) => (
          <Card key={card.title} className="rounded-[24px] border-border/70 bg-card/85">
            <CardContent className="space-y-4 p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                  <FileSpreadsheet className="h-5 w-5" />
                </div>
                <Badge variant={card.ready ? "default" : "outline"}>{card.ready ? "Ready" : "Future"}</Badge>
              </div>
              <div>
                <h2 className="text-xl font-bold">{card.title}</h2>
                <p className="mt-1 text-sm text-muted-foreground">{card.description}</p>
              </div>
              <div className="grid grid-cols-5 gap-1 text-center text-[11px] text-muted-foreground">
                {["Upload", "Validate", "Preview", "Import", "History"].map((step) => <span key={step} className="rounded-lg bg-muted/50 px-1 py-1">{step}</span>)}
              </div>
              <Button asChild variant={card.ready ? "default" : "outline"} className="w-full rounded-2xl">
                <Link to={card.to}>{card.ready ? "Open Importer" : "View Roadmap"}</Link>
              </Button>
            </CardContent>
          </Card>
        ))}
      </section>

      <Card className="rounded-[24px] border-border/70 bg-card/85">
        <CardContent className="p-5">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary"><ShieldCheck className="h-5 w-5" /></div>
            <div>
              <h2 className="text-xl font-bold">Import Production Checks</h2>
              <p className="text-sm text-muted-foreground">Operational checks exposed for the current Saints workbook pipeline.</p>
            </div>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {importReadinessChecks.map((check) => (
              <div key={check.title} className="rounded-2xl border border-border/60 bg-background/45 p-3">
                <p className="flex items-center gap-2 font-medium">
                  {check.title === "Rollback message" ? <RotateCcw className="h-4 w-4 text-primary" /> : <CheckCircle2 className="h-4 w-4 text-primary" />}
                  {check.title}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">{check.detail}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-[24px] border-border/70 bg-card/85">
        <CardContent className="p-5">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary"><History className="h-5 w-5" /></div>
            <div>
              <h2 className="text-xl font-bold">Import History</h2>
              <p className="text-sm text-muted-foreground">Placeholder history is ready for persistent import tracking when database support is added.</p>
            </div>
          </div>
          <Table className="mt-4">
            <TableHeader>
              <TableRow>
                <TableHead>Workbook Name</TableHead>
                <TableHead>Import Date</TableHead>
                <TableHead>Imported</TableHead>
                <TableHead>Updated</TableHead>
                <TableHead>Skipped</TableHead>
                <TableHead>Failed</TableHead>
                <TableHead>Duration</TableHead>
                <TableHead>Imported By</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {history.length ? history.map((record) => (
                <TableRow key={record.id}>
                  <TableCell className="font-medium">{record.workbookName}</TableCell>
                  <TableCell>{record.importDate}</TableCell>
                  <TableCell>{record.recordsImported}</TableCell>
                  <TableCell>{record.recordsUpdated}</TableCell>
                  <TableCell>{record.recordsSkipped}</TableCell>
                  <TableCell>{record.recordsFailed}</TableCell>
                  <TableCell>{record.duration}</TableCell>
                  <TableCell>{record.importedBy}</TableCell>
                </TableRow>
              )) : (
                <TableRow>
                  <TableCell colSpan={8}>
                    <div className="flex items-center gap-2 text-muted-foreground"><Clock className="h-4 w-4" />No import history has been recorded yet.</div>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </main>
  );
}

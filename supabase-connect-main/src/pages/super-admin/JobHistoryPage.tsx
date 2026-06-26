import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { Activity, AlertCircle, CheckCircle2, Clock3, History, Loader2, RefreshCw, XCircle } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ExportButton } from "@/components/super-admin/ExportButton";
import { FilterToolbar } from "@/components/super-admin/FilterToolbar";
import { supabase } from "@/integrations/supabase/client";

type AutomationRun = {
  id: string;
  started_at: string | null;
  completed_at: string | null;
  status: "running" | "completed" | "failed" | string;
  processed_count: number | null;
  error_message: string | null;
  created_at: string | null;
};

const dateTimeFormatter = new Intl.DateTimeFormat(undefined, {
  dateStyle: "medium",
  timeStyle: "short",
});

function formatDateTime(value: string | null) {
  return value ? dateTimeFormatter.format(new Date(value)) : "-";
}

function formatDuration(startedAt: string | null, completedAt: string | null) {
  if (!completedAt) return "In Progress";
  if (!startedAt) return "-";

  const durationMs = new Date(completedAt).getTime() - new Date(startedAt).getTime();
  if (!Number.isFinite(durationMs) || durationMs < 0) return "-";
  if (durationMs < 1000) return `${durationMs} ms`;
  return `${(durationMs / 1000).toFixed(1)} s`;
}

function StatusBadge({ status }: { status: AutomationRun["status"] }) {
  if (status === "completed") {
    return <Badge variant="outline" className="border-success/30 bg-success/10 text-success">Completed</Badge>;
  }

  if (status === "failed") {
    return <Badge variant="outline" className="border-destructive/30 bg-destructive/10 text-destructive">Failed</Badge>;
  }

  if (status === "running") {
    return <Badge variant="outline" className="border-primary/30 bg-primary/10 text-primary">Running</Badge>;
  }

  return <Badge variant="outline" className="border-muted-foreground/30 bg-muted text-muted-foreground">{status || "Unknown"}</Badge>;
}

function MetricCard({
  title,
  value,
  icon: Icon,
}: {
  title: string;
  value: string | number;
  icon: typeof Activity;
}) {
  return (
    <Card className="glass-card">
      <CardContent className="p-5">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm text-muted-foreground">{title}</p>
            <p className="mt-2 text-2xl font-bold font-serif">{value}</p>
          </div>
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Icon className="h-5 w-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function JobHistoryPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const statusFilter = searchParams.get("status") ?? "all";
  const fromDate = searchParams.get("from") ?? "";
  const toDate = searchParams.get("to") ?? "";
  const runningOnly = searchParams.get("running_only") === "true";

  const { data: runs = [], isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ["super-admin-job-history"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("automation_runs" as never)
        .select("id, started_at, completed_at, status, processed_count, error_message, created_at")
        .order("started_at", { ascending: false })
        .limit(100);

      if (error) {
        throw error;
      }

      return (data ?? []) as unknown as AutomationRun[];
    },
  });

  const updateFilter = (key: string, value: string) => {
    const next = new URLSearchParams(searchParams);
    if (!value || value === "all" || value === "false") {
      next.delete(key);
    } else {
      next.set(key, value);
    }
    setSearchParams(next);
  };

  const clearFilters = () => setSearchParams(new URLSearchParams());

  const filteredRuns = useMemo(() => {
    const fromTime = fromDate ? new Date(`${fromDate}T00:00:00`).getTime() : null;
    const toTime = toDate ? new Date(`${toDate}T23:59:59`).getTime() : null;

    return runs.filter((run) => {
      const startedTime = run.started_at ? new Date(run.started_at).getTime() : null;
      return (
        (statusFilter === "all" || run.status === statusFilter) &&
        (!runningOnly || run.status === "running") &&
        (fromTime === null || (startedTime !== null && startedTime >= fromTime)) &&
        (toTime === null || (startedTime !== null && startedTime <= toTime))
      );
    });
  }, [fromDate, runningOnly, runs, statusFilter, toDate]);

  const metrics = useMemo(() => {
    return filteredRuns.reduce(
      (acc, run) => {
        acc.total += 1;
        if (run.status === "completed") acc.success += 1;
        if (run.status === "failed") acc.failed += 1;
        if (run.status === "running") acc.running += 1;
        return acc;
      },
      { total: 0, success: 0, failed: 0, running: 0 },
    );
  }, [filteredRuns]);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold font-serif">Job History</h1>
          <p className="mt-1 text-sm text-muted-foreground">View execution history for scheduled platform jobs.</p>
        </div>
        <Button variant="outline" className="w-full sm:w-auto" onClick={() => refetch()} disabled={isFetching}>
          {isFetching ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
          Refresh
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard title="Total Runs" value={metrics.total} icon={History} />
        <MetricCard title="Successful Runs" value={metrics.success} icon={CheckCircle2} />
        <MetricCard title="Failed Runs" value={metrics.failed} icon={XCircle} />
        <MetricCard title="Running Jobs" value={metrics.running} icon={Activity} />
      </div>

      <FilterToolbar
        resultCount={filteredRuns.length}
        totalCount={runs.length}
        onClear={clearFilters}
        actions={
          <ExportButton
            rows={filteredRuns}
            filename="job-history.csv"
            columns={[
              { header: "Started", value: (run) => formatDateTime(run.started_at) },
              { header: "Completed", value: (run) => formatDateTime(run.completed_at) },
              { header: "Duration", value: (run) => formatDuration(run.started_at, run.completed_at) },
              { header: "Status", value: (run) => run.status },
              { header: "Processed", value: (run) => run.processed_count ?? 0 },
              { header: "Error", value: (run) => run.error_message || "" },
            ]}
          />
        }
      >
        <div>
          <Label>Status</Label>
          <Select value={statusFilter} onValueChange={(value) => updateFilter("status", value)}>
            <SelectTrigger className="mt-2"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="failed">Failed</SelectItem>
              <SelectItem value="running">Running</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label htmlFor="job-from">From</Label>
          <Input id="job-from" type="date" className="mt-2" value={fromDate} onChange={(event) => updateFilter("from", event.target.value)} />
        </div>
        <div>
          <Label htmlFor="job-to">To</Label>
          <Input id="job-to" type="date" className="mt-2" value={toDate} onChange={(event) => updateFilter("to", event.target.value)} />
        </div>
        <label className="flex min-h-[4.25rem] items-end gap-2 rounded-md border border-border/60 px-3 py-2 text-sm">
          <input
            type="checkbox"
            checked={runningOnly}
            onChange={(event) => updateFilter("running_only", event.target.checked ? "true" : "false")}
          />
          Running only
        </label>
      </FilterToolbar>

      <Card className="glass-card overflow-hidden">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-border hover:bg-transparent">
                  <TableHead>Started</TableHead>
                  <TableHead>Completed</TableHead>
                  <TableHead>Duration</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Processed</TableHead>
                  <TableHead>Error</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  Array.from({ length: 6 }).map((_, index) => (
                    <TableRow key={index}>
                      <TableCell colSpan={6} className="py-3">
                        <div className="h-8 animate-pulse rounded-md bg-secondary" />
                      </TableCell>
                    </TableRow>
                  ))
                ) : isError ? (
                  <TableRow>
                    <TableCell colSpan={6} className="py-12 text-center text-destructive">
                      <AlertCircle className="mx-auto mb-3 h-8 w-8" />
                      Unable to load job history: {(error as Error)?.message || "Unknown error"}
                    </TableCell>
                  </TableRow>
                ) : runs.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="py-12 text-center text-muted-foreground">
                      <History className="mx-auto mb-3 h-10 w-10 text-muted-foreground/30" />
                      No automation runs recorded
                    </TableCell>
                  </TableRow>
                ) : filteredRuns.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="py-12 text-center text-muted-foreground">
                      <History className="mx-auto mb-3 h-10 w-10 text-muted-foreground/30" />
                      No results match the current filters
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredRuns.map((run) => (
                    <TableRow key={run.id} className="border-border">
                      <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                        {formatDateTime(run.started_at)}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                        {formatDateTime(run.completed_at)}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                        {formatDuration(run.started_at, run.completed_at)}
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={run.status} />
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {(run.processed_count ?? 0).toLocaleString()}
                      </TableCell>
                      <TableCell className="max-w-[360px] truncate text-sm text-muted-foreground" title={run.error_message ?? undefined}>
                        {run.error_message || <span aria-label="No error">&mdash;</span>}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { Activity, AlertCircle, CheckCircle2, Clock3, Database, Loader2, ShieldAlert, XCircle } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ExportButton } from "@/components/super-admin/ExportButton";
import { FilterToolbar } from "@/components/super-admin/FilterToolbar";
import { supabase } from "@/integrations/supabase/client";

type AutomationRun = {
  id: string;
  run_date: string;
  status: "running" | "completed" | "failed";
  started_at: string | null;
  completed_at: string | null;
  error_message: string | null;
  processed_count: number;
};

type AutomationLog = {
  id: string;
  automation_type: string | null;
  sent_at: string | null;
  message: string | null;
};

type SystemAlert = {
  id: string;
  alert_type: string;
  severity: "info" | "warning" | "critical";
  title: string;
  message: string | null;
  source: string | null;
  resolved: boolean;
  created_at: string;
};

const dateTimeFormatter = new Intl.DateTimeFormat(undefined, {
  dateStyle: "medium",
  timeStyle: "short",
});

function formatDateTime(value: string | null) {
  return value ? dateTimeFormatter.format(new Date(value)) : "—";
}

function StatusBadge({ status }: { status: AutomationRun["status"] }) {
  const styles = {
    completed: "border-success/30 bg-success/10 text-success",
    failed: "border-destructive/30 bg-destructive/10 text-destructive",
    running: "border-primary/30 bg-primary/10 text-primary",
  };

  return (
    <Badge variant="outline" className={`capitalize ${styles[status]}`}>
      {status}
    </Badge>
  );
}

function SeverityBadge({ severity }: { severity: SystemAlert["severity"] }) {
  const styles = {
    critical: "border-destructive/30 bg-destructive/10 text-destructive",
    warning: "border-amber-500/30 bg-amber-500/10 text-amber-600",
    info: "border-primary/30 bg-primary/10 text-primary",
  };

  const labels = {
    critical: "Critical",
    warning: "Warning",
    info: "Info",
  };

  return (
    <Badge variant="outline" className={styles[severity]}>
      {labels[severity]}
    </Badge>
  );
}

function MetricCard({
  title,
  value,
  description,
  icon: Icon,
  tone = "primary",
}: {
  title: string;
  value: string | number;
  description: string;
  icon: typeof Activity;
  tone?: "primary" | "success" | "destructive";
}) {
  const tones = {
    primary: "bg-primary/10 text-primary",
    success: "bg-success/10 text-success",
    destructive: "bg-destructive/10 text-destructive",
  };

  return (
    <Card className="glass-card">
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-sm text-muted-foreground">{title}</p>
            <p className="mt-2 text-2xl font-bold font-serif">{value}</p>
            <p className="mt-1 text-xs text-muted-foreground">{description}</p>
          </div>
          <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${tones[tone]}`}>
            <Icon className="h-5 w-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function SystemHealthPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const severityFilter = searchParams.get("severity") ?? "all";
  const resolvedFilter = searchParams.get("resolved") ?? "all";
  const sourceFilter = searchParams.get("source") ?? "all";

  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ["system-health"],
    queryFn: async () => {
      const [runsResult, logsResult, alertsResult] = await Promise.all([
        supabase
          .from("automation_runs" as never)
          .select("id, run_date, status, started_at, completed_at, error_message, processed_count")
          .order("started_at", { ascending: false }),
        supabase
          .from("automation_logs" as never)
          .select("id, automation_type, sent_at, message")
          .order("sent_at", { ascending: false })
          .limit(50),
        supabase
          .from("system_alerts" as never)
          .select("id, alert_type, severity, title, message, source, resolved, created_at")
          .order("created_at", { ascending: false })
          .limit(10),
      ]);

      if (runsResult.error) throw runsResult.error;
      if (logsResult.error) throw logsResult.error;
      if (alertsResult.error) throw alertsResult.error;

      return {
        runs: (runsResult.data ?? []) as unknown as AutomationRun[],
        logs: (logsResult.data ?? []) as unknown as AutomationLog[],
        alerts: (alertsResult.data ?? []) as unknown as SystemAlert[],
      };
    },
  });

  const runs = useMemo(() => data?.runs ?? [], [data?.runs]);
  const logs = useMemo(() => data?.logs ?? [], [data?.logs]);
  const alerts = useMemo(() => data?.alerts ?? [], [data?.alerts]);
  const activeAlerts = useMemo(() => alerts.filter((alert) => !alert.resolved), [alerts]);
  const alertSources = useMemo(
    () => Array.from(new Set(alerts.map((alert) => alert.source || "system"))).sort(),
    [alerts],
  );
  const filteredAlerts = useMemo(
    () =>
      alerts.filter((alert) => {
        const source = alert.source || "system";
        return (
          (severityFilter === "all" || alert.severity === severityFilter) &&
          (resolvedFilter === "all" || String(alert.resolved) === resolvedFilter) &&
          (sourceFilter === "all" || source === sourceFilter)
        );
      }),
    [alerts, resolvedFilter, severityFilter, sourceFilter],
  );
  const latestRun = runs[0];
  const lastSuccessfulRun = runs.find((run) => run.status === "completed");
  const totalProcessed = runs.reduce((total, run) => total + run.processed_count, 0);
  const failedRuns = runs.filter((run) => run.status === "failed").length;

  const updateFilter = (key: string, value: string) => {
    const next = new URLSearchParams(searchParams);
    if (!value || value === "all") {
      next.delete(key);
    } else {
      next.set(key, value);
    }
    setSearchParams(next);
  };

  const clearFilters = () => setSearchParams(new URLSearchParams());

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold font-serif">System Health</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Monitor daily automations, recent run outcomes, and delivery activity.
          </p>
        </div>
        <Button variant="outline" onClick={() => refetch()} disabled={isFetching} className="gap-2 self-start">
          <Loader2 className={`h-4 w-4 ${isFetching ? "animate-spin" : "hidden"}`} />
          Refresh
        </Button>
      </div>

      {isLoading ? (
        <div className="flex min-h-72 items-center justify-center rounded-xl border border-border bg-card/50 text-muted-foreground">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Loading system health…
        </div>
      ) : isError ? (
        <Card className="border-destructive/30">
          <CardContent className="flex min-h-56 flex-col items-center justify-center p-6 text-center">
            <AlertCircle className="mb-3 h-10 w-10 text-destructive" />
            <h2 className="font-semibold">System health could not be loaded</h2>
            <p className="mt-1 max-w-lg text-sm text-muted-foreground">{error.message}</p>
            <Button className="mt-4" variant="outline" onClick={() => refetch()}>Try again</Button>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard
              title="Current automation status"
              value={latestRun ? latestRun.status : "No runs"}
              description={latestRun ? `Latest run: ${formatDateTime(latestRun.started_at)}` : "No automation runs recorded"}
              icon={latestRun?.status === "failed" ? XCircle : latestRun?.status === "completed" ? CheckCircle2 : Activity}
              tone={latestRun?.status === "failed" ? "destructive" : latestRun?.status === "completed" ? "success" : "primary"}
            />
            <MetricCard
              title="Last successful execution"
              value={lastSuccessfulRun ? formatDateTime(lastSuccessfulRun.completed_at ?? lastSuccessfulRun.started_at) : "Not available"}
              description={lastSuccessfulRun ? `${lastSuccessfulRun.processed_count} automations processed` : "No completed runs recorded"}
              icon={Clock3}
              tone="success"
            />
            <MetricCard
              title="Total processed automations"
              value={totalProcessed.toLocaleString()}
              description="Across all recorded runs"
              icon={Database}
            />
            <MetricCard
              title="Failed run count"
              value={failedRuns}
              description={failedRuns ? "Review errors in recent runs" : "No failed runs recorded"}
              icon={ShieldAlert}
              tone={failedRuns ? "destructive" : "success"}
            />
            <MetricCard
              title="Active Alerts"
              value={activeAlerts.length}
              description={activeAlerts.length ? "Unresolved system alerts need review" : "No active system alerts"}
              icon={AlertCircle}
              tone={activeAlerts.some((alert) => alert.severity === "critical") ? "destructive" : activeAlerts.length ? "primary" : "success"}
            />
          </div>

          <Card className="glass-card overflow-hidden">
            <CardHeader className="border-b border-border/70">
              <CardTitle className="font-serif text-lg">System Alerts</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 p-4">
              <FilterToolbar
                resultCount={filteredAlerts.length}
                totalCount={alerts.length}
                onClear={clearFilters}
                actions={
                  <ExportButton
                    rows={filteredAlerts}
                    filename="system-alerts.csv"
                    columns={[
                      { header: "Severity", value: (alert) => alert.severity },
                      { header: "Title", value: (alert) => alert.title },
                      { header: "Message", value: (alert) => alert.message || "" },
                      { header: "Source", value: (alert) => alert.source || "system" },
                      { header: "Created", value: (alert) => formatDateTime(alert.created_at) },
                      { header: "Resolved", value: (alert) => alert.resolved ? "Resolved" : "Active" },
                    ]}
                  />
                }
              >
                <div>
                  <Label>Severity</Label>
                  <Select value={severityFilter} onValueChange={(value) => updateFilter("severity", value)}>
                    <SelectTrigger className="mt-2"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All severities</SelectItem>
                      <SelectItem value="critical">Critical</SelectItem>
                      <SelectItem value="warning">Warning</SelectItem>
                      <SelectItem value="info">Info</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Resolved</Label>
                  <Select value={resolvedFilter} onValueChange={(value) => updateFilter("resolved", value)}>
                    <SelectTrigger className="mt-2"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All statuses</SelectItem>
                      <SelectItem value="false">Active</SelectItem>
                      <SelectItem value="true">Resolved</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Source</Label>
                  <Select value={sourceFilter} onValueChange={(value) => updateFilter("source", value)}>
                    <SelectTrigger className="mt-2"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All sources</SelectItem>
                      {alertSources.map((source) => <SelectItem key={source} value={source}>{source}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </FilterToolbar>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Severity</TableHead>
                      <TableHead>Title</TableHead>
                      <TableHead>Message</TableHead>
                      <TableHead>Source</TableHead>
                      <TableHead>Created</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {alerts.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="py-12 text-center text-muted-foreground">
                          No active system alerts
                        </TableCell>
                      </TableRow>
                    ) : filteredAlerts.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="py-12 text-center text-muted-foreground">
                          No results match the current filters
                        </TableCell>
                      </TableRow>
                    ) : filteredAlerts.map((alert) => (
                      <TableRow key={alert.id}>
                        <TableCell><SeverityBadge severity={alert.severity} /></TableCell>
                        <TableCell className="font-medium">{alert.title}</TableCell>
                        <TableCell className="max-w-xl truncate text-sm text-muted-foreground" title={alert.message ?? undefined}>
                          {alert.message || "â€”"}
                        </TableCell>
                        <TableCell className="capitalize text-sm text-muted-foreground">{alert.source || "system"}</TableCell>
                        <TableCell className="whitespace-nowrap text-sm text-muted-foreground">{formatDateTime(alert.created_at)}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className={alert.resolved ? "border-success/30 bg-success/10 text-success" : "border-primary/30 bg-primary/10 text-primary"}>
                            {alert.resolved ? "Resolved" : "Active"}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          <Card className="glass-card overflow-hidden">
            <CardHeader className="border-b border-border/70">
              <CardTitle className="font-serif text-lg">Recent Runs</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead><TableHead>Status</TableHead><TableHead>Started</TableHead><TableHead>Completed</TableHead><TableHead>Processed</TableHead><TableHead>Error</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {runs.length === 0 ? (
                      <TableRow><TableCell colSpan={6} className="py-12 text-center text-muted-foreground">No automation runs have been recorded yet.</TableCell></TableRow>
                    ) : runs.map((run) => (
                      <TableRow key={run.id}>
                        <TableCell className="font-medium">{run.run_date}</TableCell>
                        <TableCell><StatusBadge status={run.status} /></TableCell>
                        <TableCell className="whitespace-nowrap text-sm text-muted-foreground">{formatDateTime(run.started_at)}</TableCell>
                        <TableCell className="whitespace-nowrap text-sm text-muted-foreground">{formatDateTime(run.completed_at)}</TableCell>
                        <TableCell>{run.processed_count.toLocaleString()}</TableCell>
                        <TableCell className="max-w-72 truncate text-sm text-muted-foreground" title={run.error_message ?? undefined}>{run.error_message || "—"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          <Card className="glass-card overflow-hidden">
            <CardHeader className="border-b border-border/70">
              <CardTitle className="font-serif text-lg">Automation Activity</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader><TableRow><TableHead>Type</TableHead><TableHead>Sent time</TableHead><TableHead>Message preview</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {logs.length === 0 ? (
                      <TableRow><TableCell colSpan={3} className="py-12 text-center text-muted-foreground">No automation activity has been recorded yet.</TableCell></TableRow>
                    ) : logs.map((log) => (
                      <TableRow key={log.id}>
                        <TableCell className="font-medium capitalize">{log.automation_type?.replaceAll("_", " ") || "Automation"}</TableCell>
                        <TableCell className="whitespace-nowrap text-sm text-muted-foreground">{formatDateTime(log.sent_at)}</TableCell>
                        <TableCell className="max-w-xl truncate text-sm text-muted-foreground" title={log.message ?? undefined}>{log.message || "—"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

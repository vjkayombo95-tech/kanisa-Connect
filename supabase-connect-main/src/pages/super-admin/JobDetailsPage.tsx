import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useParams } from "react-router-dom";
import { Activity, AlertCircle, CalendarClock, CheckCircle2, Clock3, Loader2, RefreshCw, TrendingUp, XCircle } from "lucide-react";
import { Line, LineChart, Tooltip, XAxis, YAxis } from "recharts";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer } from "@/components/ui/chart";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { SystemJobActions, type SystemJobActionJob } from "./SystemJobActions";

type SystemJob = SystemJobActionJob & {
  description: string | null;
  schedule: string | null;
  last_run_at: string | null;
  last_status: string | null;
  last_duration_ms: number | null;
};

type AutomationRun = {
  id: string;
  started_at: string | null;
  completed_at: string | null;
  status: "running" | "completed" | "failed" | string;
  processed_count: number | null;
  error_message: string | null;
  created_at: string | null;
};

type SystemAlert = {
  id: string;
  severity: "info" | "warning" | "critical" | string;
  title: string;
  message: string | null;
  created_at: string;
  resolved: boolean;
};

const dateTimeFormatter = new Intl.DateTimeFormat(undefined, {
  dateStyle: "medium",
  timeStyle: "short",
});

function formatDateTime(value: string | null) {
  return value ? dateTimeFormatter.format(new Date(value)) : "-";
}

function durationMs(startedAt: string | null, completedAt: string | null) {
  if (!startedAt || !completedAt) return null;
  const value = new Date(completedAt).getTime() - new Date(startedAt).getTime();
  return Number.isFinite(value) && value >= 0 ? value : null;
}

function formatRunDuration(startedAt: string | null, completedAt: string | null) {
  if (!completedAt) return "In Progress";
  const value = durationMs(startedAt, completedAt);
  if (value === null) return "-";
  if (value < 1000) return `${value} ms`;
  return `${(value / 1000).toFixed(1)} s`;
}

function formatJobDuration(value: number | null) {
  if (value === null || value === undefined) return "-";
  if (value < 1000) return `${value} ms`;
  return `${(value / 1000).toFixed(1)} s`;
}

function formatDurationMs(value: number | null) {
  if (value === null || value === undefined) return "-";
  return `${value.toLocaleString()} ms`;
}

function getNextScheduledRun(schedule: string | null) {
  if (!schedule) return "Unknown";
  return schedule.trim().toLowerCase() === "daily" ? "Tomorrow 06:00 EAT" : "Unknown";
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

function LastStatusBadge({ status }: { status: string | null }) {
  const normalized = status?.trim().toLowerCase() || "pending";

  if (normalized === "success" || normalized === "completed") {
    return <Badge variant="outline" className="border-success/30 bg-success/10 text-success">Success</Badge>;
  }

  if (normalized === "failed" || normalized === "error") {
    return <Badge variant="outline" className="border-destructive/30 bg-destructive/10 text-destructive">Failed</Badge>;
  }

  return <Badge variant="outline" className="border-amber-500/30 bg-amber-500/10 text-amber-600">Pending</Badge>;
}

function SeverityBadge({ severity }: { severity: SystemAlert["severity"] }) {
  if (severity === "critical") {
    return <Badge variant="outline" className="border-destructive/30 bg-destructive/10 text-destructive">Critical</Badge>;
  }

  if (severity === "warning") {
    return <Badge variant="outline" className="border-amber-500/30 bg-amber-500/10 text-amber-600">Warning</Badge>;
  }

  return <Badge variant="outline" className="border-primary/30 bg-primary/10 text-primary">Info</Badge>;
}

function MetricCard({
  title,
  value,
  icon: Icon,
  valueClassName = "",
}: {
  title: string;
  value: string | number;
  icon: typeof Activity;
  valueClassName?: string;
}) {
  return (
    <Card className="glass-card">
      <CardContent className="p-5">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm text-muted-foreground">{title}</p>
            <p className={`mt-2 text-2xl font-bold font-serif ${valueClassName}`}>{value}</p>
          </div>
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Icon className="h-5 w-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function JobDetailsPage() {
  const { jobId } = useParams();
  const [pollingState, setPollingState] = useState<{ baselineStatus: string | null; startedAt: number } | null>(null);

  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ["super-admin-job-details", jobId],
    enabled: Boolean(jobId),
    queryFn: async () => {
      const [jobResult, runsResult, alertsResult] = await Promise.all([
        supabase
          .from("system_jobs" as never)
          .select("id, job_name, description, schedule, enabled, last_run_at, last_status, last_duration_ms")
          .eq("id", jobId)
          .maybeSingle(),
        supabase
          .from("automation_runs" as never)
          .select("id, started_at, completed_at, status, processed_count, error_message, created_at")
          .order("started_at", { ascending: false })
          .limit(50),
        supabase
          .from("system_alerts" as never)
          .select("id, severity, title, message, created_at, resolved")
          .eq("source", "automation")
          .eq("resolved", false)
          .order("created_at", { ascending: false }),
      ]);

      if (jobResult.error) throw jobResult.error;
      if (runsResult.error) throw runsResult.error;
      if (alertsResult.error) throw alertsResult.error;

      return {
        job: jobResult.data as unknown as SystemJob | null,
        runs: (runsResult.data ?? []) as unknown as AutomationRun[],
        alerts: (alertsResult.data ?? []) as unknown as SystemAlert[],
      };
    },
  });

  const job = data?.job ?? null;
  const runs = data?.runs ?? [];
  const recentRuns = runs.slice(0, 20);
  const alerts = data?.alerts ?? [];

  const metrics = useMemo(() => {
    const durations = runs
      .map((run) => durationMs(run.started_at, run.completed_at))
      .filter((value): value is number => value !== null);

    return {
      total: runs.length,
      success: runs.filter((run) => run.status === "completed").length,
      failed: runs.filter((run) => run.status === "failed").length,
      averageDuration: durations.length
        ? Math.round(durations.reduce((total, value) => total + value, 0) / durations.length)
        : "-",
    };
  }, [runs]);

  const intelligence = useMemo(() => {
    const latestThirtyRuns = runs.slice(0, 30);
    const completedRuns = latestThirtyRuns.filter((run) => run.status === "completed");
    const failedRuns = latestThirtyRuns.filter((run) => run.status === "failed");
    const successRateBase = completedRuns.length + failedRuns.length;
    const successRate = successRateBase ? Math.round((completedRuns.length / successRateBase) * 100) : null;
    const successRateClass =
      successRate === null
        ? "text-muted-foreground"
        : successRate >= 95
          ? "text-success"
          : successRate >= 80
            ? "text-amber-600"
            : "text-destructive";

    const completedTrend = runs
      .filter((run) => run.status === "completed")
      .map((run) => ({ run, duration: durationMs(run.started_at, run.completed_at) }))
      .filter((item): item is { run: AutomationRun; duration: number } => item.duration !== null)
      .slice(0, 20)
      .reverse()
      .map((item, index) => ({
        execution: index + 1,
        duration: item.duration,
      }));

    const latestFailure = runs.find((run) => run.status === "failed") ?? null;
    const latestFailureDuration = latestFailure ? durationMs(latestFailure.started_at, latestFailure.completed_at) : null;

    return {
      successRate,
      successRateClass,
      chartData: completedTrend,
      latestFailure,
      latestFailureDuration,
      nextScheduledRun: getNextScheduledRun(job?.schedule ?? null),
      latestRun: runs[0] ?? null,
    };
  }, [job?.schedule, runs]);

  useEffect(() => {
    if (!pollingState) return;

    const statusChanged = (job?.last_status ?? null) !== pollingState.baselineStatus;
    const elapsedMs = Date.now() - pollingState.startedAt;

    if (statusChanged || elapsedMs >= 30000) {
      setPollingState(null);
      return;
    }

    const intervalId = window.setInterval(() => {
      void refetch();
    }, 3000);

    return () => window.clearInterval(intervalId);
  }, [job?.last_status, pollingState, refetch]);

  const startRunPolling = () => {
    setPollingState({ baselineStatus: job?.last_status ?? null, startedAt: Date.now() });
  };

  if (isLoading) {
    return (
      <div className="flex min-h-72 items-center justify-center rounded-xl border border-border bg-card/50 text-muted-foreground">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Loading job details...
      </div>
    );
  }

  if (isError) {
    return (
      <Card className="border-destructive/30">
        <CardContent className="flex min-h-56 flex-col items-center justify-center p-6 text-center">
          <AlertCircle className="mb-3 h-10 w-10 text-destructive" />
          <h1 className="font-semibold">Job details could not be loaded</h1>
          <p className="mt-1 max-w-lg text-sm text-muted-foreground">{(error as Error)?.message || "Unknown error"}</p>
          <Button className="mt-4" variant="outline" onClick={() => refetch()}>Try again</Button>
        </CardContent>
      </Card>
    );
  }

  if (!job) {
    return (
      <Card className="glass-card">
        <CardContent className="flex min-h-56 flex-col items-center justify-center p-6 text-center text-muted-foreground">
          <Clock3 className="mb-3 h-10 w-10 text-muted-foreground/30" />
          Scheduled job not found
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold font-serif">Job Details</h1>
          <p className="mt-1 text-sm text-muted-foreground">{job.job_name}</p>
        </div>
        <Button variant="outline" className="w-full sm:w-auto" onClick={() => refetch()} disabled={isFetching}>
          {isFetching ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
          Refresh
        </Button>
      </div>

      <Card className="glass-card">
        <CardContent className="grid gap-4 p-5 sm:grid-cols-2 xl:grid-cols-4">
          <div>
            <p className="text-xs text-muted-foreground">Job Name</p>
            <p className="mt-1 font-medium">{job.job_name}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Description</p>
            <p className="mt-1 text-sm">{job.description || "-"}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Schedule</p>
            <p className="mt-1 text-sm">{job.schedule || "-"}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Enabled</p>
            <Badge
              variant="outline"
              className={
                job.enabled
                  ? "mt-1 border-success/30 bg-success/10 text-success"
                  : "mt-1 border-muted-foreground/30 bg-muted text-muted-foreground"
              }
            >
              {job.enabled ? "Enabled" : "Disabled"}
            </Badge>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Last Run</p>
            <p className="mt-1 text-sm">{formatDateTime(job.last_run_at)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Last Status</p>
            <div className="mt-1"><LastStatusBadge status={job.last_status} /></div>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Last Duration</p>
            <p className="mt-1 text-sm">{formatJobDuration(job.last_duration_ms)}</p>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard title="Total Runs" value={metrics.total} icon={Clock3} />
        <MetricCard title="Successful Runs" value={metrics.success} icon={CheckCircle2} />
        <MetricCard title="Failed Runs" value={metrics.failed} icon={XCircle} />
        <MetricCard title="Average Duration (ms)" value={metrics.averageDuration} icon={Activity} />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-4">
        <MetricCard
          title="Success Rate"
          value={intelligence.successRate === null ? "N/A" : `${intelligence.successRate}%`}
          icon={TrendingUp}
          valueClassName={intelligence.successRateClass}
        />
        <MetricCard
          title="Next Scheduled Run"
          value={intelligence.nextScheduledRun}
          icon={CalendarClock}
          valueClassName="text-lg leading-tight"
        />
        <Card className="glass-card xl:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="font-sans text-base">Latest Failure</CardTitle>
          </CardHeader>
          <CardContent>
            {intelligence.latestFailure ? (
              <div className="grid gap-3 sm:grid-cols-3">
                <div>
                  <p className="text-xs text-muted-foreground">Started</p>
                  <p className="mt-1 text-sm">{formatDateTime(intelligence.latestFailure.started_at)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Duration</p>
                  <p className="mt-1 text-sm">{formatDurationMs(intelligence.latestFailureDuration)}</p>
                </div>
                <div className="sm:col-span-1">
                  <p className="text-xs text-muted-foreground">Error message</p>
                  <p className="mt-1 line-clamp-2 text-sm" title={intelligence.latestFailure.error_message ?? undefined}>
                    {intelligence.latestFailure.error_message || "-"}
                  </p>
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No recent failures.</p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="font-sans text-base">Performance Trend</CardTitle>
        </CardHeader>
        <CardContent>
          {intelligence.chartData.length < 2 ? (
            <div className="flex h-48 items-center justify-center rounded-lg border border-border/70 bg-secondary/20 text-sm text-muted-foreground">
              Not enough history
            </div>
          ) : (
            <ChartContainer
              config={{ duration: { label: "Duration", color: "hsl(var(--primary))" } }}
              className="h-56 w-full"
            >
              <LineChart data={intelligence.chartData} margin={{ left: 12, right: 12, top: 12, bottom: 6 }}>
                <XAxis dataKey="execution" stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis
                  stroke="hsl(var(--muted-foreground))"
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(value) => `${Number(value).toLocaleString()} ms`}
                />
                <Tooltip
                  contentStyle={{
                    background: "hsl(var(--background))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "8px",
                    color: "hsl(var(--foreground))",
                  }}
                  formatter={(value: number) => [`${value.toLocaleString()} ms`, "Duration"]}
                  labelFormatter={(label) => `Execution ${label}`}
                />
                <Line type="monotone" dataKey="duration" stroke="var(--color-duration)" strokeWidth={2} dot={false} />
              </LineChart>
            </ChartContainer>
          )}
        </CardContent>
      </Card>

      <Card className="glass-card">
        <CardContent className="p-5">
          <div className="mb-4">
            <h2 className="font-serif text-lg font-semibold">Actions</h2>
          </div>
          <div className="flex flex-wrap gap-2">
            <SystemJobActions
              job={job}
              onCompleted={refetch}
              onRunStarted={startRunPolling}
              showRetryFailedRun={intelligence.latestRun?.status === "failed"}
            />
            <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
              {isFetching ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
              Refresh
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="glass-card overflow-hidden">
        <CardContent className="p-0">
          <div className="border-b border-border/70 p-5">
            <h2 className="font-serif text-lg font-semibold">Recent Executions</h2>
          </div>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Started</TableHead>
                  <TableHead>Completed</TableHead>
                  <TableHead>Duration</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Processed Count</TableHead>
                  <TableHead>Error Message</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentRuns.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="py-12 text-center text-muted-foreground">
                      No automation runs recorded
                    </TableCell>
                  </TableRow>
                ) : (
                  recentRuns.map((run) => (
                    <TableRow key={run.id}>
                      <TableCell className="whitespace-nowrap text-xs text-muted-foreground">{formatDateTime(run.started_at)}</TableCell>
                      <TableCell className="whitespace-nowrap text-xs text-muted-foreground">{formatDateTime(run.completed_at)}</TableCell>
                      <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                        {formatRunDuration(run.started_at, run.completed_at)}
                      </TableCell>
                      <TableCell><StatusBadge status={run.status} /></TableCell>
                      <TableCell className="text-sm text-muted-foreground">{(run.processed_count ?? 0).toLocaleString()}</TableCell>
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

      <Card className="glass-card overflow-hidden">
        <CardContent className="p-0">
          <div className="border-b border-border/70 p-5">
            <h2 className="font-serif text-lg font-semibold">System Alerts</h2>
          </div>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Severity</TableHead>
                  <TableHead>Title</TableHead>
                  <TableHead>Message</TableHead>
                  <TableHead>Created At</TableHead>
                  <TableHead>Resolved</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {alerts.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="py-12 text-center text-muted-foreground">
                      No active alerts.
                    </TableCell>
                  </TableRow>
                ) : (
                  alerts.map((alert) => (
                    <TableRow key={alert.id}>
                      <TableCell><SeverityBadge severity={alert.severity} /></TableCell>
                      <TableCell className="font-medium">{alert.title}</TableCell>
                      <TableCell className="max-w-[420px] truncate text-sm text-muted-foreground" title={alert.message ?? undefined}>
                        {alert.message || "-"}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-xs text-muted-foreground">{formatDateTime(alert.created_at)}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={alert.resolved ? "border-success/30 bg-success/10 text-success" : "border-primary/30 bg-primary/10 text-primary"}>
                          {alert.resolved ? "Resolved" : "Active"}
                        </Badge>
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

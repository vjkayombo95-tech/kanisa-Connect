import { memo, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Activity,
  AlertCircle,
  CheckCircle2,
  Clock3,
  Database,
  HardDrive,
  Loader2,
  Radio,
  RefreshCw,
  ShieldCheck,
  UploadCloud,
} from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAuth } from "@/contexts/AuthContext";
import { fetchOperationsHealth, fetchOperationsMetrics, type OperationalEvent, type OperationsCheck, type OperationsMetrics, type WorkerHealth } from "@/lib/operations";

const dateTimeFormatter = new Intl.DateTimeFormat(undefined, {
  dateStyle: "medium",
  timeStyle: "short",
});

function formatDateTime(value?: string | null) {
  return value ? dateTimeFormatter.format(new Date(value)) : "-";
}

function formatDuration(seconds: number) {
  if (!Number.isFinite(seconds) || seconds <= 0) return "-";
  if (seconds < 60) return `${seconds.toFixed(1)} s`;
  return `${(seconds / 60).toFixed(1)} min`;
}

function formatBytes(bytes: number) {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / 1024 ** index).toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
}

function normalizeLabel(value?: string | null) {
  return value ? value.replaceAll("_", " ") : "Unknown";
}

function StatusBadge({ status }: { status?: string }) {
  const normalized = (status ?? "missing").toLowerCase();
  const className =
    normalized === "ok" || normalized === "online"
      ? "border-success/30 bg-success/10 text-success"
      : normalized === "warning" || normalized === "stale"
        ? "border-amber-500/30 bg-amber-500/10 text-amber-600"
        : "border-destructive/30 bg-destructive/10 text-destructive";

  return (
    <Badge variant="outline" className={`capitalize ${className}`}>
      {normalizeLabel(normalized)}
    </Badge>
  );
}

const MetricCard = memo(function MetricCard({
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
  tone?: "primary" | "success" | "warning" | "destructive";
}) {
  const tones = {
    primary: "bg-primary/10 text-primary",
    success: "bg-success/10 text-success",
    warning: "bg-amber-500/10 text-amber-600",
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
});

const HealthCard = memo(function HealthCard({ title, check }: { title: string; check?: OperationsCheck | WorkerHealth }) {
  const status = (check as OperationsCheck | undefined)?.status ?? (check as WorkerHealth | undefined)?.health ?? "missing";
  const message = (check as OperationsCheck | undefined)?.message ?? (check as WorkerHealth | undefined)?.status ?? "No signal recorded";

  return (
    <Card className="glass-card">
      <CardContent className="flex items-start justify-between gap-4 p-4">
        <div className="min-w-0">
          <p className="font-medium">{title}</p>
          <p className="mt-1 truncate text-sm text-muted-foreground">{message}</p>
          {"last_seen_at" in (check ?? {}) ? (
            <p className="mt-1 text-xs text-muted-foreground">Last seen {formatDateTime((check as WorkerHealth).last_seen_at)}</p>
          ) : null}
        </div>
        <StatusBadge status={status} />
      </CardContent>
    </Card>
  );
});

const EventsTable = memo(function EventsTable({ events }: { events: OperationalEvent[] }) {
  return (
    <Card className="glass-card overflow-hidden">
      <CardHeader className="border-b border-border/70">
        <CardTitle className="font-serif text-lg">Operational Events</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Time</TableHead>
                <TableHead>Event</TableHead>
                <TableHead>Severity</TableHead>
                <TableHead>Source</TableHead>
                <TableHead>Message</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {events.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="py-12 text-center text-muted-foreground">
                    No operational events recorded yet.
                  </TableCell>
                </TableRow>
              ) : (
                events.map((event) => (
                  <TableRow key={event.id}>
                    <TableCell className="whitespace-nowrap text-sm text-muted-foreground">{formatDateTime(event.created_at)}</TableCell>
                    <TableCell className="whitespace-nowrap font-medium capitalize">{normalizeLabel(event.event_type)}</TableCell>
                    <TableCell><StatusBadge status={event.severity === "info" ? "ok" : event.severity} /></TableCell>
                    <TableCell className="whitespace-nowrap text-sm text-muted-foreground">{event.source}</TableCell>
                    <TableCell className="max-w-xl truncate text-sm text-muted-foreground" title={event.message ?? undefined}>
                      {event.message || "-"}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
});

function metricsCards(metrics: OperationsMetrics) {
  return [
    {
      title: "Queue Length",
      value: metrics.queueDepth,
      description: `${metrics.processingJobs} currently processing`,
      icon: UploadCloud,
      tone: metrics.queueDepth > 20 ? "warning" : "primary",
    },
    {
      title: "Worker Status",
      value: normalizeLabel(metrics.workerStatus.health ?? metrics.workerStatus.status),
      description: `Python: ${normalizeLabel(metrics.pythonWorkerStatus.health ?? metrics.pythonWorkerStatus.status)}`,
      icon: Radio,
      tone: metrics.workerStatus.health === "online" ? "success" : "warning",
    },
    {
      title: "Failed Jobs",
      value: metrics.failedJobs,
      description: `${metrics.errorRate.toFixed(2)}% error rate`,
      icon: AlertCircle,
      tone: metrics.failedJobs ? "destructive" : "success",
    },
    {
      title: "Average Processing",
      value: formatDuration(metrics.averageProcessingSeconds),
      description: "Completed audio jobs",
      icon: Clock3,
      tone: "primary",
    },
    {
      title: "Storage Usage",
      value: formatBytes(metrics.storageBytes),
      description: "Registered audio assets",
      icon: HardDrive,
      tone: "primary",
    },
    {
      title: "Published Audio",
      value: metrics.publishedAudioCount,
      description: "Member-visible versions",
      icon: CheckCircle2,
      tone: "success",
    },
    {
      title: "Pending Reviews",
      value: metrics.pendingReviews,
      description: "Awaiting reviewer action",
      icon: ShieldCheck,
      tone: metrics.pendingReviews ? "warning" : "success",
    },
    {
      title: "QA Confidence",
      value: `${(metrics.averageQaConfidence * 100).toFixed(1)}%`,
      description: "Average verse confidence",
      icon: Database,
      tone: "primary",
    },
  ] as const;
}

export default function OperationsPage() {
  const { churchId } = useAuth();

  const metricsQuery = useQuery({
    queryKey: ["operations-metrics", churchId],
    queryFn: () => fetchOperationsMetrics(churchId!),
    enabled: !!churchId,
    refetchInterval: 60_000,
  });

  const healthQuery = useQuery({
    queryKey: ["operations-health", churchId],
    queryFn: () => fetchOperationsHealth(churchId!),
    enabled: !!churchId,
    refetchInterval: 60_000,
  });

  const metrics = useMemo(
    () => healthQuery.data?.metrics ?? metricsQuery.data,
    [healthQuery.data?.metrics, metricsQuery.data],
  );
  const cards = useMemo(() => (metrics ? metricsCards(metrics) : []), [metrics]);
  const isLoading = metricsQuery.isLoading || healthQuery.isLoading;
  const isFetching = metricsQuery.isFetching || healthQuery.isFetching;
  const loadError = metricsQuery.error ?? healthQuery.error;

  const refresh = () => {
    void metricsQuery.refetch();
    void healthQuery.refetch();
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold font-serif">Operations</h1>
          <p className="mt-1 text-sm text-muted-foreground">Production health, queue telemetry, workers, and audio operations events.</p>
        </div>
        <Button variant="outline" className="w-full gap-2 sm:w-auto" onClick={refresh} disabled={isFetching || !churchId}>
          {isFetching ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          Refresh
        </Button>
      </div>

      {!churchId ? (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>No church context</AlertTitle>
          <AlertDescription>Operations metrics need an active church workspace.</AlertDescription>
        </Alert>
      ) : null}

      {loadError ? (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Operations data could not be loaded</AlertTitle>
          <AlertDescription>{loadError.message}</AlertDescription>
        </Alert>
      ) : null}

      {isLoading ? (
        <div className="flex min-h-72 items-center justify-center rounded-xl border border-border bg-card/50 text-muted-foreground">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Loading operations telemetry...
        </div>
      ) : metrics ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {cards.map((card) => (
              <MetricCard key={card.title} {...card} />
            ))}
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <HealthCard title="Database Connectivity" check={healthQuery.data?.database} />
            <HealthCard title="Supabase Storage" check={healthQuery.data?.storage} />
            <HealthCard title="Edge Functions" check={healthQuery.data?.edgeFunctions} />
            <HealthCard title="Queue Status" check={healthQuery.data?.queue} />
            <HealthCard title="Worker Heartbeat" check={metrics.workerStatus} />
            <HealthCard title="Python Worker Heartbeat" check={metrics.pythonWorkerStatus} />
          </div>

          <EventsTable events={metrics.recentEvents} />
        </>
      ) : null}
    </div>
  );
}

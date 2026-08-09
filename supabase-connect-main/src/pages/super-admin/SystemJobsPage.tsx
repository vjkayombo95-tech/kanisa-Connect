import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { Activity, CheckCircle2, Clock3, Loader2, PauseCircle, PlayCircle, RefreshCw } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { LoadingState } from "@/components/ui/page-state";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { SystemJobActions } from "./SystemJobActions";

type SystemJob = {
  id: string;
  job_name: string;
  description: string | null;
  schedule: string | null;
  enabled: boolean;
  last_run_at: string | null;
  last_status: string | null;
  last_duration_ms: number | null;
};

const dateTimeFormatter = new Intl.DateTimeFormat(undefined, {
  dateStyle: "medium",
  timeStyle: "short",
});

function formatDateTime(value: string | null) {
  return value ? dateTimeFormatter.format(new Date(value)) : "-";
}

function formatDuration(value: number | null) {
  if (value === null || value === undefined) return "-";
  if (value < 1000) return `${value} ms`;
  return `${(value / 1000).toFixed(1)} s`;
}

function normalizeStatus(status: string | null) {
  return status?.trim().toLowerCase() || "pending";
}

function LastStatusBadge({ status }: { status: string | null }) {
  const normalized = normalizeStatus(status);

  if (normalized === "success" || normalized === "completed") {
    return <Badge variant="outline" className="border-success/30 bg-success/10 text-success">Success</Badge>;
  }

  if (normalized === "failed" || normalized === "error") {
    return <Badge variant="outline" className="border-destructive/30 bg-destructive/10 text-destructive">Failed</Badge>;
  }

  return <Badge variant="outline" className="border-amber-500/30 bg-amber-500/10 text-amber-600">Pending</Badge>;
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

export default function SystemJobsPage() {
  const navigate = useNavigate();
  const { data: jobs = [], isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ["super-admin-system-jobs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("system_jobs" as never)
        .select("id, job_name, description, schedule, enabled, last_run_at, last_status, last_duration_ms")
        .order("job_name", { ascending: true });

      if (error) {
        throw error;
      }

      return (data ?? []) as unknown as SystemJob[];
    },
  });

  const metrics = useMemo(() => {
    return jobs.reduce(
      (acc, job) => {
        const status = normalizeStatus(job.last_status);

        acc.total += 1;
        if (job.enabled) acc.enabled += 1;
        if (!job.enabled) acc.disabled += 1;
        if (status === "success" || status === "completed") acc.success += 1;

        return acc;
      },
      { total: 0, enabled: 0, disabled: 0, success: 0 },
    );
  }, [jobs]);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold font-serif">Scheduled Jobs</h1>
          <p className="mt-1 text-sm text-muted-foreground">Manage and monitor scheduled platform jobs</p>
        </div>
        <Button variant="outline" className="w-full sm:w-auto" onClick={() => refetch()} disabled={isFetching}>
          {isFetching ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
          Refresh
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard title="Total Jobs" value={metrics.total} icon={Clock3} />
        <MetricCard title="Enabled Jobs" value={metrics.enabled} icon={PlayCircle} />
        <MetricCard title="Disabled Jobs" value={metrics.disabled} icon={PauseCircle} />
        <MetricCard title="Jobs with Success Status" value={metrics.success} icon={CheckCircle2} />
      </div>

      <Card className="glass-card overflow-hidden">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-border hover:bg-transparent">
                  <TableHead>Job Name</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Schedule</TableHead>
                  <TableHead>Enabled</TableHead>
                  <TableHead>Last Run</TableHead>
                  <TableHead>Last Status</TableHead>
                  <TableHead>Last Duration</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={8} className="py-12 text-center text-muted-foreground">
                      <LoadingState variant="table" rows={4} title="Loading scheduled jobs" />
                    </TableCell>
                  </TableRow>
                ) : isError ? (
                  <TableRow>
                    <TableCell colSpan={8} className="py-12 text-center">
                      <div className="mx-auto max-w-md space-y-3 text-muted-foreground">
                        <p className="font-medium text-foreground">We could not load scheduled jobs.</p>
                        <p className="text-sm">Please retry before reviewing automation health.</p>
                        <Button type="button" variant="outline" size="sm" onClick={() => refetch()}>
                          <RefreshCw className="mr-2 h-3.5 w-3.5" />
                          Retry
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : jobs.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="py-12 text-center text-muted-foreground">
                      <Clock3 className="mx-auto mb-3 h-10 w-10 text-muted-foreground/30" />
                      <p className="font-medium text-foreground">No scheduled jobs are configured.</p>
                      <p className="mt-1 text-sm">Platform automation jobs will appear here when they are registered.</p>
                    </TableCell>
                  </TableRow>
                ) : (
                  jobs.map((job) => (
                    <TableRow key={job.id} className="border-border">
                      <TableCell className="whitespace-nowrap font-medium">{job.job_name}</TableCell>
                      <TableCell className="max-w-[320px] truncate text-sm text-muted-foreground">
                        {job.description || "-"}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                        {job.schedule || "-"}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={
                            job.enabled
                              ? "border-success/30 bg-success/10 text-success"
                              : "border-muted-foreground/30 bg-muted text-muted-foreground"
                          }
                        >
                          {job.enabled ? "Enabled" : "Disabled"}
                        </Badge>
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                        {formatDateTime(job.last_run_at)}
                      </TableCell>
                      <TableCell>
                        <LastStatusBadge status={job.last_status} />
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                        {formatDuration(job.last_duration_ms)}
                      </TableCell>
                      <TableCell>
                        <SystemJobActions
                          job={job}
                          onCompleted={refetch}
                          onViewDetails={() => navigate(`/super-admin/system-jobs/${job.id}`)}
                        />
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

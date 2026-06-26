import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Activity, AlertCircle, CheckCircle2, Clock3, Loader2, PauseCircle, PlayCircle, RefreshCw } from "lucide-react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

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
  const { toast } = useToast();
  const [pendingToggleJob, setPendingToggleJob] = useState<SystemJob | null>(null);
  const [isToggling, setIsToggling] = useState(false);
  const { data: jobs = [], isLoading, isError, error, refetch, isFetching } = useQuery({
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

  const handleToggleJob = async () => {
    if (!pendingToggleJob) return;

    const nextEnabled = !pendingToggleJob.enabled;
    setIsToggling(true);

    try {
      const { error } = await supabase.rpc("toggle_system_job" as never, {
        p_job_id: pendingToggleJob.id,
        p_enabled: nextEnabled,
      } as never);

      if (error) {
        throw error;
      }

      await refetch();
      toast({
        title: nextEnabled ? "Job enabled" : "Job disabled",
        description: `${pendingToggleJob.job_name} is now ${nextEnabled ? "enabled" : "disabled"}.`,
      });
      setPendingToggleJob(null);
    } catch (err) {
      toast({
        title: "Unable to update job",
        description: err instanceof Error ? err.message : "The scheduled job could not be updated.",
        variant: "destructive",
      });
    } finally {
      setIsToggling(false);
    }
  };

  return (
    <>
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
                        <Loader2 className="mx-auto mb-3 h-6 w-6 animate-spin text-primary" />
                        Loading scheduled jobs...
                      </TableCell>
                    </TableRow>
                  ) : isError ? (
                    <TableRow>
                      <TableCell colSpan={8} className="py-12 text-center text-destructive">
                        <AlertCircle className="mx-auto mb-3 h-8 w-8" />
                        Unable to load scheduled jobs: {(error as Error)?.message || "Unknown error"}
                      </TableCell>
                    </TableRow>
                  ) : jobs.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="py-12 text-center text-muted-foreground">
                        <Clock3 className="mx-auto mb-3 h-10 w-10 text-muted-foreground/30" />
                        No scheduled jobs found
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
                          <Button
                            variant={job.enabled ? "outline" : "default"}
                            size="sm"
                            className="gap-2"
                            onClick={() => setPendingToggleJob(job)}
                          >
                            {job.enabled ? (
                              <>
                                <PauseCircle className="h-4 w-4" />
                                Disable
                              </>
                            ) : (
                              <>
                                <PlayCircle className="h-4 w-4" />
                                Enable
                              </>
                            )}
                          </Button>
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

      <AlertDialog
        open={!!pendingToggleJob}
        onOpenChange={(open) => {
          if (!open && !isToggling) setPendingToggleJob(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {pendingToggleJob?.enabled ? "Disable scheduled job?" : "Enable scheduled job?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {pendingToggleJob
                ? `${pendingToggleJob.job_name} will be ${pendingToggleJob.enabled ? "disabled" : "enabled"}.`
                : "This scheduled job will be updated."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isToggling}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleToggleJob} disabled={isToggling}>
              {isToggling ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {pendingToggleJob?.enabled ? "Disable" : "Enable"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

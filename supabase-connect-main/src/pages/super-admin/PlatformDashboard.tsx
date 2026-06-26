import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import {
  Activity,
  AlertTriangle,
  Building2,
  CheckCircle2,
  ClipboardList,
  Clock3,
  FileClock,
  HeartPulse,
  History,
  Loader2,
  ShieldCheck,
  Stethoscope,
} from "lucide-react";

import { StatCard } from "@/components/church-admin/StatCard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { SystemJobActions, type SystemJobActionJob } from "./SystemJobActions";

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
  created_at: string;
};

type AuditLog = {
  id: string;
  actor_id: string | null;
  actor_role: string | null;
  action: string;
  created_at: string;
};

type Church = {
  id: string;
  name: string | null;
  code: string | null;
  email: string | null;
  status: string | null;
  created_at: string;
};

type SystemJob = SystemJobActionJob & {
  last_run_at: string | null;
  last_status: string | null;
  last_duration_ms: number | null;
};

type DashboardData = {
  totalChurches: number;
  pendingChurchCount: number;
  activeAlertCount: number;
  dailyJob: SystemJob | null;
  automationRuns: AutomationRun[];
  recentAlerts: SystemAlert[];
  recentAudits: AuditLog[];
  pendingChurches: Church[];
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

function formatDuration(value: number | null) {
  if (value === null || value === undefined) return "-";
  if (value < 1000) return `${value} ms`;
  return `${(value / 1000).toFixed(1)} s`;
}

function severityBadgeClass(severity: string) {
  if (severity === "critical") return "border-destructive/30 bg-destructive/10 text-destructive";
  if (severity === "warning") return "border-amber-500/30 bg-amber-500/10 text-amber-600";
  return "border-primary/30 bg-primary/10 text-primary";
}

function statusBadgeClass(status: string | null) {
  const normalized = status?.toLowerCase();
  if (normalized === "completed" || normalized === "success") return "border-success/30 bg-success/10 text-success";
  if (normalized === "failed" || normalized === "error") return "border-destructive/30 bg-destructive/10 text-destructive";
  if (normalized === "running") return "border-primary/30 bg-primary/10 text-primary";
  return "border-amber-500/30 bg-amber-500/10 text-amber-600";
}

function actionLabel(action: string) {
  return action
    .split("_")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

async function createApprovalAuditLog(church: Church) {
  const { error } = await supabase.rpc("create_audit_log" as never, {
    p_action: "approve_church",
    p_entity_type: "church",
    p_entity_id: church.id,
    p_description: `Approved church ${church.name || church.id}.`,
    p_metadata: {},
  } as never);

  if (error) throw error;
}

export default function PlatformDashboard() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const {
    data,
    isLoading,
    isError,
    error,
    refetch,
    isFetching,
  } = useQuery({
    queryKey: ["sa-executive-dashboard"],
    queryFn: async (): Promise<DashboardData> => {
      const [
        churchCountResult,
        pendingChurchesResult,
        alertsResult,
        auditResult,
        runsResult,
        dailyJobResult,
      ] = await Promise.all([
        supabase.from("churches").select("id", { count: "exact", head: true }),
        supabase
          .from("churches")
          .select("id, name, code, email, status, created_at", { count: "exact" })
          .eq("status", "pending")
          .order("created_at", { ascending: false })
          .limit(5),
        supabase
          .from("system_alerts" as never)
          .select("id, severity, title, created_at", { count: "exact" })
          .eq("resolved", false)
          .order("created_at", { ascending: false })
          .limit(5),
        supabase
          .from("audit_logs" as never)
          .select("id, actor_id, actor_role, action, created_at")
          .order("created_at", { ascending: false })
          .limit(5),
        supabase
          .from("automation_runs" as never)
          .select("id, started_at, completed_at, status, processed_count, error_message, created_at")
          .order("started_at", { ascending: false })
          .limit(30),
        supabase
          .from("system_jobs" as never)
          .select("id, job_name, enabled, last_run_at, last_status, last_duration_ms")
          .eq("job_name", "Daily Automations")
          .maybeSingle(),
      ]);

      if (churchCountResult.error) throw churchCountResult.error;
      if (pendingChurchesResult.error) throw pendingChurchesResult.error;
      if (alertsResult.error) throw alertsResult.error;
      if (auditResult.error) throw auditResult.error;
      if (runsResult.error) throw runsResult.error;
      if (dailyJobResult.error) throw dailyJobResult.error;

      return {
        totalChurches: churchCountResult.count ?? 0,
        pendingChurchCount: pendingChurchesResult.count ?? 0,
        activeAlertCount: alertsResult.count ?? 0,
        dailyJob: dailyJobResult.data as unknown as SystemJob | null,
        automationRuns: (runsResult.data ?? []) as unknown as AutomationRun[],
        recentAlerts: (alertsResult.data ?? []) as unknown as SystemAlert[],
        recentAudits: (auditResult.data ?? []) as unknown as AuditLog[],
        pendingChurches: (pendingChurchesResult.data ?? []) as unknown as Church[],
      };
    },
    staleTime: 30 * 1000,
    refetchOnWindowFocus: false,
  });

  const approveChurch = useMutation({
    mutationFn: async (church: Church) => {
      const { error: updateError } = await supabase
        .from("churches")
        .update({ status: "active" })
        .eq("id", church.id);

      if (updateError) throw updateError;

      try {
        await createApprovalAuditLog(church);
      } catch (auditError) {
        console.warn("Failed to create church audit log", auditError);
      }
    },
    onSuccess: async (_, church) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["sa-executive-dashboard"] }),
        queryClient.invalidateQueries({ queryKey: ["sa-churches"] }),
      ]);
      toast.success(`${church.name || "Church"} approved.`);
    },
    onError: (mutationError: Error) => {
      toast.error(mutationError.message || "Unable to approve church.");
    },
  });

  const automationSummary = useMemo(() => {
    const runs = data?.automationRuns ?? [];
    const completed = runs.filter((run) => run.status === "completed").length;
    const failed = runs.filter((run) => run.status === "failed").length;
    const finished = completed + failed;
    const latestRun = runs[0] ?? null;
    const latestDuration = latestRun ? durationMs(latestRun.started_at, latestRun.completed_at) : null;

    return {
      latestRun,
      latestDuration,
      successfulRate: finished ? `${Math.round((completed / finished) * 100)}%` : "N/A",
    };
  }, [data?.automationRuns]);

  if (isLoading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center rounded-xl border border-border bg-card/50 text-muted-foreground">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        Loading operations overview...
      </div>
    );
  }

  if (isError) {
    return (
      <Card className="border-destructive/30">
        <CardContent className="flex min-h-56 flex-col items-center justify-center p-6 text-center">
          <AlertTriangle className="mb-3 h-10 w-10 text-destructive" />
          <h1 className="font-semibold">Dashboard could not be loaded</h1>
          <p className="mt-1 max-w-lg text-sm text-muted-foreground">{(error as Error)?.message || "Unknown error"}</p>
          <Button className="mt-4" variant="outline" onClick={() => refetch()}>Try again</Button>
        </CardContent>
      </Card>
    );
  }

  const dashboard = data ?? {
    totalChurches: 0,
    pendingChurchCount: 0,
    activeAlertCount: 0,
    dailyJob: null,
    automationRuns: [],
    recentAlerts: [],
    recentAudits: [],
    pendingChurches: [],
  };

  const hasAnyData =
    dashboard.totalChurches > 0 ||
    dashboard.activeAlertCount > 0 ||
    dashboard.automationRuns.length > 0 ||
    dashboard.recentAudits.length > 0;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold font-serif">Platform Dashboard</h1>
          <p className="mt-1 text-sm text-muted-foreground">Executive operations overview for Kanisa Connect</p>
        </div>
        <Button variant="outline" className="w-full sm:w-auto" onClick={() => refetch()} disabled={isFetching}>
          {isFetching ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Activity className="mr-2 h-4 w-4" />}
          Refresh
        </Button>
      </div>

      {!hasAnyData && (
        <Card className="glass-card">
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            No operations data recorded yet.
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard title="Total Churches" value={dashboard.totalChurches} icon={Building2} />
        <StatCard title="Pending Approvals" value={dashboard.pendingChurchCount} icon={ClipboardList} />
        <StatCard title="Active Alerts" value={dashboard.activeAlertCount} icon={AlertTriangle} />
        <StatCard title="Successful Job Rate" value={automationSummary.successfulRate} icon={CheckCircle2} />
      </div>

      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 font-sans text-base">
            <HeartPulse className="h-4 w-4 text-primary" />
            Operations Status
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 lg:grid-cols-[1fr_auto] lg:items-center">
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <p className="text-xs text-muted-foreground">Latest Automation Run</p>
              <p className="mt-1 font-medium">{automationSummary.latestRun ? "Daily Automations" : "No runs recorded"}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Status</p>
              <div className="mt-1">
                <Badge variant="outline" className={statusBadgeClass(automationSummary.latestRun?.status ?? dashboard.dailyJob?.last_status ?? null)}>
                  {automationSummary.latestRun?.status ?? dashboard.dailyJob?.last_status ?? "Pending"}
                </Badge>
              </div>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Duration</p>
              <p className="mt-1 text-sm">{formatDuration(automationSummary.latestDuration ?? dashboard.dailyJob?.last_duration_ms ?? null)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Last Run Time</p>
              <p className="mt-1 text-sm">{formatDateTime(automationSummary.latestRun?.started_at ?? dashboard.dailyJob?.last_run_at ?? null)}</p>
            </div>
          </div>
          {dashboard.dailyJob ? (
            <SystemJobActions job={dashboard.dailyJob} onCompleted={refetch} />
          ) : (
            <p className="text-sm text-muted-foreground">Daily Automations job is not configured.</p>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <Card className="glass-card">
          <CardHeader className="flex flex-row items-center justify-between gap-3">
            <CardTitle className="flex items-center gap-2 font-sans text-base">
              <AlertTriangle className="h-4 w-4 text-primary" />
              Recent Alerts
            </CardTitle>
            <Button variant="outline" size="sm" onClick={() => navigate("/super-admin/system-health")}>View All</Button>
          </CardHeader>
          <CardContent className="space-y-3">
            {dashboard.recentAlerts.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">No active alerts.</p>
            ) : (
              dashboard.recentAlerts.map((alert) => (
                <div key={alert.id} className="flex items-center justify-between gap-3 rounded-lg border border-border/60 bg-secondary/20 p-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className={severityBadgeClass(alert.severity)}>{alert.severity}</Badge>
                      <p className="truncate text-sm font-medium">{alert.title}</p>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">{formatDateTime(alert.created_at)}</p>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card className="glass-card">
          <CardHeader className="flex flex-row items-center justify-between gap-3">
            <CardTitle className="flex items-center gap-2 font-sans text-base">
              <FileClock className="h-4 w-4 text-primary" />
              Recent Audit Activity
            </CardTitle>
            <Button variant="outline" size="sm" onClick={() => navigate("/super-admin/audit-logs")}>View All</Button>
          </CardHeader>
          <CardContent className="space-y-3">
            {dashboard.recentAudits.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">No audit activity recorded.</p>
            ) : (
              dashboard.recentAudits.map((audit) => (
                <div key={audit.id} className="flex items-center justify-between gap-3 rounded-lg border border-border/60 bg-secondary/20 p-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{actionLabel(audit.action)}</p>
                    <p className="text-xs text-muted-foreground">Actor: {audit.actor_role || audit.actor_id || "System"}</p>
                  </div>
                  <p className="shrink-0 text-xs text-muted-foreground">{formatDateTime(audit.created_at)}</p>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="glass-card">
        <CardHeader className="flex flex-row items-center justify-between gap-3">
          <CardTitle className="flex items-center gap-2 font-sans text-base">
            <ShieldCheck className="h-4 w-4 text-primary" />
            Pending Church Approvals
          </CardTitle>
          <Button variant="outline" size="sm" onClick={() => navigate("/super-admin/churches")}>View All</Button>
        </CardHeader>
        <CardContent className="space-y-3">
          {dashboard.pendingChurches.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">No pending church approvals.</p>
          ) : (
            dashboard.pendingChurches.map((church) => (
              <div key={church.id} className="flex flex-col gap-3 rounded-lg border border-border/60 bg-secondary/20 p-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-medium">{church.name || "Unnamed church"}</p>
                  <p className="text-xs text-muted-foreground">
                    Created {new Date(church.created_at).toLocaleDateString()}
                  </p>
                </div>
                <Button
                  size="sm"
                  onClick={() => approveChurch.mutate(church)}
                  disabled={approveChurch.isPending}
                >
                  {approveChurch.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Approve
                </Button>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="font-sans text-base">Quick Actions</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <Button variant="outline" className="justify-start gap-2" onClick={() => navigate("/super-admin/system-health")}>
            <Stethoscope className="h-4 w-4" />
            System Health
          </Button>
          <Button variant="outline" className="justify-start gap-2" onClick={() => navigate("/super-admin/system-jobs")}>
            <Clock3 className="h-4 w-4" />
            Scheduled Jobs
          </Button>
          <Button variant="outline" className="justify-start gap-2" onClick={() => navigate("/super-admin/job-history")}>
            <History className="h-4 w-4" />
            Job History
          </Button>
          <Button variant="outline" className="justify-start gap-2" onClick={() => navigate("/super-admin/audit-logs")}>
            <FileClock className="h-4 w-4" />
            Audit Logs
          </Button>
          <Button variant="outline" className="justify-start gap-2" onClick={() => navigate("/super-admin/churches")}>
            <Building2 className="h-4 w-4" />
            Church Management
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

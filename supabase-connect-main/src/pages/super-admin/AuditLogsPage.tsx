import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Activity, Building2, FileText, Loader2, RefreshCw, Shield, Terminal } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";

type AuditLog = {
  id: string;
  actor_id: string | null;
  actor_role: string | null;
  action: string | null;
  entity_type: string | null;
  entity_id: string | null;
  description: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
};

const dateTimeFormatter = new Intl.DateTimeFormat(undefined, {
  dateStyle: "medium",
  timeStyle: "short",
});

function formatDateTime(value: string) {
  return dateTimeFormatter.format(new Date(value));
}

function formatAction(action: string | null) {
  return (action || "system")
    .split("_")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function actionBadgeClass(action: string | null) {
  if (action === "approve_church") {
    return "border-success/30 bg-success/10 text-success";
  }

  if (action === "reject_church") {
    return "border-destructive/30 bg-destructive/10 text-destructive";
  }

  if (action === "update_church_status") {
    return "border-amber-500/30 bg-amber-500/10 text-amber-600";
  }

  return "border-primary/30 bg-primary/10 text-primary";
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

export default function AuditLogsPage() {
  const { data: logs = [], isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ["super-admin-audit-logs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("audit_logs" as never)
        .select("id, actor_id, actor_role, action, entity_type, entity_id, description, metadata, created_at")
        .order("created_at", { ascending: false })
        .limit(100);

      if (error) {
        throw error;
      }

      return (data ?? []) as AuditLog[];
    },
  });

  const metrics = useMemo(() => {
    return logs.reduce(
      (acc, log) => {
        const role = log.actor_role?.toLowerCase() ?? "";

        acc.total += 1;
        if (role.includes("admin")) acc.admin += 1;
        if (log.entity_type === "church") acc.church += 1;
        if (log.entity_type === "system" || !log.actor_id) acc.system += 1;

        return acc;
      },
      { total: 0, admin: 0, church: 0, system: 0 },
    );
  }, [logs]);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold font-serif">Audit Logs</h1>
          <p className="mt-1 text-sm text-muted-foreground">Track system and administrator activity</p>
        </div>
        <Button
          variant="outline"
          className="w-full sm:w-auto"
          onClick={() => refetch()}
          disabled={isFetching}
        >
          {isFetching ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
          Refresh
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard title="Total Logs" value={metrics.total} icon={FileText} />
        <MetricCard title="Admin Actions" value={metrics.admin} icon={Shield} />
        <MetricCard title="Church Actions" value={metrics.church} icon={Building2} />
        <MetricCard title="System Actions" value={metrics.system} icon={Terminal} />
      </div>

      <Card className="glass-card">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="border-border hover:bg-transparent">
                <TableHead>Time</TableHead>
                <TableHead>Actor Role</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Entity</TableHead>
                <TableHead>Description</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={5} className="py-12 text-center text-muted-foreground">
                    <Loader2 className="mx-auto mb-3 h-6 w-6 animate-spin text-primary" />
                    Loading audit logs...
                  </TableCell>
                </TableRow>
              ) : isError ? (
                <TableRow>
                  <TableCell colSpan={5} className="py-12 text-center text-destructive">
                    Unable to load audit logs: {(error as Error)?.message || "Unknown error"}
                  </TableCell>
                </TableRow>
              ) : logs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="py-12 text-center text-muted-foreground">
                    <FileText className="mx-auto mb-3 h-10 w-10 text-muted-foreground/30" />
                    No audit activity recorded
                  </TableCell>
                </TableRow>
              ) : (
                logs.map((log) => (
                  <TableRow key={log.id} className="border-border">
                    <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                      {formatDateTime(log.created_at)}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">
                        {log.actor_role || "System"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={actionBadgeClass(log.action)}>
                        {formatAction(log.action)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      <div className="font-medium text-foreground">{log.entity_type || "-"}</div>
                      <div className="max-w-[180px] truncate text-xs">{log.entity_id || "-"}</div>
                    </TableCell>
                    <TableCell className="max-w-[360px] truncate text-sm text-muted-foreground">
                      {log.description || "-"}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

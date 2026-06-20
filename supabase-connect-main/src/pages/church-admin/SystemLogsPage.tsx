import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, CheckCircle2, Info, Search } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { logSupabaseError } from "@/lib/error-logger";

type AppErrorLog = {
  id: string;
  level: "error" | "warning" | "info";
  message: string;
  stack: string | null;
  page: string | null;
  route: string | null;
  component: string | null;
  function_name: string | null;
  church_id: string | null;
  user_id: string | null;
  metadata: Record<string, unknown>;
  browser_info: string | null;
  occurrence_count: number;
  resolved: boolean;
  resolved_at: string | null;
  resolved_by: string | null;
  created_at: string;
};

const levelStyles = {
  error: "border-destructive/30 text-destructive",
  warning: "border-warning/30 text-warning",
  info: "border-primary/30 text-primary",
};

export default function SystemLogsPage() {
  const { churchId } = useAuth();
  const queryClient = useQueryClient();
  const [level, setLevel] = useState("all");
  const [status, setStatus] = useState("unresolved");
  const [search, setSearch] = useState("");
  const [selectedLog, setSelectedLog] = useState<AppErrorLog | null>(null);

  const { data: logs = [], isLoading } = useQuery({
    queryKey: ["app-error-logs", churchId, level, status],
    queryFn: async () => {
      let query = supabase
        .from("app_error_logs" as never)
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);

      if (churchId) {
        query = query.or(`church_id.eq.${churchId},church_id.is.null`);
      }

      if (level !== "all") {
        query = query.eq("level", level);
      }

      if (status === "unresolved") {
        query = query.eq("resolved", false);
      }

      if (status === "resolved") {
        query = query.eq("resolved", true);
      }

      const { data, error } = await query;

      if (error) {
        logSupabaseError(error, {
          page: "System Logs",
          component: "SystemLogsPage",
          function: "loadSystemLogs",
          church_id: churchId,
          table: "app_error_logs",
          operation: "select",
        });
        return [];
      }

      return (data ?? []) as unknown as AppErrorLog[];
    },
  });

  const resolveLog = useMutation({
    mutationFn: async (logId: string) => {
      const { data, error } = await supabase.rpc("resolve_app_error_log" as never, {
        p_log_id: logId,
      } as never);

      if (error) {
        logSupabaseError(error, {
          page: "System Logs",
          component: "SystemLogsPage",
          function: "resolveLog",
          church_id: churchId,
          rpc: "resolve_app_error_log",
          operation: "rpc",
          metadata: { log_id: logId },
        });
        throw error;
      }

      return data as unknown as AppErrorLog;
    },
    onSuccess: async (updatedLog) => {
      setSelectedLog(updatedLog);
      await queryClient.invalidateQueries({ queryKey: ["app-error-logs"] });
      await queryClient.invalidateQueries({ queryKey: ["system-log-alert-count"] });
    },
  });

  const filteredLogs = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return logs;

    return logs.filter((log) =>
      [
        log.message,
        log.page,
        log.route,
        log.component,
        log.function_name,
        JSON.stringify(log.metadata ?? {}),
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(term)),
    );
  }, [logs, search]);

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold font-serif">System Logs</h1>
        <p className="text-sm text-muted-foreground mt-1">Application errors, warnings, and diagnostic events</p>
      </div>

      <div className="flex flex-col gap-3 md:flex-row md:items-center">
        <div className="relative md:w-80">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search message, page, component..."
            className="pl-9"
          />
        </div>
        <Select value={level} onValueChange={setLevel}>
          <SelectTrigger className="md:w-44">
            <SelectValue placeholder="Level" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All levels</SelectItem>
            <SelectItem value="error">Error</SelectItem>
            <SelectItem value="warning">Warning</SelectItem>
            <SelectItem value="info">Info</SelectItem>
          </SelectContent>
        </Select>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="md:w-44">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="unresolved">Unresolved</SelectItem>
            <SelectItem value="resolved">Resolved</SelectItem>
            <SelectItem value="all">All statuses</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card className="glass-card">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Level</TableHead>
                <TableHead>Message</TableHead>
                <TableHead>Page / Component</TableHead>
                <TableHead>Count</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Timestamp</TableHead>
                <TableHead className="text-right">Details</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={7} className="py-12 text-center text-muted-foreground">Loading...</TableCell>
                </TableRow>
              ) : filteredLogs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="py-12 text-center text-muted-foreground">
                    <Info className="mx-auto mb-2 h-8 w-8 text-muted-foreground/30" />
                    No system logs found.
                  </TableCell>
                </TableRow>
              ) : (
                filteredLogs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell>
                      <Badge variant="outline" className={levelStyles[log.level]}>
                        {log.level}
                      </Badge>
                    </TableCell>
                    <TableCell className="max-w-[360px] truncate font-medium">{log.message}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      <div>{log.page || log.route || "Application"}</div>
                      <div className="text-xs">{log.component || log.function_name || "Unknown component"}</div>
                    </TableCell>
                    <TableCell>{log.occurrence_count}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={log.resolved ? "border-success/30 text-success" : "border-destructive/30 text-destructive"}>
                        {log.resolved ? "resolved" : "unresolved"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{new Date(log.created_at).toLocaleString()}</TableCell>
                    <TableCell className="text-right">
                      <Button variant="outline" size="sm" onClick={() => setSelectedLog(log)}>
                        View
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={!!selectedLog} onOpenChange={(open) => !open && setSelectedLog(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 font-serif">
              <AlertTriangle className="h-5 w-5 text-primary" />
              Log Details
            </DialogTitle>
          </DialogHeader>

          {selectedLog ? (
            <div className="space-y-4 text-sm">
              <div className="grid gap-3 md:grid-cols-2">
                <div><span className="text-muted-foreground">Level:</span> {selectedLog.level}</div>
                <div><span className="text-muted-foreground">Occurrences:</span> {selectedLog.occurrence_count}</div>
                <div><span className="text-muted-foreground">Status:</span> {selectedLog.resolved ? "Resolved" : "Unresolved"}</div>
                <div><span className="text-muted-foreground">Resolved at:</span> {selectedLog.resolved_at ? new Date(selectedLog.resolved_at).toLocaleString() : "-"}</div>
                <div><span className="text-muted-foreground">Page:</span> {selectedLog.page || "-"}</div>
                <div><span className="text-muted-foreground">Route:</span> {selectedLog.route || "-"}</div>
                <div><span className="text-muted-foreground">Component:</span> {selectedLog.component || "-"}</div>
                <div><span className="text-muted-foreground">Function:</span> {selectedLog.function_name || "-"}</div>
                <div><span className="text-muted-foreground">Church:</span> {selectedLog.church_id || "-"}</div>
                <div><span className="text-muted-foreground">User:</span> {selectedLog.user_id || "-"}</div>
              </div>

              {!selectedLog.resolved ? (
                <Button
                  onClick={() => resolveLog.mutate(selectedLog.id)}
                  disabled={resolveLog.isPending}
                  className="gap-2"
                >
                  <CheckCircle2 className="h-4 w-4" />
                  Mark as resolved
                </Button>
              ) : null}

              <div>
                <p className="mb-1 text-muted-foreground">Message</p>
                <pre className="max-h-32 overflow-auto rounded-lg bg-muted p-3 whitespace-pre-wrap">{selectedLog.message}</pre>
              </div>

              <div>
                <p className="mb-1 text-muted-foreground">Stack Trace</p>
                <pre className="max-h-52 overflow-auto rounded-lg bg-muted p-3 whitespace-pre-wrap">
                  {selectedLog.stack || "No stack trace recorded."}
                </pre>
              </div>

              <div>
                <p className="mb-1 text-muted-foreground">Metadata JSON</p>
                <pre className="max-h-52 overflow-auto rounded-lg bg-muted p-3 whitespace-pre-wrap">
                  {JSON.stringify(selectedLog.metadata ?? {}, null, 2)}
                </pre>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}

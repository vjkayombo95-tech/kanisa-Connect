import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { FileText, Search } from "lucide-react";

type ActivityLogRow = {
  id: string;
  action: string;
  detail: string | null;
  entity_id: string | null;
  entity_type: string;
  created_at: string;
  user_name: string | null;
  user_role: string | null;
};

type AuditLogRow = {
  id: string;
  action: string | null;
  details: string | null;
  entity: string | null;
  entity_id: string | null;
  created_at: string;
  user_id: string | null;
};

type SystemLogItem = {
  id: string;
  action: string;
  detail: string | null;
  performer: string | null;
  role: string | null;
  entity: string | null;
  entityId: string | null;
  createdAt: string;
  source: "activity_logs" | "audit_logs";
};

export default function SystemLogs() {
  const [search, setSearch] = useState("");

  const { data: logs = [], isLoading } = useQuery({
    queryKey: ["sa-system-logs"],
    queryFn: async () => {
      const [{ data: activityLogs, error: activityError }, { data: auditLogs }] = await Promise.all([
        supabase
          .from("activity_logs")
          .select("id, action, detail, entity_id, entity_type, created_at, user_name, user_role")
          .order("created_at", { ascending: false })
          .limit(100),
        supabase
          .from("audit_logs" as never)
          .select("id, action, details, entity, entity_id, created_at, user_id")
          .order("created_at", { ascending: false })
          .limit(100),
      ]);

      if (activityError) {
        throw activityError;
      }

      const normalizedActivityLogs: SystemLogItem[] = ((activityLogs ?? []) as ActivityLogRow[]).map((log) => ({
        id: `activity-${log.id}`,
        action: log.action || "SYSTEM",
        detail: log.detail,
        performer: log.user_name,
        role: log.user_role,
        entity: log.entity_type,
        entityId: log.entity_id,
        createdAt: log.created_at,
        source: "activity_logs",
      }));

      const normalizedAuditLogs: SystemLogItem[] = ((auditLogs ?? []) as AuditLogRow[]).map((log) => ({
        id: `audit-${log.id}`,
        action: log.action || "SYSTEM",
        detail: log.details,
        performer: log.user_id,
        role: "audit",
        entity: log.entity,
        entityId: log.entity_id,
        createdAt: log.created_at,
        source: "audit_logs",
      }));

      return [...normalizedActivityLogs, ...normalizedAuditLogs]
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .slice(0, 100);
    },
  });

  const normalizedSearch = search.trim().toLowerCase();
  const filtered = useMemo(() => {
    if (!normalizedSearch) {
      return logs;
    }

    return logs.filter((log) =>
      [log.action, log.detail, log.performer, log.role, log.entity, log.source]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(normalizedSearch)),
    );
  }, [logs, normalizedSearch]);

  const typeColor = (action: string) => {
    const normalized = action.toLowerCase();
    if (normalized.includes("create")) return "bg-success/20 text-success border-success/30";
    if (normalized.includes("update")) return "bg-primary/20 text-primary border-primary/30";
    if (normalized.includes("delete")) return "bg-destructive/20 text-destructive border-destructive/30";
    return "bg-muted text-muted-foreground";
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold font-serif">System Logs</h1>
        <p className="text-sm text-muted-foreground mt-1">Searchable audit trail of platform activity</p>
      </div>

      <Card className="glass-card">
        <CardContent className="p-0">
          <div className="p-4 border-b border-border">
            <div className="relative max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search logs..."
                className="pl-9 bg-secondary border-border/50"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent border-border">
                <TableHead>Action</TableHead>
                <TableHead>Detail</TableHead>
                <TableHead>Performer</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Entity</TableHead>
                <TableHead>Time</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-12 text-muted-foreground">
                    Loading...
                  </TableCell>
                </TableRow>
              ) : filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-12 text-muted-foreground">
                    <FileText className="h-10 w-10 mx-auto mb-3 text-muted-foreground/30" />
                    {search ? "No logs match your search." : "No system logs recorded yet."}
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((log) => (
                  <TableRow key={log.id} className="border-border">
                    <TableCell className="font-medium">
                      <Badge variant="outline" className={typeColor(log.action)}>
                        {log.action}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground max-w-[260px] truncate">
                      {log.detail || "-"}
                    </TableCell>
                    <TableCell>{log.performer || "System"}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">
                        {log.role || "-"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-xs">
                      {log.entity || "-"}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-xs whitespace-nowrap">
                      {new Date(log.createdAt).toLocaleString()}
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

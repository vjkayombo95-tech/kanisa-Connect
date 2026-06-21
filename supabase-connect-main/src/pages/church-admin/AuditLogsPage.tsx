import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Shield } from "lucide-react";

type ContributionAuditLog = {
  id: string;
  action: string;
  reason: string;
  old_values: { amount?: number | null } | null;
  new_values: { amount?: number | null } | null;
  performer_name: string | null;
  performed_by: string | null;
  created_at: string;
};

export default function AuditLogsPage() {
  const { data: auditLogs = [], isLoading, isError, error } = useQuery({
    queryKey: ["audit-logs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contribution_audit_logs")
        .select("id, action, reason, old_values, new_values, performer_name, performed_by, created_at")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return ((data ?? []) as ContributionAuditLog[]).map((log) => ({
        ...log,
        entity: "Contribution",
        details:
          log.action === "EDIT" && log.old_values?.amount != null && log.new_values?.amount != null
            ? `${log.reason} · Amount: ${log.old_values.amount} → ${log.new_values.amount}`
            : log.reason,
      }));
    },
  });

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold font-serif">Audit Logs</h1>
        <p className="text-sm text-muted-foreground mt-1">Track contribution edits and deletions</p>
      </div>

      <Card className="glass-card">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Action</TableHead>
                <TableHead>User</TableHead>
                <TableHead>Entity</TableHead>
                <TableHead>Details</TableHead>
                <TableHead>Timestamp</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-12 text-muted-foreground">Loading...</TableCell>
                </TableRow>
              ) : isError ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-12 text-destructive">
                    Could not load audit logs: {error.message}
                  </TableCell>
                </TableRow>
              ) : auditLogs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-12 text-muted-foreground">
                    <Shield className="h-8 w-8 mx-auto mb-2 text-muted-foreground/30" />
                    No audit logs yet.
                  </TableCell>
                </TableRow>
              ) : (
                auditLogs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell>
                      <Badge variant="outline" className={log.action === "DELETE" ? "text-destructive border-destructive/30" : "text-warning border-warning/30"}>
                        {log.action || "—"}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-medium">{log.performer_name || log.performed_by || "System"}</TableCell>
                    <TableCell className="text-muted-foreground">{log.entity || "—"}</TableCell>
                    <TableCell className="text-muted-foreground max-w-[320px] truncate">{log.details || log.action || "—"}</TableCell>
                    <TableCell className="text-muted-foreground text-sm">{new Date(log.created_at).toLocaleString()}</TableCell>
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

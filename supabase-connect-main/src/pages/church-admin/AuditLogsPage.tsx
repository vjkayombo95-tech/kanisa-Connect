import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Shield } from "lucide-react";

export default function AuditLogsPage() {
  const { data: auditLogs = [], isLoading } = useQuery({
    queryKey: ["audit-logs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("audit_logs")
        .select("*")
        .order("created_at", { ascending: false });

      console.log("AUDIT DATA:", data);
      console.log("AUDIT ERROR:", error);

      if (error) return [];
      return data ?? [];
    },
  });

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold font-serif">Audit Logs</h1>
        <p className="text-sm text-muted-foreground mt-1">Track changes and actions across the system</p>
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
              ) : auditLogs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-12 text-muted-foreground">
                    <Shield className="h-8 w-8 mx-auto mb-2 text-muted-foreground/30" />
                    No audit logs yet.
                  </TableCell>
                </TableRow>
              ) : (
                auditLogs.map((log: any) => (
                  <TableRow key={log.id}>
                    <TableCell>
                      <Badge variant="outline" className={log.action === "DELETE" ? "text-destructive border-destructive/30" : "text-warning border-warning/30"}>
                        {log.action || "—"}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-medium">{log.user_id || "System"}</TableCell>
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

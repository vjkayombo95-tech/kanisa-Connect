import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Search, MoreHorizontal, Building2, ExternalLink } from "lucide-react";

type ChurchStatus = "active" | "inactive" | "suspended";
type AuditAction = "approve_church" | "reject_church" | "update_church_status";

type ChurchStatusUpdate = {
  churchId: string;
  churchName?: string | null;
  status: ChurchStatus;
  action: AuditAction;
};

async function createChurchAuditLog({ churchId, churchName, status, action }: ChurchStatusUpdate) {
  const actionDescriptions: Record<AuditAction, string> = {
    approve_church: `Approved church ${churchName || churchId}.`,
    reject_church: `Rejected church ${churchName || churchId}.`,
    update_church_status: `Changed church ${churchName || churchId} status to ${status}.`,
  };

  const { error } = await supabase.rpc("create_audit_log" as never, {
    p_action: action,
    p_entity_type: "church",
    p_entity_id: churchId,
    p_description: actionDescriptions[action],
    p_metadata: {},
  } as never);

  if (error) {
    throw error;
  }
}

export default function ChurchManagement() {
  const [search, setSearch] = useState("");
  const queryClient = useQueryClient();

  const { data: churches = [], isLoading } = useQuery({
    queryKey: ["sa-churches"],
    queryFn: async () => {
      const { data } = await supabase.from("churches").select("*").order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const updateChurchStatus = useMutation({
    mutationFn: async (variables: ChurchStatusUpdate) => {
      const { error } = await supabase
        .from("churches")
        .update({ status: variables.status })
        .eq("id", variables.churchId);

      if (error) {
        throw error;
      }

      try {
        await createChurchAuditLog(variables);
      } catch (auditError) {
        console.warn("Failed to create church audit log", auditError);
      }
    },
    onSuccess: async (_, variables) => {
      await queryClient.invalidateQueries({ queryKey: ["sa-churches"] });
      toast.success(`Church status updated to ${variables.status}.`);
    },
    onError: (error: Error) => {
      toast.error(error.message || "Unable to update church status.");
    },
  });

  const filtered = churches.filter((c: any) =>
    c.name?.toLowerCase().includes(search.toLowerCase()) || c.code?.toLowerCase().includes(search.toLowerCase())
  );

  const statusColor = (s: string) => {
    if (s === "active") return "bg-success/20 text-success border-success/30";
    if (s === "suspended") return "bg-destructive/20 text-destructive border-destructive/30";
    return "bg-muted text-muted-foreground";
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold font-serif">Church Management</h1>
        <p className="text-sm text-muted-foreground mt-1">{churches.length} registered churches</p>
      </div>

      <Card className="glass-card">
        <CardContent className="p-0">
          <div className="p-4 border-b border-border">
            <div className="relative max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search churches..." className="pl-9 bg-secondary border-border/50" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
          </div>
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent border-border">
                <TableHead>Church</TableHead>
                <TableHead>Code</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="w-10"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={6} className="text-center py-12 text-muted-foreground">Loading...</TableCell></TableRow>
              ) : filtered.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center py-12 text-muted-foreground">
                  <Building2 className="h-10 w-10 mx-auto mb-3 text-muted-foreground/30" />
                  {search ? "No churches match your search." : "No churches registered yet."}
                </TableCell></TableRow>
              ) : filtered.map((c: any) => (
                <TableRow key={c.id} className="border-border">
                  <TableCell className="font-medium">{c.name}</TableCell>
                  <TableCell className="font-mono text-xs text-primary">{c.code}</TableCell>
                  <TableCell className="text-muted-foreground">{c.email}</TableCell>
                  <TableCell><Badge variant="outline" className={statusColor(c.status)}>{c.status}</Badge></TableCell>
                  <TableCell className="text-muted-foreground">{new Date(c.created_at).toLocaleDateString()}</TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="max-h-[min(20rem,calc(100vh-8rem))] w-56 overflow-y-auto overscroll-contain">
                        <DropdownMenuItem>View Details</DropdownMenuItem>
                        <DropdownMenuItem><ExternalLink className="mr-2 h-3 w-3" />Open Workspace</DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          disabled={updateChurchStatus.isPending || c.status === "active"}
                          onClick={() => updateChurchStatus.mutate({
                            churchId: c.id,
                            churchName: c.name,
                            status: "active",
                            action: "approve_church",
                          })}
                        >
                          Approve Church
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          disabled={updateChurchStatus.isPending || c.status === "inactive"}
                          onClick={() => updateChurchStatus.mutate({
                            churchId: c.id,
                            churchName: c.name,
                            status: "inactive",
                            action: "reject_church",
                          })}
                        >
                          Reject Church
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          disabled={updateChurchStatus.isPending || c.status === "active"}
                          onClick={() => updateChurchStatus.mutate({
                            churchId: c.id,
                            churchName: c.name,
                            status: "active",
                            action: "update_church_status",
                          })}
                        >
                          Change Status: Active
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          disabled={updateChurchStatus.isPending || c.status === "inactive"}
                          onClick={() => updateChurchStatus.mutate({
                            churchId: c.id,
                            churchName: c.name,
                            status: "inactive",
                            action: "update_church_status",
                          })}
                        >
                          Change Status: Inactive
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          disabled={updateChurchStatus.isPending || c.status === "suspended"}
                          onClick={() => updateChurchStatus.mutate({
                            churchId: c.id,
                            churchName: c.name,
                            status: "suspended",
                            action: "update_church_status",
                          })}
                        >
                          Change Status: Suspended
                        </DropdownMenuItem>
                        <DropdownMenuItem>View Metrics</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

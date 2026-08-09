import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { MoreHorizontal, Building2, ExternalLink } from "lucide-react";
import { FilterToolbar } from "@/components/super-admin/FilterToolbar";
import { SearchInput } from "@/components/super-admin/SearchInput";

type ChurchStatus = "active" | "inactive" | "suspended";
type AuditAction = "approve_church" | "reject_church" | "update_church_status";

type Church = {
  id: string;
  name: string | null;
  code: string | null;
  church_code: string | null;
  short_code: string | null;
  email: string | null;
  status: string | null;
  created_at: string;
};

type ChurchStatusUpdate = {
  churchId: string;
  churchName?: string | null;
  churchCode?: string | null;
  shortCode?: string | null;
  status: ChurchStatus;
  action: AuditAction;
};

async function createChurchAuditLog({ churchId, churchName, churchCode, shortCode, status, action }: ChurchStatusUpdate) {
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
    p_metadata: { church_name: churchName, church_code: churchCode, short_code: shortCode, status },
  } as never);

  if (error) {
    throw error;
  }
}

export default function ChurchManagement() {
  const [searchParams, setSearchParams] = useSearchParams();
  const search = searchParams.get("search") ?? "";
  const statusFilter = searchParams.get("status") ?? "all";
  const approvalFilter = searchParams.get("approval") ?? "all";
  const queryClient = useQueryClient();

  const { data: churches = [], isLoading } = useQuery({
    queryKey: ["sa-churches"],
    queryFn: async () => {
      const { data } = await supabase.from("churches").select("*").order("created_at", { ascending: false });
      return (data ?? []) as Church[];
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

  const updateFilter = (key: string, value: string) => {
    const next = new URLSearchParams(searchParams);
    if (!value || value === "all") {
      next.delete(key);
    } else {
      next.set(key, value);
    }
    setSearchParams(next);
  };

  const clearFilters = () => setSearchParams(new URLSearchParams());

  const filtered = churches.filter((church) => {
    const term = search.trim().toLowerCase();
    const approvalState =
      church.status === "pending" ? "pending" :
      church.status === "active" ? "approved" :
      church.status === "inactive" ? "rejected" :
      "other";

    return (
      (statusFilter === "all" || church.status === statusFilter) &&
      (approvalFilter === "all" || approvalState === approvalFilter) &&
      (!term ||
        church.name?.toLowerCase().includes(term) ||
        church.church_code?.toLowerCase().includes(term) ||
        church.short_code?.toLowerCase().includes(term) ||
        church.code?.toLowerCase().includes(term) ||
        church.email?.toLowerCase().includes(term))
    );
  });

  const statusColor = (s: string | null) => {
    if (s === "active") return "bg-success/20 text-success border-success/30";
    if (s === "suspended") return "bg-destructive/20 text-destructive border-destructive/30";
    if (s === "pending") return "bg-primary/20 text-primary border-primary/30";
    return "bg-muted text-muted-foreground";
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold font-serif">Church Management</h1>
        <p className="text-sm text-muted-foreground mt-1">{churches.length} registered churches</p>
      </div>

      <FilterToolbar resultCount={filtered.length} totalCount={churches.length} onClear={clearFilters}>
        <div>
          <Label>Search</Label>
          <SearchInput
            className="mt-2"
            value={search}
            onChange={(value) => updateFilter("search", value)}
            placeholder="Search name, church code, or join code..."
          />
        </div>
        <div>
          <Label>Status</Label>
          <Select value={statusFilter} onValueChange={(value) => updateFilter("status", value)}>
            <SelectTrigger className="mt-2"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="inactive">Inactive</SelectItem>
              <SelectItem value="suspended">Suspended</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Approval</Label>
          <Select value={approvalFilter} onValueChange={(value) => updateFilter("approval", value)}>
            <SelectTrigger className="mt-2"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All approvals</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="approved">Approved</SelectItem>
              <SelectItem value="rejected">Rejected</SelectItem>
              <SelectItem value="other">Other</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </FilterToolbar>

      <Card className="glass-card">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent border-border">
                <TableHead>Church</TableHead>
                <TableHead>Church Code</TableHead>
                <TableHead>Join Code</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="w-10"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 6 }).map((_, index) => (
                  <TableRow key={index}>
                    <TableCell colSpan={7} className="py-3">
                      <div className="h-8 animate-pulse rounded-md bg-secondary" />
                    </TableCell>
                  </TableRow>
                ))
              ) : filtered.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="text-center py-12 text-muted-foreground">
                  <Building2 className="h-10 w-10 mx-auto mb-3 text-muted-foreground/30" />
                  {churches.length === 0 ? "No churches registered yet." : "No results match the current filters."}
                </TableCell></TableRow>
              ) : filtered.map((c) => (
                <TableRow key={c.id} className="border-border">
                  <TableCell className="font-medium">{c.name}</TableCell>
                  <TableCell className="font-mono text-xs text-primary">{c.church_code || c.code}</TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">{c.short_code || "-"}</TableCell>
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
                            churchCode: c.church_code || c.code,
                            shortCode: c.short_code,
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
                            churchCode: c.church_code || c.code,
                            shortCode: c.short_code,
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
                            churchCode: c.church_code || c.code,
                            shortCode: c.short_code,
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
                            churchCode: c.church_code || c.code,
                            shortCode: c.short_code,
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
                            churchCode: c.church_code || c.code,
                            shortCode: c.short_code,
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

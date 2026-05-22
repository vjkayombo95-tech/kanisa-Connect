import { useState } from "react";
import { useOutletContext } from "react-router-dom";
import { CommunityOutletContext } from "@/components/community-leader/CommunityLeaderLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Plus, Search, Trash2, Users, Loader2 } from "lucide-react";
import { useCommunityMembers } from "@/hooks/use-community-leader";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export default function CommunityMembersPage() {
  const { communityId, community, churchId } = useOutletContext<CommunityOutletContext>();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [addSearch, setAddSearch] = useState("");
  const [addOpen, setAddOpen] = useState(false);

  const { data: communityMembers = [], isLoading } = useCommunityMembers(communityId);

  // Fetch church members NOT in any community for adding
  const { data: availableMembers = [], isLoading: loadingAvailable } = useQuery({
    queryKey: ["available-members-for-community", churchId, addSearch],
    queryFn: async () => {
      // Get all member IDs already in any community
      const { data: assigned } = await supabase
        .from("community_members")
        .select("member_id");
      const assignedIds = new Set((assigned || []).map((a) => a.member_id));

      const query = supabase
        .from("members")
        .select("id, full_name, email, phone")
        .eq("church_id", churchId)
        .eq("status", "active")
        .order("full_name");

      if (addSearch.trim()) {
        query.ilike("full_name", `%${addSearch.trim()}%`);
      }

      const { data, error } = await query.limit(50);
      if (error) throw error;
      return (data || []).filter((m) => !assignedIds.has(m.id));
    },
    enabled: addOpen,
  });

  const addMember = useMutation({
    mutationFn: async (memberId: string) => {
      const { error } = await supabase
        .from("community_members")
        .insert({ community_id: communityId, member_id: memberId });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["community-members", communityId] });
      queryClient.invalidateQueries({ queryKey: ["available-members-for-community"] });
      toast.success("Member added to community");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const removeMember = useMutation({
    mutationFn: async (cmId: string) => {
      const { error } = await supabase
        .from("community_members")
        .delete()
        .eq("id", cmId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["community-members", communityId] });
      toast.success("Member removed from community");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const filtered = communityMembers.filter((cm: any) => {
    const name = (cm.members as any)?.full_name || "";
    return name.toLowerCase().includes(search.toLowerCase());
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold font-serif">Community Members</h1>
          <p className="text-sm text-muted-foreground">{community?.name} &middot; {communityMembers.length} members</p>
        </div>
        <Dialog open={addOpen} onOpenChange={setAddOpen}>
          <DialogTrigger asChild>
            <Button size="sm"><Plus className="h-4 w-4 mr-1.5" />Add Member</Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Add Member to {community?.name}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search church members..."
                  className="pl-9"
                  value={addSearch}
                  onChange={(e) => setAddSearch(e.target.value)}
                />
              </div>
              <div className="max-h-64 overflow-y-auto space-y-1">
                {loadingAvailable ? (
                  <div className="flex justify-center py-4"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
                ) : availableMembers.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">No available members found</p>
                ) : (
                  availableMembers.map((m: any) => (
                    <div key={m.id} className="flex items-center justify-between p-2 rounded-md hover:bg-secondary">
                      <div>
                        <p className="text-sm font-medium">{m.full_name}</p>
                        <p className="text-xs text-muted-foreground">{m.phone || m.email || "—"}</p>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => addMember.mutate(m.id)}
                        disabled={addMember.isPending}
                      >
                        Add
                      </Button>
                    </div>
                  ))
                )}
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search members..."
              className="pl-9"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12">
              <Users className="h-12 w-12 mx-auto text-muted-foreground/30 mb-3" />
              <p className="text-muted-foreground">No members in this community yet.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-16"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((cm: any) => {
                  const m = cm.members as any;
                  return (
                    <TableRow key={cm.id}>
                      <TableCell className="font-medium">{m?.full_name || "—"}</TableCell>
                      <TableCell>{m?.phone || "—"}</TableCell>
                      <TableCell>{m?.email || "—"}</TableCell>
                      <TableCell>
                        <Badge variant={m?.status === "active" ? "default" : "secondary"} className="text-xs">
                          {m?.status || "—"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-destructive hover:text-destructive"
                          onClick={() => removeMember.mutate(cm.id)}
                          disabled={removeMember.isPending}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

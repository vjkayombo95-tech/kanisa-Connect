import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Building2, Users, Loader2, Crown, UserPlus, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const LEADERSHIP_ROLES = [
  { key: "mwenyekiti_id", label: "Mwenyekiti" },
  { key: "makamu_mwenyekiti_id", label: "Makamu Mwenyekiti" },
  { key: "mweka_hazina_id", label: "Mweka Hazina" },
  { key: "katibu_id", label: "Katibu" },
] as const;

type LeadershipFieldKey = (typeof LEADERSHIP_ROLES)[number]["key"];

function getLeadershipUpdatePayload(field: LeadershipFieldKey, value: string | null) {
  if (field === "mwenyekiti_id") {
    return {
      mwenyekiti_id: value,
      leader_id: value,
    };
  }

  return { [field]: value };
}

function getErrorMessage(error: any) {
  if (!error) return "Please try again.";
  if (typeof error.message === "string" && error.message.trim()) return error.message;
  if (typeof error.error_description === "string" && error.error_description.trim()) return error.error_description;
  if (typeof error.details === "string" && error.details.trim()) return error.details;
  return "Please try again.";
}

export default function CommunitiesPage() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteCommunityId, setDeleteCommunityId] = useState<string | null>(null);
  const [detailCommunity, setDetailCommunity] = useState<any>(null);
  const [addMemberOpen, setAddMemberOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [chairperson, setChairperson] = useState("");
  const [viceChairperson, setViceChairperson] = useState("");
  const [treasurer, setTreasurer] = useState("");
  const [katibu, setKatibu] = useState("");
  const [selectedMemberId, setSelectedMemberId] = useState("");
  const { churchId } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: communities = [], isLoading } = useQuery({
    queryKey: ["communities", churchId],
    queryFn: async () => {
      if (!churchId) return [];
      const { data } = await supabase.from("communities").select("*").eq("church_id", churchId).order("name");
      return data ?? [];
    },
    enabled: !!churchId,
  });

  const { data: communityMembers = [] } = useQuery({
    queryKey: ["community-members-all", churchId],
    queryFn: async () => {
      if (!churchId) return [];
      const { data, error } = await supabase
        .from("member_communities")
        .select("id, member_id, community_id, created_at, members(full_name, id)");
      if (error) {
        console.error("Error fetching community members:", error);
        return [];
      }
      return data ?? [];
    },
    enabled: !!churchId,
  });

  const { data: allMembers = [] } = useQuery({
    queryKey: ["members-for-communities", churchId],
    queryFn: async () => {
      if (!churchId) return [];
      const { data } = await supabase.from("members").select("id, full_name").eq("church_id", churchId).eq("status", "active").order("full_name");
      return data ?? [];
    },
    enabled: !!churchId,
  });

  const getCommunityMembers = (communityId: string) => communityMembers.filter((cm: any) => cm.community_id === communityId);
  const getLeadershipValue = (community: any, key: LeadershipFieldKey) => {
    if (key === "mwenyekiti_id") {
      return community?.mwenyekiti_id ?? community?.leader_id ?? null;
    }

    return community?.[key] ?? null;
  };
  const getMemberName = (memberId: string | null) => allMembers.find((m: any) => m.id === memberId)?.full_name || "—";

  const create = useMutation({
    mutationFn: async () => {
      if (!churchId) throw new Error("No church context");
      const trimmedName = name.trim();
      if (!trimmedName) throw new Error("Community name is required.");

      const { error } = await supabase.from("communities" as never).insert({
        church_id: churchId,
        name: trimmedName,
        description: description.trim() || null,
        mwenyekiti_id: chairperson || null,
        leader_id: chairperson || null,
        makamu_mwenyekiti_id: viceChairperson || null,
        mweka_hazina_id: treasurer || null,
        katibu_id: katibu || null,
      } as never);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["communities"] });
      toast({ title: "Community created" });
      setDialogOpen(false);
      setName("");
      setDescription("");
      setChairperson("");
      setViceChairperson("");
      setTreasurer("");
      setKatibu("");
    },
    onError: (err: any) => {
      console.error("Failed to create community:", err);
      toast({
        title: "Unable to create community",
        description: err?.message || "Please check the form and try again.",
        variant: "destructive",
      });
    },
  });

  const updateLeadership = useMutation({
    mutationFn: async ({ communityId, field, value }: { communityId: string; field: LeadershipFieldKey; value: string | null }) => {
      const { data, error } = await supabase.rpc("update_community_leadership" as never, {
        _community_id: communityId,
        _role_field: field,
        _member_id: value,
      } as never);

      if (!error) {
        const result = data as { success?: boolean; error?: string } | null;
        if (result?.success === false) {
          throw new Error(result.error || "Unable to update leadership.");
        }
        return;
      }

      const missingRpc =
        typeof error.message === "string" &&
        (error.message.includes("Could not find the function public.update_community_leadership") ||
          error.message.includes("function public.update_community_leadership"));

      if (!missingRpc) {
        throw error;
      }

      const { error: fallbackError } = await supabase
        .from("communities" as never)
        .update(getLeadershipUpdatePayload(field, value) as never)
        .eq("id", communityId);

      if (fallbackError) throw fallbackError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["communities"] });
      toast({ title: "Leadership updated" });
    },
    onError: (err: any) => {
      console.error("Failed to update community leadership:", err);
      toast({
        title: "Unable to update leadership",
        description: getErrorMessage(err),
        variant: "destructive",
      });
    },
  });

  const addCommunityMember = useMutation({
    mutationFn: async () => {
      if (!detailCommunity || !selectedMemberId) throw new Error("Missing data");
      const { error } = await supabase
        .from("member_communities")
        .insert({ community_id: detailCommunity.id, member_id: selectedMemberId });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["community-members-all"] });
      toast({ title: "Member added" });
      setAddMemberOpen(false); setSelectedMemberId("");
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const removeCommunityMember = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("member_communities").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["community-members-all"] });
      toast({ title: "Member removed" });
    },
  });

  const deleteCommunity = useMutation({
    mutationFn: async (communityId: string) => {
      const { error: membershipError } = await supabase
        .from("member_communities")
        .delete()
        .eq("community_id", communityId);

      if (membershipError) throw membershipError;

      const { error } = await supabase
        .from("communities")
        .delete()
        .eq("id", communityId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["communities"] });
      queryClient.invalidateQueries({ queryKey: ["community-members-all"] });
      toast({ title: "Community deleted" });
      setDeleteCommunityId(null);
      setDetailCommunity(null);
    },
    onError: (err: any) => {
      console.error("Failed to delete community:", err);
      toast({ title: "Unable to delete community", description: err.message, variant: "destructive" });
    },
  });

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold font-serif">Communities / Jumuiya</h1>
          <p className="text-sm text-muted-foreground mt-1">Manage small church communities</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild><Button size="sm"><Plus className="mr-2 h-4 w-4" /> Add Community</Button></DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle className="font-serif">New Community</DialogTitle></DialogHeader>
            <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); create.mutate(); }}>
              <div className="space-y-2"><Label>Name *</Label><Input placeholder="e.g. Jumuiya ya Mtakatifu Yosefu" value={name} onChange={(e) => setName(e.target.value)} required /></div>
              <div className="space-y-2"><Label>Description</Label><Textarea placeholder="Brief description..." value={description} onChange={(e) => setDescription(e.target.value)} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div key="chairperson" className="space-y-1">
                  <Label className="text-xs">Mwenyekiti</Label>
                  <Select value={chairperson} onValueChange={setChairperson}>
                    <SelectTrigger className="h-9"><SelectValue placeholder="Select" /></SelectTrigger>
                    <SelectContent>{allMembers.map((m: any) => <SelectItem key={m.id} value={m.id}>{m.full_name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div key="vice-chairperson" className="space-y-1">
                  <Label className="text-xs">Makamu Mwenyekiti</Label>
                  <Select value={viceChairperson} onValueChange={setViceChairperson}>
                    <SelectTrigger className="h-9"><SelectValue placeholder="Select" /></SelectTrigger>
                    <SelectContent>{allMembers.map((m: any) => <SelectItem key={m.id} value={m.id}>{m.full_name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div key="treasurer" className="space-y-1">
                  <Label className="text-xs">Mweka Hazina</Label>
                  <Select value={treasurer} onValueChange={setTreasurer}>
                    <SelectTrigger className="h-9"><SelectValue placeholder="Select" /></SelectTrigger>
                    <SelectContent>{allMembers.map((m: any) => <SelectItem key={m.id} value={m.id}>{m.full_name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div key="katibu" className="space-y-1">
                  <Label className="text-xs">Katibu</Label>
                  <Select value={katibu} onValueChange={setKatibu}>
                    <SelectTrigger className="h-9"><SelectValue placeholder="Select" /></SelectTrigger>
                    <SelectContent>{allMembers.map((m: any) => <SelectItem key={m.id} value={m.id}>{m.full_name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" type="button" onClick={() => setDialogOpen(false)}>Cancel</Button>
                <Button type="submit" disabled={create.isPending || !name.trim()}>{create.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Create</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? <p className="text-muted-foreground">Loading...</p> : communities.length === 0 ? (
        <Card className="glass-card"><CardContent className="py-16 text-center text-muted-foreground">
          <Building2 className="h-12 w-12 mx-auto mb-4 text-muted-foreground/30" />
          <p>No communities yet. Create your first Jumuiya.</p>
        </CardContent></Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {communities.map((c: any) => {
            const mCount = getCommunityMembers(c.id).length;
            return (
              <Card key={c.id} className="glass-card hover:gold-glow transition-shadow cursor-pointer" onClick={() => setDetailCommunity(c)}>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base font-sans">{c.name}</CardTitle>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className={c.status === "active" ? "bg-success/20 text-success border-success/30" : ""}>{c.status}</Badge>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive"
                        onClick={(event) => {
                          event.stopPropagation();
                          setDeleteCommunityId(c.id);
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground mb-3">{c.description || "No description"}</p>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground"><Users className="h-3 w-3" /> {mCount} members</div>
                  {/* Show leadership summary */}
                  {LEADERSHIP_ROLES.some((r) => getLeadershipValue(c, r.key)) && (
                    <div className="mt-2 space-y-1">
                      {LEADERSHIP_ROLES.filter((r) => getLeadershipValue(c, r.key)).map((r) => (
                        <div key={r.key} className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Crown className="h-3 w-3 text-primary" /> {r.label}: {getMemberName(getLeadershipValue(c, r.key))}
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Detail dialog */}
      <Dialog open={!!detailCommunity} onOpenChange={(o) => { if (!o) setDetailCommunity(null); }}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle className="font-serif">{detailCommunity?.name}</DialogTitle></DialogHeader>
          {detailCommunity && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">{detailCommunity.description || "No description"}</p>

              {/* Leadership */}
              <div>
                <h4 className="text-sm font-semibold mb-2 flex items-center gap-2"><Crown className="h-4 w-4 text-primary" /> Leadership</h4>
                <div className="grid grid-cols-2 gap-3">
                  {LEADERSHIP_ROLES.map((role) => (
                    <div key={role.key} className="space-y-1">
                      <Label className="text-xs">{role.label}</Label>
                      <Select
                        value={getLeadershipValue(detailCommunity, role.key) || ""}
                        onValueChange={(v) => {
                          updateLeadership.mutate({ communityId: detailCommunity.id, field: role.key, value: v || null });
                          setDetailCommunity({
                            ...detailCommunity,
                            ...getLeadershipUpdatePayload(role.key, v || null),
                          });
                        }}
                      >
                        <SelectTrigger className="h-9"><SelectValue placeholder="Not assigned" /></SelectTrigger>
                        <SelectContent>{allMembers.map((m: any) => <SelectItem key={m.id} value={m.id}>{m.full_name}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                  ))}
                </div>
              </div>

              {/* Members */}
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-semibold">Members ({getCommunityMembers(detailCommunity.id).length})</h4>
                <Button size="sm" variant="outline" onClick={() => setAddMemberOpen(true)}><UserPlus className="mr-2 h-3 w-3" /> Add</Button>
              </div>
              <Table>
                <TableBody>
                  {getCommunityMembers(detailCommunity.id).length === 0 ? (
                    <TableRow><TableCell className="text-center text-muted-foreground py-4">No members</TableCell></TableRow>
                  ) : getCommunityMembers(detailCommunity.id).map((cm: any) => (
                    <TableRow key={cm.id}>
                      <TableCell className="font-medium">{cm.members?.full_name}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{cm.created_at ? new Date(cm.created_at).toLocaleDateString() : "—"}</TableCell>
                      <TableCell className="w-10"><Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => removeCommunityMember.mutate(cm.id)}><Trash2 className="h-3 w-3" /></Button></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {addMemberOpen && (
                <div className="border border-border rounded-lg p-4 space-y-3 bg-secondary/30">
                  <Select value={selectedMemberId} onValueChange={setSelectedMemberId}>
                    <SelectTrigger><SelectValue placeholder="Select member" /></SelectTrigger>
                    <SelectContent>{allMembers.map((m: any) => <SelectItem key={m.id} value={m.id}>{m.full_name}</SelectItem>)}</SelectContent>
                  </Select>
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => addCommunityMember.mutate()} disabled={!selectedMemberId || addCommunityMember.isPending}>
                      {addCommunityMember.isPending && <Loader2 className="mr-2 h-3 w-3 animate-spin" />} Add
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setAddMemberOpen(false)}>Cancel</Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteCommunityId} onOpenChange={(open) => { if (!open) setDeleteCommunityId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete community?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove the community and its member assignments.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (deleteCommunityId) {
                  deleteCommunity.mutate(deleteCommunityId);
                }
              }}
            >
              {deleteCommunity.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

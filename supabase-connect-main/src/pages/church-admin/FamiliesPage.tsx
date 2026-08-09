import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Heart, Users, Loader2, Calendar, HandCoins, UserPlus, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { formatTZS } from "@/lib/currency";

const FAMILY_ROLES = ["father", "mother", "child", "guardian", "other"] as const;

export default function FamiliesPage() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [detailFamily, setDetailFamily] = useState<any>(null);
  const [addMemberOpen, setAddMemberOpen] = useState(false);
  const [name, setName] = useState("");
  const [weddingDate, setWeddingDate] = useState("");
  const [selectedMemberId, setSelectedMemberId] = useState("");
  const [selectedRole, setSelectedRole] = useState<string>("other");
  const { churchId } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: families = [], isLoading } = useQuery({
    queryKey: ["families", churchId],
    queryFn: async () => {
      const { data, error } = await supabase.from("families").select("*").order("name");
      if (error) {
        console.error("Error fetching families:", error);
        return [];
      }
      return data ?? [];
    },
    enabled: true,
  });

  const { data: familyMembers = [] } = useQuery({
    queryKey: ["family-members-all", churchId],
    queryFn: async () => {
      if (!churchId) return [];
      const { data, error } = await supabase
        .from("members")
        .select("id, full_name, family_id, family_role, church_id")
        .eq("church_id", churchId)
        .not("family_id", "is", null);
      if (error) {
        console.error("Error fetching family members:", error);
        return [];
      }
      return data ?? [];
    },
    enabled: !!churchId,
  });

  const { data: allMembers = [] } = useQuery({
    queryKey: ["members-for-families", churchId],
    queryFn: async () => {
      if (!churchId) return [];
      const { data } = await supabase.from("members").select("id, full_name").eq("church_id", churchId).eq("status", "active").order("full_name");
      return data ?? [];
    },
    enabled: !!churchId,
  });

  const { data: contributions = [] } = useQuery({
    queryKey: ["contributions-for-families", churchId],
    queryFn: async () => {
      if (!churchId) return [];
      const { data } = await supabase.from("contributions").select("member_id, amount").eq("church_id", churchId);
      return data ?? [];
    },
    enabled: !!churchId,
  });

  const getFamilyMembersList = (familyId: string) => familyMembers.filter((fm: any) => fm.family_id === familyId);
  const getFamilyTotal = (familyId: string) => {
    const memberIds = getFamilyMembersList(familyId).map((fm: any) => fm.id);
    return contributions.filter((c: any) => memberIds.includes(c.member_id)).reduce((s: number, c: any) => s + (c.amount || 0), 0);
  };

  // Members already in any family
  const membersInFamilies = new Set(familyMembers.map((fm: any) => fm.id));
  const availableMembers = allMembers.filter((m: any) => !membersInFamilies.has(m.id));

  const create = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("families").insert({
        name: name.trim(),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["families"] });
      toast({ title: "Family added" });
      setDialogOpen(false); setName(""); setWeddingDate("");
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const addFamilyMember = useMutation({
    mutationFn: async () => {
      if (!detailFamily || !selectedMemberId) throw new Error("Missing data");
      const { error } = await supabase
        .from("members")
        .update({
          family_id: detailFamily.id,
          family_role: selectedRole,
        })
        .eq("id", selectedMemberId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["family-members-all"] });
      toast({ title: "Member added to family" });
      setAddMemberOpen(false); setSelectedMemberId(""); setSelectedRole("other");
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const removeFamilyMember = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("members")
        .update({
          family_id: null,
          family_role: null,
        })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["family-members-all"] });
      toast({ title: "Member removed from family" });
    },
  });

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold font-serif">Families</h1>
          <p className="text-sm text-muted-foreground mt-1">Manage church families and their members</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild><Button size="sm"><Plus className="mr-2 h-4 w-4" /> Add Family</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle className="font-serif">New Family</DialogTitle></DialogHeader>
            <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); create.mutate(); }}>
              <div className="space-y-2"><Label>Family Name *</Label><Input placeholder="e.g. The Shumbusho Family" value={name} onChange={(e) => setName(e.target.value)} required /></div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" type="button" onClick={() => setDialogOpen(false)}>Cancel</Button>
                <Button type="submit" disabled={create.isPending || !name}>{create.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Create</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? <p className="text-muted-foreground">Loading...</p> : families.length === 0 ? (
        <Card className="glass-card"><CardContent className="py-16 text-center text-muted-foreground">
          <Heart className="h-12 w-12 mx-auto mb-4 text-muted-foreground/30" />
          <p>No families registered yet.</p>
        </CardContent></Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {families.map((f: any) => {
            const fMembers = getFamilyMembersList(f.id);
            const total = getFamilyTotal(f.id);
            return (
              <Card key={f.id} className="glass-card hover:gold-glow transition-shadow cursor-pointer" onClick={() => setDetailFamily(f)}>
                <CardHeader className="pb-2"><CardTitle className="text-base font-sans">{f.name}</CardTitle></CardHeader>
                <CardContent className="space-y-2">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground"><Users className="h-3 w-3" /> {fMembers.length} members</div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground"><HandCoins className="h-3 w-3" /> {formatTZS(total)}</div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Family detail */}
      <Dialog open={!!detailFamily} onOpenChange={(o) => { if (!o) setDetailFamily(null); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle className="font-serif">{detailFamily?.name}</DialogTitle></DialogHeader>
          {detailFamily && (
            <div className="space-y-4">
              <p className="text-sm font-medium">Total Contributions: <span className="text-primary">{formatTZS(getFamilyTotal(detailFamily.id))}</span></p>

              <div className="flex items-center justify-between">
                <h4 className="text-sm font-semibold">Family Members</h4>
                <Button size="sm" variant="outline" onClick={() => setAddMemberOpen(true)}><UserPlus className="mr-2 h-3 w-3" /> Add</Button>
              </div>

              <Table>
                <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Role</TableHead><TableHead className="w-10"></TableHead></TableRow></TableHeader>
                <TableBody>
                  {getFamilyMembersList(detailFamily.id).length === 0 ? (
                    <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground py-4">No members assigned</TableCell></TableRow>
                  ) : getFamilyMembersList(detailFamily.id).map((fm: any) => (
                    <TableRow key={fm.id}>
                      <TableCell className="font-medium">{fm.full_name}</TableCell>
                      <TableCell><Badge variant="outline" className="capitalize">{fm.family_role}</Badge></TableCell>
                      <TableCell><Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => removeFamilyMember.mutate(fm.id)}><Trash2 className="h-3 w-3" /></Button></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {/* Add member sub-dialog */}
              {addMemberOpen && (
                <div className="border border-border rounded-lg p-4 space-y-3 bg-secondary/30">
                  <div className="space-y-2">
                    <Label>Member</Label>
                    <Select value={selectedMemberId} onValueChange={setSelectedMemberId}>
                      <SelectTrigger><SelectValue placeholder="Select member" /></SelectTrigger>
                      <SelectContent>{availableMembers.map((m: any) => <SelectItem key={m.id} value={m.id}>{m.full_name}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Role</Label>
                    <Select value={selectedRole} onValueChange={setSelectedRole}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{FAMILY_ROLES.map((r) => <SelectItem key={r} value={r} className="capitalize">{r === "father" ? "Husband" : r === "mother" ? "Wife" : r === "child" ? "Child" : r}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => addFamilyMember.mutate()} disabled={!selectedMemberId || addFamilyMember.isPending}>
                      {addFamilyMember.isPending && <Loader2 className="mr-2 h-3 w-3 animate-spin" />} Assign
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setAddMemberOpen(false)}>Cancel</Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

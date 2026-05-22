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
import { Plus, BookOpen, Users, Loader2, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useNetworkStatus } from "@/hooks/useNetworkStatus";
import { readOfflineCache, withOfflineCache } from "@/lib/offline-cache";

export default function MinistriesPage() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteMinistryId, setDeleteMinistryId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const { churchId } = useAuth();
  const { isOnline } = useNetworkStatus();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const ministriesCacheKey = churchId ? `offline-cache:ministries:${churchId}` : null;
  const ministryMembersCacheKey = churchId ? `offline-cache:ministry-memberships:${churchId}` : null;

  const { data: ministries = [], isLoading } = useQuery({
    queryKey: ["ministries", churchId],
    queryFn: async () => {
      if (!churchId) return [];
      if (!isOnline) {
        return readOfflineCache(ministriesCacheKey, [] as any[]);
      }

      return withOfflineCache(
        ministriesCacheKey,
        async () => {
          const { data, error } = await supabase
            .from("ministries")
            .select("*")
            .eq("church_id", churchId)
            .order("name");

          if (error) {
            console.error("Error fetching ministries:", error);
            return [];
          }

          return data ?? [];
        },
        readOfflineCache(ministriesCacheKey, [] as any[]),
      );
    },
    enabled: !!churchId,
  });

  const { data: ministryMembers = [] } = useQuery({
    queryKey: ["ministry-members-all", churchId],
    queryFn: async () => {
      if (!churchId) return [];
      if (!isOnline) {
        return readOfflineCache(ministryMembersCacheKey, [] as any[]);
      }

      return withOfflineCache(
        ministryMembersCacheKey,
        async () => {
          const { data, error } = await supabase
            .from("member_ministries")
            .select("ministry_id");

          if (error) {
            console.error("Error fetching ministry memberships:", error);
            return [];
          }

          return data ?? [];
        },
        readOfflineCache(ministryMembersCacheKey, [] as any[]),
      );
    },
    enabled: !!churchId,
  });

  const getMinistryMemberCount = (ministryId: string) =>
    ministryMembers.filter((membership: any) => membership.ministry_id === ministryId).length;

  const create = useMutation({
    mutationFn: async () => {
      if (!churchId) throw new Error("No church context");
      const { error } = await supabase.from("ministries").insert({ church_id: churchId, name, description: description || null });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ministries"] });
      toast({ title: "Ministry created" });
      setDialogOpen(false); setName(""); setDescription("");
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const deleteMinistry = useMutation({
    mutationFn: async (ministryId: string) => {
      const { error: membershipError } = await supabase
        .from("member_ministries")
        .delete()
        .eq("ministry_id", ministryId);

      if (membershipError) throw membershipError;

      const { error } = await supabase
        .from("ministries")
        .delete()
        .eq("id", ministryId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ministries"] });
      queryClient.invalidateQueries({ queryKey: ["ministry-members-all"] });
      toast({ title: "Ministry deleted" });
      setDeleteMinistryId(null);
    },
    onError: (err: any) => {
      console.error("Failed to delete ministry:", err);
      toast({ title: "Unable to delete ministry", description: err.message, variant: "destructive" });
    },
  });

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold font-serif">Ministries & Groups</h1>
          <p className="text-sm text-muted-foreground mt-1">Manage church ministries and groups</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild><Button size="sm"><Plus className="mr-2 h-4 w-4" /> Add Ministry</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle className="font-serif">New Ministry</DialogTitle></DialogHeader>
            <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); create.mutate(); }}>
              <div className="space-y-2"><Label>Name *</Label><Input placeholder="e.g. Choir, Youth Ministry" value={name} onChange={(e) => setName(e.target.value)} required /></div>
              <div className="space-y-2"><Label>Description</Label><Textarea placeholder="Ministry purpose..." value={description} onChange={(e) => setDescription(e.target.value)} /></div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" type="button" onClick={() => setDialogOpen(false)}>Cancel</Button>
                <Button type="submit" disabled={create.isPending || !name}>
                  {create.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Create
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? <p className="text-muted-foreground">Loading...</p> : ministries.length === 0 ? (
        <Card className="glass-card"><CardContent className="py-16 text-center text-muted-foreground">
          <BookOpen className="h-12 w-12 mx-auto mb-4 text-muted-foreground/30" />
          <p>No ministries yet. Create ministries to organize your church groups.</p>
        </CardContent></Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {ministries.map((m: any) => (
            <Card key={m.id} className="glass-card hover:gold-glow transition-shadow">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base font-sans">{m.name}</CardTitle>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="bg-success/20 text-success border-success/30">{m.status || "active"}</Badge>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive"
                      onClick={() => setDeleteMinistryId(m.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-3">{m.description || "No description"}</p>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Users className="h-3 w-3" />
                  {getMinistryMemberCount(m.id)} members
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <AlertDialog open={!!deleteMinistryId} onOpenChange={(open) => { if (!open) setDeleteMinistryId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete ministry?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove the ministry and its member assignments.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (deleteMinistryId) {
                  deleteMinistry.mutate(deleteMinistryId);
                }
              }}
            >
              {deleteMinistry.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

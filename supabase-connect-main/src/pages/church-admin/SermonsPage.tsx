import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Plus, BookMarked, Video, Headphones, Loader2, Pencil, Archive, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

type SermonRecord = {
  id: string;
  church_id: string;
  title: string;
  preacher: string | null;
  date: string;
  content: string | null;
  video_url: string | null;
  audio_url: string | null;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
};

const EMPTY_FORM = {
  id: null as string | null,
  title: "",
  preacher: "",
  date: "",
  content: "",
  videoUrl: "",
  audioUrl: "",
};

export default function SermonsPage() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const { churchId } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: sermons = [], isLoading } = useQuery({
    queryKey: ["sermons", churchId],
    queryFn: async () => {
      if (!churchId) return [];
      const { data, error } = await supabase
        .from("sermons")
        .select("*")
        .eq("church_id", churchId)
        .order("date", { ascending: false });

      if (error) throw error;
      return (data ?? []) as SermonRecord[];
    },
    enabled: !!churchId,
  });

  const activeSermons = useMemo(() => sermons.filter((sermon) => !sermon.archived_at), [sermons]);
  const archivedSermons = useMemo(() => sermons.filter((sermon) => !!sermon.archived_at), [sermons]);

  const resetForm = () => setForm(EMPTY_FORM);

  const openCreateDialog = () => {
    resetForm();
    setDialogOpen(true);
  };

  const openEditDialog = (sermon: SermonRecord) => {
    setForm({
      id: sermon.id,
      title: sermon.title,
      preacher: sermon.preacher ?? "",
      date: sermon.date ?? "",
      content: sermon.content ?? "",
      videoUrl: sermon.video_url ?? "",
      audioUrl: sermon.audio_url ?? "",
    });
    setDialogOpen(true);
  };

  const saveSermon = useMutation({
    mutationFn: async () => {
      if (!churchId) throw new Error("No church context");

      const payload = {
        title: form.title,
        preacher: form.preacher || null,
        date: form.date || new Date().toISOString().split("T")[0],
        content: form.content || null,
        video_url: form.videoUrl || null,
        audio_url: form.audioUrl || null,
      };

      if (form.id) {
        const { error } = await supabase
          .from("sermons")
          .update(payload)
          .eq("id", form.id)
          .eq("church_id", churchId);

        if (error) throw error;
        return;
      }

      const { error } = await supabase.from("sermons").insert({
        church_id: churchId,
        ...payload,
      });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sermons"] });
      queryClient.invalidateQueries({ queryKey: ["portal-sermons"] });
      toast({ title: form.id ? "Sermon updated" : "Sermon saved" });
      setDialogOpen(false);
      resetForm();
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const archiveSermon = useMutation({
    mutationFn: async (sermon: SermonRecord) => {
      const { error } = await supabase
        .from("sermons")
        .update({ archived_at: sermon.archived_at ? null : new Date().toISOString() })
        .eq("id", sermon.id)
        .eq("church_id", sermon.church_id);

      if (error) throw error;
    },
    onSuccess: (_, sermon) => {
      queryClient.invalidateQueries({ queryKey: ["sermons"] });
      queryClient.invalidateQueries({ queryKey: ["portal-sermons"] });
      toast({ title: sermon.archived_at ? "Sermon restored" : "Sermon archived" });
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const deleteSermon = useMutation({
    mutationFn: async (sermon: SermonRecord) => {
      const { error } = await supabase
        .from("sermons")
        .delete()
        .eq("id", sermon.id)
        .eq("church_id", sermon.church_id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sermons"] });
      queryClient.invalidateQueries({ queryKey: ["portal-sermons"] });
      toast({ title: "Sermon deleted" });
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const SermonCard = ({ sermon }: { sermon: SermonRecord }) => (
    <Card className="glass-card">
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="font-medium">{sermon.title}</h3>
              {sermon.archived_at && (
                <Badge variant="outline" className="border-border text-muted-foreground">
                  Archived
                </Badge>
              )}
            </div>
            {sermon.preacher && <p className="text-sm text-primary mt-0.5">{sermon.preacher}</p>}
            <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{sermon.content || "No notes"}</p>
            <div className="flex gap-3 mt-2">
              {sermon.video_url && (
                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Video className="h-3 w-3" />
                  Video
                </span>
              )}
              {sermon.audio_url && (
                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Headphones className="h-3 w-3" />
                  Audio
                </span>
              )}
            </div>
          </div>

          <div className="flex shrink-0 flex-col items-end gap-3">
            <p className="text-xs text-muted-foreground">{new Date(sermon.date).toLocaleDateString()}</p>
            <div className="flex flex-wrap justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => openEditDialog(sermon)}>
                <Pencil className="mr-2 h-3.5 w-3.5" />
                Edit
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => archiveSermon.mutate(sermon)}
                disabled={archiveSermon.isPending}
              >
                <Archive className="mr-2 h-3.5 w-3.5" />
                {sermon.archived_at ? "Restore" : "Archive"}
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => deleteSermon.mutate(sermon)}
                disabled={deleteSermon.isPending}
              >
                <Trash2 className="mr-2 h-3.5 w-3.5" />
                Delete
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold font-serif">Sermons</h1>
          <p className="text-sm text-muted-foreground mt-1">Manage sermons and messages</p>
        </div>
        <Dialog
          open={dialogOpen}
          onOpenChange={(open) => {
            setDialogOpen(open);
            if (!open) resetForm();
          }}
        >
          <DialogTrigger asChild>
            <Button size="sm" onClick={openCreateDialog}>
              <Plus className="mr-2 h-4 w-4" />
              Add Sermon
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle className="font-serif">{form.id ? "Edit Sermon" : "New Sermon"}</DialogTitle>
            </DialogHeader>
            <form
              className="space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                saveSermon.mutate();
              }}
            >
              <div className="space-y-2">
                <Label>Title *</Label>
                <Input
                  placeholder="Sermon title"
                  value={form.title}
                  onChange={(e) => setForm((current) => ({ ...current, title: e.target.value }))}
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Preacher</Label>
                  <Input
                    placeholder="Pastor name"
                    value={form.preacher}
                    onChange={(e) => setForm((current) => ({ ...current, preacher: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Date *</Label>
                  <Input
                    type="date"
                    value={form.date}
                    onChange={(e) => setForm((current) => ({ ...current, date: e.target.value }))}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Content / Notes</Label>
                <Textarea
                  rows={4}
                  placeholder="Sermon notes..."
                  value={form.content}
                  onChange={(e) => setForm((current) => ({ ...current, content: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Video URL</Label>
                <Input
                  placeholder="https://..."
                  value={form.videoUrl}
                  onChange={(e) => setForm((current) => ({ ...current, videoUrl: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Audio URL</Label>
                <Input
                  placeholder="https://..."
                  value={form.audioUrl}
                  onChange={(e) => setForm((current) => ({ ...current, audioUrl: e.target.value }))}
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" type="button" onClick={() => setDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={saveSermon.isPending || !form.title}>
                  {saveSermon.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {form.id ? "Save Changes" : "Save"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <p className="text-muted-foreground">Loading...</p>
      ) : sermons.length === 0 ? (
        <Card className="glass-card">
          <CardContent className="py-16 text-center text-muted-foreground">
            <BookMarked className="h-12 w-12 mx-auto mb-4 text-muted-foreground/30" />
            <p>No sermons uploaded yet.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          <div className="space-y-3">
            {activeSermons.length === 0 ? (
              <Card className="glass-card">
                <CardContent className="py-8 text-center text-muted-foreground">
                  No active sermons.
                </CardContent>
              </Card>
            ) : (
              activeSermons.map((sermon) => <SermonCard key={sermon.id} sermon={sermon} />)
            )}
          </div>

          {archivedSermons.length > 0 && (
            <div className="space-y-3">
              <div>
                <h2 className="font-semibold">Archived</h2>
                <p className="text-sm text-muted-foreground">Stored sermons that are hidden from members.</p>
              </div>
              {archivedSermons.map((sermon) => <SermonCard key={sermon.id} sermon={sermon} />)}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

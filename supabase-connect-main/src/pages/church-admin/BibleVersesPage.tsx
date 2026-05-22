import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Church, Plus, Loader2, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";

type BibleVerseRow = {
  id: string;
  reference: string;
  text: string;
  is_active: boolean;
  church_id: string;
  created_at: string;
};

export default function BibleVersesPage() {
  const { toast } = useToast();
  const { churchId } = useAuth();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [reference, setReference] = useState("");
  const [verseText, setVerseText] = useState("");
  const [language, setLanguage] = useState<"sw" | "en">("sw");
  const [verses, setVerses] = useState<BibleVerseRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const fetchVerses = async () => {
    if (!churchId) {
      setVerses([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);

    const { data, error } = await supabase
      .from("bible_verses")
      .select("id, reference, text, is_active, church_id, created_at")
      .eq("church_id", churchId)
      .order("created_at", { ascending: false });

    if (!error) {
      setVerses((data ?? []) as BibleVerseRow[]);
    } else {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }

    setIsLoading(false);
  };

  useEffect(() => {
    void fetchVerses();
  }, [churchId]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reference.trim() || !verseText.trim()) return;
    if (!churchId) {
      toast({ title: "Error", description: "No church context found.", variant: "destructive" });
      return;
    }

    setIsSaving(true);

    const { error } = await supabase
      .from("bible_verses")
      .insert({
        church_id: churchId,
        reference: reference.trim(),
        text: verseText.trim(),
        is_active: true,
      });

    setIsSaving(false);

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return;
    }

    toast({ title: "Bible verse added" });
    setReference("");
    setVerseText("");
    setLanguage("sw");
    setDialogOpen(false);
    await fetchVerses();
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("bible_verses").delete().eq("id", id);

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return;
    }

    toast({ title: "Bible verse deleted" });
    await fetchVerses();
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold font-serif">Bible Verses</h1>
          <p className="text-sm text-muted-foreground mt-1">Share daily verses with your congregation</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild><Button size="sm"><Plus className="mr-2 h-4 w-4" /> Add Verse</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle className="font-serif">Add Bible Verse</DialogTitle></DialogHeader>
            <form onSubmit={handleCreate} className="space-y-4">
              <div className="space-y-2">
                <Label>Reference</Label>
                <Input placeholder="e.g. John 3:16" value={reference} onChange={(e) => setReference(e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label>Language</Label>
                <Select value={language} onValueChange={(value: "sw" | "en") => setLanguage(value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select language" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="sw">Swahili</SelectItem>
                    <SelectItem value="en">English</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Verse Text</Label>
                <Textarea placeholder="Enter the verse text..." value={verseText} onChange={(e) => setVerseText(e.target.value)} rows={4} required />
              </div>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
                <Button type="submit" disabled={isSaving}>
                  {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Add Verse
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : verses.length === 0 ? (
        <Card className="glass-card">
          <CardContent className="py-16 text-center text-muted-foreground">
            <Church className="h-12 w-12 mx-auto mb-4 text-muted-foreground/30" />
            <p>No verses available</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {verses.map((verse) => (
            <Card key={verse.id} className="glass-card">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-sans">{verse.reference}</CardTitle>
                  <p className="text-xs text-muted-foreground">{language}</p>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground italic">"{verse.text}"</p>
                <div className="flex items-center justify-between mt-3">
                  <p className="text-xs text-muted-foreground/60">{new Date(verse.created_at).toLocaleDateString()}</p>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => handleDelete(verse.id)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

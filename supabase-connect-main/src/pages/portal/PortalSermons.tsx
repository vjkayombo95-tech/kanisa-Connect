import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BookMarked, Video, Headphones } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useFeatureAccess } from "@/hooks/use-feature-access";

export default function PortalSermons() {
  const { churchId } = useAuth();
  const { isFeatureEnabled } = useFeatureAccess();

  const { data: sermons = [], isLoading, isError, refetch } = useQuery({
    queryKey: ["portal-sermons", churchId],
    queryFn: async () => {
      if (!churchId) return [];
      const { data, error } = await supabase
        .from("sermons")
        .select("*")
        .eq("church_id", churchId)
        .is("archived_at", null)
        .order("date", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!churchId && isFeatureEnabled("sermons"),
  });

  return (
    <div className="container mx-auto px-4 py-10 animate-fade-in">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-2xl md:text-3xl font-bold font-serif mb-2">Sermons</h1>
        <p className="text-muted-foreground mb-8">Listen to messages and teachings from our pastors.</p>

        {isLoading ? <p role="status" aria-live="polite" className="text-muted-foreground">Mahubiri yanapakiwa...</p> : isError ? (
          <Card className="border-destructive/30"><CardContent className="space-y-3 py-10 text-center" role="alert"><p className="text-destructive">Imeshindikana kupakia mahubiri.</p><Button type="button" variant="outline" onClick={() => void refetch()}>Jaribu tena</Button></CardContent></Card>
        ) : sermons.length === 0 ? (
          <Card className="glass-card"><CardContent className="py-16 text-center text-muted-foreground">
            <BookMarked className="h-12 w-12 mx-auto mb-4 text-muted-foreground/30" />
            No sermons available yet.
          </CardContent></Card>
        ) : (
          <div className="space-y-4">
            {sermons.map((s: any) => (
              <Card key={s.id} className="glass-card hover:gold-glow transition-shadow">
                <CardContent className="p-6">
                  <div className="flex min-w-0 items-start justify-between gap-4">
                    <div className="min-w-0">
                      <h3 className="break-words font-semibold">{s.title}</h3>
                      {s.preacher && <p className="text-sm text-primary mt-0.5">{s.preacher}</p>}
                      <p className="text-sm text-muted-foreground mt-2 line-clamp-3">{s.content || "No notes available."}</p>
                      <div className="flex gap-3 mt-3">
                        {s.video_url && (
                          <a href={s.video_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline">
                            <Video className="h-3.5 w-3.5" /> Watch Video
                          </a>
                        )}
                        {s.audio_url && (
                          <a href={s.audio_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline">
                            <Headphones className="h-3.5 w-3.5" /> Listen Audio
                          </a>
                        )}
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground shrink-0">{new Date(s.date).toLocaleDateString()}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

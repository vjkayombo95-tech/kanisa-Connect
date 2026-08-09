import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BookOpen, CheckCircle2, ExternalLink, Plus, Radio, Square } from "lucide-react";
import { useTranslation } from "react-i18next";

import { AppLink } from "@/components/AppLink";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/contexts/AuthContext";
import { useChurchPermission } from "@/hooks/use-church-permission";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { churchLivestreamQueryKey, extractYouTubeVideoId, fetchChurchLivestreams, isSecureLivestreamUrl, transitionChurchLivestream, type ChurchLivestream, type ChurchLivestreamProvider } from "@/lib/church-livestreams";

const emptyForm = { id: "", title: "", provider: "youtube" as ChurchLivestreamProvider, watchUrl: "", thumbnailUrl: "", recordingUrl: "", scheduledStart: "", scheduledEnd: "" };
const emptySermonForm = { livestreamId: "", title: "", preacher: "", date: "", content: "", recordingUrl: "" };

export default function LivestreamsPage() {
  const { t } = useTranslation();
  const { churchId, user } = useAuth();
  const { allowed: canManage, isLoading: permissionLoading } = useChurchPermission("livestream", "manage");
  const { allowed: canCreateSermon } = useChurchPermission("sermons", "create");
  const { allowed: canPublishSermon } = useChurchPermission("sermons", "publish");
  const [form, setForm] = useState(emptyForm);
  const [sermonForm, setSermonForm] = useState(emptySermonForm);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [sermonDialogOpen, setSermonDialogOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const streams = useQuery({ queryKey: churchLivestreamQueryKey(churchId), queryFn: () => fetchChurchLivestreams(churchId!), enabled: !!churchId });
  const sermonLinks = useQuery({
    queryKey: ["livestream-sermon-links", churchId],
    queryFn: async () => {
      if (!churchId) return new Map<string, string>();
      const { data, error } = await supabase.from("sermons").select("id, source_livestream_id").eq("church_id", churchId).not("source_livestream_id", "is", null);
      if (error) throw error;
      return new Map((data ?? []).map((sermon) => [sermon.source_livestream_id!, sermon.id]));
    },
    enabled: !!churchId && canCreateSermon && canPublishSermon,
  });
  const invalidate = () => queryClient.invalidateQueries({ queryKey: churchLivestreamQueryKey(churchId) });

  const save = useMutation({
    mutationFn: async () => {
      if (!churchId || !user?.id) throw new Error("Church context is required.");
      if (!isSecureLivestreamUrl(form.watchUrl) || (form.thumbnailUrl && !isSecureLivestreamUrl(form.thumbnailUrl)) || (form.recordingUrl && !isSecureLivestreamUrl(form.recordingUrl))) throw new Error("Tumia anwani salama inayoanza na https://");
      if (form.provider === "youtube" && !extractYouTubeVideoId(form.watchUrl)) throw new Error("Tumia YouTube URL halali ya watch, live, au youtu.be.");
      const payload = { title: form.title.trim(), provider: form.provider, watch_url: form.watchUrl.trim(), thumbnail_url: form.thumbnailUrl.trim() || null, recording_url: form.recordingUrl.trim() || null, scheduled_start: form.scheduledStart ? new Date(form.scheduledStart).toISOString() : null, scheduled_end: form.scheduledEnd ? new Date(form.scheduledEnd).toISOString() : null };
      if (form.id) {
        const { error } = await supabase.from("church_livestreams").update(payload).eq("id", form.id).eq("church_id", churchId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("church_livestreams").insert({ church_id: churchId, created_by: user.id, ...payload });
        if (error) throw error;
      }
    },
    onSuccess: () => { invalidate(); setDialogOpen(false); setForm(emptyForm); toast({ title: "Livestream imehifadhiwa" }); },
    onError: (error: Error) => toast({ title: "Imeshindikana", description: error.message, variant: "destructive" }),
  });

  const transition = useMutation({
    mutationFn: ({ id, status }: { id: string; status: "live" | "ended" | "cancelled" }) => transitionChurchLivestream(id, status),
    onSuccess: () => { invalidate(); toast({ title: "Hali ya livestream imesasishwa" }); },
    onError: (error: Error) => toast({ title: "Imeshindikana", description: error.message, variant: "destructive" }),
  });

  const publishAsSermon = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc("publish_livestream_as_sermon", {
        _livestream_id: sermonForm.livestreamId,
        _title: sermonForm.title.trim(),
        _preacher: sermonForm.preacher.trim() || null,
        _sermon_date: sermonForm.date || null,
        _content: sermonForm.content.trim() || null,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["livestream-sermon-links", churchId] });
      queryClient.invalidateQueries({ queryKey: ["sermons", churchId] });
      queryClient.invalidateQueries({ queryKey: ["portal-sermons", churchId] });
      setSermonDialogOpen(false);
      setSermonForm(emptySermonForm);
      toast({ title: "Livestream imechapishwa kama hubiri" });
    },
    onError: (error: Error) => toast({ title: "Hubiri halikuweza kuchapishwa", description: error.message, variant: "destructive" }),
  });

  const edit = (stream: ChurchLivestream) => {
    setForm({ id: stream.id, title: stream.title, provider: stream.provider, watchUrl: stream.watchUrl, thumbnailUrl: stream.thumbnailUrl ?? "", recordingUrl: stream.recordingUrl ?? "", scheduledStart: stream.scheduledStart?.slice(0, 16) ?? "", scheduledEnd: stream.scheduledEnd?.slice(0, 16) ?? "" });
    setDialogOpen(true);
  };

  const openSermonReview = (stream: ChurchLivestream) => {
    const sourceDate = stream.actualStartedAt ?? stream.scheduledStart;
    setSermonForm({ livestreamId: stream.id, title: stream.title, preacher: "", date: sourceDate?.slice(0, 10) ?? "", content: "", recordingUrl: stream.recordingUrl ?? "" });
    setSermonDialogOpen(true);
  };

  if (permissionLoading) return <p className="text-sm text-muted-foreground">Inakagua ruhusa…</p>;
  if (!canManage) return <Card><CardContent className="p-6 text-sm text-muted-foreground">Huna ruhusa ya kusimamia livestream.</CardContent></Card>;

  return <div className="space-y-6">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><h1 className="text-2xl font-bold">{t("church_media.livestreams_title")}</h1><p className="text-sm text-muted-foreground">{t("church_media.livestreams_description")}</p></div>
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogTrigger asChild><Button onClick={() => setForm(emptyForm)}><Plus className="mr-2 h-4 w-4" />Ratibu livestream</Button></DialogTrigger>
        <DialogContent><DialogHeader><DialogTitle>{form.id ? "Hariri livestream" : "Livestream mpya"}</DialogTitle></DialogHeader>
          <form className="space-y-4" onSubmit={(event) => { event.preventDefault(); save.mutate(); }}>
            <div><Label htmlFor="live-title">Kichwa</Label><Input id="live-title" required maxLength={200} value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} /></div>
            <div><Label htmlFor="live-provider">Mtoa huduma</Label><select id="live-provider" className="min-h-10 w-full rounded-md border bg-background px-3" value={form.provider} onChange={(event) => setForm({ ...form, provider: event.target.value as ChurchLivestreamProvider })}>{["youtube", "facebook", "vimeo", "custom"].map((provider) => <option key={provider}>{provider}</option>)}</select></div>
            <div><Label htmlFor="watch-url">Watch URL</Label><Input id="watch-url" required type="url" placeholder="https://…" value={form.watchUrl} onChange={(event) => setForm({ ...form, watchUrl: event.target.value })} /></div>
            <div className="grid gap-3 sm:grid-cols-2"><div><Label htmlFor="scheduled-start">Mwanzo</Label><Input id="scheduled-start" type="datetime-local" value={form.scheduledStart} onChange={(event) => setForm({ ...form, scheduledStart: event.target.value })} /></div><div><Label htmlFor="scheduled-end">Mwisho</Label><Input id="scheduled-end" type="datetime-local" value={form.scheduledEnd} onChange={(event) => setForm({ ...form, scheduledEnd: event.target.value })} /></div></div>
            <div><Label htmlFor="thumbnail-url">Thumbnail URL</Label><Input id="thumbnail-url" type="url" value={form.thumbnailUrl} onChange={(event) => setForm({ ...form, thumbnailUrl: event.target.value })} /></div>
            {form.id ? <div><Label htmlFor="recording-url">Recording URL</Label><Input id="recording-url" type="url" value={form.recordingUrl} onChange={(event) => setForm({ ...form, recordingUrl: event.target.value })} /></div> : null}
            <Button className="w-full" disabled={save.isPending}>{save.isPending ? "Inahifadhi…" : "Hifadhi"}</Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>

    {streams.isError ? <p className="rounded-xl border border-destructive/30 p-4 text-sm text-destructive">Livestream hazikuweza kupakiwa.</p> : null}
    <div className="space-y-3">
      {(streams.data ?? []).map((stream) => {
        const sermonId = sermonLinks.data?.get(stream.id);
        return <Card key={stream.id}><CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div><div className="flex items-center gap-2"><h2 className="font-semibold">{stream.title}</h2><Badge variant={stream.status === "live" ? "destructive" : "outline"}>{stream.status === "live" ? "LIVE" : stream.status}</Badge></div><p className="mt-1 text-sm text-muted-foreground">{stream.actualStartedAt ? `Started: ${new Date(stream.actualStartedAt).toLocaleString()}` : stream.scheduledStart ? new Date(stream.scheduledStart).toLocaleString() : "Muda haujawekwa"}</p>{stream.provider === "youtube" ? <p className="mt-1 text-xs text-muted-foreground">Automation: YouTube · {stream.providerLastCheckedAt ? `Last checked ${new Date(stream.providerLastCheckedAt).toLocaleString()} · Provider: ${stream.providerStatus ?? "unknown"}` : "Awaiting first status check"}{stream.providerLastErrorCategory ? " · Status unavailable; manual controls remain available" : ""}</p> : <p className="mt-1 text-xs text-muted-foreground">Automation: Manual only ({stream.provider})</p>}</div>
          <div className="flex flex-wrap gap-2">
            {stream.status === "live" ? <Button asChild variant="outline" size="sm"><a href={stream.watchUrl} target="_blank" rel="noopener noreferrer"><ExternalLink className="mr-2 h-4 w-4" />Fungua Stream</a></Button> : null}
            {stream.status === "scheduled" ? <><Button variant="outline" size="sm" onClick={() => edit(stream)}>Hariri</Button><ConfirmAction title="Anza LIVE?" description="Uko tayari kuonyesha kwamba Misa hii inaendelea moja kwa moja?" label="Anza LIVE" onConfirm={() => transition.mutate({ id: stream.id, status: "live" })} icon={<Radio className="mr-2 h-4 w-4" />} /><ConfirmAction title="Ghairi livestream?" description="Livestream hii itawekwa kuwa imeghairiwa." label="Ghairi" variant="outline" onConfirm={() => transition.mutate({ id: stream.id, status: "cancelled" })} /></> : null}
            {stream.status === "live" ? <ConfirmAction title="Maliza LIVE?" description="Unataka kumaliza matangazo ya moja kwa moja?" label="Maliza LIVE" variant="destructive" onConfirm={() => transition.mutate({ id: stream.id, status: "ended" })} icon={<Square className="mr-2 h-4 w-4" />} /> : null}
            {stream.status === "ended" && stream.recordingUrl ? <Button asChild variant="outline" size="sm"><a href={stream.recordingUrl} target="_blank" rel="noopener noreferrer"><ExternalLink className="mr-2 h-4 w-4" />Tazama Rekodi</a></Button> : null}
            {stream.status === "ended" && stream.recordingUrl && canCreateSermon && canPublishSermon ? sermonId ? <Button asChild variant="outline" size="sm"><AppLink to="/church-admin/sermons"><CheckCircle2 className="mr-2 h-4 w-4" />Limechapishwa kama Hubiri</AppLink></Button> : <Button variant="outline" size="sm" onClick={() => openSermonReview(stream)}><BookOpen className="mr-2 h-4 w-4" />Chapisha kama Hubiri</Button> : null}
          </div>
        </CardContent></Card>;
      })}
      {!streams.isLoading && !streams.data?.length ? <p className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">Hakuna livestream zilizoratibiwa.</p> : null}
    </div>

    <Dialog open={sermonDialogOpen} onOpenChange={setSermonDialogOpen}><DialogContent><DialogHeader><DialogTitle>Chapisha kama Hubiri</DialogTitle></DialogHeader>
      <form className="space-y-4" onSubmit={(event) => { event.preventDefault(); publishAsSermon.mutate(); }}>
        <p className="text-sm text-muted-foreground">Kagua taarifa kabla ya kutengeneza hubiri lililorekodiwa. Livestream ya kihistoria haitabadilishwa.</p>
        <div><Label htmlFor="sermon-title">Kichwa *</Label><Input id="sermon-title" required maxLength={200} value={sermonForm.title} onChange={(event) => setSermonForm({ ...sermonForm, title: event.target.value })} /></div>
        <div><Label htmlFor="sermon-recording">Recording URL</Label><Input id="sermon-recording" value={sermonForm.recordingUrl} readOnly aria-readonly="true" /></div>
        <div className="grid gap-3 sm:grid-cols-2"><div><Label htmlFor="sermon-preacher">Mhubiri</Label><Input id="sermon-preacher" value={sermonForm.preacher} onChange={(event) => setSermonForm({ ...sermonForm, preacher: event.target.value })} /></div><div><Label htmlFor="sermon-date">Tarehe</Label><Input id="sermon-date" type="date" value={sermonForm.date} onChange={(event) => setSermonForm({ ...sermonForm, date: event.target.value })} /></div></div>
        <div><Label htmlFor="sermon-content">Maelezo</Label><Textarea id="sermon-content" value={sermonForm.content} onChange={(event) => setSermonForm({ ...sermonForm, content: event.target.value })} /></div>
        <Button className="w-full" disabled={publishAsSermon.isPending}>{publishAsSermon.isPending ? "Inachapisha…" : "Chapisha kama Hubiri"}</Button>
      </form>
    </DialogContent></Dialog>
  </div>;
}

function ConfirmAction({ title, description, label, onConfirm, variant = "default", icon }: { title: string; description: string; label: string; onConfirm: () => void; variant?: "default" | "outline" | "destructive"; icon?: React.ReactNode }) {
  return <AlertDialog><AlertDialogTrigger asChild><Button size="sm" variant={variant}>{icon}{label}</Button></AlertDialogTrigger><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>{title}</AlertDialogTitle><AlertDialogDescription>{description}</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Rudi</AlertDialogCancel><AlertDialogAction onClick={onConfirm}>{label}</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>;
}

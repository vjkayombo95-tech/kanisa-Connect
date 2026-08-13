import { FormEvent, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { useLivestreamPermission } from "@/hooks/use-church-livestream";
import { supabase } from "@/integrations/supabase/client";
import { extractYouTubeVideoId } from "@/lib/church-livestreams";
import { useToast } from "@/hooks/use-toast";

type LivestreamRow = {
  id: string;
  church_id: string;
  title: string;
  watch_url: string;
  provider_external_id: string;
  scheduled_start: string | null;
  scheduled_end: string | null;
  status: "scheduled" | "live" | "ended" | "cancelled";
};

type EditForm = {
  id: string;
  title: string;
  watchUrl: string;
  scheduledStart: string;
  scheduledEnd: string;
};

type DbResult = { data?: LivestreamRow[] | null; error: Error | null };
type Db = {
  from: (table: string) => {
    select: (columns: string) => { eq: (column: string, value: string | null) => { order: (column: string, options: { ascending: boolean }) => Promise<DbResult> } };
    insert: (values: Record<string, unknown>) => Promise<{ error: Error | null }>;
    update: (values: Record<string, unknown>) => { eq: (column: string, value: string) => { eq: (column: string, value: string | null) => Promise<{ error: Error | null }> } };
  };
  rpc: (name: string, args: unknown) => Promise<{ error: Error | null }>;
};

const db = supabase as unknown as Db;
const toLocalInput = (value: string | null) => value ? new Date(value).toISOString().slice(0, 16) : "";
const toTimestamp = (value: string) => value ? new Date(value).toISOString() : null;

export default function LivestreamsPage() {
  const { churchId, user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const editPermission = useLivestreamPermission("edit");
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [edit, setEdit] = useState<EditForm | null>(null);
  const key = ["admin-production-livestreams", churchId];

  const query = useQuery({
    queryKey: key,
    queryFn: async () => {
      const { data, error } = await db.from("church_livestreams").select("*").eq("church_id", churchId).order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!churchId,
  });

  const create = useMutation({
    mutationFn: async () => {
      const videoId = extractYouTubeVideoId(url);
      if (!videoId) throw new Error("A valid public YouTube URL is required");
      const { error } = await db.from("church_livestreams").insert({ church_id: churchId, created_by: user?.id, title, provider: "youtube", watch_url: url, provider_external_id: videoId, status: "scheduled" });
      if (error) throw error;
    },
    onSuccess: () => { setTitle(""); setUrl(""); void queryClient.invalidateQueries({ queryKey: key }); },
  });

  const update = useMutation({
    mutationFn: async (form: EditForm) => {
      if (!churchId || editPermission.data !== true) throw new Error("Livestream edit permission required");
      const videoId = extractYouTubeVideoId(form.watchUrl);
      if (!videoId) throw new Error("A valid public YouTube URL is required");
      const scheduledStart = toTimestamp(form.scheduledStart);
      const scheduledEnd = toTimestamp(form.scheduledEnd);
      if (scheduledStart && scheduledEnd && scheduledEnd <= scheduledStart) throw new Error("Scheduled end must be after scheduled start");
      const { error } = await db.from("church_livestreams").update({ title: form.title.trim(), watch_url: form.watchUrl, provider_external_id: videoId, scheduled_start: scheduledStart, scheduled_end: scheduledEnd }).eq("id", form.id).eq("church_id", churchId);
      if (error) throw error;
    },
    onSuccess: () => { setEdit(null); void queryClient.invalidateQueries({ queryKey: key }); toast({ title: "Livestream updated" }); },
  });

  const transition = async (id: string, status: string) => {
    const { error } = await db.rpc("transition_production_livestream", { _livestream_id: id, _new_status: status });
    if (error) throw error;
    await queryClient.invalidateQueries({ queryKey: key });
  };

  const openEdit = (row: LivestreamRow) => setEdit({ id: row.id, title: row.title, watchUrl: row.watch_url, scheduledStart: toLocalInput(row.scheduled_start), scheduledEnd: toLocalInput(row.scheduled_end) });
  const submitEdit = (event: FormEvent) => { event.preventDefault(); if (edit) update.mutate(edit); };

  return <main className="space-y-6">
    <header><h1 className="text-3xl font-bold">Livestreams</h1><p className="text-muted-foreground">Create and control tenant-scoped YouTube broadcasts.</p></header>
    <form onSubmit={(event) => { event.preventDefault(); create.mutate(); }} className="grid gap-3 rounded-2xl border p-4">
      <input aria-label="Livestream title" value={title} onChange={(event) => setTitle(event.target.value)} required maxLength={200} className="min-h-11 rounded-xl border bg-background px-3" placeholder="Title" />
      <input aria-label="YouTube URL" value={url} onChange={(event) => setUrl(event.target.value)} required className="min-h-11 rounded-xl border bg-background px-3" placeholder="https://www.youtube.com/watch?v=..." />
      <button disabled={create.isPending} className="min-h-11 rounded-xl bg-primary px-4 font-bold text-primary-foreground">Schedule livestream</button>
      {create.error ? <p className="text-sm text-destructive">{create.error.message}</p> : null}
    </form>
    <section className="space-y-3">{query.data?.map((row) => <article key={row.id} className="rounded-2xl border p-4">
      <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="font-bold">{row.title}</h2><p className="text-sm text-muted-foreground">{row.status}</p></div><div className="flex gap-2">
        {editPermission.data === true ? <button type="button" onClick={() => openEdit(row)} className="min-h-11 rounded-xl border px-4">Edit</button> : null}
        {row.status === "scheduled" ? <button type="button" onClick={() => void transition(row.id, "live")} className="min-h-11 rounded-xl border px-4">Start</button> : null}
        {row.status === "live" ? <button type="button" onClick={() => void transition(row.id, "ended")} className="min-h-11 rounded-xl border px-4">End</button> : null}
      </div></div>
      {edit?.id === row.id ? <form onSubmit={submitEdit} className="mt-4 grid gap-3 border-t pt-4" data-testid="livestream-edit-form">
        <input aria-label="Edit livestream title" value={edit.title} onChange={(event) => setEdit({ ...edit, title: event.target.value })} required maxLength={200} className="min-h-11 rounded-xl border bg-background px-3" />
        <input aria-label="Edit YouTube URL" value={edit.watchUrl} onChange={(event) => setEdit({ ...edit, watchUrl: event.target.value })} required className="min-h-11 rounded-xl border bg-background px-3" />
        <div className="grid gap-3 sm:grid-cols-2"><input type="datetime-local" aria-label="Scheduled start" value={edit.scheduledStart} onChange={(event) => setEdit({ ...edit, scheduledStart: event.target.value })} className="min-h-11 rounded-xl border bg-background px-3" /><input type="datetime-local" aria-label="Scheduled end" value={edit.scheduledEnd} onChange={(event) => setEdit({ ...edit, scheduledEnd: event.target.value })} className="min-h-11 rounded-xl border bg-background px-3" /></div>
        <div className="flex gap-2"><button disabled={update.isPending} className="min-h-11 rounded-xl bg-primary px-4 font-bold text-primary-foreground">{update.isPending ? "Saving…" : "Save"}</button><button type="button" onClick={() => { setEdit(null); update.reset(); }} className="min-h-11 rounded-xl border px-4">Cancel</button></div>
        {update.error ? <p role="alert" className="text-sm text-destructive">{update.error.message}</p> : null}
      </form> : null}
    </article>)}</section>
  </main>;
}

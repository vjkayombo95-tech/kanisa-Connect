import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { SupabaseClient } from "@supabase/supabase-js";
import { ArrowLeft, CheckCircle2, Loader2, Search, Users, XCircle } from "lucide-react";
import { Link, useParams } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

const db = supabase as unknown as SupabaseClient;
type RosterRow = { attendance_id: string; event_id: string; church_id: string; event_title: string; event_start_date: string; event_location: string | null; registration_type: string; registration_fee: number; full_name: string; phone: string | null; email: string | null; registration_status: string; payment_status: string; attendance_status: string };

export default function EventRegistrationsPage() {
  const { eventId } = useParams(); const { churchId } = useAuth(); const { toast } = useToast(); const client = useQueryClient();
  const [search, setSearch] = useState(""); const [selected, setSelected] = useState<string[]>([]);
  const roster = useQuery({ queryKey: ["wave4a-event-roster", eventId, churchId], enabled: !!eventId && !!churchId, queryFn: async () => {
    const ownership = await db.from("events").select("id,church_id,title,start_date,location,registration_type,registration_fee").eq("id", eventId).eq("church_id", churchId).maybeSingle();
    if (ownership.error) throw ownership.error; if (!ownership.data) throw new Error("Tukio halipatikani katika parokia hii.");
    const result = await db.rpc("get_event_registration_roster", { p_event_id: eventId }); if (result.error) throw result.error;
    const rows = (result.data ?? []) as RosterRow[]; if (rows.some(row => row.church_id !== churchId || row.event_id !== eventId)) throw new Error("Roster tenant mismatch.");
    return { event: ownership.data, rows };
  }});
  const filtered = useMemo(() => (roster.data?.rows ?? []).filter(row => `${row.full_name} ${row.phone ?? ""} ${row.email ?? ""}`.toLowerCase().includes(search.toLowerCase())), [roster.data, search]);
  const mark = useMutation({ mutationFn: async (status: "attended" | "absent") => { const result = await db.rpc("mark_event_registration_attendance", { p_event_id: eventId, p_attendance_ids: selected, p_attendance_status: status }); if (result.error) throw result.error; const value = result.data as {success?:boolean;error?:string}; if (!value?.success) throw new Error(value?.error || "Attendance update failed"); }, onSuccess: () => { setSelected([]); client.invalidateQueries({queryKey:["wave4a-event-roster"]}); toast({title:"Mahudhurio yamehifadhiwa"}); }, onError: (error: Error) => toast({title:"Imeshindikana",description:error.message,variant:"destructive"}) });
  if (roster.isLoading) return <Loader2 className="mx-auto h-6 w-6 animate-spin"/>;
  if (roster.isError) return <div className="space-y-4"><Button asChild variant="outline"><Link to="/church-admin/events"><ArrowLeft className="mr-2 h-4 w-4"/>Rudi</Link></Button><Card><CardContent className="p-6 text-destructive">{(roster.error as Error).message}</CardContent></Card></div>;
  return <div className="space-y-6" data-testid="event-registration-roster"><div><Button asChild variant="ghost"><Link to="/church-admin/events"><ArrowLeft className="mr-2 h-4 w-4"/>Matukio</Link></Button><h1 className="font-serif text-2xl font-bold">Waliojisajili</h1><p className="text-sm text-muted-foreground">{roster.data?.event.title}</p></div><div className="relative max-w-md"><Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground"/><Input className="pl-9" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Tafuta jina, simu au barua pepe"/></div><div className="flex flex-wrap gap-2"><Button variant="outline" disabled={!selected.length} onClick={()=>mark.mutate("attended")}><CheckCircle2 className="mr-2 h-4 w-4"/>Amehudhuria</Button><Button variant="outline" disabled={!selected.length} onClick={()=>mark.mutate("absent")}><XCircle className="mr-2 h-4 w-4"/>Hajahudhuria</Button></div><Card><CardHeader><CardTitle className="flex items-center gap-2 text-base"><Users className="h-4 w-4"/>{filtered.length} waliojisajili</CardTitle></CardHeader><CardContent className="space-y-2">{filtered.length ? filtered.map(row=><div key={row.attendance_id} className="flex min-h-14 items-center gap-3 rounded-xl border p-3"><Checkbox checked={selected.includes(row.attendance_id)} onCheckedChange={v=>setSelected(current=>v?[...current,row.attendance_id]:current.filter(id=>id!==row.attendance_id))}/><div className="min-w-0 flex-1"><p className="font-medium">{row.full_name}</p><p className="truncate text-xs text-muted-foreground">{row.phone || row.email || "-"}</p></div><div className="text-right"><Badge variant="outline">{row.registration_status}</Badge><p className="mt-1 text-xs text-muted-foreground">{row.registration_type === "paid" ? row.payment_status : "bure"} · {row.attendance_status}</p></div></div>) : <p className="py-8 text-center text-muted-foreground">Hakuna usajili.</p>}</CardContent></Card></div>;
}

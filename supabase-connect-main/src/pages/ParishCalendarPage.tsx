import { useQuery } from "@tanstack/react-query";
import type { SupabaseClient } from "@supabase/supabase-js";
import { CalendarDays, Church, Loader2, MapPin } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { formatMassDate, formatMassTime, type MassOccurrence } from "@/lib/mass-timetable";

const db = supabase as unknown as SupabaseClient;
type CalendarEvent = { id: string; church_id: string; title: string; description: string | null; start_date: string; end_date: string | null; location: string | null; event_type: string | null; registration_type: string | null; archived_at: string | null };
type Props = { workspace: "member" | "admin" };

export default function ParishCalendarPage({ workspace }: Props) {
  const { churchId, user } = useAuth();
  const calendar = useQuery({ queryKey: ["wave4a-parish-calendar", workspace, churchId], enabled: !!churchId, queryFn: async () => {
    const now = new Date().toISOString(); const today = now.slice(0, 10);
    const eventsQuery = db.from("events").select("id,church_id,title,description,start_date,end_date,location,event_type,registration_type,archived_at").eq("church_id", churchId).gte("start_date", now).is("archived_at", null).order("start_date").limit(100);
    const [events, masses] = await Promise.all([eventsQuery, db.from("mass_occurrences").select("*").eq("church_id", churchId).gte("occurrence_date", today).in("status", ["scheduled", "rescheduled"]).order("occurrence_date").order("start_time").limit(100)]);
    if (events.error) throw events.error; if (masses.error) throw masses.error;
    const eventRows = events.data as CalendarEvent[];
    const registrationByEvent = new Map<string, string>();
    if (workspace === "member" && user && eventRows.length) {
      const member = await db.from("members").select("id").eq("user_id", user.id).eq("church_id", churchId).maybeSingle();
      if (member.error) throw member.error;
      if (member.data) {
        const registrations = await db.from("event_attendances").select("event_id,registration_status,payment_status").eq("church_id", churchId).eq("member_id", member.data.id).in("event_id", eventRows.map(row => row.id));
        if (registrations.error) throw registrations.error;
        for (const row of registrations.data ?? []) registrationByEvent.set(row.event_id, row.payment_status === "paid" ? "Umesajiliwa · imelipwa" : `Umesajiliwa · ${row.registration_status}`);
      }
    }
    return { events: eventRows, masses: masses.data as MassOccurrence[], registrationByEvent };
  }});
  const items = [
    ...(calendar.data?.events ?? []).map(event => ({ id: `event-${event.id}`, at: event.start_date, title: event.title, kind: event.event_type || "Tukio", detail: event.location, status: calendar.data?.registrationByEvent.get(event.id) ?? (event.registration_type === "paid" ? "Usajili wa malipo" : "Tukio la parokia") })),
    ...(calendar.data?.masses ?? []).map(mass => ({ id: `mass-${mass.id}`, at: `${mass.occurrence_date}T${mass.start_time}`, title: mass.name, kind: "Misa", detail: mass.location_name, status: mass.status })),
  ].sort((a,b) => a.at.localeCompare(b.at));
  return <div className="mx-auto max-w-5xl space-y-6" data-testid={`${workspace}-parish-calendar`}><div><p className="text-sm font-bold text-primary">Kanisa Connect</p><h1 className="font-serif text-2xl font-bold">Kalenda ya Parokia</h1><p className="text-sm text-muted-foreground">Matukio na Misa zijazo katika parokia yako.</p></div>
    {calendar.isLoading ? <Loader2 className="mx-auto h-6 w-6 animate-spin"/> : calendar.isError ? <Card><CardContent className="p-6 text-destructive">Kalenda haikupatikana. Jaribu tena.</CardContent></Card> : items.length === 0 ? <Card><CardContent className="py-12 text-center text-muted-foreground"><CalendarDays className="mx-auto mb-3 h-10 w-10"/>Hakuna tukio lijalo.</CardContent></Card> : <div className="grid gap-3 md:grid-cols-2">{items.map(item => <Card key={item.id}><CardContent className="p-5"><div className="flex items-start justify-between gap-3"><div><Badge variant="outline" className="mb-2">{item.kind}</Badge><h2 className="font-semibold">{item.title}</h2></div><Church className="h-5 w-5 text-primary"/></div><p className="mt-3 text-sm text-muted-foreground">{item.kind === "Misa" ? `${formatMassDate(item.at.slice(0,10))} ${formatMassTime(item.at.slice(11))}` : new Date(item.at).toLocaleString("sw-TZ")}</p>{item.detail && <p className="mt-2 flex items-center gap-1 text-sm text-muted-foreground"><MapPin className="h-4 w-4"/>{item.detail}</p>}<p className="mt-2 text-xs text-muted-foreground">{item.status}</p></CardContent></Card>)}</div>}
  </div>;
}

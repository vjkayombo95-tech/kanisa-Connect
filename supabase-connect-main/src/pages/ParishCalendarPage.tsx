import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import type { SupabaseClient } from "@supabase/supabase-js";
import { CalendarDays, Church, Clock, Loader2, MapPin } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { formatMassDate, formatMassTime, type MassOccurrence } from "@/lib/mass-timetable";
import { cn } from "@/lib/utils";

const db = supabase as unknown as SupabaseClient;
const TANZANIA_TIME_ZONE = "Africa/Dar_es_Salaam";

type CalendarEvent = { id: string; church_id: string; title: string; description: string | null; start_date: string; end_date: string | null; location: string | null; event_type: string | null; registration_type: string | null; archived_at: string | null };
type CalendarMass = Pick<MassOccurrence, "id" | "occurrence_date" | "start_time" | "name" | "location_name" | "status">;
type Props = { workspace: "member" | "admin" };
type ScheduleItem = {
  id: string;
  source: "mass" | "event";
  dateKey: string;
  timeKey: string;
  title: string;
  kind: string;
  detail: string | null;
  status: string | null;
  displayDate: string;
  displayTime: string;
};
type ScheduleGroup = { key: "today" | "week" | "later"; title: string; dateLabel: string; items: ScheduleItem[] };

const dateKeyFormatter = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  month: "2-digit",
  timeZone: TANZANIA_TIME_ZONE,
  year: "numeric",
});

const eventTimeFormatter = new Intl.DateTimeFormat("sw-TZ", {
  hour: "2-digit",
  hourCycle: "h23",
  minute: "2-digit",
  timeZone: TANZANIA_TIME_ZONE,
});

const dateLabelFormatter = new Intl.DateTimeFormat("sw-TZ", {
  day: "numeric",
  month: "long",
  timeZone: TANZANIA_TIME_ZONE,
  weekday: "long",
});

function getTanzaniaDateKey(value: Date) {
  const parts = dateKeyFormatter.formatToParts(value);
  const part = (type: string) => parts.find((item) => item.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

function dateKeyToUtcDate(dateKey: string) {
  return new Date(`${dateKey}T00:00:00Z`);
}

function addDaysToDateKey(dateKey: string, days: number) {
  const date = dateKeyToUtcDate(dateKey);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function getUpcomingSundayKey(todayKey: string) {
  const day = dateKeyToUtcDate(todayKey).getUTCDay();
  return addDaysToDateKey(todayKey, (7 - day) % 7);
}

function formatDateKey(dateKey: string) {
  return dateLabelFormatter.format(dateKeyToUtcDate(dateKey));
}

function getEventDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function getEventTimeKey(date: Date | null) {
  if (!date) return "99:99";
  const parts = eventTimeFormatter.formatToParts(date);
  const part = (type: string) => parts.find((item) => item.type === type)?.value ?? "99";
  return `${part("hour")}:${part("minute")}`;
}

function getMassTimeKey(startTime: string | null) {
  return startTime?.slice(0, 5) || "99:99";
}

function compareScheduleItems(a: ScheduleItem, b: ScheduleItem) {
  return (
    a.dateKey.localeCompare(b.dateKey) ||
    a.timeKey.localeCompare(b.timeKey) ||
    a.source.localeCompare(b.source) ||
    a.id.localeCompare(b.id)
  );
}

function getGroupedSchedule(items: ScheduleItem[], todayKey: string): ScheduleGroup[] {
  const sundayKey = getUpcomingSundayKey(todayKey);
  const groups: ScheduleGroup[] = [
    { key: "today", title: "Leo", dateLabel: formatDateKey(todayKey), items: [] },
    { key: "week", title: "Wiki Hii", dateLabel: `Hadi ${formatDateKey(sundayKey)}`, items: [] },
    { key: "later", title: "Baadaye", dateLabel: "Ratiba nyingine zijazo", items: [] },
  ];

  for (const item of items) {
    if (item.dateKey === todayKey) groups[0].items.push(item);
    else if (item.dateKey > todayKey && item.dateKey <= sundayKey) groups[1].items.push(item);
    else groups[2].items.push(item);
  }

  return groups.filter((group) => group.items.length > 0);
}

function LoadingState({ member }: { member: boolean }) {
  if (!member) return <Loader2 className="mx-auto h-6 w-6 animate-spin" />;

  return (
    <div className="space-y-3" aria-label="Ratiba inapakia">
      <Skeleton className="h-24 rounded-[26px]" />
      <Skeleton className="h-28 rounded-[26px]" />
      <Skeleton className="h-28 rounded-[26px]" />
    </div>
  );
}

function AdminCalendar({ items, isError, isLoading }: { items: ScheduleItem[]; isError: boolean; isLoading: boolean }) {
  return (
    <div className="mx-auto max-w-5xl space-y-6" data-testid="admin-parish-calendar">
      <div>
        <p className="text-sm font-bold text-primary">Kanisa Connect</p>
        <h1 className="font-serif text-2xl font-bold">Kalenda ya Parokia</h1>
        <p className="text-sm text-muted-foreground">Matukio na Misa zijazo katika parokia yako.</p>
      </div>
      {isLoading ? (
        <LoadingState member={false} />
      ) : isError ? (
        <Card><CardContent className="p-6 text-destructive">Kalenda haikupatikana. Jaribu tena.</CardContent></Card>
      ) : items.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground"><CalendarDays className="mx-auto mb-3 h-10 w-10" />Hakuna tukio lijalo.</CardContent></Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {items.map((item) => (
            <Card key={item.id}>
              <CardContent className="p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <Badge variant="outline" className="mb-2">{item.kind}</Badge>
                    <h2 className="font-semibold">{item.title}</h2>
                  </div>
                  <Church className="h-5 w-5 text-primary" />
                </div>
                <p className="mt-3 text-sm text-muted-foreground">{item.displayDate} {item.displayTime}</p>
                {item.detail && <p className="mt-2 flex items-center gap-1 text-sm text-muted-foreground"><MapPin className="h-4 w-4" />{item.detail}</p>}
                {item.status ? <p className="mt-2 text-xs text-muted-foreground">{item.status}</p> : null}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function MemberScheduleItem({ item }: { item: ScheduleItem }) {
  return (
    <article className="grid min-w-0 grid-cols-[auto_minmax(0,1fr)] gap-3 rounded-[26px] border border-primary/10 bg-card/80 p-4 shadow-sm shadow-black/5 sm:p-5">
      <div className={cn(
        "mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border",
        item.source === "mass" ? "border-primary/20 bg-primary/12 text-primary" : "border-emerald-400/20 bg-emerald-400/10 text-emerald-200",
      )}>
        {item.source === "mass" ? <Church className="h-5 w-5" /> : <CalendarDays className="h-5 w-5" />}
      </div>
      <div className="min-w-0">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <Badge variant="outline" className="max-w-full border-primary/20 bg-primary/8 text-primary">{item.kind}</Badge>
          {item.status ? <span className="min-w-0 break-words text-xs font-medium text-muted-foreground">{item.status}</span> : null}
        </div>
        <h2 className="mt-2 break-words text-lg font-bold leading-snug text-foreground">{item.title}</h2>
        <div className="mt-3 flex min-w-0 flex-wrap gap-x-4 gap-y-2 text-sm text-muted-foreground">
          <span className="flex min-w-0 items-center gap-1.5">
            <Clock className="h-4 w-4 shrink-0 text-primary" />
            <span className="break-words">{item.displayTime}</span>
          </span>
          {item.detail ? (
            <span className="flex min-w-0 items-center gap-1.5">
              <MapPin className="h-4 w-4 shrink-0 text-primary" />
              <span className="min-w-0 break-words">{item.detail}</span>
            </span>
          ) : null}
        </div>
      </div>
    </article>
  );
}

function MemberSchedule({ groups, isError, isLoading }: { groups: ScheduleGroup[]; isError: boolean; isLoading: boolean }) {
  return (
    <main
      data-testid="member-parish-calendar"
      className="min-h-full min-w-0 bg-[linear-gradient(180deg,hsl(var(--background)),hsl(var(--muted)/0.35))] px-4 py-5 pb-28 lg:px-8 lg:pb-10"
    >
      <div className="mx-auto w-full max-w-3xl space-y-6">
        <header className="min-w-0 rounded-[30px] border border-primary/15 bg-[linear-gradient(135deg,hsl(var(--primary)/0.14),hsl(var(--card))_65%)] p-5 shadow-sm sm:p-7">
          <p className="text-sm font-bold text-primary">Kanisa Connect</p>
          <h1 className="mt-1 break-words font-serif text-3xl font-bold tracking-tight text-foreground sm:text-4xl">Ratiba ya Parokia</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base">Misa na matukio yajayo katika parokia yako.</p>
        </header>

        {isLoading ? (
          <LoadingState member />
        ) : isError ? (
          <Card className="rounded-[26px] border-destructive/20 bg-card/85">
            <CardContent className="p-5">
              <p className="font-semibold text-foreground">Ratiba haikupatikana.</p>
              <p className="mt-1 text-sm text-muted-foreground">Jaribu tena baada ya muda mfupi.</p>
            </CardContent>
          </Card>
        ) : groups.length === 0 ? (
          <Card className="rounded-[26px] border-border/70 bg-card/85">
            <CardContent className="py-12 text-center text-muted-foreground">
              <CalendarDays className="mx-auto mb-3 h-10 w-10 text-primary" />
              <p className="font-semibold text-foreground">Hakuna ratiba ijayo kwa sasa.</p>
              <p className="mt-1 text-sm">Misa na matukio yajayo yataonekana hapa yakichapishwa.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-7">
            {groups.map((group) => (
              <section key={group.key} aria-labelledby={`schedule-${group.key}`} className="min-w-0">
                <div className="mb-3 min-w-0">
                  <h2 id={`schedule-${group.key}`} className="break-words text-xl font-bold text-foreground">{group.title}</h2>
                  <p className="mt-1 break-words text-sm text-muted-foreground">{group.dateLabel}</p>
                </div>
                <div className="space-y-3">
                  {group.items.map((item) => <MemberScheduleItem key={item.id} item={item} />)}
                </div>
              </section>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}

export default function ParishCalendarPage({ workspace }: Props) {
  const { churchId, user } = useAuth();
  const calendar = useQuery({ queryKey: ["wave4a-parish-calendar", workspace, churchId], enabled: !!churchId, queryFn: async () => {
    const now = new Date().toISOString(); const today = now.slice(0, 10);
    const eventsQuery = db.from("events").select("id,church_id,title,description,start_date,end_date,location,event_type,registration_type,archived_at").eq("church_id", churchId).gte("start_date", now).is("archived_at", null).order("start_date").limit(100);
    const massesQuery = workspace === "member"
      ? db.rpc("get_member_parish_schedule_masses", { p_church_id: churchId, p_from_date: today })
      : db.from("mass_occurrences").select("*").eq("church_id", churchId).gte("occurrence_date", today).in("status", ["scheduled", "rescheduled"]).order("occurrence_date").order("start_time").limit(100);
    const [events, masses] = await Promise.all([eventsQuery, massesQuery]);
    if (events.error) throw events.error; if (masses.error) throw masses.error;
    const eventRows = events.data as CalendarEvent[];
    const registrationByEvent = new Map<string, string>();
    if (workspace === "member" && user && eventRows.length) {
      const member = await db.from("members").select("id").eq("user_id", user.id).eq("church_id", churchId).maybeSingle();
      if (member.error) throw member.error;
      if (member.data) {
        const registrations = await db.from("event_attendances").select("event_id,registration_status,payment_status").eq("church_id", churchId).eq("member_id", member.data.id).in("event_id", eventRows.map(row => row.id));
        if (registrations.error) throw registrations.error;
        for (const row of registrations.data ?? []) registrationByEvent.set(row.event_id, row.payment_status === "paid" ? "Umesajiliwa - imelipwa" : `Umesajiliwa - ${row.registration_status}`);
      }
    }
    return { events: eventRows, masses: masses.data as CalendarMass[], registrationByEvent };
  }});
  const todayKey = useMemo(() => getTanzaniaDateKey(new Date()), []);
  const items = [
    ...(calendar.data?.events ?? []).map((event) => {
      const eventDate = getEventDate(event.start_date);
      const dateKey = eventDate ? getTanzaniaDateKey(eventDate) : event.start_date.slice(0, 10);
      return { id: `event-${event.id}`, source: "event" as const, dateKey, timeKey: getEventTimeKey(eventDate), title: event.title, kind: event.event_type || "Tukio", detail: event.location, status: calendar.data?.registrationByEvent.get(event.id) ?? (event.registration_type === "paid" ? "Usajili wa malipo" : "Tukio la parokia"), displayDate: eventDate ? dateLabelFormatter.format(eventDate) : formatDateKey(dateKey), displayTime: eventDate ? eventTimeFormatter.format(eventDate) : "Muda haujawekwa" };
    }),
    ...(calendar.data?.masses ?? []).map((mass) => ({ id: `mass-${mass.id}`, source: "mass" as const, dateKey: mass.occurrence_date, timeKey: getMassTimeKey(mass.start_time), title: mass.name, kind: "Misa", detail: mass.location_name, status: mass.status, displayDate: formatMassDate(mass.occurrence_date), displayTime: formatMassTime(mass.start_time) })),
  ].sort(compareScheduleItems);
  const groups = getGroupedSchedule(items, todayKey);

  if (workspace === "admin") {
    return <AdminCalendar items={items} isError={calendar.isError} isLoading={calendar.isLoading} />;
  }

  return <MemberSchedule groups={groups} isError={calendar.isError} isLoading={calendar.isLoading} />;
}

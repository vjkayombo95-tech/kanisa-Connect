import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  CalendarClock,
  CalendarPlus,
  CheckCircle2,
  Church,
  Clock3,
  Eye,
  Loader2,
  MapPin,
  Pencil,
  Plus,
  RefreshCw,
  Trash2,
  XCircle,
} from "lucide-react";
import { Link } from "react-router-dom";

import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { PageToolbar } from "@/components/workspace";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { formatTZS } from "@/lib/currency";
import { MASS_RESERVING_STATUSES, MASS_WEEKDAYS, formatMassDate, formatMassTime, validateMassTimes, type MassOccurrence, type MassOccurrenceStatus, type MassSchedule } from "@/lib/mass-timetable";

const db = supabase as unknown as SupabaseClient;
const tanzaniaDate = (days = 0) => {
  const value = new Date(Date.now() + days * 86_400_000);
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Dar_es_Salaam",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(value);
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((item) => item.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
};
const today = () => tanzaniaDate();
const inDays = (days: number) => tanzaniaDate(days);

type ScheduleForm = {
  id?: string; name: string; day_of_week: string; start_time: string; end_time: string;
  location_name: string; language: string; default_celebrant_name: string;
  intention_capacity: string; default_intention_fee: string; accepts_intentions: boolean;
  effective_from: string; effective_until: string; is_active: boolean;
};

type OccurrenceForm = {
  id?: string; name: string; occurrence_date: string; start_time: string; end_time: string;
  location_name: string; language: string; celebrant_name: string; intention_capacity: string;
  intention_fee: string; accepts_intentions: boolean; notes: string; is_special_mass: boolean;
};

const emptySchedule = (): ScheduleForm => ({
  name: "", day_of_week: "0", start_time: "06:30", end_time: "", location_name: "",
  language: "Kiswahili", default_celebrant_name: "", intention_capacity: "",
  default_intention_fee: "", accepts_intentions: true, effective_from: today(), effective_until: "", is_active: true,
});
const emptyOccurrence = (special = true): OccurrenceForm => ({
  name: "", occurrence_date: today(), start_time: "10:00", end_time: "", location_name: "",
  language: "Kiswahili", celebrant_name: "", intention_capacity: "", intention_fee: "",
  accepts_intentions: true, notes: "", is_special_mass: special,
});

const statusLabels: Record<MassOccurrenceStatus, string> = {
  scheduled: "Imepangwa", cancelled: "Imeghairiwa", completed: "Imekamilika", rescheduled: "Imebadilishwa Muda",
};

function nullableNumber(value: string) {
  return value === "" ? null : Number(value);
}

function validateSchedule(form: ScheduleForm) {
  if (!form.name.trim() || !form.start_time || !form.effective_from) return "Jina, muda wa kuanza na tarehe ya kuanza vinahitajika.";
  if (!validateMassTimes(form.start_time, form.end_time)) return "Muda wa kumaliza lazima uwe baada ya muda wa kuanza.";
  if (nullableNumber(form.intention_capacity) != null && Number(form.intention_capacity) < 0) return "Uwezo hauwezi kuwa hasi.";
  if (nullableNumber(form.default_intention_fee) != null && Number(form.default_intention_fee) < 0) return "Ada haiwezi kuwa hasi.";
  if (form.effective_until && form.effective_until < form.effective_from) return "Tarehe ya mwisho haiwezi kutangulia tarehe ya kuanza.";
  return null;
}

function validateOccurrence(form: OccurrenceForm) {
  if (!form.name.trim() || !form.occurrence_date || !form.start_time) return "Jina, tarehe na muda wa kuanza vinahitajika.";
  if (!validateMassTimes(form.start_time, form.end_time)) return "Muda wa kumaliza lazima uwe baada ya muda wa kuanza.";
  if (nullableNumber(form.intention_capacity) != null && Number(form.intention_capacity) < 0) return "Uwezo hauwezi kuwa hasi.";
  if (nullableNumber(form.intention_fee) != null && Number(form.intention_fee) < 0) return "Ada haiwezi kuwa hasi.";
  return null;
}

export default function MassTimetablePage() {
  const { churchId } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showInactive, setShowInactive] = useState(false);
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [dateFrom, setDateFrom] = useState(today());
  const [dateTo, setDateTo] = useState(inDays(90));
  const [search, setSearch] = useState("");
  const [scheduleForm, setScheduleForm] = useState<ScheduleForm | null>(null);
  const [occurrenceForm, setOccurrenceForm] = useState<OccurrenceForm | null>(null);
  const [confirmAction, setConfirmAction] = useState<{ title: string; description: string; run: () => void } | null>(null);

  const timetable = useQuery({
    queryKey: ["mass-timetable", churchId, dateFrom, dateTo],
    enabled: !!churchId,
    queryFn: async () => {
      await db.rpc("generate_mass_occurrences", { p_church_id: churchId, p_start_date: today(), p_end_date: inDays(90) });
      const [scheduleResult, occurrenceResult, intentionResult] = await Promise.all([
        db.from("mass_schedules").select("*").eq("church_id", churchId).order("day_of_week").order("start_time"),
        db.from("mass_occurrences").select("*").eq("church_id", churchId).gte("occurrence_date", dateFrom).lte("occurrence_date", dateTo).order("occurrence_date").order("start_time"),
        db.from("mass_intentions").select("mass_occurrence_id,status").eq("church_id", churchId).not("mass_occurrence_id", "is", null),
      ]);
      if (scheduleResult.error) throw scheduleResult.error;
      if (occurrenceResult.error) throw occurrenceResult.error;
      if (intentionResult.error) throw intentionResult.error;
      const counts = new Map<string, number>();
      for (const row of intentionResult.data ?? []) {
        if (MASS_RESERVING_STATUSES.includes(row.status as (typeof MASS_RESERVING_STATUSES)[number])) counts.set(row.mass_occurrence_id, (counts.get(row.mass_occurrence_id) ?? 0) + 1);
      }
      return {
        schedules: (scheduleResult.data ?? []) as MassSchedule[],
        occurrences: ((occurrenceResult.data ?? []) as MassOccurrence[]).map((row) => ({ ...row, booked_count: counts.get(row.id) ?? 0 })),
      };
    },
  });

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["mass-timetable"] });
  const generate = useMutation({
    mutationFn: async () => {
      const { data, error } = await db.rpc("generate_mass_occurrences", { p_church_id: churchId, p_start_date: today(), p_end_date: inDays(90) });
      if (error) throw error;
      return Number(data ?? 0);
    },
    onSuccess: (count) => { refresh(); toast({ title: "Masses generated", description: `${count} Misa mpya zimeongezwa.` }); },
    onError: (error: Error) => toast({ title: "Imeshindikana kutengeneza Misa", description: error.message, variant: "destructive" }),
  });

  const saveSchedule = useMutation({
    mutationFn: async (form: ScheduleForm) => {
      const validation = validateSchedule(form); if (validation) throw new Error(validation);
      const payload = {
        church_id: churchId, name: form.name.trim(), day_of_week: Number(form.day_of_week), start_time: form.start_time,
        end_time: form.end_time || null, location_name: form.location_name.trim() || null, language: form.language.trim() || null,
        default_celebrant_name: form.default_celebrant_name.trim() || null, intention_capacity: nullableNumber(form.intention_capacity),
        default_intention_fee: nullableNumber(form.default_intention_fee), accepts_intentions: form.accepts_intentions,
        effective_from: form.effective_from, effective_until: form.effective_until || null, is_active: form.is_active,
      };
      const result = form.id ? await db.from("mass_schedules").update(payload).eq("id", form.id).eq("church_id", churchId) : await db.from("mass_schedules").insert(payload);
      if (result.error) throw result.error;
      const generated = await db.rpc("generate_mass_occurrences", { p_church_id: churchId, p_start_date: today(), p_end_date: inDays(90) });
      if (generated.error) throw generated.error;
    },
    onSuccess: () => { setScheduleForm(null); refresh(); toast({ title: "Ratiba imehifadhiwa" }); },
    onError: (error: Error) => toast({ title: "Ratiba haijahifadhiwa", description: error.message, variant: "destructive" }),
  });

  const saveOccurrence = useMutation({
    mutationFn: async (form: OccurrenceForm) => {
      const validation = validateOccurrence(form); if (validation) throw new Error(validation);
      const payload = {
        church_id: churchId, mass_schedule_id: form.id ? undefined : null, name: form.name.trim(), occurrence_date: form.occurrence_date,
        start_time: form.start_time, end_time: form.end_time || null, location_name: form.location_name.trim() || null,
        language: form.language.trim() || null, celebrant_name: form.celebrant_name.trim() || null,
        intention_capacity: nullableNumber(form.intention_capacity), intention_fee: nullableNumber(form.intention_fee),
        accepts_intentions: form.accepts_intentions, notes: form.notes.trim() || null, is_special_mass: form.is_special_mass,
      };
      const result = form.id
        ? await db.from("mass_occurrences").update({ ...payload, mass_schedule_id: undefined, status: "rescheduled" }).eq("id", form.id).eq("church_id", churchId)
        : await db.from("mass_occurrences").insert(payload);
      if (result.error) throw result.error;
    },
    onSuccess: () => { setOccurrenceForm(null); refresh(); toast({ title: "Misa imehifadhiwa" }); },
    onError: (error: Error) => toast({ title: "Misa haijahifadhiwa", description: error.message, variant: "destructive" }),
  });

  const patchSchedule = useMutation({
    mutationFn: async ({ id, values }: { id: string; values: Record<string, unknown> }) => {
      const { error } = await db.from("mass_schedules").update(values).eq("id", id).eq("church_id", churchId); if (error) throw error;
    }, onSuccess: refresh,
  });
  const deleteSchedule = useMutation({
    mutationFn: async (id: string) => { const { error } = await db.from("mass_schedules").delete().eq("id", id).eq("church_id", churchId); if (error) throw error; },
    onSuccess: () => { refresh(); toast({ title: "Ratiba imefutwa" }); },
    onError: (error: Error) => toast({ title: "Tumia Disable badala ya kufuta", description: error.message, variant: "destructive" }),
  });
  const patchOccurrence = useMutation({
    mutationFn: async ({ id, values }: { id: string; values: Record<string, unknown> }) => {
      const { error } = await db.from("mass_occurrences").update(values).eq("id", id).eq("church_id", churchId); if (error) throw error;
    },
    onSuccess: () => { refresh(); toast({ title: "Misa imesasishwa" }); },
    onError: (error: Error) => toast({ title: "Misa haijasasishwa", description: error.message, variant: "destructive" }),
  });

  const schedules = timetable.data?.schedules ?? [];
  const occurrences = timetable.data?.occurrences ?? [];
  const filteredOccurrences = occurrences.filter((row) =>
    (statusFilter === "all" || row.status === statusFilter) &&
    (typeFilter === "all" || (typeFilter === "special" ? row.is_special_mass : !row.is_special_mass)) &&
    (!search.trim() || `${row.name} ${row.location_name ?? ""}`.toLowerCase().includes(search.toLowerCase())),
  );
  const weekEnd = inDays(7);
  const summary = {
    active: schedules.filter((row) => row.is_active).length,
    week: occurrences.filter((row) => row.occurrence_date >= today() && row.occurrence_date <= weekEnd && row.status !== "cancelled").length,
    accepting: occurrences.filter((row) => row.accepts_intentions && ["scheduled", "rescheduled"].includes(row.status)).length,
    cancelled: occurrences.filter((row) => row.status === "cancelled").length,
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <PageToolbar title="Ratiba za Misa" description="Panga muda wa Misa za kawaida na Misa maalum za kanisa." />
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        <Button onClick={() => setScheduleForm(emptySchedule())}><Plus className="mr-2 h-4 w-4" />Ongeza Muda wa Misa</Button>
        <Button variant="outline" onClick={() => setOccurrenceForm(emptyOccurrence(true))}><CalendarPlus className="mr-2 h-4 w-4" />Ongeza Misa Maalum</Button>
        <Button variant="outline" disabled={generate.isPending} onClick={() => generate.mutate()}>{generate.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}Generate Upcoming Masses</Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[["Active weekly Mass times", summary.active, CalendarClock], ["Masses scheduled this week", summary.week, Clock3], ["Masses accepting intentions", summary.accepting, CheckCircle2], ["Cancelled Masses", summary.cancelled, XCircle]].map(([label, value, Icon]) => (
          <Card key={String(label)} className="glass-card"><CardContent className="flex items-center justify-between p-5"><div><p className="text-sm text-muted-foreground">{String(label)}</p><p className="mt-2 font-serif text-3xl font-bold">{Number(value)}</p></div><Icon className="h-8 w-8 text-primary/70" /></CardContent></Card>
        ))}
      </div>

      <Tabs defaultValue="weekly" className="space-y-4">
        <TabsList className="h-auto w-full justify-start overflow-x-auto">
          <TabsTrigger value="weekly">Weekly Schedule</TabsTrigger><TabsTrigger value="upcoming">Upcoming Masses</TabsTrigger><TabsTrigger value="special">Special Masses</TabsTrigger>
        </TabsList>
        <TabsContent value="weekly" className="space-y-4">
          <div className="flex items-center gap-3"><Switch id="inactive" checked={showInactive} onCheckedChange={setShowInactive} /><Label htmlFor="inactive">Onyesha ratiba zilizozimwa</Label></div>
          {timetable.isLoading ? <LoadingCards /> : schedules.length === 0 ? <EmptyState text="Bado hakuna ratiba ya kila wiki. Ongeza muda wa kwanza wa Misa." /> : MASS_WEEKDAYS.map((day, index) => {
            const rows = schedules.filter((row) => row.day_of_week === index && (showInactive || row.is_active));
            if (!rows.length) return null;
            return <section key={day}><h2 className="mb-3 font-serif text-xl font-semibold">{day}</h2><div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{rows.map((row) => <ScheduleCard key={row.id} row={row} onEdit={() => setScheduleForm({ id: row.id, name: row.name, day_of_week: String(row.day_of_week), start_time: formatMassTime(row.start_time), end_time: formatMassTime(row.end_time) === "-" ? "" : formatMassTime(row.end_time), location_name: row.location_name ?? "", language: row.language ?? "", default_celebrant_name: row.default_celebrant_name ?? "", intention_capacity: row.intention_capacity == null ? "" : String(row.intention_capacity), default_intention_fee: row.default_intention_fee == null ? "" : String(row.default_intention_fee), accepts_intentions: row.accepts_intentions, effective_from: row.effective_from, effective_until: row.effective_until ?? "", is_active: row.is_active })} onToggle={() => patchSchedule.mutate({ id: row.id, values: { is_active: !row.is_active } })} onDelete={() => setConfirmAction({ title: "Futa ratiba?", description: "Ratiba yenye historia haiwezi kufutwa; izime ili kuhifadhi kumbukumbu.", run: () => deleteSchedule.mutate(row.id) })} />)}</div></section>;
          })}
        </TabsContent>
        <TabsContent value="upcoming" className="space-y-4">
          <OccurrenceFilters dateFrom={dateFrom} dateTo={dateTo} setDateFrom={setDateFrom} setDateTo={setDateTo} status={statusFilter} setStatus={setStatusFilter} type={typeFilter} setType={setTypeFilter} search={search} setSearch={setSearch} />
          <OccurrencesTable loading={timetable.isLoading} rows={filteredOccurrences} onEdit={(row) => setOccurrenceForm(toOccurrenceForm(row))} onStatus={(row, status) => setConfirmAction({ title: status === "cancelled" ? "Ghairi Misa hii?" : "Sasisha Misa?", description: status === "cancelled" ? `Nia ${row.booked_count ?? 0} zimeunganishwa. Wanachama watajulishwa na kumbukumbu zitahifadhiwa.` : "Hatua hii itaathiri Misa hii pekee, si ratiba ya kila wiki.", run: () => patchOccurrence.mutate({ id: row.id, values: { status } }) })} />
        </TabsContent>
        <TabsContent value="special">
          <OccurrencesTable loading={timetable.isLoading} rows={occurrences.filter((row) => row.is_special_mass)} onEdit={(row) => setOccurrenceForm(toOccurrenceForm(row))} onStatus={(row, status) => setConfirmAction({ title: "Sasisha Misa maalum?", description: `Nia ${row.booked_count ?? 0} zimeunganishwa na Misa hii.`, run: () => patchOccurrence.mutate({ id: row.id, values: { status } }) })} />
        </TabsContent>
      </Tabs>

      <ScheduleDialog form={scheduleForm} setForm={setScheduleForm} saving={saveSchedule.isPending} onSave={() => scheduleForm && saveSchedule.mutate(scheduleForm)} />
      <OccurrenceDialog form={occurrenceForm} setForm={setOccurrenceForm} saving={saveOccurrence.isPending} onSave={() => occurrenceForm && saveOccurrence.mutate(occurrenceForm)} />
      <AlertDialog open={!!confirmAction} onOpenChange={(open) => !open && setConfirmAction(null)}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>{confirmAction?.title}</AlertDialogTitle><AlertDialogDescription>{confirmAction?.description}</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Rudi</AlertDialogCancel><AlertDialogAction onClick={() => { confirmAction?.run(); setConfirmAction(null); }}>Thibitisha</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
    </div>
  );
}

function ScheduleCard({ row, onEdit, onToggle, onDelete }: { row: MassSchedule; onEdit: () => void; onToggle: () => void; onDelete: () => void }) {
  return <Card className={!row.is_active ? "opacity-65" : ""}><CardHeader className="pb-3"><div className="flex items-start justify-between gap-3"><div><p className="font-serif text-2xl font-bold text-primary">{formatMassTime(row.start_time)}</p><CardTitle className="mt-1 text-lg">{row.name}</CardTitle></div><Badge variant={row.is_active ? "default" : "secondary"}>{row.is_active ? "Active" : "Disabled"}</Badge></div></CardHeader><CardContent className="space-y-3 text-sm"><p className="flex gap-2 text-muted-foreground"><MapPin className="h-4 w-4" />{row.location_name || "Kanisa kuu"}</p><p>{row.language || "-"}</p><div className="flex flex-wrap gap-2"><Badge variant="outline">{row.accepts_intentions ? "Accepts intentions" : "No intentions"}</Badge><Badge variant="outline">Capacity: {row.intention_capacity ?? "Unlimited"}</Badge>{row.default_intention_fee != null && <Badge variant="outline">{formatTZS(row.default_intention_fee)}</Badge>}</div><div className="flex flex-wrap gap-1 pt-2"><Button size="sm" variant="ghost" onClick={onEdit}><Pencil className="mr-1 h-4 w-4" />Edit</Button><Button size="sm" variant="ghost" onClick={onToggle}>{row.is_active ? "Disable" : "Enable"}</Button><Button size="sm" variant="ghost" className="text-destructive" onClick={onDelete}><Trash2 className="mr-1 h-4 w-4" />Delete</Button></div></CardContent></Card>;
}

function OccurrenceFilters(props: { dateFrom: string; dateTo: string; setDateFrom: (v: string) => void; setDateTo: (v: string) => void; status: string; setStatus: (v: string) => void; type: string; setType: (v: string) => void; search: string; setSearch: (v: string) => void }) {
  return <Card><CardContent className="grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-5"><Field label="Kuanzia"><Input type="date" value={props.dateFrom} onChange={(e) => props.setDateFrom(e.target.value)} /></Field><Field label="Mpaka"><Input type="date" value={props.dateTo} onChange={(e) => props.setDateTo(e.target.value)} /></Field><Field label="Status"><Select value={props.status} onValueChange={props.setStatus}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Zote</SelectItem>{Object.entries(statusLabels).map(([value,label]) => <SelectItem value={value} key={value}>{label}</SelectItem>)}</SelectContent></Select></Field><Field label="Aina"><Select value={props.type} onValueChange={props.setType}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Zote</SelectItem><SelectItem value="recurring">Ratiba</SelectItem><SelectItem value="special">Maalum</SelectItem></SelectContent></Select></Field><Field label="Tafuta"><Input value={props.search} onChange={(e) => props.setSearch(e.target.value)} placeholder="Misa au mahali" /></Field></CardContent></Card>;
}

function OccurrencesTable({ loading, rows, onEdit, onStatus }: { loading: boolean; rows: MassOccurrence[]; onEdit: (row: MassOccurrence) => void; onStatus: (row: MassOccurrence, status: MassOccurrenceStatus) => void }) {
  if (loading) return <LoadingCards />;
  if (!rows.length) return <EmptyState text="Hakuna Misa katika kichujio hiki." />;
  return <Card className="overflow-hidden"><CardContent className="p-0"><div className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Time</TableHead><TableHead>Mass</TableHead><TableHead>Location</TableHead><TableHead>Capacity</TableHead><TableHead>Availability</TableHead><TableHead>Status</TableHead><TableHead>Actions</TableHead></TableRow></TableHeader><TableBody>{rows.map((row) => { const booked=row.booked_count??0; const remaining=row.intention_capacity==null?null:Math.max(row.intention_capacity-booked,0); return <TableRow key={row.id}><TableCell className="min-w-48">{formatMassDate(row.occurrence_date)}</TableCell><TableCell>{formatMassTime(row.start_time)}</TableCell><TableCell><p className="font-medium">{row.name}</p>{row.is_special_mass && <Badge variant="outline" className="mt-1">Maalum</Badge>}</TableCell><TableCell>{row.location_name || "-"}</TableCell><TableCell>{booked} / {row.intention_capacity ?? "∞"}</TableCell><TableCell>{remaining == null ? "Unlimited" : remaining === 0 ? <Badge variant="destructive">Full</Badge> : `${remaining} spaces`}</TableCell><TableCell><Badge variant={row.status === "cancelled" ? "destructive" : "outline"}>{statusLabels[row.status]}</Badge></TableCell><TableCell><div className="flex min-w-80 flex-wrap gap-1"><Button asChild size="sm" variant="ghost"><Link to={`/church-admin/mass-intentions?occurrence=${row.id}`}><Eye className="mr-1 h-4 w-4" />View Intentions</Link></Button><Button size="sm" variant="ghost" onClick={() => onEdit(row)}><Pencil className="mr-1 h-4 w-4" />Edit This Mass</Button>{row.status !== "cancelled" && <Button size="sm" variant="ghost" className="text-destructive" onClick={() => onStatus(row,"cancelled")}>Cancel</Button>}{row.status !== "completed" && <Button size="sm" variant="ghost" onClick={() => onStatus(row,"completed")}>Complete</Button>}</div></TableCell></TableRow>; })}</TableBody></Table></div></CardContent></Card>;
}

function toOccurrenceForm(row: MassOccurrence): OccurrenceForm { return { id: row.id, name: row.name, occurrence_date: row.occurrence_date, start_time: formatMassTime(row.start_time), end_time: row.end_time ? formatMassTime(row.end_time) : "", location_name: row.location_name ?? "", language: row.language ?? "", celebrant_name: row.celebrant_name ?? "", intention_capacity: row.intention_capacity == null ? "" : String(row.intention_capacity), intention_fee: row.intention_fee == null ? "" : String(row.intention_fee), accepts_intentions: row.accepts_intentions, notes: row.notes ?? "", is_special_mass: row.is_special_mass }; }

function ScheduleDialog({ form, setForm, saving, onSave }: { form: ScheduleForm | null; setForm: (v: ScheduleForm | null) => void; saving: boolean; onSave: () => void }) {
  if (!form) return null;
  return <Dialog open onOpenChange={(open) => !open && setForm(null)}><DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto"><DialogHeader><DialogTitle>{form.id ? "Hariri Ratiba" : "Ongeza Muda wa Misa"}</DialogTitle><DialogDescription>Ratiba hii itatengeneza Misa halisi kwa siku 90 zijazo.</DialogDescription></DialogHeader><div className="grid gap-4 sm:grid-cols-2"><Field label="Jina la Misa *"><Input value={form.name} onChange={(e) => setForm({...form,name:e.target.value})} /></Field><Field label="Siku *"><Select value={form.day_of_week} onValueChange={(v)=>setForm({...form,day_of_week:v})}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{MASS_WEEKDAYS.map((day,index)=><SelectItem key={day} value={String(index)}>{day}</SelectItem>)}</SelectContent></Select></Field><Field label="Muda wa kuanza *"><Input type="time" value={form.start_time} onChange={(e)=>setForm({...form,start_time:e.target.value})} /></Field><Field label="Muda wa kumaliza"><Input type="time" value={form.end_time} onChange={(e)=>setForm({...form,end_time:e.target.value})} /></Field><Field label="Mahali"><Input value={form.location_name} onChange={(e)=>setForm({...form,location_name:e.target.value})} /></Field><Field label="Lugha"><Input value={form.language} onChange={(e)=>setForm({...form,language:e.target.value})} /></Field><Field label="Madhabahu / Celebrant"><Input value={form.default_celebrant_name} onChange={(e)=>setForm({...form,default_celebrant_name:e.target.value})} /></Field><Field label="Uwezo wa nia (wazi = unlimited)"><Input type="number" min="0" value={form.intention_capacity} onChange={(e)=>setForm({...form,intention_capacity:e.target.value})} /></Field><Field label="Ada ya nia (TZS)"><Input type="number" min="0" value={form.default_intention_fee} onChange={(e)=>setForm({...form,default_intention_fee:e.target.value})} /></Field><Field label="Inaanza *"><Input type="date" value={form.effective_from} onChange={(e)=>setForm({...form,effective_from:e.target.value})} /></Field><Field label="Inaisha"><Input type="date" value={form.effective_until} onChange={(e)=>setForm({...form,effective_until:e.target.value})} /></Field><Toggle label="Pokea nia za Misa" checked={form.accepts_intentions} onChange={(v)=>setForm({...form,accepts_intentions:v})} /><Toggle label="Ratiba iko active" checked={form.is_active} onChange={(v)=>setForm({...form,is_active:v})} /></div><DialogFooter><Button variant="outline" onClick={()=>setForm(null)}>Rudi</Button><Button disabled={saving} onClick={onSave}>{saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Hifadhi</Button></DialogFooter></DialogContent></Dialog>;
}

function OccurrenceDialog({ form, setForm, saving, onSave }: { form: OccurrenceForm | null; setForm: (v: OccurrenceForm | null) => void; saving: boolean; onSave: () => void }) {
  if (!form) return null;
  return <Dialog open onOpenChange={(open)=>!open&&setForm(null)}><DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto"><DialogHeader><DialogTitle>{form.id ? "Hariri Misa Hii" : "Ongeza Misa Maalum"}</DialogTitle><DialogDescription>Mabadiliko hapa yataathiri Misa hii pekee na kuhifadhi ratiba ya kila wiki.</DialogDescription></DialogHeader><div className="grid gap-4 sm:grid-cols-2"><Field label="Jina la Misa *"><Input value={form.name} onChange={(e)=>setForm({...form,name:e.target.value})} /></Field><Field label="Tarehe *"><Input type="date" value={form.occurrence_date} onChange={(e)=>setForm({...form,occurrence_date:e.target.value})} /></Field><Field label="Muda wa kuanza *"><Input type="time" value={form.start_time} onChange={(e)=>setForm({...form,start_time:e.target.value})} /></Field><Field label="Muda wa kumaliza"><Input type="time" value={form.end_time} onChange={(e)=>setForm({...form,end_time:e.target.value})} /></Field><Field label="Mahali"><Input value={form.location_name} onChange={(e)=>setForm({...form,location_name:e.target.value})} /></Field><Field label="Lugha"><Input value={form.language} onChange={(e)=>setForm({...form,language:e.target.value})} /></Field><Field label="Celebrant"><Input value={form.celebrant_name} onChange={(e)=>setForm({...form,celebrant_name:e.target.value})} /></Field><Field label="Uwezo wa nia"><Input type="number" min="0" value={form.intention_capacity} onChange={(e)=>setForm({...form,intention_capacity:e.target.value})} /></Field><Field label="Ada (TZS)"><Input type="number" min="0" value={form.intention_fee} onChange={(e)=>setForm({...form,intention_fee:e.target.value})} /></Field><Toggle label="Pokea nia" checked={form.accepts_intentions} onChange={(v)=>setForm({...form,accepts_intentions:v})} /><div className="sm:col-span-2"><Field label="Maelezo"><Textarea value={form.notes} onChange={(e)=>setForm({...form,notes:e.target.value})} /></Field></div></div><DialogFooter><Button variant="outline" onClick={()=>setForm(null)}>Rudi</Button><Button disabled={saving} onClick={onSave}>{saving&&<Loader2 className="mr-2 h-4 w-4 animate-spin" />}Hifadhi</Button></DialogFooter></DialogContent></Dialog>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) { return <div className="space-y-2"><Label>{label}</Label>{children}</div>; }
function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (value:boolean)=>void }) { return <div className="flex items-center justify-between rounded-lg border p-3"><Label>{label}</Label><Switch checked={checked} onCheckedChange={onChange} /></div>; }
function EmptyState({ text }: { text: string }) { return <Card><CardContent className="py-14 text-center"><Church className="mx-auto mb-3 h-10 w-10 text-muted-foreground/40" /><p className="text-muted-foreground">{text}</p></CardContent></Card>; }
function LoadingCards() { return <div className="grid gap-4 md:grid-cols-3">{[1,2,3].map((item)=><Skeleton key={item} className="h-48 rounded-xl" />)}</div>; }

import { useMemo, useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarDays, CheckCircle2, Clock, Edit, Loader2, Plus, RefreshCw, XCircle } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

type MassEvent = {
  id: string;
  church_id: string;
  title: string;
  description: string | null;
  mass_date: string;
  start_time: string;
  end_time: string | null;
  response_deadline: string | null;
  ask_for_rsvp: boolean;
  is_active: boolean;
  created_at: string;
};

type MassResponse = {
  mass_event_id: string;
  response: "yes" | "maybe" | "no";
};

type FormState = {
  id?: string;
  title: string;
  description: string;
  mass_date: string;
  start_time: string;
  end_time: string;
  response_deadline: string;
  ask_for_rsvp: boolean;
};

const emptyForm: FormState = {
  title: "",
  description: "",
  mass_date: "",
  start_time: "",
  end_time: "",
  response_deadline: "",
  ask_for_rsvp: true,
};

function formatDate(value: string) {
  return new Date(`${value}T00:00:00`).toLocaleDateString("en-TZ", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function formatTime(value: string | null) {
  if (!value) return "-";
  return value.slice(0, 5);
}

function toDatetimeLocal(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 16);
}

function fromDatetimeLocal(value: string) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

export default function MassSchedulePage() {
  const { churchId, user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["mass-schedule-admin", churchId],
    queryFn: async () => {
      if (!churchId) return { events: [] as MassEvent[], responses: [] as MassResponse[] };

      const { data: events, error: eventsError } = await supabase
        .from("mass_events" as never)
        .select("*")
        .eq("church_id", churchId)
        .order("mass_date", { ascending: true })
        .order("start_time", { ascending: true });

      if (eventsError) throw eventsError;

      const eventIds = ((events ?? []) as MassEvent[]).map((event) => event.id);
      if (eventIds.length === 0) return { events: [], responses: [] };

      const { data: responses, error: responsesError } = await supabase
        .from("mass_responses" as never)
        .select("mass_event_id, response")
        .in("mass_event_id", eventIds);

      if (responsesError) throw responsesError;

      return {
        events: (events ?? []) as MassEvent[],
        responses: (responses ?? []) as MassResponse[],
      };
    },
    enabled: !!churchId,
  });

  const countsByEvent = useMemo(() => {
    const map = new Map<string, { yes: number; maybe: number; no: number }>();
    (data?.responses ?? []).forEach((response) => {
      const counts = map.get(response.mass_event_id) ?? { yes: 0, maybe: 0, no: 0 };
      counts[response.response] += 1;
      map.set(response.mass_event_id, counts);
    });
    return map;
  }, [data?.responses]);

  const activeEvents = (data?.events ?? []).filter((event) => event.is_active);
  const upcomingEvents = activeEvents.filter((event) => event.mass_date >= new Date().toISOString().slice(0, 10));
  const totalExpected = upcomingEvents.reduce((sum, event) => sum + (countsByEvent.get(event.id)?.yes ?? 0), 0);

  const saveMass = useMutation({
    mutationFn: async () => {
      if (!churchId) throw new Error("No church context");
      if (!form.title.trim() || !form.mass_date || !form.start_time) {
        throw new Error("Title, date, and start time are required.");
      }

      const payload = {
        church_id: churchId,
        title: form.title.trim(),
        description: form.description.trim() || null,
        mass_date: form.mass_date,
        start_time: form.start_time,
        end_time: form.end_time || null,
        response_deadline: fromDatetimeLocal(form.response_deadline),
        ask_for_rsvp: form.ask_for_rsvp,
        is_active: true,
        created_by: user?.id ?? null,
      };

      const query = form.id
        ? supabase.from("mass_events" as never).update(payload as never).eq("id", form.id).eq("church_id", churchId)
        : supabase.from("mass_events" as never).insert(payload as never);

      const { error } = await query;
      if (error) throw error;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["mass-schedule-admin"] });
      await queryClient.invalidateQueries({ queryKey: ["next-mass-summary"] });
      await queryClient.invalidateQueries({ queryKey: ["church-dashboard-deferred"] });
      setFormOpen(false);
      setForm(emptyForm);
      toast({ title: "Mass saved", description: "The Mass schedule has been updated." });
    },
    onError: (error: any) => {
      toast({ title: "Unable to save Mass", description: error.message, variant: "destructive" });
    },
  });

  const updateMass = useMutation({
    mutationFn: async ({ id, values }: { id: string; values: Partial<MassEvent> }) => {
      if (!churchId) throw new Error("No church context");
      const { error } = await supabase
        .from("mass_events" as never)
        .update(values as never)
        .eq("id", id)
        .eq("church_id", churchId);
      if (error) throw error;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["mass-schedule-admin"] });
      await queryClient.invalidateQueries({ queryKey: ["next-mass-summary"] });
      await queryClient.invalidateQueries({ queryKey: ["church-dashboard-deferred"] });
    },
    onError: (error: any) => {
      toast({ title: "Unable to update Mass", description: error.message, variant: "destructive" });
    },
  });

  const openCreate = () => {
    setForm(emptyForm);
    setFormOpen(true);
  };

  const openEdit = (event: MassEvent) => {
    setForm({
      id: event.id,
      title: event.title,
      description: event.description ?? "",
      mass_date: event.mass_date,
      start_time: event.start_time.slice(0, 5),
      end_time: event.end_time?.slice(0, 5) ?? "",
      response_deadline: toDatetimeLocal(event.response_deadline),
      ask_for_rsvp: event.ask_for_rsvp,
    });
    setFormOpen(true);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold font-serif">Mass Schedule</h1>
          <p className="mt-1 text-sm text-muted-foreground">Manage upcoming Masses and lightweight RSVP forecasts.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => refetch()} disabled={isLoading}>
            <RefreshCw className="mr-2 h-4 w-4" />Refresh
          </Button>
          <Button onClick={openCreate}>
            <Plus className="mr-2 h-4 w-4" />Create Mass
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card><CardContent className="p-5"><p className="text-sm text-muted-foreground">Upcoming Masses</p><p className="mt-2 text-2xl font-bold">{upcomingEvents.length}</p></CardContent></Card>
        <Card><CardContent className="p-5"><p className="text-sm text-muted-foreground">RSVP Enabled</p><p className="mt-2 text-2xl font-bold">{upcomingEvents.filter((event) => event.ask_for_rsvp).length}</p></CardContent></Card>
        <Card><CardContent className="p-5"><p className="text-sm text-muted-foreground">Expected Yes</p><p className="mt-2 text-2xl font-bold">{totalExpected}</p></CardContent></Card>
        <Card><CardContent className="p-5"><p className="text-sm text-muted-foreground">Archived</p><p className="mt-2 text-2xl font-bold">{(data?.events ?? []).filter((event) => !event.is_active).length}</p></CardContent></Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base"><CalendarDays className="h-4 w-4 text-primary" />Scheduled Masses</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : isError ? (
            <p className="rounded-xl border border-destructive/20 bg-destructive/5 p-4 text-sm text-destructive">Unable to load Mass schedule.</p>
          ) : (data?.events ?? []).length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground">No Masses scheduled yet.</div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Mass</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Time</TableHead>
                    <TableHead>RSVP</TableHead>
                    <TableHead>Expected</TableHead>
                    <TableHead>Maybe</TableHead>
                    <TableHead>No</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(data?.events ?? []).map((event) => {
                    const counts = countsByEvent.get(event.id) ?? { yes: 0, maybe: 0, no: 0 };
                    return (
                      <TableRow key={event.id} className={!event.is_active ? "opacity-60" : ""}>
                        <TableCell>
                          <div className="font-medium">{event.title}</div>
                          {event.description ? <div className="text-xs text-muted-foreground line-clamp-1">{event.description}</div> : null}
                        </TableCell>
                        <TableCell className="whitespace-nowrap">{formatDate(event.mass_date)}</TableCell>
                        <TableCell className="whitespace-nowrap">{formatTime(event.start_time)}{event.end_time ? ` - ${formatTime(event.end_time)}` : ""}</TableCell>
                        <TableCell>
                          <Badge variant={event.ask_for_rsvp ? "default" : "secondary"}>{event.ask_for_rsvp ? "Enabled" : "Disabled"}</Badge>
                        </TableCell>
                        <TableCell>{counts.yes}</TableCell>
                        <TableCell>{counts.maybe}</TableCell>
                        <TableCell>{counts.no}</TableCell>
                        <TableCell>
                          <div className="flex justify-end gap-2">
                            <Button variant="ghost" size="sm" onClick={() => openEdit(event)}>
                              <Edit className="mr-1 h-4 w-4" />Edit
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => updateMass.mutate({ id: event.id, values: { ask_for_rsvp: !event.ask_for_rsvp } })}
                            >
                              {event.ask_for_rsvp ? <XCircle className="mr-1 h-4 w-4" /> : <CheckCircle2 className="mr-1 h-4 w-4" />}
                              {event.ask_for_rsvp ? "Disable" : "Enable"}
                            </Button>
                            {event.is_active ? (
                              <Button variant="ghost" size="sm" onClick={() => updateMass.mutate({ id: event.id, values: { is_active: false } })}>
                                Archive
                              </Button>
                            ) : null}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{form.id ? "Edit Mass" : "Create Mass"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Title"><Input value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} placeholder="Sunday Mass" /></Field>
            <Field label="Mass date"><Input type="date" value={form.mass_date} onChange={(event) => setForm({ ...form, mass_date: event.target.value })} /></Field>
            <Field label="Start time"><Input type="time" value={form.start_time} onChange={(event) => setForm({ ...form, start_time: event.target.value })} /></Field>
            <Field label="End time"><Input type="time" value={form.end_time} onChange={(event) => setForm({ ...form, end_time: event.target.value })} /></Field>
            <Field label="Response deadline"><Input type="datetime-local" value={form.response_deadline} onChange={(event) => setForm({ ...form, response_deadline: event.target.value })} /></Field>
            <div className="flex items-center justify-between rounded-xl border border-border p-3">
              <div>
                <Label>Enable RSVP</Label>
                <p className="text-xs text-muted-foreground">Members can indicate yes, maybe, or no.</p>
              </div>
              <Switch checked={form.ask_for_rsvp} onCheckedChange={(checked) => setForm({ ...form, ask_for_rsvp: checked })} />
            </div>
            <div className="md:col-span-2">
              <Label>Description</Label>
              <Textarea className="mt-2" value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} placeholder="Optional notes for members" />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setFormOpen(false)}>Cancel</Button>
            <Button onClick={() => saveMass.mutate()} disabled={saveMass.isPending}>
              {saveMass.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Clock className="mr-2 h-4 w-4" />}
              Save Mass
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <Label>{label}</Label>
      <div className="mt-2">{children}</div>
    </div>
  );
}

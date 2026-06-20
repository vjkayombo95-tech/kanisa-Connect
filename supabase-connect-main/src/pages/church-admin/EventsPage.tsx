import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Calendar, MapPin, Clock, Loader2, Users, Pencil, Archive, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { usePaginatedQuery } from "@/hooks/use-paginated-query";
import { PaginationFooter } from "@/components/ui/pagination-footer";

type AttendanceSummaryRow = {
  event_id: string;
  response: string;
  members: {
    full_name: string;
  } | null;
};

type EventRecord = {
  id: string;
  church_id: string;
  title: string;
  description: string | null;
  start_date: string;
  end_date: string | null;
  location: string | null;
  status: string;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
};

const EMPTY_FORM = {
  id: null as string | null,
  title: "",
  description: "",
  startDate: "",
  endDate: "",
  location: "",
};

const isEventList = (value: unknown): value is EventRecord[] => Array.isArray(value);

export default function EventsPage() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const { churchId, user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [totalCount, setTotalCount] = useState(0);
  const pagination = usePaginatedQuery({ totalCount, resetKey: churchId });

  const { data: eventsPage = { rows: [] as EventRecord[], count: 0 }, isLoading } = useQuery({
    queryKey: ["events", churchId, pagination.page, pagination.pageSize],
    queryFn: async () => {
      if (!churchId) return { rows: [] as EventRecord[], count: 0 };
      const { data, error, count } = await supabase
        .from("events")
        .select("*", { count: "exact" })
        .eq("church_id", churchId)
        .order("start_date", { ascending: false })
        .range(pagination.from, pagination.to);

      if (error) {
        throw error;
      }

      return { rows: (data ?? []) as EventRecord[], count: count ?? 0 };
    },
    enabled: !!churchId,
  });
  const events = eventsPage.rows;
  const eventIds = events.map((event) => event.id);

  useEffect(() => {
    setTotalCount(eventsPage.count);
  }, [eventsPage.count]);

  const { data: attendanceSummary = [] } = useQuery({
    queryKey: ["event-attendance-summary", churchId, eventIds],
    queryFn: async () => {
      if (!churchId || eventIds.length === 0) return [];
      const { data, error } = await supabase
        .from("event_attendances")
        .select("event_id, response, members(full_name)")
        .eq("church_id", churchId)
        .eq("response", "yes")
        .in("event_id", eventIds);

      if (error) {
        throw error;
      }

      return (data ?? []) as unknown as AttendanceSummaryRow[];
    },
    enabled: !!churchId && eventIds.length > 0,
  });

  const activeEvents = useMemo(() => events.filter((event) => !event.archived_at), [events]);
  const archivedEvents = useMemo(() => events.filter((event) => !!event.archived_at), [events]);

  const attendanceByEvent = useMemo(() => {
    const summary = new Map<string, { count: number; names: string[] }>();

    attendanceSummary.forEach((attendance) => {
      const current = summary.get(attendance.event_id) ?? { count: 0, names: [] };
      current.count += 1;
      if (attendance.members?.full_name) {
        current.names.push(attendance.members.full_name);
      }
      summary.set(attendance.event_id, current);
    });

    return summary;
  }, [attendanceSummary]);

  const resetForm = () => setForm(EMPTY_FORM);

  const openCreateDialog = () => {
    resetForm();
    setDialogOpen(true);
  };

  const openEditDialog = (event: EventRecord) => {
    setForm({
      id: event.id,
      title: event.title,
      description: event.description ?? "",
      startDate: event.start_date ? new Date(event.start_date).toISOString().slice(0, 16) : "",
      endDate: event.end_date ? new Date(event.end_date).toISOString().slice(0, 16) : "",
      location: event.location ?? "",
    });
    setDialogOpen(true);
  };

  const saveEvent = useMutation({
    mutationFn: async () => {
      if (!churchId) throw new Error("No church context");

      const payload = {
        title: form.title,
        description: form.description || null,
        start_date: form.startDate,
        end_date: form.endDate || null,
        location: form.location || null,
      };

      if (form.id) {
        const { error } = await supabase
          .from("events")
          .update(payload)
          .eq("id", form.id)
          .eq("church_id", churchId);

        if (error) throw error;
        return;
      }

      const { error } = await supabase.from("events").insert({
        church_id: churchId,
        created_by: user?.id || null,
        ...payload,
      });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["events"] });
      queryClient.invalidateQueries({ queryKey: ["portal-events"] });
      toast({ title: form.id ? "Event updated" : "Event created" });
      setDialogOpen(false);
      resetForm();
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const archiveEvent = useMutation({
    mutationFn: async (event: EventRecord) => {
      const { error } = await supabase
        .from("events")
        .update({
          archived_at: event.archived_at ? null : new Date().toISOString(),
        })
        .eq("id", event.id)
        .eq("church_id", event.church_id);

      if (error) throw error;
    },
    onSuccess: (_, event) => {
      queryClient.setQueriesData({ queryKey: ["events"] }, (current) => {
        if (!isEventList(current)) return current;

        return current.map((item) =>
          item.id === event.id
            ? { ...item, archived_at: event.archived_at ? null : new Date().toISOString() }
            : item
        );
      });
      queryClient.invalidateQueries({ queryKey: ["events"] });
      queryClient.invalidateQueries({ queryKey: ["portal-events"] });
      queryClient.invalidateQueries({ queryKey: ["portal-upcoming-events"] });
      toast({ title: event.archived_at ? "Event restored" : "Event archived" });
    },
    onError: (err: Error) => {
      const needsArchiveMigration = err.message.includes("archived_at") && err.message.includes("schema cache");

      toast({
        title: "Error",
        description: needsArchiveMigration
          ? "The events archive column is missing in Supabase. Apply the latest migrations, then try again."
          : err.message,
        variant: "destructive",
      });
    },
  });

  const deleteEvent = useMutation({
    mutationFn: async (event: EventRecord) => {
      const { data, error } = await supabase
        .from("events")
        .delete()
        .eq("id", event.id)
        .eq("church_id", event.church_id)
        .select("id")
        .maybeSingle();

      if (error) throw error;
      if (!data) {
        throw new Error("Event was not deleted. Please refresh and try again.");
      }
    },
    onSuccess: (_, event) => {
      queryClient.setQueriesData({ queryKey: ["events"] }, (current) => {
        if (!isEventList(current)) return current;

        return current.filter((item) => item.id !== event.id);
      });
      queryClient.invalidateQueries({ queryKey: ["events"] });
      queryClient.invalidateQueries({ queryKey: ["portal-events"] });
      queryClient.invalidateQueries({ queryKey: ["portal-upcoming-events"] });
      queryClient.invalidateQueries({ queryKey: ["event-attendance-summary"] });
      toast({ title: "Event deleted" });
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const statusColor = (status: string) => {
    if (status === "upcoming") return "bg-primary/20 text-primary border-primary/30";
    if (status === "ongoing") return "bg-success/20 text-success border-success/30";
    if (status === "completed") return "bg-muted text-muted-foreground";
    return "bg-destructive/20 text-destructive border-destructive/30";
  };

  const EventCard = ({ event }: { event: EventRecord }) => {
    const attendance = attendanceByEvent.get(event.id) ?? { count: 0, names: [] };

    return (
      <Card key={event.id} className="glass-card hover:gold-glow transition-shadow">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between gap-3">
            <CardTitle className="text-base font-sans">{event.title}</CardTitle>
            <div className="flex items-center gap-2">
              {event.archived_at && (
                <Badge variant="outline" className="border-border text-muted-foreground">
                  Archived
                </Badge>
              )}
              <Badge variant="outline" className={statusColor(event.status)}>
                {event.status}
              </Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground line-clamp-2">{event.description || "No description"}</p>
          <div className="flex items-center gap-4 text-xs text-muted-foreground flex-wrap">
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {new Date(event.start_date).toLocaleDateString()}
            </span>
            {event.location && (
              <span className="flex items-center gap-1">
                <MapPin className="h-3 w-3" />
                {event.location}
              </span>
            )}
          </div>

          <div className="rounded-lg border border-primary/10 bg-primary/5 p-3">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Users className="h-4 w-4 text-primary" />
              {attendance.count} attending
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Members who tapped yes in the portal are registered automatically.
            </p>
            {attendance.names.length > 0 && (
              <p className="mt-2 text-xs text-muted-foreground line-clamp-2">
                {attendance.names.slice(0, 3).join(", ")}
                {attendance.names.length > 3 ? ` +${attendance.names.length - 3} more` : ""}
              </p>
            )}
          </div>

          <div className="flex flex-wrap gap-2 pt-1">
            <Button variant="outline" size="sm" onClick={() => openEditDialog(event)}>
              <Pencil className="mr-2 h-3.5 w-3.5" />
              Edit
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => archiveEvent.mutate(event)}
              disabled={archiveEvent.isPending}
            >
              <Archive className="mr-2 h-3.5 w-3.5" />
              {event.archived_at ? "Restore" : "Archive"}
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => deleteEvent.mutate(event)}
              disabled={deleteEvent.isPending}
            >
              <Trash2 className="mr-2 h-3.5 w-3.5" />
              Delete
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold font-serif">Events</h1>
          <p className="text-sm text-muted-foreground mt-1">Manage church events and services</p>
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
              <Plus className="mr-2 h-4 w-4" /> Create Event
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle className="font-serif">{form.id ? "Edit Event" : "New Event"}</DialogTitle>
            </DialogHeader>
            <form
              className="space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                saveEvent.mutate();
              }}
            >
              <div className="space-y-2">
                <Label>Title *</Label>
                <Input
                  placeholder="Sunday Service"
                  value={form.title}
                  onChange={(e) => setForm((current) => ({ ...current, title: e.target.value }))}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Textarea
                  placeholder="Event details..."
                  value={form.description}
                  onChange={(e) => setForm((current) => ({ ...current, description: e.target.value }))}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Start Date *</Label>
                  <Input
                    type="datetime-local"
                    value={form.startDate}
                    onChange={(e) => setForm((current) => ({ ...current, startDate: e.target.value }))}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>End Date</Label>
                  <Input
                    type="datetime-local"
                    value={form.endDate}
                    onChange={(e) => setForm((current) => ({ ...current, endDate: e.target.value }))}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Location</Label>
                <Input
                  placeholder="Main Church Hall"
                  value={form.location}
                  onChange={(e) => setForm((current) => ({ ...current, location: e.target.value }))}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Members will automatically see a "Will you attend?" button for upcoming events in the portal.
              </p>
              <div className="flex justify-end gap-2">
                <Button variant="outline" type="button" onClick={() => setDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={saveEvent.isPending || !form.title || !form.startDate}>
                  {saveEvent.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {form.id ? "Save Changes" : "Create Event"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <p className="text-muted-foreground">Loading...</p>
      ) : events.length === 0 ? (
        <Card className="glass-card">
          <CardContent className="py-16 text-center text-muted-foreground">
            <Calendar className="h-12 w-12 mx-auto mb-4 text-muted-foreground/30" />
            <p>No events created yet. Plan your first church event.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-8">
          <section className="space-y-4">
            <div className="space-y-1">
              <h2 className="text-lg font-semibold font-serif">Active Events</h2>
              <p className="text-sm text-muted-foreground">Upcoming, ongoing, and completed events still visible to the church.</p>
            </div>
            {activeEvents.length === 0 ? (
              <Card className="glass-card">
                <CardContent className="py-10 text-center text-sm text-muted-foreground">
                  No active events right now.
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {activeEvents.map((event) => (
                  <EventCard key={event.id} event={event} />
                ))}
              </div>
            )}
          </section>

          {archivedEvents.length > 0 && (
            <section className="space-y-4">
              <div className="space-y-1">
                <h2 className="text-lg font-semibold font-serif">Archived Events</h2>
                <p className="text-sm text-muted-foreground">Archived events are hidden from the member portal until restored.</p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {archivedEvents.map((event) => (
                  <EventCard key={event.id} event={event} />
                ))}
              </div>
            </section>
          )}
          <PaginationFooter
            page={pagination.page}
            pageSize={pagination.pageSize}
            totalCount={pagination.totalCount}
            hasPreviousPage={pagination.hasPreviousPage}
            hasNextPage={pagination.hasNextPage}
            previousPage={pagination.previousPage}
            nextPage={pagination.nextPage}
            isLoading={isLoading}
          />
        </div>
      )}
    </div>
  );
}

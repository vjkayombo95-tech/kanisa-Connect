import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar, CheckCircle2, Clock, Loader2, MapPin, XCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

type AttendanceResponse = "yes" | "no";

function useMemberRecord() {
  const { user, churchId } = useAuth();

  return useQuery({
    queryKey: ["my-member-record", user?.id, churchId],
    queryFn: async () => {
      if (!user || !churchId) return null;
      const { data } = await supabase
        .from("members")
        .select("id, full_name")
        .eq("user_id", user.id)
        .eq("church_id", churchId)
        .maybeSingle();
      return data;
    },
    enabled: !!user && !!churchId,
  });
}

export default function PortalEvents() {
  const { churchId } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: member, isLoading: isMemberLoading } = useMemberRecord();

  const { data: events = [], isLoading } = useQuery({
    queryKey: ["portal-events", churchId],
    queryFn: async () => {
      if (!churchId) return [];
      const { data, error } = await supabase
        .from("events")
        .select("*")
        .eq("church_id", churchId)
        .is("archived_at", null)
        .order("start_date", { ascending: true });

      if (error) {
        throw error;
      }

      return data ?? [];
    },
    enabled: !!churchId,
  });

  const { data: attendances = [] } = useQuery({
    queryKey: ["portal-event-attendances", member?.id],
    queryFn: async () => {
      if (!member?.id) return [];
      const { data, error } = await supabase
        .from("event_attendances")
        .select("event_id, response")
        .eq("member_id", member.id);

      if (error) {
        throw error;
      }

      return data ?? [];
    },
    enabled: !!member?.id,
  });

  const attendanceByEvent = new Map(
    attendances.map((attendance) => [attendance.event_id, attendance.response as AttendanceResponse]),
  );

  const respondToEvent = useMutation({
    mutationFn: async ({ eventId, response }: { eventId: string; response: AttendanceResponse }) => {
      if (!churchId) throw new Error("No church context");
      if (!member?.id) throw new Error("No member profile found");

      const { error } = await supabase.from("event_attendances").upsert(
        {
          church_id: churchId,
          event_id: eventId,
          member_id: member.id,
          response,
          responded_at: new Date().toISOString(),
        },
        { onConflict: "event_id,member_id" },
      );

      if (error) {
        throw error;
      }
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["portal-event-attendances"] });
      queryClient.invalidateQueries({ queryKey: ["event-attendance-summary"] });
      toast({
        title: variables.response === "yes" ? "Attendance confirmed" : "Attendance updated",
        description:
          variables.response === "yes"
            ? "You have been registered for this event."
            : "Your response has been saved.",
      });
    },
    onError: (error: Error) => {
      toast({ title: "Unable to save response", description: error.message, variant: "destructive" });
    },
  });

  const statusColor = (s: string) => {
    if (s === "upcoming") return "bg-primary/20 text-primary border-primary/30";
    if (s === "ongoing") return "bg-success/20 text-success border-success/30";
    if (s === "completed") return "bg-muted text-muted-foreground";
    return "bg-destructive/20 text-destructive border-destructive/30";
  };

  const canRespondToEvent = (event: any) => {
    if (event.status === "completed" || event.status === "cancelled") {
      return false;
    }

    const eventStart = new Date(event.start_date).getTime();
    if (Number.isNaN(eventStart)) {
      return true;
    }

    return eventStart >= Date.now() || event.status === "ongoing" || event.status === "upcoming";
  };

  return (
    <div className="container mx-auto px-4 py-10 animate-fade-in">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-2xl md:text-3xl font-bold font-serif mb-2">Events</h1>
        <p className="text-muted-foreground mb-8">Stay updated with church events and services.</p>

        {isLoading ? (
          <p className="text-muted-foreground">Loading events...</p>
        ) : events.length === 0 ? (
          <Card className="glass-card">
            <CardContent className="py-16 text-center text-muted-foreground">
              <Calendar className="h-12 w-12 mx-auto mb-4 text-muted-foreground/30" />
              No events at this time. Check back soon!
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {events.map((event: any) => {
              const response = attendanceByEvent.get(event.id);
              const showAttendancePrompt = canRespondToEvent(event);
              const isSaving = respondToEvent.isPending && respondToEvent.variables?.eventId === event.id;

              return (
                <Card key={event.id} className="glass-card hover:gold-glow transition-shadow">
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex gap-4">
                        <div className="h-14 w-14 rounded-lg bg-primary/10 flex flex-col items-center justify-center shrink-0 border border-primary/20">
                          <span className="text-xs text-primary font-medium">
                            {new Date(event.start_date).toLocaleDateString("en-US", { month: "short" })}
                          </span>
                          <span className="text-lg font-bold text-primary leading-none">{new Date(event.start_date).getDate()}</span>
                        </div>
                        <div>
                          <h3 className="font-semibold">{event.title}</h3>
                          <p className="text-sm text-muted-foreground mt-1">{event.description || "Join us for this event."}</p>
                          <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground flex-wrap">
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {new Date(event.start_date).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}
                            </span>
                            {event.location && (
                              <span className="flex items-center gap-1">
                                <MapPin className="h-3 w-3" />
                                {event.location}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <Badge variant="outline" className={statusColor(event.status)}>
                        {event.status}
                      </Badge>
                    </div>

                    {showAttendancePrompt && (
                      <div className="mt-5 rounded-xl border border-border/60 bg-muted/20 p-4">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                          <div>
                            <p className="text-sm font-medium">Will you attend {event.title}?</p>
                            <p className="text-xs text-muted-foreground">
                              Tap yes to register automatically for this event.
                            </p>
                          </div>
                          {member ? (
                            <div className="flex items-center gap-2">
                              <Button
                                size="sm"
                                variant={response === "yes" ? "default" : "outline"}
                                disabled={isSaving}
                                onClick={() => respondToEvent.mutate({ eventId: event.id, response: "yes" })}
                              >
                                {isSaving && respondToEvent.variables?.response === "yes" ? (
                                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                ) : (
                                  <CheckCircle2 className="mr-2 h-4 w-4" />
                                )}
                                Yes
                              </Button>
                              <Button
                                size="sm"
                                variant={response === "no" ? "secondary" : "outline"}
                                disabled={isSaving}
                                onClick={() => respondToEvent.mutate({ eventId: event.id, response: "no" })}
                              >
                                {isSaving && respondToEvent.variables?.response === "no" ? (
                                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                ) : (
                                  <XCircle className="mr-2 h-4 w-4" />
                                )}
                                No
                              </Button>
                            </div>
                          ) : (
                            <p className="text-xs text-muted-foreground">
                              {isMemberLoading ? "Loading your membership..." : "Your member profile is required to RSVP."}
                            </p>
                          )}
                        </div>
                        {response && (
                          <p className="mt-3 text-xs text-muted-foreground">
                            Your current response: <span className="font-medium text-foreground">{response === "yes" ? "Attending" : "Not attending"}</span>
                          </p>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

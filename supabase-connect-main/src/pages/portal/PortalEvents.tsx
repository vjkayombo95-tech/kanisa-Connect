import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AlertCircle, Calendar, CheckCircle2, Clock, Loader2, MapPin, XCircle } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { useLinkedMember } from "@/hooks/use-linked-member";

type AttendanceResponse = "yes" | "no";

export default function PortalEvents() {
  const { churchId } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: member, isLoading: isMemberLoading } = useLinkedMember();

  const { data: events = [], isLoading, isError, refetch } = useQuery({
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
    <main className="min-h-full overflow-x-hidden bg-[linear-gradient(180deg,hsl(var(--background)),hsl(var(--muted)/0.28))] px-4 py-5 pb-28 lg:px-8 lg:pb-10">
      <div className="mx-auto max-w-5xl space-y-5">
        <header className="space-y-1">
          <p className="text-sm font-bold text-primary">Kanisa Connect</p>
          <h1 className="break-words font-serif text-2xl font-bold md:text-3xl">Matukio</h1>
          <p className="max-w-2xl text-sm text-muted-foreground">Angalia matukio yajayo ya parokia.</p>
        </header>

        {isLoading ? (
          <div role="status" aria-live="polite" className="space-y-3">
            <Skeleton className="h-32 rounded-[24px]" />
            <Skeleton className="h-32 rounded-[24px]" />
            <span className="sr-only">Matukio yanapakiwa...</span>
          </div>
        ) : isError ? (
          <Card className="rounded-[24px] border-destructive/30 bg-card/85">
            <CardContent className="flex flex-col items-center gap-3 px-5 py-8 text-center" role="alert">
              <AlertCircle className="h-9 w-9 text-destructive" />
              <div>
                <p className="font-semibold text-destructive">Imeshindikana kupakia matukio.</p>
                <p className="mt-1 text-sm text-muted-foreground">Jaribu tena kuona matukio mapya ya parokia.</p>
              </div>
              <Button type="button" variant="outline" onClick={() => void refetch()}>Jaribu tena</Button>
            </CardContent>
          </Card>
        ) : events.length === 0 ? (
          <Card className="rounded-[24px] border-border/70 bg-card/80">
            <CardContent className="flex items-start gap-4 p-5 text-muted-foreground">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <Calendar className="h-5 w-5" />
              </span>
              <div>
                <p className="font-semibold text-foreground">Hakuna matukio yajayo kwa sasa.</p>
                <p className="mt-1 text-sm">Matukio mapya yataonekana hapa yatakapochapishwa.</p>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {events.map((event: any) => {
              const response = attendanceByEvent.get(event.id);
              const showAttendancePrompt = canRespondToEvent(event);
              const isSaving = respondToEvent.isPending && respondToEvent.variables?.eventId === event.id;

              return (
                <Card key={event.id} className="rounded-[24px] border-border/70 bg-card/85 shadow-sm transition-shadow hover:border-primary/25">
                  <CardContent className="p-5 sm:p-6">
                    <div className="flex min-w-0 items-start justify-between gap-4">
                      <div className="flex min-w-0 gap-4">
                        <div className="h-14 w-14 rounded-lg bg-primary/10 flex flex-col items-center justify-center shrink-0 border border-primary/20">
                          <span className="text-xs text-primary font-medium">
                            {new Date(event.start_date).toLocaleDateString("en-US", { month: "short" })}
                          </span>
                          <span className="text-lg font-bold text-primary leading-none">{new Date(event.start_date).getDate()}</span>
                        </div>
                        <div className="min-w-0">
                          <h3 className="break-words font-semibold">{event.title}</h3>
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
                            <p className="text-sm font-medium">Utahudhuria {event.title}?</p>
                            <p className="text-xs text-muted-foreground">
                              Bonyeza ndiyo ili kusajiliwa kwa tukio hili.
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
                                Ndiyo
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
                                Hapana
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
                            Jibu lako: <span className="font-medium text-foreground">{response === "yes" ? "Utahudhuria" : "Hutahudhuria"}</span>
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
    </main>
  );
}

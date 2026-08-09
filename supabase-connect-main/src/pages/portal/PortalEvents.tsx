import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar, CheckCircle2, Clock, Loader2, MapPin, XCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "react-i18next";
import { formatLocalizedDate, formatLocalizedTime, normalizeAppLanguage } from "@/lib/localization";
import { useMember } from "@/hooks/useMember";
import { isMemberPreviewActive } from "@/lib/member-preview";
import { EventPaymentDialog } from "@/components/events/EventPaymentDialog";
import { formatTZSForLanguage } from "@/lib/currency";
import { describeRegistrationStatus, normalizePaidEventConfig } from "@/lib/events/paid-registration";

type AttendanceResponse = "yes" | "no";
type PortalEvent = {
  id: string;
  title: string;
  description: string | null;
  start_date: string;
  end_date?: string | null;
  location?: string | null;
  status?: string | null;
  registration_required?: boolean | null;
  registration_type?: string | null;
  registration_fee?: number | string | null;
  registration_currency?: string | null;
  registration_deadline?: string | null;
  registration_capacity?: number | string | null;
};

type PortalAttendance = {
  id: string;
  event_id: string;
  response: AttendanceResponse;
  registration_status?: string | null;
  payment_status?: string | null;
  amount_due?: number | string | null;
  currency?: string | null;
};

function getEventStatus(event: PortalEvent) {
  if (event.status === "upcoming" || event.status === "ongoing" || event.status === "completed" || event.status === "cancelled") {
    return event.status;
  }

  const now = Date.now();
  const startsAt = new Date(event.start_date).getTime();
  const endsAt = event.end_date ? new Date(event.end_date).getTime() : startsAt;

  if (Number.isNaN(startsAt)) return "upcoming";
  if (startsAt <= now && endsAt >= now) return "ongoing";
  if (endsAt < now) return "completed";
  return "upcoming";
}

export default function PortalEvents() {
  const { i18n, t } = useTranslation();
  const language = normalizeAppLanguage(i18n.language) ?? "en";
  const { churchId } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: member, isLoading: isMemberLoading } = useMember("id, full_name, church_id, email");
  const isPreview = isMemberPreviewActive();
  const [paymentTarget, setPaymentTarget] = useState<{ attendance: PortalAttendance; event: PortalEvent } | null>(null);

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
        .select("id,event_id,response,registration_status,payment_status,amount_due,currency")
        .eq("member_id", member.id);

      if (error) {
        throw error;
      }

      return (data ?? []) as PortalAttendance[];
    },
    enabled: !!member?.id,
  });

  const attendanceByEvent = useMemo(() => new Map(attendances.map((attendance) => [attendance.event_id, attendance])), [attendances]);

  const registerForEvent = useMutation({
    mutationFn: async (eventId: string) => {
      const { data, error } = await supabase.rpc("register_for_event" as never, { _event_id: eventId } as never);
      if (error) throw error;
      const result = data as { success?: boolean; error?: string } | null;
      if (!result?.success) throw new Error(result?.error || t("member_portal.parish_life.unable_save_response"));
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["portal-event-attendances"] });
      queryClient.invalidateQueries({ queryKey: ["event-attendance-summary"] });
      toast({
        title: t("member_portal.parish_life.registration_saved"),
        description: t("member_portal.parish_life.registration_saved_description"),
      });
    },
    onError: (error: Error) => {
      toast({ title: t("member_portal.parish_life.unable_save_response"), description: error.message, variant: "destructive" });
    },
  });

  const submitPayment = useMutation({
    mutationFn: async ({ attendanceId, paymentMethod, transactionReference, proofUrl }: { attendanceId: string; paymentMethod: string; transactionReference: string; proofUrl: string }) => {
      const { data, error } = await supabase.rpc("submit_event_registration_payment" as never, {
        _attendance_id: attendanceId,
        _payment_method: paymentMethod,
        _transaction_reference: transactionReference || null,
        _proof_url: proofUrl || null,
      } as never);
      if (error) throw error;
      const result = data as { success?: boolean; error?: string } | null;
      if (!result?.success) throw new Error(result?.error || t("member_portal.parish_life.payment_submit_failed"));
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["portal-event-attendances"] });
      queryClient.invalidateQueries({ queryKey: ["event-registration-payments"] });
      toast({
        title: t("member_portal.parish_life.payment_submitted"),
        description: t("member_portal.parish_life.payment_submitted_description"),
      });
    },
    onError: (error: Error) => {
      toast({ title: t("member_portal.parish_life.payment_submit_failed"), description: error.message, variant: "destructive" });
    },
  });

  const respondToEvent = useMutation({
    mutationFn: async ({ eventId, response }: { eventId: string; response: AttendanceResponse }) => {
      if (!churchId) throw new Error(t("member_portal.parish_life.error_no_church"));
      if (!member?.id) throw new Error(t("member_portal.parish_life.error_no_member"));

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
        title: variables.response === "yes" ? t("member_portal.parish_life.attendance_confirmed") : t("member_portal.parish_life.attendance_updated"),
        description:
          variables.response === "yes"
            ? t("member_portal.parish_life.attendance_confirmed_description")
            : t("member_portal.parish_life.attendance_saved_description"),
      });
    },
    onError: (error: Error) => {
      toast({ title: t("member_portal.parish_life.unable_save_response"), description: error.message, variant: "destructive" });
    },
  });

  const statusColor = (s: string) => {
    if (s === "upcoming") return "bg-primary/20 text-primary border-primary/30";
    if (s === "ongoing") return "bg-success/20 text-success border-success/30";
    if (s === "completed") return "bg-muted text-muted-foreground";
    return "bg-destructive/20 text-destructive border-destructive/30";
  };

  const canRespondToEvent = (event: PortalEvent) => {
    const status = getEventStatus(event);
    if (status === "completed" || status === "cancelled") {
      return false;
    }

    const eventStart = new Date(event.start_date).getTime();
    if (Number.isNaN(eventStart)) {
      return true;
    }

    return eventStart >= Date.now() || status === "ongoing" || status === "upcoming";
  };

  return (
    <div className="container mx-auto px-4 py-10 animate-fade-in">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-2xl md:text-3xl font-bold font-serif mb-2">{t("member_portal.parish_life.events")}</h1>
        <p className="text-muted-foreground mb-8">{t("member_portal.parish_life.events_description")}</p>

        {isLoading ? (
          <p className="text-muted-foreground">{t("member_portal.parish_life.loading_events")}</p>
        ) : events.length === 0 ? (
          <Card className="glass-card">
            <CardContent className="py-16 text-center text-muted-foreground">
              <Calendar className="h-12 w-12 mx-auto mb-4 text-muted-foreground/30" />
              {t("member_portal.parish_life.no_events")}
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {events.map((event: PortalEvent) => {
              const attendance = attendanceByEvent.get(event.id);
              const response = attendance?.response;
              const showAttendancePrompt = canRespondToEvent(event);
              const isSaving =
                (respondToEvent.isPending && respondToEvent.variables?.eventId === event.id)
                || (registerForEvent.isPending && registerForEvent.variables === event.id);
              const status = getEventStatus(event);
              const registration = normalizePaidEventConfig({
                registrationRequired: event.registration_required,
                registrationType: event.registration_type,
                registrationFee: event.registration_fee,
                registrationCurrency: event.registration_currency,
                registrationDeadline: event.registration_deadline,
                registrationCapacity: event.registration_capacity,
              });
              const registrationStatus = describeRegistrationStatus(attendance?.registration_status, attendance?.payment_status);
              const requiresPayment = registration.isPaid && attendance?.id && ["payment_pending", "payment_submitted"].includes(registrationStatus);

              return (
                <Card key={event.id} className="glass-card hover:gold-glow transition-shadow">
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex gap-4">
                        <div className="h-14 w-14 rounded-lg bg-primary/10 flex flex-col items-center justify-center shrink-0 border border-primary/20">
                          <span className="text-xs text-primary font-medium">
                            {formatLocalizedDate(event.start_date, language, { month: "short" })}
                          </span>
                          <span className="text-lg font-bold text-primary leading-none">{new Date(event.start_date).getDate()}</span>
                        </div>
                        <div>
                          <h3 className="font-semibold">{event.title}</h3>
                          <p className="text-sm text-muted-foreground mt-1">{event.description || t("member_portal.parish_life.event_description_fallback")}</p>
                          <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground flex-wrap">
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {formatLocalizedTime(event.start_date, language)}
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
                      <div className="flex flex-col items-end gap-2">
                        <Badge variant="outline" className={statusColor(status)}>
                          {t(`member_portal.parish_life.event_status.${status}`, status)}
                        </Badge>
                        {registration.registrationRequired ? (
                          <Badge variant="outline" className="border-primary/30 text-primary">
                            {registration.isPaid
                              ? t("member_portal.parish_life.paid_event_badge", { amount: formatTZSForLanguage(registration.fee, language) })
                              : t("member_portal.parish_life.registration_required")}
                          </Badge>
                        ) : null}
                      </div>
                    </div>

                    {showAttendancePrompt && (
                      <div className="mt-5 rounded-xl border border-border/60 bg-muted/20 p-4">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                          <div>
                            <p className="text-sm font-medium">{t("member_portal.parish_life.will_you_attend", { title: event.title })}</p>
                            <p className="text-xs text-muted-foreground">
                              {isPreview
                                ? t("member_portal.parish_life.preview_rsvp_hint")
                                : member
                                  ? registration.registrationRequired
                                    ? t("member_portal.parish_life.registration_hint")
                                    : t("member_portal.parish_life.rsvp_hint")
                                  : isMemberLoading
                                    ? t("member_portal.parish_life.loading_membership")
                                    : t("member_portal.parish_life.member_required_rsvp")}
                            </p>
                            {registration.deadline || registration.capacity ? (
                              <p className="mt-1 text-xs text-muted-foreground">
                                {registration.deadline
                                  ? t("member_portal.parish_life.registration_deadline", {
                                      date: formatLocalizedDate(registration.deadline, language),
                                      time: formatLocalizedTime(registration.deadline, language),
                                    })
                                  : null}
                                {registration.capacity
                                  ? ` ${t("member_portal.parish_life.registration_capacity", {
                                      count: registration.capacity,
                                    })}`
                                  : null}
                              </p>
                            ) : null}
                          </div>
                          <div className="flex items-center gap-2">
                            <Button
                              size="sm"
                              variant={response === "yes" ? "default" : "outline"}
                              disabled={isSaving || !member || !registration.canRegister}
                              onClick={() => member && registerForEvent.mutate(event.id)}
                            >
                              {isSaving ? (
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              ) : (
                                <CheckCircle2 className="mr-2 h-4 w-4" />
                              )}
                              {registration.registrationRequired ? t("member_portal.parish_life.register") : t("member_portal.parish_life.yes")}
                            </Button>
                            <Button
                              size="sm"
                              variant={response === "no" ? "secondary" : "outline"}
                              disabled={isSaving || !member}
                              onClick={() => member && respondToEvent.mutate({ eventId: event.id, response: "no" })}
                            >
                              {isSaving && respondToEvent.variables?.response === "no" ? (
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              ) : (
                                <XCircle className="mr-2 h-4 w-4" />
                              )}
                              {t("member_portal.parish_life.no")}
                            </Button>
                          </div>
                        </div>
                        {response && (
                          <p className="mt-3 text-xs text-muted-foreground">
                            {t("member_portal.parish_life.current_response")} <span className="font-medium text-foreground">{response === "yes" ? t("member_portal.parish_life.attending") : t("member_portal.parish_life.not_attending")}</span>
                            {response === "yes" && registration.registrationRequired ? (
                              <>
                                {" "}
                                <span className="font-medium text-foreground">
                                  {t(`member_portal.parish_life.registration_status.${registrationStatus}`, registrationStatus)}
                                </span>
                              </>
                            ) : null}
                          </p>
                        )}
                        {requiresPayment ? (
                          <Button
                            className="mt-3"
                            size="sm"
                            onClick={() => setPaymentTarget({ attendance, event })}
                          >
                            {t("member_portal.parish_life.pay_event_fee", {
                              amount: formatTZSForLanguage(Number(attendance.amount_due ?? registration.fee), language),
                            })}
                          </Button>
                        ) : null}
                        {!registration.canRegister && !response ? (
                          <p className="mt-3 text-xs text-destructive">
                            {registration.reason === "full"
                              ? t("member_portal.parish_life.registration_full")
                              : t("member_portal.parish_life.registration_closed")}
                          </p>
                        ) : null}
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
      {paymentTarget ? (
        <EventPaymentDialog
          open={!!paymentTarget}
          onOpenChange={(open) => !open && setPaymentTarget(null)}
          eventTitle={paymentTarget.event.title}
          amount={Number(paymentTarget.attendance.amount_due ?? paymentTarget.event.registration_fee ?? 0)}
          isSubmitting={submitPayment.isPending}
          onSubmit={(paymentMethod, transactionReference, proofUrl) =>
            submitPayment.mutateAsync({
              attendanceId: paymentTarget.attendance.id,
              paymentMethod,
              transactionReference,
              proofUrl,
            })
          }
        />
      ) : null}
    </div>
  );
}

import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Calendar, MapPin, Clock, Loader2, Users, Pencil, Archive, Trash2, MessageCircle, CheckCircle2, XCircle, ClipboardList } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { usePaginatedQuery } from "@/hooks/use-paginated-query";
import { PaginationFooter } from "@/components/ui/pagination-footer";
import { buildEventShareMessage, openWhatsAppShare } from "@/lib/whatsapp-share";
import {
  applyCatholicEventDefaults,
  catholicEventTaxonomy,
  catholicEventTaxonomyGroups,
  findCatholicEventType,
} from "@/lib/calendar/catholic-event-taxonomy";
import type { ParishCalendarEventType, ParishCalendarVisibility, ParishEventAudienceMode } from "@/components/calendar/types";
import {
  describeRecurrenceRule,
  normalizeRecurrenceRule,
  validateRecurrenceRule,
  type CalendarMonthlyPattern,
  type CalendarRecurrenceEndMode,
  type CalendarRecurrenceFrequency,
} from "@/lib/calendar/recurrence";
import { formatTZS } from "@/lib/currency";
import { normalizePaidEventConfig, validatePaidEventConfig } from "@/lib/events/paid-registration";

type AttendanceSummaryRow = {
  event_id: string;
  response: string;
  registration_status?: string | null;
  payment_status?: string | null;
  amount_due?: number | string | null;
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
  event_type?: string | null;
  ministry?: string | null;
  visibility?: ParishCalendarVisibility | null;
  audience_mode?: ParishEventAudienceMode | null;
  recurrence_frequency?: CalendarRecurrenceFrequency | null;
  recurrence_interval?: number | null;
  recurrence_days_of_week?: number[] | null;
  recurrence_end_date?: string | null;
  recurrence_count?: number | null;
  recurrence_monthly_pattern?: CalendarMonthlyPattern | null;
  recurrence_monthly_week?: number | null;
  recurrence_monthly_weekday?: number | null;
  registration_required?: boolean | null;
  registration_type?: string | null;
  registration_fee?: number | string | null;
  registration_currency?: string | null;
  registration_deadline?: string | null;
  registration_capacity?: number | string | null;
  payment_required_for_confirmation?: boolean | null;
};

type AudienceTargetOption = {
  key: string;
  id: string;
  type: "ministry" | "community";
  name: string;
};

type EventAudienceTargetRecord = {
  event_id: string;
  ministry_id: string | null;
  community_id: string | null;
};

type EventRegistrationPaymentRow = {
  id: string;
  event_id: string;
  amount: number | string;
  currency: string;
  payment_method: string;
  transaction_reference: string | null;
  proof_url: string | null;
  status: string;
  members: {
    full_name: string | null;
  } | null;
};

const WEEKDAY_OPTIONS = [
  { value: 1, key: "monday", label: "Monday" },
  { value: 2, key: "tuesday", label: "Tuesday" },
  { value: 3, key: "wednesday", label: "Wednesday" },
  { value: 4, key: "thursday", label: "Thursday" },
  { value: 5, key: "friday", label: "Friday" },
  { value: 6, key: "saturday", label: "Saturday" },
  { value: 0, key: "sunday", label: "Sunday" },
];

const EMPTY_FORM = {
  id: null as string | null,
  title: "",
  description: "",
  startDate: "",
  endDate: "",
  location: "",
  eventType: "public_event" as ParishCalendarEventType,
  ministry: "Parish Life",
  visibility: "public" as ParishCalendarVisibility,
  audienceMode: "everyone" as ParishEventAudienceMode,
  audienceTargetKeys: [] as string[],
  recurrenceFrequency: "none" as CalendarRecurrenceFrequency,
  recurrenceInterval: 1,
  recurrenceDaysOfWeek: [] as number[],
  recurrenceEndMode: "date" as CalendarRecurrenceEndMode,
  recurrenceEndDate: "",
  recurrenceCount: 6,
  recurrenceMonthlyPattern: "day_of_month" as CalendarMonthlyPattern,
  registrationRequired: false,
  registrationType: "free" as "free" | "paid",
  registrationFee: "",
  registrationDeadline: "",
  registrationCapacity: "",
};

const isEventList = (value: unknown): value is EventRecord[] => Array.isArray(value);

function getEventMutationError(err: Error) {
  if (err.message.toLowerCase().includes("row-level security")) {
    return "You do not have permission to manage events for this church, or the latest event permissions migration has not been applied yet.";
  }
  return err.message;
}

export default function EventsPage() {
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [audienceSearch, setAudienceSearch] = useState("");
  const { churchId, user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [totalCount, setTotalCount] = useState(0);
  const pagination = usePaginatedQuery({ totalCount, resetKey: churchId });
  const eventRequestId = searchParams.get("eventRequestId");
  const eventRequestSearch = searchParams.toString();

  const { data: church } = useQuery({
    queryKey: ["event-share-church", churchId],
    queryFn: async () => {
      if (!churchId) return null;
      const { data, error } = await supabase
        .from("churches")
        .select("name")
        .eq("id", churchId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!churchId,
  });

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

  const { data: audienceOptions = [] } = useQuery({
    queryKey: ["event-audience-options", churchId],
    queryFn: async () => {
      if (!churchId) return [] as AudienceTargetOption[];
      const [ministriesResult, communitiesResult] = await Promise.all([
        supabase
          .from("ministries")
          .select("id,name")
          .eq("church_id", churchId)
          .order("name", { ascending: true }),
        supabase
          .from("communities")
          .select("id,name")
          .eq("church_id", churchId)
          .order("name", { ascending: true }),
      ]);

      if (ministriesResult.error) throw ministriesResult.error;
      if (communitiesResult.error) throw communitiesResult.error;

      const ministryOptions = (ministriesResult.data ?? [])
        .filter((item) => item.id && item.name)
        .map((item) => ({ key: `ministry:${item.id}`, id: item.id, type: "ministry" as const, name: item.name }));
      const communityOptions = (communitiesResult.data ?? [])
        .filter((item) => item.id && item.name)
        .map((item) => ({ key: `community:${item.id}`, id: item.id, type: "community" as const, name: item.name }));

      return [...ministryOptions, ...communityOptions].sort((left, right) => left.name.localeCompare(right.name));
    },
    enabled: !!churchId,
  });

  const { data: eventAudienceTargets = [] } = useQuery({
    queryKey: ["event-audience-targets", churchId, eventIds],
    queryFn: async () => {
      if (!churchId || eventIds.length === 0) return [] as EventAudienceTargetRecord[];
      const { data, error } = await supabase
        .from("event_audience_targets" as never)
        .select("event_id,ministry_id,community_id")
        .eq("church_id", churchId)
        .in("event_id", eventIds as never);

      if (error) throw error;
      return (data ?? []) as unknown as EventAudienceTargetRecord[];
    },
    enabled: !!churchId && eventIds.length > 0,
  });

  const { data: registrationPayments = [] } = useQuery({
    queryKey: ["event-registration-payments", churchId, eventIds],
    queryFn: async () => {
      if (!churchId || eventIds.length === 0) return [] as EventRegistrationPaymentRow[];
      const { data, error } = await supabase
        .from("event_registration_payments" as never)
        .select("id,event_id,amount,currency,payment_method,transaction_reference,proof_url,status,members(full_name)")
        .eq("church_id", churchId)
        .in("event_id", eventIds as never)
        .eq("status", "pending")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return (data ?? []) as unknown as EventRegistrationPaymentRow[];
    },
    enabled: !!churchId && eventIds.length > 0,
  });

  useEffect(() => {
    setTotalCount(eventsPage.count);
  }, [eventsPage.count]);

  const { data: attendanceSummary = [] } = useQuery({
    queryKey: ["event-attendance-summary", churchId, eventIds],
    queryFn: async () => {
      if (!churchId || eventIds.length === 0) return [];
      const { data, error } = await supabase
        .from("event_attendances")
        .select("event_id, response, registration_status, payment_status, amount_due, members(full_name)")
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
    const summary = new Map<string, { count: number; names: string[]; pendingPayment: number; paid: number; amountDue: number }>();

    attendanceSummary.forEach((attendance) => {
      const current = summary.get(attendance.event_id) ?? { count: 0, names: [], pendingPayment: 0, paid: 0, amountDue: 0 };
      current.count += 1;
      if (attendance.payment_status === "pending" || attendance.payment_status === "submitted") current.pendingPayment += 1;
      if (attendance.payment_status === "paid" || attendance.registration_status === "confirmed") current.paid += 1;
      current.amountDue += Number(attendance.amount_due ?? 0) || 0;
      if (attendance.members?.full_name) {
        current.names.push(attendance.members.full_name);
      }
      summary.set(attendance.event_id, current);
    });

    return summary;
  }, [attendanceSummary]);

  const audienceTargetsByEvent = useMemo(() => {
    const map = new Map<string, string[]>();
    eventAudienceTargets.forEach((target) => {
      const key = target.ministry_id ? `ministry:${target.ministry_id}` : target.community_id ? `community:${target.community_id}` : null;
      if (!key) return;
      map.set(target.event_id, [...(map.get(target.event_id) ?? []), key]);
    });
    return map;
  }, [eventAudienceTargets]);

  const audienceOptionByKey = useMemo(() => {
    const map = new Map<string, AudienceTargetOption>();
    audienceOptions.forEach((option) => map.set(option.key, option));
    return map;
  }, [audienceOptions]);

  const pendingPaymentsByEvent = useMemo(() => {
    const map = new Map<string, EventRegistrationPaymentRow[]>();
    registrationPayments.forEach((payment) => {
      map.set(payment.event_id, [...(map.get(payment.event_id) ?? []), payment]);
    });
    return map;
  }, [registrationPayments]);

  const filteredAudienceOptions = useMemo(() => {
    const search = audienceSearch.trim().toLowerCase();
    if (!search) return audienceOptions;
    return audienceOptions.filter((option) => option.name.toLowerCase().includes(search));
  }, [audienceOptions, audienceSearch]);

  const resetForm = () => setForm(EMPTY_FORM);

  const openCreateDialog = () => {
    resetForm();
    setAudienceSearch("");
    setDialogOpen(true);
  };

  useEffect(() => {
    if (!eventRequestId) return;

    const params = new URLSearchParams(eventRequestSearch);
    const requestType = params.get("requestType") ?? "parish_event";
    const inferredType: ParishCalendarEventType =
      requestType === "prayer_formation_event"
        ? "prayer_service"
        : requestType === "ministry_group_event"
          ? "ministry_meeting"
          : requestType === "venue_facility_request"
            ? "parish_meeting"
            : "public_event";
    const date = params.get("date") ?? "";
    const startTime = params.get("startTime") ?? "";
    const endTime = params.get("endTime") ?? "";
    const taxonomy = findCatholicEventType(inferredType);

    setForm((current) => ({
      ...current,
      title: params.get("title") || current.title,
      description: params.get("description") || current.description,
      startDate: date ? `${date}T${startTime || "09:00"}` : current.startDate,
      endDate: date && endTime ? `${date}T${endTime}` : current.endDate,
      location: params.get("location") || current.location,
      eventType: inferredType,
      ministry: taxonomy?.suggestedService ?? current.ministry,
      visibility: taxonomy?.defaultVisibility ?? current.visibility,
    }));
    setDialogOpen(true);
  }, [eventRequestId, eventRequestSearch]);

  const openEditDialog = (event: EventRecord) => {
    const start = event.start_date ? new Date(event.start_date) : new Date();
    const frequency: CalendarRecurrenceFrequency =
      event.recurrence_frequency === "daily" || event.recurrence_frequency === "weekly" || event.recurrence_frequency === "monthly"
        ? event.recurrence_frequency
        : "none";
    setForm({
      id: event.id,
      title: event.title,
      description: event.description ?? "",
      startDate: event.start_date ? new Date(event.start_date).toISOString().slice(0, 16) : "",
      endDate: event.end_date ? new Date(event.end_date).toISOString().slice(0, 16) : "",
      location: event.location ?? "",
      eventType: (findCatholicEventType(event.event_type)?.id ?? "custom") as ParishCalendarEventType,
      ministry: event.ministry ?? findCatholicEventType(event.event_type)?.suggestedService ?? "Parish Life",
      visibility: event.visibility ?? findCatholicEventType(event.event_type)?.defaultVisibility ?? "public",
      audienceMode: event.audience_mode ?? "everyone",
      audienceTargetKeys: audienceTargetsByEvent.get(event.id) ?? [],
      recurrenceFrequency: frequency,
      recurrenceInterval: event.recurrence_interval ?? 1,
      recurrenceDaysOfWeek: event.recurrence_days_of_week ?? [start.getDay()],
      recurrenceEndMode: event.recurrence_count ? "count" : "date",
      recurrenceEndDate: event.recurrence_end_date ?? "",
      recurrenceCount: event.recurrence_count ?? 6,
      recurrenceMonthlyPattern: event.recurrence_monthly_pattern ?? "day_of_month",
      registrationRequired: Boolean(event.registration_required),
      registrationType: event.registration_type === "paid" ? "paid" : "free",
      registrationFee: event.registration_fee ? String(event.registration_fee) : "",
      registrationDeadline: event.registration_deadline ? new Date(event.registration_deadline).toISOString().slice(0, 16) : "",
      registrationCapacity: event.registration_capacity ? String(event.registration_capacity) : "",
    });
    setAudienceSearch("");
    setDialogOpen(true);
  };

  const selectedTaxonomy = findCatholicEventType(form.eventType);
  const taxonomyByGroup = catholicEventTaxonomyGroups.map((group) => ({
    ...group,
    items: catholicEventTaxonomy.filter((item) => item.groupId === group.id),
  })).filter((group) => group.items.length > 0);

  const updateEventType = (eventType: ParishCalendarEventType) => {
    const defaults = applyCatholicEventDefaults(eventType);
    const label = t(findCatholicEventType(eventType)?.labelKey ?? "member_portal.parish_life.event_types.custom");
    setForm((current) => ({
      ...current,
      eventType: defaults.eventType as ParishCalendarEventType,
      ministry: defaults.ministry,
      visibility: defaults.visibility,
      audienceMode: defaults.visibility === "public" ? "everyone" : "all_members",
      audienceTargetKeys: current.audienceMode === "specific_groups" ? current.audienceTargetKeys : [],
      title: current.title.trim() ? current.title : label,
    }));
  };

  const updateRecurrenceFrequency = (frequency: CalendarRecurrenceFrequency) => {
    setForm((current) => {
      const start = current.startDate ? new Date(current.startDate) : new Date();
      return {
        ...current,
        recurrenceFrequency: frequency,
        recurrenceDaysOfWeek: frequency === "weekly" && current.recurrenceDaysOfWeek.length === 0 ? [start.getDay()] : current.recurrenceDaysOfWeek,
        recurrenceInterval: Math.max(1, current.recurrenceInterval || 1),
      };
    });
  };

  const toggleWeekday = (day: number) => {
    setForm((current) => {
      const set = new Set(current.recurrenceDaysOfWeek);
      if (set.has(day)) set.delete(day);
      else set.add(day);
      return { ...current, recurrenceDaysOfWeek: Array.from(set).sort() };
    });
  };

  const toggleAudienceTarget = (key: string) => {
    setForm((current) => {
      const selected = new Set(current.audienceTargetKeys);
      if (selected.has(key)) selected.delete(key);
      else selected.add(key);
      return { ...current, audienceTargetKeys: Array.from(selected).sort() };
    });
  };

  const saveEvent = useMutation({
    mutationFn: async () => {
      if (!churchId) throw new Error("No church context");
      if (form.audienceMode === "specific_groups" && form.audienceTargetKeys.length === 0) {
        throw new Error(t("church_admin.events.audience.group_required"));
      }
      if (form.endDate && new Date(form.endDate) < new Date(form.startDate)) {
        throw new Error("End date cannot be before the start date.");
      }
      const registration = normalizePaidEventConfig({
        registrationRequired: form.registrationRequired,
        registrationType: form.registrationType,
        registrationFee: form.registrationFee,
        registrationDeadline: form.registrationDeadline,
        registrationCapacity: form.registrationCapacity,
      });
      const registrationErrors = validatePaidEventConfig(registration);
      if (registrationErrors.length) {
        throw new Error(t(`church_admin.events.registration.errors.${registrationErrors[0]}`));
      }
      const recurrence = normalizeRecurrenceRule({
        frequency: form.recurrenceFrequency,
        interval: form.recurrenceInterval,
        daysOfWeek: form.recurrenceFrequency === "weekly" ? form.recurrenceDaysOfWeek : null,
        endDate: form.recurrenceFrequency !== "none" && form.recurrenceEndMode === "date" ? form.recurrenceEndDate || null : null,
        count: form.recurrenceFrequency !== "none" && form.recurrenceEndMode === "count" ? form.recurrenceCount : null,
        monthlyPattern: form.recurrenceFrequency === "monthly" ? form.recurrenceMonthlyPattern : "day_of_month",
        monthlyWeek: form.recurrenceMonthlyPattern === "nth_weekday" && form.startDate ? Math.floor((new Date(form.startDate).getDate() - 1) / 7) + 1 : null,
        monthlyWeekday: form.recurrenceMonthlyPattern === "nth_weekday" && form.startDate ? new Date(form.startDate).getDay() : null,
      });
      const recurrenceErrors = validateRecurrenceRule({
        id: form.id ?? "new",
        startsAt: form.startDate,
        endsAt: form.endDate || null,
        recurrence,
      });
      if (recurrenceErrors.length) {
        throw new Error(t(`church_admin.events.recurrence.errors.${recurrenceErrors[0]}`));
      }

      const payload = {
        title: form.title,
        description: form.description || null,
        start_date: form.startDate,
        end_date: form.endDate || null,
        location: form.location || null,
        event_type: form.eventType,
        ministry: form.ministry.trim() || null,
        visibility: form.visibility,
        audience_mode: form.audienceMode,
        recurrence_frequency: recurrence.frequency,
        recurrence_interval: recurrence.frequency === "none" ? 1 : recurrence.interval,
        recurrence_days_of_week: recurrence.frequency === "weekly" ? recurrence.daysOfWeek : null,
        recurrence_end_date: recurrence.frequency === "none" ? null : recurrence.endDate,
        recurrence_count: recurrence.frequency === "none" ? null : recurrence.count,
        recurrence_monthly_pattern: recurrence.frequency === "monthly" ? recurrence.monthlyPattern : "day_of_month",
        recurrence_monthly_week: recurrence.frequency === "monthly" && recurrence.monthlyPattern === "nth_weekday" ? recurrence.monthlyWeek : null,
        recurrence_monthly_weekday: recurrence.frequency === "monthly" && recurrence.monthlyPattern === "nth_weekday" ? recurrence.monthlyWeekday : null,
        registration_required: registration.registrationRequired,
        registration_type: registration.registrationType,
        registration_fee: registration.fee,
        registration_currency: registration.currency,
        registration_deadline: registration.deadline,
        registration_capacity: registration.capacity,
        payment_required_for_confirmation: registration.isPaid,
      };

      let eventId = form.id;
      if (form.id) {
        const { error } = await supabase
          .from("events")
          .update(payload)
          .eq("id", form.id)
          .eq("church_id", churchId);

        if (error) throw error;
      } else {
        const { data, error } = await supabase.from("events").insert({
          church_id: churchId,
          created_by: user?.id || null,
          ...payload,
        }).select("id").single();

        if (error) throw error;
        eventId = data.id;
      }

      if (!eventId) throw new Error("Event could not be saved.");

      const deleteResult = await supabase
        .from("event_audience_targets" as never)
        .delete()
        .eq("event_id", eventId as never);
      if (deleteResult.error) throw deleteResult.error;

      if (form.audienceMode === "specific_groups") {
        const targets = form.audienceTargetKeys
          .map((key) => audienceOptionByKey.get(key))
          .filter((option): option is AudienceTargetOption => Boolean(option))
          .map((option) => ({
            church_id: churchId,
            event_id: eventId,
            ministry_id: option.type === "ministry" ? option.id : null,
            community_id: option.type === "community" ? option.id : null,
          }));

        if (targets.length === 0) throw new Error(t("church_admin.events.audience.group_required"));
        const insertTargetsResult = await supabase
          .from("event_audience_targets" as never)
          .insert(targets as never);
        if (insertTargetsResult.error) throw insertTargetsResult.error;
      }

      if (eventRequestId && !form.id) {
        const { error } = await supabase
          .from("event_requests")
          .update({
            converted_event_id: eventId,
            converted_at: new Date().toISOString(),
            status: "converted",
          })
          .eq("id", eventRequestId)
          .eq("church_id", churchId)
          .is("converted_event_id", null);

        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["events"] });
      queryClient.invalidateQueries({ queryKey: ["event-audience-targets"] });
      queryClient.invalidateQueries({ queryKey: ["portal-events"] });
      queryClient.invalidateQueries({ queryKey: ["parish-calendar-events"] });
      toast({ title: form.id ? t("church_admin.events.recurrence.series_updated") : t("church_admin.events.recurrence.event_created") });
      setDialogOpen(false);
      resetForm();
      if (eventRequestId) setSearchParams({});
    },
    onError: (err: Error) =>
      toast({
        title: "Event could not be saved",
        description: getEventMutationError(err),
        variant: "destructive",
      }),
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
      queryClient.invalidateQueries({ queryKey: ["parish-calendar-events"] });
      toast({ title: event.archived_at ? "Event restored" : event.recurrence_frequency && event.recurrence_frequency !== "none" ? t("church_admin.events.recurrence.series_archived") : "Event archived" });
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

  const reviewPayment = useMutation({
    mutationFn: async ({ paymentId, approve }: { paymentId: string; approve: boolean }) => {
      const { data, error } = await supabase.rpc("review_event_registration_payment" as never, {
        _payment_id: paymentId,
        _approve: approve,
        _reason: null,
      } as never);
      if (error) throw error;
      const result = data as { success?: boolean; error?: string } | null;
      if (!result?.success) throw new Error(result?.error || t("church_admin.events.registration.review_failed"));
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["event-registration-payments"] });
      queryClient.invalidateQueries({ queryKey: ["event-attendance-summary"] });
      queryClient.invalidateQueries({ queryKey: ["portal-event-attendances"] });
      toast({ title: t("church_admin.events.registration.review_saved") });
    },
    onError: (err: Error) =>
      toast({
        title: t("church_admin.events.registration.review_failed"),
        description: err.message,
        variant: "destructive",
      }),
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
      queryClient.invalidateQueries({ queryKey: ["parish-calendar-events"] });
      toast({ title: event.recurrence_frequency && event.recurrence_frequency !== "none" ? t("church_admin.events.recurrence.series_deleted") : "Event deleted" });
    },
    onError: (err: Error) =>
      toast({
        title: "Event could not be deleted",
        description: getEventMutationError(err),
        variant: "destructive",
      }),
  });

  const statusColor = (status: string) => {
    if (status === "upcoming") return "bg-primary/20 text-primary border-primary/30";
    if (status === "ongoing") return "bg-success/20 text-success border-success/30";
    if (status === "completed") return "bg-muted text-muted-foreground";
    return "bg-destructive/20 text-destructive border-destructive/30";
  };

  const getAudienceLabel = (mode: ParishEventAudienceMode | null | undefined, targetKeys: string[]) => {
    if (mode === "specific_groups") {
      const names = targetKeys
        .map((key) => audienceOptionByKey.get(key)?.name)
        .filter(Boolean);
      return names.length > 0 ? names.join(", ") : t("church_admin.events.audience.specific_groups");
    }
    if (mode === "all_members") return t("church_admin.events.audience.all_members");
    return t("church_admin.events.audience.everyone");
  };

  const EventCard = ({ event }: { event: EventRecord }) => {
    const attendance = attendanceByEvent.get(event.id) ?? { count: 0, names: [], pendingPayment: 0, paid: 0, amountDue: 0 };
    const pendingPayments = pendingPaymentsByEvent.get(event.id) ?? [];
    const audienceTargetKeys = audienceTargetsByEvent.get(event.id) ?? [];
    const audienceLabel = getAudienceLabel(event.audience_mode, audienceTargetKeys);
    const recurrenceDescription = event.recurrence_frequency && event.recurrence_frequency !== "none"
      ? describeRecurrenceRule({
          frequency: event.recurrence_frequency,
          interval: event.recurrence_interval ?? 1,
          daysOfWeek: event.recurrence_days_of_week,
          endDate: event.recurrence_end_date,
          count: event.recurrence_count,
          monthlyPattern: event.recurrence_monthly_pattern,
          monthlyWeek: event.recurrence_monthly_week,
          monthlyWeekday: event.recurrence_monthly_weekday,
        })
      : null;
    const registration = normalizePaidEventConfig({
      registrationRequired: event.registration_required,
      registrationType: event.registration_type,
      registrationFee: event.registration_fee,
      registrationCurrency: event.registration_currency,
      registrationDeadline: event.registration_deadline,
      registrationCapacity: event.registration_capacity,
      registeredCount: attendance.count,
    });

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
            {recurrenceDescription && (
              <span className="flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                {recurrenceDescription}
              </span>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <Badge variant="outline" className="rounded-full">
              {t("church_admin.events.audience.audience")}: {audienceLabel}
            </Badge>
            {registration.registrationRequired ? (
              <Badge variant="outline" className="rounded-full border-primary/30 text-primary">
                {registration.isPaid
                  ? t("church_admin.events.registration.paid_badge", { amount: formatTZS(registration.fee) })
                  : t("church_admin.events.registration.free_badge")}
              </Badge>
            ) : null}
          </div>

          <div className="rounded-lg border border-primary/10 bg-primary/5 p-3">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Users className="h-4 w-4 text-primary" />
              {attendance.count} attending
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Members who tapped yes in the portal are registered automatically.
            </p>
            {registration.registrationRequired ? (
              <div className="mt-2 grid gap-2 text-xs text-muted-foreground sm:grid-cols-3">
                <span>{t("church_admin.events.registration.registered")}: {attendance.count}</span>
                <span>{t("church_admin.events.registration.pending_payment")}: {attendance.pendingPayment}</span>
                <span>{t("church_admin.events.registration.capacity")}: {registration.capacity ?? t("church_admin.events.registration.unlimited")}</span>
              </div>
            ) : null}
            {attendance.names.length > 0 && (
              <p className="mt-2 text-xs text-muted-foreground line-clamp-2">
                {attendance.names.slice(0, 3).join(", ")}
                {attendance.names.length > 3 ? ` +${attendance.names.length - 3} more` : ""}
              </p>
            )}
            {pendingPayments.length > 0 ? (
              <div className="mt-3 space-y-2">
                <p className="text-xs font-medium">{t("church_admin.events.registration.pending_review")}</p>
                {pendingPayments.slice(0, 3).map((payment) => (
                  <div key={payment.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border/70 bg-background/70 p-2 text-xs">
                    <span className="text-muted-foreground">
                      {payment.members?.full_name || t("members")} · {formatTZS(Number(payment.amount ?? 0))}
                      {payment.transaction_reference ? ` · ${payment.transaction_reference}` : ""}
                    </span>
                    <span className="flex gap-1">
                      <Button size="sm" variant="outline" onClick={() => reviewPayment.mutate({ paymentId: payment.id, approve: true })} disabled={reviewPayment.isPending}>
                        <CheckCircle2 className="mr-1 h-3 w-3" />
                        {t("church_admin.events.registration.approve")}
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => reviewPayment.mutate({ paymentId: payment.id, approve: false })} disabled={reviewPayment.isPending}>
                        <XCircle className="mr-1 h-3 w-3" />
                        {t("church_admin.events.registration.reject")}
                      </Button>
                    </span>
                  </div>
                ))}
              </div>
            ) : null}
          </div>

          <div className="flex flex-wrap gap-2 pt-1">
            <Button asChild variant="outline" size="sm">
              <Link to={`/church-admin/events/${event.id}/registrations`}>
                <ClipboardList className="mr-2 h-3.5 w-3.5" />
                {t("church_admin.events.roster.view_registrations")}
              </Link>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                openWhatsAppShare(
                  buildEventShareMessage({
                    churchName: church?.name,
                    title: event.title,
                    dateTime: new Date(event.start_date).toLocaleString(),
                    location: event.location,
                  }),
                )
              }
            >
              <MessageCircle className="mr-2 h-3.5 w-3.5" />
              Share to WhatsApp
            </Button>
            <Button variant="outline" size="sm" onClick={() => openEditDialog(event)}>
              <Pencil className="mr-2 h-3.5 w-3.5" />
              {event.recurrence_frequency && event.recurrence_frequency !== "none" ? t("church_admin.events.recurrence.edit_series") : "Edit"}
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
              {event.recurrence_frequency && event.recurrence_frequency !== "none" ? t("church_admin.events.recurrence.delete_series") : "Delete"}
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
                <Label>{t("church_admin.events.taxonomy.prompt")}</Label>
                <Select value={form.eventType} onValueChange={(value) => updateEventType(value as ParishCalendarEventType)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {taxonomyByGroup.map((group) => (
                      <SelectGroup key={group.id}>
                        <SelectLabel className="px-2 py-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                          {t(group.labelKey)}
                        </SelectLabel>
                        {group.items.map((item) => (
                          <SelectItem key={`${group.id}-${item.id}`} value={item.id}>
                            {t(item.labelKey)}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  {selectedTaxonomy?.sacramentalClassification
                    ? t("church_admin.events.taxonomy.sacramental_boundary_hint")
                    : t("church_admin.events.taxonomy.classification_hint")}
                </p>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>{t("church_admin.events.taxonomy.service_label")}</Label>
                  <Input
                    value={form.ministry}
                    onChange={(e) => setForm((current) => ({ ...current, ministry: e.target.value }))}
                    placeholder={t("church_admin.events.taxonomy.service_placeholder")}
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t("member_portal.parish_life.visibility_label")}</Label>
                  <Select value={form.visibility} onValueChange={(value) => setForm((current) => ({ ...current, visibility: value as ParishCalendarVisibility }))}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="public">{t("member_portal.parish_life.visibility.public")}</SelectItem>
                      <SelectItem value="member">{t("member_portal.parish_life.visibility.member")}</SelectItem>
                      <SelectItem value="pastoral">{t("member_portal.parish_life.visibility.pastoral")}</SelectItem>
                      <SelectItem value="admin">{t("member_portal.parish_life.visibility.admin")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-3 rounded-lg border border-border/70 bg-card/60 p-3">
                <div className="space-y-2">
                  <Label>{t("church_admin.events.audience.who_for")}</Label>
                  <Select
                    value={form.audienceMode}
                    onValueChange={(value) =>
                      setForm((current) => ({
                        ...current,
                        audienceMode: value as ParishEventAudienceMode,
                        audienceTargetKeys: value === "specific_groups" ? current.audienceTargetKeys : [],
                      }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="everyone">{t("church_admin.events.audience.everyone")}</SelectItem>
                      <SelectItem value="all_members">{t("church_admin.events.audience.all_members")}</SelectItem>
                      <SelectItem value="specific_groups">{t("church_admin.events.audience.specific_groups")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {form.audienceMode === "specific_groups" ? (
                  <div className="space-y-2">
                    <Label>{t("church_admin.events.audience.select_groups")}</Label>
                    <Input
                      value={audienceSearch}
                      onChange={(event) => setAudienceSearch(event.target.value)}
                      placeholder={t("church_admin.events.audience.search_groups")}
                    />
                    <div className="max-h-44 space-y-2 overflow-y-auto rounded-lg border border-border/70 bg-background/60 p-2">
                      {filteredAudienceOptions.length === 0 ? (
                        <p className="px-2 py-3 text-sm text-muted-foreground">{t("church_admin.events.audience.no_groups_found")}</p>
                      ) : (
                        filteredAudienceOptions.map((option) => {
                          const selected = form.audienceTargetKeys.includes(option.key);
                          return (
                            <Button
                              key={option.key}
                              type="button"
                              variant={selected ? "default" : "outline"}
                              size="sm"
                              className="mr-2 mb-2"
                              onClick={() => toggleAudienceTarget(option.key)}
                            >
                              {selected ? `${t("church_admin.events.audience.selected")} ` : ""}
                              {option.name}
                            </Button>
                          );
                        })
                      )}
                    </div>
                    {form.audienceTargetKeys.length === 0 ? (
                      <p className="text-xs text-destructive">{t("church_admin.events.audience.group_required")}</p>
                    ) : (
                      <p className="text-xs text-muted-foreground">
                        {t("church_admin.events.audience.visible_to")}:{" "}
                        {form.audienceTargetKeys
                          .map((key) => audienceOptionByKey.get(key)?.name)
                          .filter(Boolean)
                          .join(", ")}
                      </p>
                    )}
                  </div>
                ) : null}
              </div>
              {selectedTaxonomy?.supportsRecurrence ? (
                <div className="space-y-3 rounded-lg border border-primary/20 bg-primary/5 p-3">
                  <div className="space-y-2">
                    <Label>{t("church_admin.events.recurrence.schedule")}</Label>
                    <Select value={form.recurrenceFrequency} onValueChange={(value) => updateRecurrenceFrequency(value as CalendarRecurrenceFrequency)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">{t("church_admin.events.recurrence.one_time")}</SelectItem>
                        <SelectItem value="daily">{t("church_admin.events.recurrence.daily")}</SelectItem>
                        <SelectItem value="weekly">{t("church_admin.events.recurrence.weekly")}</SelectItem>
                        <SelectItem value="monthly">{t("church_admin.events.recurrence.monthly")}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {form.recurrenceFrequency !== "none" && (
                    <div className="grid gap-3">
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div className="space-y-2">
                          <Label>{t("church_admin.events.recurrence.repeat_every")}</Label>
                          <Input
                            type="number"
                            min={1}
                            max={366}
                            value={form.recurrenceInterval}
                            onChange={(e) => setForm((current) => ({ ...current, recurrenceInterval: Math.max(1, Number(e.target.value) || 1) }))}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>{t("church_admin.events.recurrence.ends")}</Label>
                          <Select value={form.recurrenceEndMode} onValueChange={(value) => setForm((current) => ({ ...current, recurrenceEndMode: value as CalendarRecurrenceEndMode }))}>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="date">{t("church_admin.events.recurrence.end_on_date")}</SelectItem>
                              <SelectItem value="count">{t("church_admin.events.recurrence.end_after_count")}</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      {form.recurrenceFrequency === "weekly" && (
                        <div className="space-y-2">
                          <Label>{t("church_admin.events.recurrence.days_of_week")}</Label>
                          <div className="flex flex-wrap gap-2">
                            {WEEKDAY_OPTIONS.map((day) => (
                              <Button
                                key={day.value}
                                type="button"
                                size="sm"
                                variant={form.recurrenceDaysOfWeek.includes(day.value) ? "default" : "outline"}
                                onClick={() => toggleWeekday(day.value)}
                              >
                                {t(`church_admin.events.recurrence.weekdays.${day.key}`, day.label)}
                              </Button>
                            ))}
                          </div>
                        </div>
                      )}
                      {form.recurrenceFrequency === "monthly" && (
                        <div className="space-y-2">
                          <Label>{t("church_admin.events.recurrence.monthly_pattern")}</Label>
                          <Select value={form.recurrenceMonthlyPattern} onValueChange={(value) => setForm((current) => ({ ...current, recurrenceMonthlyPattern: value as CalendarMonthlyPattern }))}>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="day_of_month">{t("church_admin.events.recurrence.same_day_of_month")}</SelectItem>
                              <SelectItem value="nth_weekday">{t("church_admin.events.recurrence.nth_weekday")}</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      )}
                      {form.recurrenceEndMode === "date" ? (
                        <div className="space-y-2">
                          <Label>{t("church_admin.events.recurrence.end_date")}</Label>
                          <Input
                            type="date"
                            value={form.recurrenceEndDate}
                            onChange={(e) => setForm((current) => ({ ...current, recurrenceEndDate: e.target.value }))}
                          />
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <Label>{t("church_admin.events.recurrence.occurrence_count")}</Label>
                          <Input
                            type="number"
                            min={1}
                            max={1000}
                            value={form.recurrenceCount}
                            onChange={(e) => setForm((current) => ({ ...current, recurrenceCount: Math.max(1, Number(e.target.value) || 1) }))}
                          />
                        </div>
                      )}
                      <p className="text-xs text-muted-foreground">{describeRecurrenceRule({
                        frequency: form.recurrenceFrequency,
                        interval: form.recurrenceInterval,
                        daysOfWeek: form.recurrenceDaysOfWeek,
                        endDate: form.recurrenceEndDate,
                        count: form.recurrenceEndMode === "count" ? form.recurrenceCount : null,
                        monthlyPattern: form.recurrenceMonthlyPattern,
                      })}</p>
                    </div>
                  )}
                </div>
              ) : null}
              <div className="space-y-3 rounded-lg border border-border/70 bg-card/60 p-3">
                <div className="space-y-2">
                  <Label>{t("church_admin.events.registration.mode")}</Label>
                  <Select
                    value={form.registrationRequired ? form.registrationType : "none"}
                    onValueChange={(value) =>
                      setForm((current) => ({
                        ...current,
                        registrationRequired: value !== "none",
                        registrationType: value === "paid" ? "paid" : "free",
                        registrationFee: value === "paid" ? current.registrationFee : "",
                      }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">{t("church_admin.events.registration.none")}</SelectItem>
                      <SelectItem value="free">{t("church_admin.events.registration.free")}</SelectItem>
                      <SelectItem value="paid">{t("church_admin.events.registration.paid")}</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">{t("church_admin.events.registration.series_hint")}</p>
                </div>
                {form.registrationRequired ? (
                  <div className="grid gap-3 sm:grid-cols-3">
                    {form.registrationType === "paid" ? (
                      <div className="space-y-2">
                        <Label>{t("church_admin.events.registration.fee_tzs")}</Label>
                        <Input
                          type="number"
                          min={1}
                          value={form.registrationFee}
                          onChange={(event) => setForm((current) => ({ ...current, registrationFee: event.target.value }))}
                          required
                        />
                      </div>
                    ) : null}
                    <div className="space-y-2">
                      <Label>{t("church_admin.events.registration.deadline")}</Label>
                      <Input
                        type="datetime-local"
                        value={form.registrationDeadline}
                        onChange={(event) => setForm((current) => ({ ...current, registrationDeadline: event.target.value }))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>{t("church_admin.events.registration.capacity")}</Label>
                      <Input
                        type="number"
                        min={1}
                        value={form.registrationCapacity}
                        onChange={(event) => setForm((current) => ({ ...current, registrationCapacity: event.target.value }))}
                        placeholder={t("church_admin.events.registration.unlimited")}
                      />
                    </div>
                  </div>
                ) : null}
              </div>
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

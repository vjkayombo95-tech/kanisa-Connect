import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarPlus, Check, Clock, Loader2, MessageSquare, Search, X } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { translateEventRequestType, translateStatus } from "@/lib/translation-helpers";
import { useTranslation } from "react-i18next";

const STATUS_FILTERS = ["all", "submitted", "under_review", "changes_requested", "approved", "rejected", "converted", "scheduled", "cancelled"];
const TYPE_FILTERS = ["all", "parish_event", "ministry_group_event", "special_mass_request", "venue_facility_request", "prayer_formation_event", "other"];

type ReviewStatus = "under_review" | "changes_requested" | "approved" | "rejected" | "converted" | "scheduled";

function statusColor(status: string) {
  if (status === "approved") return "bg-emerald-500/20 text-emerald-400 border-emerald-500/30";
  if (status === "rejected") return "bg-destructive/20 text-destructive border-destructive/30";
  if (status === "converted" || status === "scheduled") return "bg-sky-500/20 text-sky-300 border-sky-500/30";
  if (status === "changes_requested") return "bg-orange-500/20 text-orange-300 border-orange-500/30";
  return "bg-amber-500/20 text-amber-400 border-amber-500/30";
}

function encodeRequestParams(request: any) {
  const params = new URLSearchParams({
    eventRequestId: request.id,
    title: request.title || "",
    description: request.description || "",
    date: request.preferred_date || "",
    startTime: request.preferred_start_time || "",
    endTime: request.preferred_end_time || "",
    location: request.location_preference || "",
    requestType: request.request_type || "",
  });
  return params.toString();
}

export default function EventRequestsPage() {
  const { churchId, user } = useAuth();
  const { toast } = useToast();
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [notesById, setNotesById] = useState<Record<string, string>>({});

  const { data: requests = [], isLoading } = useQuery({
    queryKey: ["event-requests", "admin", churchId],
    queryFn: async () => {
      if (!churchId) return [];
      const { data, error } = await supabase
        .from("event_requests")
        .select(`
          *,
          members(full_name, email),
          ministries(name),
          communities(name)
        `)
        .eq("church_id", churchId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!churchId,
  });

  const filteredRequests = useMemo(() => {
    const loweredSearch = search.trim().toLowerCase();
    return requests.filter((request: any) => {
      const matchesStatus = statusFilter === "all" || request.status === statusFilter;
      const matchesType = typeFilter === "all" || request.request_type === typeFilter;
      const haystack = [
        request.title,
        request.description,
        request.requester_name,
        request.members?.full_name,
        request.ministries?.name,
        request.communities?.name,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return matchesStatus && matchesType && (!loweredSearch || haystack.includes(loweredSearch));
    });
  }, [requests, search, statusFilter, typeFilter]);

  const updateRequest = useMutation({
    mutationFn: async ({ id, status, requireNote }: { id: string; status: ReviewStatus; requireNote?: boolean }) => {
      if (!churchId) throw new Error(t("event_requests_admin.error_missing_church"));
      const adminNote = notesById[id]?.trim() || null;
      if (requireNote && !adminNote) throw new Error(t("event_requests_admin.error_note_required"));

      const { data, error } = await supabase
        .from("event_requests")
        .update({
          status,
          admin_notes: adminNote,
          reviewed_by: user?.id ?? null,
          reviewed_at: new Date().toISOString(),
        })
        .eq("id", id)
        .eq("church_id", churchId)
        .select("id, status");

      if (error) throw error;
      if (!data?.length) throw new Error(t("event_requests_admin.error_update_blocked"));
      if (data.length > 1) throw new Error(t("event_requests_admin.error_multiple_rows"));
    },
    onSuccess: async (_, { status }) => {
      await queryClient.invalidateQueries({ queryKey: ["event-requests"] });
      toast({ title: t("event_requests_admin.status_updated", { status: translateStatus(t, status).toLowerCase() }) });
    },
    onError: (error: Error) => toast({ title: t("common.error"), description: error.message, variant: "destructive" }),
  });

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold font-serif">{t("event_requests_admin.page_title")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("event_requests_admin.page_description")}</p>
      </div>

      <Card className="glass-card">
        <CardContent className="grid gap-4 p-4 md:grid-cols-[1fr_180px_220px]">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input className="pl-9" value={search} onChange={(event) => setSearch(event.target.value)} placeholder={t("event_requests_admin.search_placeholder")} />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {STATUS_FILTERS.map((status) => (
                <SelectItem key={status} value={status}>{status === "all" ? t("event_requests_admin.all_statuses") : translateStatus(t, status)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {TYPE_FILTERS.map((type) => (
                <SelectItem key={type} value={type}>{type === "all" ? t("event_requests_admin.all_types") : translateEventRequestType(t, type)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {isLoading ? (
        <Card className="glass-card"><CardContent className="py-12 text-center text-muted-foreground"><Loader2 className="mx-auto h-5 w-5 animate-spin" /></CardContent></Card>
      ) : filteredRequests.length === 0 ? (
        <Card className="glass-card">
          <CardContent className="py-12 text-center text-muted-foreground">
            <CalendarPlus className="mx-auto mb-3 h-10 w-10 text-muted-foreground/30" />
            {t("event_requests_admin.empty")}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {filteredRequests.map((request: any) => {
            const isMassRequest = request.request_type === "special_mass_request";
            const converted = request.converted_event_id || request.converted_mass_event_id || request.status === "converted" || request.status === "scheduled";
            const memberName = request.members?.full_name || request.requester_name || t("common.member");
            return (
              <Card key={request.id} className="glass-card">
                <CardContent className="space-y-4 p-4">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="text-lg font-semibold">{request.title || translateEventRequestType(t, request.request_type)}</h2>
                        <Badge variant="outline" className={statusColor(request.status)}>{translateStatus(t, request.status)}</Badge>
                      </div>
                      <p className="mt-1 text-sm text-muted-foreground">{memberName} - {translateEventRequestType(t, request.request_type)}</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button size="sm" variant="outline" disabled={updateRequest.isPending || request.status === "under_review"} onClick={() => updateRequest.mutate({ id: request.id, status: "under_review" })}>
                        <Clock className="mr-2 h-4 w-4" />{t("event_requests_admin.mark_under_review")}
                      </Button>
                      <Button size="sm" variant="outline" disabled={updateRequest.isPending} onClick={() => updateRequest.mutate({ id: request.id, status: "approved" })}>
                        <Check className="mr-2 h-4 w-4" />{t("event_requests_admin.approve")}
                      </Button>
                      <Button size="sm" variant="outline" disabled={updateRequest.isPending} onClick={() => updateRequest.mutate({ id: request.id, status: "changes_requested", requireNote: true })}>
                        <MessageSquare className="mr-2 h-4 w-4" />{t("event_requests_admin.request_changes")}
                      </Button>
                      <Button size="sm" variant="outline" className="text-destructive" disabled={updateRequest.isPending} onClick={() => updateRequest.mutate({ id: request.id, status: "rejected", requireNote: true })}>
                        <X className="mr-2 h-4 w-4" />{t("event_requests_admin.reject")}
                      </Button>
                    </div>
                  </div>

                  <div className="grid gap-3 text-sm text-muted-foreground md:grid-cols-3">
                    <span>{t("event_requests_admin.preferred_date")}: {request.preferred_date || t("common.not_assigned")}</span>
                    <span>{t("event_request.preferred_start_time")}: {request.preferred_start_time || t("common.not_assigned")}</span>
                    <span>{t("event_request.expected_attendance")}: {request.expected_attendance ?? t("common.not_assigned")}</span>
                    <span>{t("event_request.location_preference")}: {request.location_preference || t("common.not_assigned")}</span>
                    <span>{t("event_request.ministry")}: {request.ministries?.name || t("common.not_assigned")}</span>
                    <span>{t("event_request.community")}: {request.communities?.name || t("common.not_assigned")}</span>
                  </div>

                  <p className="whitespace-pre-wrap text-sm">{request.description}</p>
                  {request.additional_notes && <p className="whitespace-pre-wrap text-sm text-muted-foreground">{request.additional_notes}</p>}

                  <div className="grid gap-3 md:grid-cols-[1fr_auto]">
                    <div className="space-y-2">
                      <Label htmlFor={`note-${request.id}`}>{t("event_requests_admin.admin_note")}</Label>
                      <Textarea
                        id={`note-${request.id}`}
                        value={notesById[request.id] ?? request.admin_notes ?? ""}
                        onChange={(event) => setNotesById((current) => ({ ...current, [request.id]: event.target.value }))}
                        rows={2}
                      />
                    </div>
                    <div className="flex items-end gap-2">
                      {request.status === "approved" && !converted && (
                        <Button asChild>
                          <Link to={isMassRequest ? `/church-admin/mass-schedule?${encodeRequestParams(request)}` : `/church-admin/events?${encodeRequestParams(request)}`}>
                            {isMassRequest ? t("event_requests_admin.schedule_mass_from_request") : t("event_requests_admin.create_event_from_request")}
                          </Link>
                        </Button>
                      )}
                      {converted && <Badge variant="outline" className="h-9 px-3 py-2">{t("event_requests_admin.already_converted")}</Badge>}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

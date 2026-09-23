import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertCircle, CalendarPlus, Check, Loader2, RotateCw, X } from "lucide-react";
import { useTranslation } from "react-i18next";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { translateEventRequestType, translateStatus } from "@/lib/translation-helpers";

type EventRequestRow = {
  id: string;
  requester_name: string | null;
  requester_phone: string | null;
  request_type: string | null;
  type: string | null;
  description: string | null;
  preferred_date: string | null;
  status: string | null;
};

const NEW_STATUSES = new Set(["pending", "submitted"]);
const ACTIVE_STATUSES = new Set(["under_review", "approved", "changes_requested"]);
const DONE_STATUSES = new Set(["converted", "scheduled", "rejected", "cancelled"]);
const TABS = [
  { value: "new", labelKey: "event_requests_admin.new_tab", statuses: NEW_STATUSES, emptyKey: "event_requests_admin.empty_new" },
  { value: "active", labelKey: "event_requests_admin.active_tab", statuses: ACTIVE_STATUSES, emptyKey: "event_requests_admin.empty_active" },
  { value: "done", labelKey: "event_requests_admin.done_tab", statuses: DONE_STATUSES, emptyKey: "event_requests_admin.empty_done" },
] as const;

type TabValue = (typeof TABS)[number]["value"];

export default function EventRequestsPage() {
  const { churchId } = useAuth();
  const { toast } = useToast();
  const { t, i18n } = useTranslation();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<TabValue>("new");
  const [rejectRequest, setRejectRequest] = useState<EventRequestRow | null>(null);

  const { data: requests = [], isLoading, isError, isFetching, refetch } = useQuery({
    queryKey: ["event-requests", churchId],
    queryFn: async () => {
      if (!churchId) return [];
      const { data, error } = await supabase
        .from("event_requests")
        .select("*")
        .eq("church_id", churchId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return (data ?? []) as EventRequestRow[];
    },
    enabled: !!churchId,
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: "under_review" | "approved" | "rejected" | "converted" | "pending" }) => {
      if (!churchId) {
        throw new Error(t("event_requests_admin.error_missing_church"));
      }

      const { data, error } = await supabase
        .from("event_requests")
        .update({ status })
        .eq("id", id)
        .eq("church_id", churchId)
        .select("id, status");

      if (error) throw error;
      if (!data?.length) throw new Error(t("event_requests_admin.error_update_blocked"));
      if (data.length > 1) throw new Error(t("event_requests_admin.error_multiple_rows"));
    },
    onSuccess: (_, { status }) => {
      queryClient.invalidateQueries({ queryKey: ["event-requests"] });
      toast({ title: t("event_requests_admin.status_updated", { status: translateStatus(t, status).toLowerCase() }) });
    },
    onError: (err: Error) => toast({ title: t("event_requests_admin.update_error_title"), description: err.message, variant: "destructive" }),
  });

  const statusColor = (status: string | null) => {
    const value = status ?? "submitted";
    if (NEW_STATUSES.has(value)) return "bg-amber-500/20 text-amber-400 border-amber-500/30";
    if (value === "under_review" || value === "changes_requested") return "bg-blue-500/20 text-blue-400 border-blue-500/30";
    if (value === "approved") return "bg-emerald-500/20 text-emerald-400 border-emerald-500/30";
    if (value === "rejected") return "bg-destructive/20 text-destructive border-destructive/30";
    return "bg-muted text-muted-foreground border-border";
  };

  const serviceLabel = (request: EventRequestRow) => translateEventRequestType(t, request.type ?? request.request_type);
  const newCount = requests.filter((request) => NEW_STATUSES.has(request.status ?? "submitted")).length;
  const activeCount = requests.filter((request) => ACTIVE_STATUSES.has(request.status ?? "")).length;
  const doneCount = requests.filter((request) => DONE_STATUSES.has(request.status ?? "")).length;
  const tabCounts: Record<TabValue, number> = { new: newCount, active: activeCount, done: doneCount };
  const updatingId = updateStatus.isPending ? updateStatus.variables?.id : null;
  const formatDate = (date: string | null) => {
    if (!date) return t("event_requests_admin.no_date");
    const parsed = new Date(date);
    if (Number.isNaN(parsed.getTime())) return date;
    const locale = i18n.language === "sw" ? "sw-TZ" : "en-TZ";
    return new Intl.DateTimeFormat(locale, { day: "numeric", month: "short", year: "numeric" }).format(parsed);
  };
  const descriptionPreview = (description: string | null) => {
    if (!description?.trim()) return t("event_requests_admin.no_description");
    return description.length > 140 ? `${description.slice(0, 140).trim()}...` : description;
  };

  const renderActions = (request: EventRequestRow) => {
    const value = request.status ?? "submitted";
    const isUpdating = updatingId === request.id;

    if (NEW_STATUSES.has(value)) {
      return (
        <div className="grid gap-2 sm:grid-cols-2">
          <Button
            type="button"
            className="min-h-11 w-full"
            disabled={isUpdating}
            onClick={() => updateStatus.mutate({ id: request.id, status: "under_review" })}
          >
            {isUpdating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" /> : <Check className="mr-2 h-4 w-4" aria-hidden="true" />}
            {t("event_requests_admin.start_review")}
          </Button>
          <Button
            type="button"
            variant="outline"
            className="min-h-11 w-full border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
            disabled={isUpdating}
            onClick={() => setRejectRequest(request)}
          >
            <X className="mr-2 h-4 w-4" aria-hidden="true" />
            {t("event_requests_admin.reject_request")}
          </Button>
        </div>
      );
    }

    if (value === "under_review" || value === "approved") {
      return (
        <Button
          type="button"
          className="min-h-11 w-full sm:w-auto"
          disabled={isUpdating}
          onClick={() => updateStatus.mutate({ id: request.id, status: "converted" })}
        >
          {isUpdating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" /> : <Check className="mr-2 h-4 w-4" aria-hidden="true" />}
          {t("event_requests_admin.complete")}
        </Button>
      );
    }

    return null;
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold font-serif">{t("event_requests_admin.page_title")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("event_requests_admin.page_description")}</p>
      </div>

      {isError ? (
        <Card className="glass-card">
          <CardContent className="p-0">
            <div className="flex min-h-48 flex-col items-center justify-center gap-3 p-8 text-center">
              <AlertCircle className="h-10 w-10 text-destructive" aria-hidden="true" />
              <div>
                <h2 className="font-semibold">{t("event_requests_admin.error_title")}</h2>
                <p className="mt-1 text-sm text-muted-foreground">{t("event_requests_admin.error_description")}</p>
              </div>
              <Button type="button" variant="outline" onClick={() => void refetch()} disabled={isFetching}>
                <RotateCw className="mr-2 h-4 w-4" aria-hidden="true" />
                {isFetching ? t("event_requests_admin.retrying") : t("event_requests_admin.retry")}
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as TabValue)} className="space-y-4">
          <TabsList className="grid h-auto w-full grid-cols-1 gap-2 bg-transparent p-0 sm:grid-cols-3">
            {TABS.map((tab) => (
              <TabsTrigger
                key={tab.value}
                value={tab.value}
                className="min-h-14 justify-between rounded-lg border border-border bg-card px-4 py-3 text-left shadow-sm data-[state=active]:border-primary data-[state=active]:bg-primary/10 data-[state=active]:text-primary"
              >
                <span>{t(tab.labelKey)}</span>
                <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-bold text-foreground">{tabCounts[tab.value]}</span>
              </TabsTrigger>
            ))}
          </TabsList>

          {TABS.map((tab) => {
            const tabRequests = requests.filter((request) => tab.statuses.has(request.status ?? "submitted"));

            return (
              <TabsContent key={tab.value} value={tab.value} className="mt-0">
                {isLoading ? (
                  <Card className="glass-card">
                    <CardContent className="flex min-h-48 items-center justify-center gap-2 p-8 text-sm text-muted-foreground">
                      <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
                      {t("event_requests_admin.loading")}
                    </CardContent>
                  </Card>
                ) : tabRequests.length === 0 ? (
                  <Card className="glass-card">
                    <CardContent className="flex min-h-48 flex-col items-center justify-center gap-3 p-8 text-center text-sm text-muted-foreground">
                      <CalendarPlus className="h-10 w-10 text-muted-foreground/30" aria-hidden="true" />
                      <p>{t(tab.emptyKey)}</p>
                    </CardContent>
                  </Card>
                ) : (
                  <div className="space-y-3">
                    {tabRequests.map((request) => (
                      <Card key={request.id} className="glass-card overflow-hidden">
                        <CardContent className="space-y-4 p-4 sm:p-5">
                          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                            <div className="min-w-0">
                              <p className="break-words text-lg font-bold">{serviceLabel(request)}</p>
                              <p className="mt-1 break-words text-sm text-muted-foreground">
                                {request.requester_name || t("event_requests_admin.unknown_requester")}
                              </p>
                            </div>
                            <Badge variant="outline" className={statusColor(request.status)}>
                              {translateStatus(t, request.status ?? "submitted")}
                            </Badge>
                          </div>

                          <div className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
                            <div>
                              <p className="text-xs font-semibold uppercase text-muted-foreground">{t("event_requests_admin.phone")}</p>
                              <p className="mt-1 break-words">{request.requester_phone || t("event_requests_admin.no_phone")}</p>
                            </div>
                            <div>
                              <p className="text-xs font-semibold uppercase text-muted-foreground">{t("event_requests_admin.preferred_date")}</p>
                              <p className="mt-1">{formatDate(request.preferred_date)}</p>
                            </div>
                            <div className="sm:col-span-2 lg:col-span-1">
                              <p className="text-xs font-semibold uppercase text-muted-foreground">{t("event_requests_admin.description")}</p>
                              <p className="mt-1 break-words text-muted-foreground">{descriptionPreview(request.description)}</p>
                            </div>
                          </div>

                          <details className="rounded-lg border border-border bg-background/50 p-3">
                            <summary className="cursor-pointer text-sm font-semibold text-primary">{t("event_requests_admin.view_details")}</summary>
                            <div className="mt-3 space-y-3 text-sm">
                              <div>
                                <p className="text-xs font-semibold uppercase text-muted-foreground">{t("event_requests_admin.full_description")}</p>
                                <p className="mt-1 whitespace-pre-wrap break-words">{request.description?.trim() || t("event_requests_admin.no_description")}</p>
                              </div>
                              <div className="grid gap-3 sm:grid-cols-2">
                                <div>
                                  <p className="text-xs font-semibold uppercase text-muted-foreground">{t("event_requests_admin.requester")}</p>
                                  <p className="mt-1 break-words">{request.requester_name || t("event_requests_admin.unknown_requester")}</p>
                                </div>
                                <div>
                                  <p className="text-xs font-semibold uppercase text-muted-foreground">{t("event_requests_admin.type")}</p>
                                  <p className="mt-1 break-words">{serviceLabel(request)}</p>
                                </div>
                              </div>
                            </div>
                          </details>

                          {renderActions(request)}
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </TabsContent>
            );
          })}
        </Tabs>
      )}

      <AlertDialog open={!!rejectRequest} onOpenChange={(open) => !open && setRejectRequest(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("event_requests_admin.reject_confirm_title")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("event_requests_admin.reject_confirm_description", {
                service: rejectRequest ? serviceLabel(rejectRequest) : t("event_requests_admin.request"),
              })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={!!updatingId}>{t("event_requests_admin.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={!rejectRequest || !!updatingId}
              onClick={(event) => {
                if (!rejectRequest) return;
                event.preventDefault();
                updateStatus.mutate(
                  { id: rejectRequest.id, status: "rejected" },
                  { onSuccess: () => setRejectRequest(null) },
                );
              }}
            >
              {updatingId === rejectRequest?.id ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" /> : null}
              {t("event_requests_admin.reject_request")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

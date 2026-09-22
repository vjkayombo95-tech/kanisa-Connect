import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertCircle, CalendarPlus, Check, Loader2, RotateCw, X } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
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

export default function EventRequestsPage() {
  const { churchId } = useAuth();
  const { toast } = useToast();
  const { t } = useTranslation();
  const queryClient = useQueryClient();

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
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
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

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold font-serif">{t("event_requests_admin.page_title")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("event_requests_admin.page_description")}</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Card><CardContent className="p-4"><p className="text-sm text-muted-foreground">{t("event_requests_admin.new_tab")}</p><p className="mt-1 text-2xl font-bold">{newCount}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-sm text-muted-foreground">{t("event_requests_admin.active_tab")}</p><p className="mt-1 text-2xl font-bold">{activeCount}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-sm text-muted-foreground">{t("event_requests_admin.done_tab")}</p><p className="mt-1 text-2xl font-bold">{doneCount}</p></CardContent></Card>
      </div>

      <Card className="glass-card">
        <CardContent className="p-0">
          {isError ? (
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
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="border-border hover:bg-transparent">
                  <TableHead>{t("event_requests_admin.requester")}</TableHead>
                  <TableHead>{t("event_requests_admin.type")}</TableHead>
                  <TableHead>{t("event_requests_admin.phone")}</TableHead>
                  <TableHead>{t("event_requests_admin.description")}</TableHead>
                  <TableHead>{t("event_requests_admin.preferred_date")}</TableHead>
                  <TableHead>{t("event_requests_admin.status")}</TableHead>
                  <TableHead>{t("event_requests_admin.actions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="py-12 text-center text-muted-foreground">
                      <Loader2 className="mx-auto h-5 w-5 animate-spin" />
                    </TableCell>
                  </TableRow>
                ) : requests.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="py-12 text-center text-muted-foreground">
                      <CalendarPlus className="mx-auto mb-3 h-10 w-10 text-muted-foreground/30" />
                      {t("event_requests_admin.empty")}
                    </TableCell>
                  </TableRow>
                ) : requests.map((request) => (
                  <TableRow key={request.id} className="border-border">
                    <TableCell className="font-medium">{request.requester_name || "-"}</TableCell>
                    <TableCell>{serviceLabel(request)}</TableCell>
                    <TableCell className="text-muted-foreground">{request.requester_phone || "-"}</TableCell>
                    <TableCell className="max-w-[260px] truncate text-muted-foreground">{request.description || "-"}</TableCell>
                    <TableCell className="text-muted-foreground">{request.preferred_date ? new Date(request.preferred_date).toLocaleDateString() : "-"}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={statusColor(request.status)}>
                        {translateStatus(t, request.status ?? "submitted")}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {NEW_STATUSES.has(request.status ?? "submitted") ? (
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-primary"
                            disabled={updateStatus.isPending}
                            onClick={() => updateStatus.mutate({ id: request.id, status: "under_review" })}
                          >
                            <Check className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-destructive"
                            disabled={updateStatus.isPending}
                            onClick={() => updateStatus.mutate({ id: request.id, status: "rejected" })}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      ) : null}
                      {request.status === "under_review" || request.status === "approved" ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 text-xs"
                          disabled={updateStatus.isPending}
                          onClick={() => updateStatus.mutate({ id: request.id, status: "converted" })}
                        >
                          {t("event_requests_admin.complete")}
                        </Button>
                      ) : null}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

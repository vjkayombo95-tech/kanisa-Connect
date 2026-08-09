import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CalendarPlus, Check, X, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "react-i18next";
import { translateEventRequestType, translateStatus } from "@/lib/translation-helpers";

export default function EventRequestsPage() {
  const { churchId } = useAuth();
  const { toast } = useToast();
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const { data: requests = [], isLoading } = useQuery({
    queryKey: ["event-requests", churchId],
    queryFn: async () => {
      if (!churchId) return [];
      const { data, error } = await supabase
        .from("event_requests")
        .select("*")
        .eq("church_id", churchId)
        .order("created_at", { ascending: false });
      if (error) return [];
      return data ?? [];
    },
    enabled: !!churchId,
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: "approved" | "rejected" | "completed" | "pending" }) => {
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
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const statusColor = (s: string) => {
    if (s === "approved") return "bg-emerald-500/20 text-emerald-400 border-emerald-500/30";
    if (s === "rejected") return "bg-destructive/20 text-destructive border-destructive/30";
    if (s === "completed") return "bg-muted text-muted-foreground border-border";
    return "bg-amber-500/20 text-amber-400 border-amber-500/30";
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold font-serif">{t("event_requests_admin.page_title")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("event_requests_admin.page_description")}</p>
      </div>

      <Card className="glass-card">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="border-border hover:bg-transparent">
                <TableHead>{t("event_requests_admin.requester")}</TableHead>
                <TableHead>{t("event_requests_admin.type")}</TableHead>
                <TableHead>{t("event_requests_admin.description")}</TableHead>
                <TableHead>{t("event_requests_admin.preferred_date")}</TableHead>
                <TableHead>{t("event_requests_admin.status")}</TableHead>
                <TableHead>{t("event_requests_admin.actions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={6} className="py-12 text-center text-muted-foreground">
                    <Loader2 className="mx-auto h-5 w-5 animate-spin" />
                  </TableCell>
                </TableRow>
              ) : requests.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="py-12 text-center text-muted-foreground">
                    <CalendarPlus className="mx-auto mb-3 h-10 w-10 text-muted-foreground/30" />
                    {t("event_requests_admin.empty")}
                  </TableCell>
                </TableRow>
              ) : requests.map((r: any) => (
                <TableRow key={r.id} className="border-border">
                  <TableCell className="font-medium">{r.requester_name}</TableCell>
                  <TableCell className="capitalize">{translateEventRequestType(t, r.request_type)}</TableCell>
                  <TableCell className="max-w-[200px] truncate text-muted-foreground">{r.description || "—"}</TableCell>
                  <TableCell className="text-muted-foreground">{r.preferred_date ? new Date(r.preferred_date).toLocaleDateString() : "—"}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className={statusColor(r.status)}>
                      {translateStatus(t, r.status)}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {r.status === "pending" && (
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-primary"
                          disabled={updateStatus.isPending}
                          onClick={() => updateStatus.mutate({ id: r.id, status: "approved" })}
                        >
                          <Check className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-destructive"
                          disabled={updateStatus.isPending}
                          onClick={() => updateStatus.mutate({ id: r.id, status: "rejected" })}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    )}
                    {r.status === "approved" && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs"
                        disabled={updateStatus.isPending}
                        onClick={() => updateStatus.mutate({ id: r.id, status: "completed" })}
                      >
                        {t("event_requests_admin.complete")}
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Flame } from "lucide-react";
import { formatTZS } from "@/lib/currency";
import { useToast } from "@/hooks/use-toast";
import { MASS_INTENTION_SELECT, mapMassIntentionRecord, type MassIntentionWithMember } from "@/lib/member-linked-requests";
import { useTranslation } from "react-i18next";
import { translateMassIntentionType, translateStatus } from "@/lib/translation-helpers";

export default function MassIntentionsPage() {
  const { churchId } = useAuth();
  const { toast } = useToast();
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const { data: intentions = [], isLoading } = useQuery({
    queryKey: ["mass-intentions", churchId],
    queryFn: async () => {
      if (!churchId) return [];
      const { data, error } = await supabase
        .from("mass_intentions")
        .select(MASS_INTENTION_SELECT)
        .eq("church_id", churchId)
        .order("created_at", { ascending: false });

      if (error) {
        throw error;
      }

      return (data ?? []).map((row: any) => mapMassIntentionRecord(row as MassIntentionWithMember));
    },
    enabled: !!churchId,
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: "approved" | "rejected" }) => {
      const { data, error } = await supabase
        .from("mass_intentions")
        .update({ status })
        .eq("id", id)
        .select("id, status");

      if (error) throw error;
      if (!data?.length) {
        throw new Error("Mass intention update was blocked or the row was not found.");
      }
      if (data.length > 1) {
        throw new Error("Mass intention update returned multiple rows unexpectedly.");
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["mass-intentions"] });
      queryClient.invalidateQueries({ queryKey: ["portal-mass-intentions"] });
      queryClient.invalidateQueries({ queryKey: ["my-mass-intentions"] });
      queryClient.invalidateQueries({ queryKey: ["my-mass-intentions-dashboard"] });
      toast({ title: t("mass_intentions_admin.status_updated") });
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const pendingIntentions = intentions.filter((intention) => intention.status === "pending");
  const reviewedIntentions = intentions.filter((intention) => intention.status === "approved" || intention.status === "rejected");

  const statusColor = (status: string) => {
    if (status === "approved") return "bg-success/20 text-success border-success/30";
    if (status === "pending") return "bg-primary/20 text-primary border-primary/30";
    return "bg-destructive/10 text-destructive border-destructive/20";
  };

  const renderList = (items: MassIntentionWithMember[]) =>
    items.length === 0 ? (
      <Card className="glass-card">
        <CardContent className="py-12 text-center text-muted-foreground">
          <Flame className="mx-auto mb-3 h-10 w-10 text-muted-foreground/30" />
          {t("mass_intentions_admin.empty_category")}
        </CardContent>
      </Card>
    ) : (
      <div className="space-y-3">
        {items.map((intention) => (
          <Card key={intention.id} className="glass-card">
            <CardContent className="p-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="mb-1 flex items-center gap-2">
                    <p className="text-sm font-medium">{intention.member_name}</p>
                    <Badge variant="outline" className={statusColor(intention.status)}>
                      {translateStatus(t, intention.status)}
                    </Badge>
                  </div>
                  <p className="mb-1 text-xs text-primary">{translateMassIntentionType(t, intention.intention_type)}</p>
                  <p className="text-sm text-muted-foreground">{intention.message}</p>
                  {intention.offering_amount && (
                    <p className="mt-2 text-xs text-primary">
                      {t("mass_intentions_admin.offering", { amount: formatTZS(intention.offering_amount) })}
                    </p>
                  )}
                  <p className="mt-1 text-xs text-muted-foreground/60">{new Date(intention.created_at).toLocaleDateString()}</p>
                </div>
                {intention.status === "pending" && (
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => updateStatus.mutate({ id: intention.id, status: "approved" })} disabled={updateStatus.isPending}>
                      {t("mass_intentions_admin.approve")}
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => updateStatus.mutate({ id: intention.id, status: "rejected" })} disabled={updateStatus.isPending}>
                      {t("mass_intentions_admin.reject")}
                    </Button>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold font-serif">{t("mass_intentions_admin.page_title")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("mass_intentions_admin.page_description")}</p>
      </div>
      {isLoading ? (
        <p className="text-muted-foreground">{t("common.loading")}</p>
      ) : (
        <Tabs defaultValue="pending">
          <TabsList className="bg-secondary">
            <TabsTrigger value="pending">{t("mass_intentions_admin.pending_tab", { count: pendingIntentions.length })}</TabsTrigger>
            <TabsTrigger value="reviewed">{t("mass_intentions_admin.reviewed_tab", { count: reviewedIntentions.length })}</TabsTrigger>
          </TabsList>
          <TabsContent value="pending" className="mt-4">{renderList(pendingIntentions)}</TabsContent>
          <TabsContent value="reviewed" className="mt-4">{renderList(reviewedIntentions)}</TabsContent>
        </Tabs>
      )}
    </div>
  );
}

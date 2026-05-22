import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { CalendarDays, Flame, Heart, Loader2, Plus, User } from "lucide-react";
import { formatTZS } from "@/lib/currency";
import { useToast } from "@/hooks/use-toast";
import { MASS_INTENTION_SELECT, mapMassIntentionRecord, submitMassIntention, type MassIntentionWithMember } from "@/lib/member-linked-requests";
import { clearOfflineDraft, readOfflineDraft, writeOfflineDraft } from "@/lib/offline-drafts";
import { useNetworkStatus } from "@/hooks/useNetworkStatus";
import { enqueueOfflineSyncAction, processOfflineSyncQueue, removeOfflineSyncAction } from "@/lib/offline-sync";
import { useOfflineSyncQueue } from "@/hooks/useOfflineSyncQueue";
import { readOfflineCache, withOfflineCache } from "@/lib/offline-cache";
import { useTranslation } from "react-i18next";
import { translateStatus } from "@/lib/translation-helpers";

const intentionTypeOptions = [
  { value: "shukrani", label: "Shukrani", description: "Nia ya kumshukuru Mungu" },
  { value: "marehemu", label: "Marehemu", description: "Kwa roho za waliofariki" },
  { value: "maombi_maalum", label: "Maombi Maalum", description: "Nia maalum ya familia au binafsi" },
  { value: "wagonjwa", label: "Wagonjwa", description: "Kwa uponyaji na faraja" },
  { value: "safari", label: "Safari", description: "Kwa ulinzi na baraka safarini" },
  { value: "mtakatifu_wa_familia", label: "Mtakatifu wa Familia", description: "Kwa maombezi ya mtakatifu wa familia" },
  { value: "other", label: "Other", description: "Nia nyingine ya Misa" },
] as const;

type IntentionTypeValue = (typeof intentionTypeOptions)[number]["value"];

const DEFAULT_OFFERING = 5000;

function getIntentionTypeLabel(value: string) {
  return intentionTypeOptions.find((option) => option.value === value)?.label ?? value;
}

function useMemberRecord() {
  const { user, churchId } = useAuth();
  const { isOnline } = useNetworkStatus();

  return useQuery({
    queryKey: ["my-member-record", user?.id, churchId],
    queryFn: async () => {
      if (!user || !churchId) return null;
      if (!isOnline) return null;
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

export default function PortalMassIntentions() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [intentionType, setIntentionType] = useState<IntentionTypeValue>("shukrani");
  const [message, setMessage] = useState("");
  const [offeringAmount, setOfferingAmount] = useState(String(DEFAULT_OFFERING));
  const [massDate, setMassDate] = useState("");
  const [tab, setTab] = useState("all");
  const { churchId } = useAuth();
  const { isOnline } = useNetworkStatus();
  const { toast } = useToast();
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { data: member } = useMemberRecord();
  const offlineQueue = useOfflineSyncQueue();
  const massDraftKey = churchId ? `offline-draft:mass-intention:${churchId}:${member?.id || "member"}` : null;
  const allIntentionsCacheKey = churchId ? `offline-cache:portal-mass-intentions:${churchId}` : null;
  const myIntentionsCacheKey = member?.id ? `offline-cache:my-mass-intentions:${member.id}:${churchId || "church"}` : null;
  const pendingMassIntentions = useMemo(
    () =>
      offlineQueue.filter(
        (item) =>
          item.type === "mass_intention_create" &&
          item.payload.churchId === churchId &&
          item.payload.memberId === member?.id,
      ),
    [churchId, member?.id, offlineQueue],
  );
  const [isSyncingPending, setIsSyncingPending] = useState(false);

  useEffect(() => {
    if (!massDraftKey) return;
    const draft = readOfflineDraft(massDraftKey, {
      intentionType: "shukrani",
      message: "",
      offeringAmount: String(DEFAULT_OFFERING),
      massDate: "",
    });
    const draftType = intentionTypeOptions.some((option) => option.value === draft.intentionType)
      ? (draft.intentionType as IntentionTypeValue)
      : "shukrani";
    setIntentionType(draftType);
    setMessage(draft.message || "");
    setOfferingAmount(draft.offeringAmount || String(DEFAULT_OFFERING));
    setMassDate(draft.massDate || "");
  }, [massDraftKey]);

  useEffect(() => {
    if (!massDraftKey) return;
    writeOfflineDraft(massDraftKey, { intentionType, message, offeringAmount, massDate });
  }, [massDraftKey, intentionType, message, offeringAmount, massDate]);

  const { data: intentions = [], isLoading } = useQuery({
    queryKey: ["portal-mass-intentions", churchId],
    queryFn: async () => {
      if (!churchId) return [];
      if (!isOnline) {
        return readOfflineCache(allIntentionsCacheKey, [] as MassIntentionWithMember[]);
      }
      return withOfflineCache(
        allIntentionsCacheKey,
        async () => {
          const { data, error } = await supabase
            .from("mass_intentions")
            .select(MASS_INTENTION_SELECT)
            .eq("church_id", churchId)
            .order("created_at", { ascending: false });

          if (error) throw error;

          return (data ?? []).map((row: any) => mapMassIntentionRecord(row as MassIntentionWithMember));
        },
        readOfflineCache(allIntentionsCacheKey, [] as MassIntentionWithMember[]),
      );
    },
    enabled: !!churchId,
  });

  const { data: myIntentions = [] } = useQuery({
    queryKey: ["my-mass-intentions", member?.id, churchId],
    queryFn: async () => {
      if (!member?.id || !churchId) return [];
      if (!isOnline) {
        return readOfflineCache(myIntentionsCacheKey, [] as MassIntentionWithMember[]);
      }
      return withOfflineCache(
        myIntentionsCacheKey,
        async () => {
          const { data, error } = await supabase
            .from("mass_intentions")
            .select(MASS_INTENTION_SELECT)
            .eq("church_id", churchId)
            .eq("member_id", member.id)
            .order("created_at", { ascending: false });

          if (error) throw error;

          return (data ?? []).map((row: any) => mapMassIntentionRecord(row as MassIntentionWithMember));
        },
        readOfflineCache(myIntentionsCacheKey, [] as MassIntentionWithMember[]),
      );
    },
    enabled: !!member?.id && !!churchId,
  });

  const PLATFORM_FEE_PERCENT = 1;
  const churchAmount = parseFloat(offeringAmount) || DEFAULT_OFFERING;
  const grossAmount = Number((churchAmount / (1 - PLATFORM_FEE_PERCENT / 100)).toFixed(2));
  const feeAmount = Number((grossAmount - churchAmount).toFixed(2));

  const submit = useMutation({
    mutationFn: async () => {
      if (!churchId) throw new Error(t("mass_intentions_form.error_no_church"));
      if (!member?.id) throw new Error(t("mass_intentions_form.error_no_member"));
      const netAmount = parseFloat(offeringAmount) || DEFAULT_OFFERING;
      if (!message.trim()) throw new Error(t("mass_intentions_form.error_message_required"));
      if (!massDate) throw new Error("Please select the Mass date.");
      if (netAmount < 1000) throw new Error(t("mass_intentions_form.error_minimum_offering"));

      if (!isOnline) {
        enqueueOfflineSyncAction({
          type: "mass_intention_create",
          payload: {
            churchId,
            memberId: member.id,
            memberName: member.full_name,
            intentionType,
            message,
            offeringAmount: netAmount,
            requestedMassDate: massDate || null,
          },
        });
        return { queuedOffline: true };
      }

      const amount = Number((netAmount / (1 - PLATFORM_FEE_PERCENT / 100)).toFixed(2));

      const fee = Number((amount - netAmount).toFixed(2));
      const net = netAmount;
      const savedMessage = `Tarehe ya Misa: ${massDate}\n\n${message.trim()}`;

      const intentionData = await submitMassIntention({
        intention_type: intentionType,
        message: savedMessage,
        offering_amount: net,
        member_id: member.id,
        church_id: churchId,
        requested_mass_date: massDate || null,
      });

      await supabase.from("platform_fees").insert({
        church_id: churchId,
        source_type: "mass_intention",
        source_id: intentionData.id,
        gross_amount: amount,
        fee_percentage: PLATFORM_FEE_PERCENT,
        fee_amount: fee,
        net_amount: net,
        member_id: member.id,
      });

      await supabase.from("contributions").insert({
        church_id: churchId,
        amount: net,
        donor_name: member.full_name,
        member_id: member.id,
        notes: `Nia ya Misa: ${getIntentionTypeLabel(intentionType)}${massDate ? ` - ${massDate}` : ""} - ${message.trim().slice(0, 80)} (${formatTZS(fee)} platform fee)`,
      });
      return { queuedOffline: false };
    },
    onSuccess: (result) => {
      clearOfflineDraft(massDraftKey);
      if (!result?.queuedOffline) {
        queryClient.invalidateQueries({ queryKey: ["portal-mass-intentions"] });
        queryClient.invalidateQueries({ queryKey: ["my-mass-intentions"] });
        queryClient.invalidateQueries({ queryKey: ["my-mass-intentions-dashboard"] });
        queryClient.invalidateQueries({ queryKey: ["my-contributions-all"] });
        queryClient.invalidateQueries({ queryKey: ["contributions"] });
      }
      const amount = parseFloat(offeringAmount) || DEFAULT_OFFERING;
      const gross = Number((amount / (1 - PLATFORM_FEE_PERCENT / 100)).toFixed(2));
      const fee = Number((gross - amount).toFixed(2));
      toast({
        title: result?.queuedOffline ? t("mass_intentions_form.queued_title") : t("mass_intentions_form.submitted_title"),
        description: result?.queuedOffline
          ? t("mass_intentions_form.queued_description")
          : t("mass_intentions_form.submitted_description", {
              amount: formatTZS(amount),
              gross: formatTZS(gross),
              fee: formatTZS(fee),
            }),
      });
      setDialogOpen(false);
      setIntentionType("shukrani");
      setMessage("");
      setOfferingAmount(String(DEFAULT_OFFERING));
      setMassDate("");
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const statusColor = (status: string) => {
    if (status === "approved") return "bg-success/20 text-success border-success/30";
    if (status === "pending") return "bg-primary/20 text-primary border-primary/30";
    return "bg-destructive/10 text-destructive border-destructive/20";
  };

  const IntentionList = ({ items }: { items: MassIntentionWithMember[] }) => (
    <div className="space-y-3">
      {items.map((intention) => (
        <Card key={intention.id} className="glass-card">
          <CardContent className="p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="mb-1 flex items-center gap-2">
                  <p className="text-sm font-medium">{intention.member_name}</p>
                  <Badge variant="outline" className={statusColor(intention.status)}>
                    {translateStatus(t, intention.status)}
                  </Badge>
                </div>
                <p className="mb-1 text-xs text-primary">{getIntentionTypeLabel(intention.intention_type)}</p>
                <p className="text-sm text-muted-foreground">{intention.message}</p>
                {intention.offering_amount && (
                  <p className="mt-2 text-xs text-primary">{t("mass_intentions_form.offering", { amount: formatTZS(intention.offering_amount) })}</p>
                )}
                <p className="mt-2 text-xs text-muted-foreground/60">{new Date(intention.created_at).toLocaleDateString()}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );

  return (
    <div className="container mx-auto px-4 py-10 animate-fade-in">
      <div className="mx-auto max-w-3xl">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="font-serif text-2xl font-bold md:text-3xl">Nia za Misa</h1>
            <p className="mt-1 text-muted-foreground">Wasilisha nia ya Misa, chagua tarehe, na toa sadaka ya Misa kwa urahisi.</p>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Wasilisha Nia
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle className="font-serif">Wasilisha Nia ya Misa</DialogTitle>
              </DialogHeader>
              <form
                className="space-y-4"
                onSubmit={(event) => {
                  event.preventDefault();
                  submit.mutate();
                }}
              >
                {member && (
                  <div className="flex items-center gap-3 rounded-lg border border-primary/10 bg-primary/5 p-3">
                    <User className="h-4 w-4 shrink-0 text-primary" />
                    <p className="text-sm font-medium">{member.full_name}</p>
                  </div>
                )}
                <div className="space-y-2">
                  <Label>Aina ya Nia ya Misa *</Label>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {intentionTypeOptions.map((option) => {
                      const selected = intentionType === option.value;

                      return (
                        <button
                          key={option.value}
                          type="button"
                          onClick={() => setIntentionType(option.value)}
                          className={[
                            "rounded-2xl border p-3 text-left transition-all",
                            selected
                              ? "border-primary/40 bg-primary/10 shadow-[0_16px_36px_-28px_hsl(var(--primary))]"
                              : "border-border/70 bg-background/60 hover:border-primary/25 hover:bg-primary/5",
                          ].join(" ")}
                        >
                          <span className="flex items-start gap-3">
                            <span
                              className={[
                                "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border",
                                selected ? "border-primary/35 bg-primary text-primary-foreground" : "border-border bg-muted text-muted-foreground",
                              ].join(" ")}
                            >
                              <Heart className="h-4 w-4" />
                            </span>
                            <span>
                              <span className="block text-sm font-semibold">{option.label}</span>
                              <span className="mt-1 block text-xs leading-5 text-muted-foreground">{option.description}</span>
                            </span>
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="mass_date">Tarehe ya Misa *</Label>
                  <div className="relative">
                    <CalendarDays className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="mass_date"
                      type="date"
                      value={massDate}
                      onChange={(event) => setMassDate(event.target.value)}
                      className="pl-9"
                      required
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Nia / Ujumbe *</Label>
                  <Textarea
                    rows={4}
                    placeholder="Andika jina, familia, au ujumbe wa nia ya Misa..."
                    value={message}
                    onChange={(event) => setMessage(event.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>Kiasi cha Sadaka ya Misa *</Label>
                  <Input
                    type="number"
                    min="1000"
                    placeholder="5000"
                    value={offeringAmount}
                    onChange={(event) => setOfferingAmount(event.target.value)}
                    required
                  />
                  <p className="text-xs text-muted-foreground">
                    {t("mass_intentions_form.offering_hint", { amount: formatTZS(DEFAULT_OFFERING) })}
                  </p>
                </div>
                {churchAmount >= 1000 && (
                  <div className="space-y-1 rounded-lg border border-border bg-muted/50 p-3">
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>{t("mass_intentions_form.church_receives")}</span>
                      <span>{formatTZS(churchAmount)}</span>
                    </div>
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>{t("mass_intentions_form.platform_fee", { percent: PLATFORM_FEE_PERCENT })}</span>
                      <span>{formatTZS(feeAmount)}</span>
                    </div>
                    <div className="flex justify-between border-t border-border pt-1 text-sm font-medium">
                      <span>{t("mass_intentions_form.you_pay")}</span>
                      <span className="text-primary">{formatTZS(grossAmount)}</span>
                    </div>
                  </div>
                )}
                <p className="text-xs text-muted-foreground">{t("mass_intentions_form.draft_saved")}</p>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" type="button" onClick={() => setDialogOpen(false)}>
                    {t("common.cancel")}
                  </Button>
                  <Button type="submit" disabled={submit.isPending || !message.trim() || !massDate || !offeringAmount || !member?.id}>
                    {submit.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    {t("mass_intentions_form.submit_and_pay", { amount: formatTZS(grossAmount) })}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {pendingMassIntentions.length > 0 ? (
          <Card className="mb-6 border-primary/20 bg-primary/5">
            <CardContent className="space-y-3 p-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium">{t("mass_intentions_form.pending_offline_title")}</p>
                  <p className="text-sm text-muted-foreground">{t("mass_intentions_form.pending_offline_description")}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline">{t("mass_intentions_form.pending_count", { count: pendingMassIntentions.length })}</Badge>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={!isOnline || isSyncingPending}
                    onClick={async () => {
                      setIsSyncingPending(true);
                      const result = await processOfflineSyncQueue(queryClient);
                      setIsSyncingPending(false);
                      if (result.processedCount === 0 && result.error) {
                        toast({ title: t("mass_intentions_form.sync_failed"), description: result.error.message, variant: "destructive" });
                      }
                    }}
                  >
                    {isSyncingPending ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : null}
                    {t("common.sync_now")}
                  </Button>
                </div>
              </div>
              <div className="space-y-2">
                {pendingMassIntentions.map((item) => (
                  <div key={item.id} className="rounded-lg border border-border/60 bg-background/70 p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-medium">{getIntentionTypeLabel(item.payload.intentionType)}</p>
                        {item.payload.requestedMassDate ? (
                          <p className="mt-1 text-xs text-muted-foreground">Tarehe ya Misa: {item.payload.requestedMassDate}</p>
                        ) : null}
                        <p className="mt-1 text-sm text-muted-foreground">{item.payload.message}</p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {t("mass_intentions_form.saved_at", { date: new Date(item.createdAt).toLocaleString() })}
                        </p>
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-destructive"
                        onClick={() => removeOfflineSyncAction(item.id)}
                      >
                        {t("common.remove")}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ) : null}

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="mb-4 bg-secondary">
            <TabsTrigger value="all">{t("mass_intentions_form.all_intentions")}</TabsTrigger>
            <TabsTrigger value="mine">{t("mass_intentions_form.my_intentions", { count: myIntentions.length })}</TabsTrigger>
          </TabsList>
          <TabsContent value="all">
            {isLoading ? (
              <p className="text-muted-foreground">{t("common.loading")}</p>
            ) : intentions.length === 0 ? (
              <Card className="glass-card">
                <CardContent className="py-16 text-center text-muted-foreground">
                  <Flame className="mx-auto mb-4 h-12 w-12 text-muted-foreground/30" />
                  {t("mass_intentions_form.empty_all")}
                </CardContent>
              </Card>
            ) : (
              <IntentionList items={intentions} />
            )}
          </TabsContent>
          <TabsContent value="mine">
            {myIntentions.length === 0 ? (
              <Card className="glass-card">
                <CardContent className="py-16 text-center text-muted-foreground">
                  <Flame className="mx-auto mb-4 h-12 w-12 text-muted-foreground/30" />
                  {t("mass_intentions_form.empty_mine")}
                </CardContent>
              </Card>
            ) : (
              <IntentionList items={myIntentions} />
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

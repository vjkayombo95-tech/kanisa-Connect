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
import { MASS_INTENTION_SELECT, mapMassIntentionRecord, submitPortalMassIntentionForOccurrence, type MassIntentionWithMember } from "@/lib/member-linked-requests";
import type { MassOccurrence } from "@/lib/mass-timetable";
import { clearOfflineDraft, readOfflineDraft, writeOfflineDraft } from "@/lib/offline-drafts";
import { useNetworkStatus } from "@/hooks/useNetworkStatus";
import { enqueueOfflineSyncAction, isOfflineSyncActionType, processOfflineSyncQueue, removeOfflineSyncAction } from "@/lib/offline-sync";
import { useOfflineSyncQueue } from "@/hooks/useOfflineSyncQueue";
import { readOfflineCache, withOfflineCache } from "@/lib/offline-cache";
import { useTranslation } from "react-i18next";
import { translateStatus } from "@/lib/translation-helpers";
import { assertClientRateLimit } from "@/lib/client-rate-limit";
import { logSupabaseError } from "@/lib/error-logger";

const intentionTypeOptions = [
  { value: "shukrani", label: "Shukrani", description: "Nia ya kumshukuru Mungu" },
  { value: "marehemu", label: "Marehemu", description: "Kwa roho za waliofariki" },
  { value: "maombi_maalum", label: "Maombi Maalum", description: "Nia maalum ya familia au binafsi" },
  { value: "wagonjwa", label: "Wagonjwa", description: "Kwa uponyaji na faraja" },
  { value: "safari", label: "Safari", description: "Kwa ulinzi na baraka safarini" },
  { value: "mtakatifu_wa_familia", label: "Mtakatifu wa Familia", description: "Kwa maombezi ya mtakatifu wa familia" },
  { value: "other", label: "Nyingine", description: "Nia nyingine ya Misa" },
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
  const [massOccurrenceId, setMassOccurrenceId] = useState("");
  const [tab, setTab] = useState("mine");
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
      offlineQueue
        .filter((item) => isOfflineSyncActionType(item, "mass_intention_create"))
        .filter(
          (item) =>
            item.payload.churchId === churchId &&
            item.payload.memberId === member?.id,
        ),
    [churchId, member?.id, offlineQueue],
  );
  const { data: availableMasses = [], isLoading: massesLoading } = useQuery({
    queryKey: ["available-mass-occurrences", churchId],
    queryFn: async () => {
      if (!churchId || !isOnline) return [];
      const { data, error } = await supabase.rpc("get_available_mass_occurrences" as never, { p_church_id: churchId, p_date: null } as never);
      if (error) throw error;
      return (data ?? []) as unknown as Array<MassOccurrence & { remaining_slots: number | null; is_full: boolean }>;
    },
    enabled: !!churchId && isOnline,
  });
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
            .order("created_at", { ascending: false })
            .limit(25);

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
            .order("created_at", { ascending: false })
            .limit(25);

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
      if (!massOccurrenceId) throw new Error("Please select an available Mass.");
      if (netAmount < 1000) throw new Error(t("mass_intentions_form.error_minimum_offering"));
      assertClientRateLimit(`mass-intention:${churchId}:${member.id}`, 5, 60 * 60 * 1000, "mass intention submissions");

      if (!isOnline) throw new Error("Unganisha intaneti ili kuthibitisha nafasi ya Misa.");
      await submitPortalMassIntentionForOccurrence({
        intention_type: intentionType,
        message,
        offering_amount: netAmount,
        member_id: member.id,
        church_id: churchId,
        mass_occurrence_id: massOccurrenceId,
        idempotency_key: crypto.randomUUID(),
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
        queryClient.invalidateQueries({ queryKey: ["simple-member-home"] });
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
      setMassOccurrenceId("");
    },
    onError: (err: Error) => {
      logSupabaseError(err, {
        page: "Portal Mass Intentions",
        component: "PortalMassIntentions",
        function: "submitMassIntention",
        church_id: churchId,
        operation: "insert",
        table: "mass_intentions",
        metadata: { member_id: member?.id, intention_type: intentionType, offering_amount: offeringAmount },
      });
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const statusColor = (status: string) => {
    if (status === "approved") return "bg-success/20 text-success border-success/30";
    if (status === "pending") return "bg-primary/20 text-primary border-primary/30";
    return "bg-destructive/10 text-destructive border-destructive/20";
  };

  const IntentionList = ({ items }: { items: MassIntentionWithMember[] }) => (
    <div className="space-y-3">
      {items.map((intention) => (
        <Card key={intention.id} className="rounded-2xl border-border/70 bg-card/90 shadow-sm">
          <CardContent className="p-5">
            <div className="flex min-w-0 items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="mb-1 flex items-center gap-2">
                  <p className="truncate text-sm font-medium">{intention.member_name}</p>
                  <Badge variant="outline" className={statusColor(intention.status)}>
                    {translateStatus(t, intention.status)}
                  </Badge>
                </div>
                <p className="mb-1 text-xs text-primary">{getIntentionTypeLabel(intention.intention_type)}</p>
                <p className="break-words text-sm leading-6 text-muted-foreground">{intention.message}</p>
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
    <div className="container mx-auto px-4 pb-28 pt-6 animate-fade-in lg:px-8 lg:py-10">
      <div className="mx-auto max-w-6xl min-w-0">
        <div className="mb-7 flex min-w-0 flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-sm">
              <Heart className="h-6 w-6" />
            </div>
            <p className="text-sm font-semibold uppercase tracking-wide text-primary">Kanisa Connect</p>
            <h1 className="mt-1 font-serif text-3xl font-bold tracking-normal text-foreground sm:text-4xl">Nia za Misa</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base">
              Wasilisha nia yako kwa Misa utakayochagua, kisha parokia itaipokea kwa ajili ya maandalizi na kumbukumbu.
            </p>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button className="min-h-12 w-full sm:w-auto">
                <Plus className="mr-2 h-4 w-4" />
                Wasilisha Nia
              </Button>
            </DialogTrigger>
            <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
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
                  <div className="flex min-w-0 items-center gap-3 rounded-2xl border border-primary/10 bg-primary/5 p-3">
                    <User className="h-4 w-4 shrink-0 text-primary" />
                    <p className="truncate text-sm font-medium">{member.full_name}</p>
                  </div>
                )}
                <div className="space-y-2">
                  <Label>Aina ya Nia ya Misa *</Label>
                  <div className="grid min-w-0 gap-2 sm:grid-cols-2">
                    {intentionTypeOptions.map((option) => {
                      const selected = intentionType === option.value;

                      return (
                        <button
                          key={option.value}
                          type="button"
                          onClick={() => setIntentionType(option.value)}
                          className={[
                            "min-w-0 rounded-2xl border p-3 text-left transition-all",
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
                            <span className="min-w-0">
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
                  <Label htmlFor="mass_occurrence">Chagua Misa *</Label>
                  <div className="relative">
                    <CalendarDays className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <select id="mass_occurrence" value={massOccurrenceId} onChange={(event) => { const selected = availableMasses.find(item => item.id === event.target.value); setMassOccurrenceId(event.target.value); setMassDate(selected?.occurrence_date ?? ""); setOfferingAmount(String(selected?.intention_fee ?? 0)); }} className="h-12 w-full min-w-0 rounded-md border bg-background pl-9 pr-3" required disabled={massesLoading || !isOnline}>
                      <option value="">{massesLoading ? "Inapakia Misa..." : "Chagua Misa inayopatikana"}</option>
                      {availableMasses.filter(item => !item.is_full).map(item => <option key={item.id} value={item.id}>{item.occurrence_date} · {item.start_time.slice(0,5)} · {item.name}{item.remaining_slots == null ? "" : ` · nafasi ${item.remaining_slots}`}</option>)}
                    </select>
                  </div>
                  {!isOnline ? <p className="text-xs text-destructive">Uchaguzi wa Misa unahitaji muunganisho ili kuthibitisha nafasi.</p> : null}
                </div>
                <div className="space-y-2">
                  <Label>Nia / Ujumbe *</Label>
                  <Textarea
                    rows={4}
                    placeholder="Andika jina, familia, au ujumbe wa nia ya Misa..."
                    value={message}
                    onChange={(event) => setMessage(event.target.value)}
                    className="min-h-32"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>Kiasi cha sadaka ya Misa *</Label>
                  <Input
                    type="number"
                    min="1000"
                    placeholder="5000"
                    value={offeringAmount}
                    onChange={(event) => setOfferingAmount(event.target.value)}
                    className="h-12"
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
                <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                  <Button variant="outline" type="button" className="min-h-11" onClick={() => setDialogOpen(false)}>
                    {t("common.cancel")}
                  </Button>
                  <Button type="submit" className="min-h-11" disabled={submit.isPending || !message.trim() || !massOccurrenceId || !member?.id || !isOnline}>
                    {submit.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    {t("mass_intentions_form.submit_and_pay", { amount: formatTZS(grossAmount) })}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <div className="grid min-w-0 gap-5 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start">
          <section className="min-w-0">
        {pendingMassIntentions.length > 0 ? (
          <Card className="mb-6 rounded-2xl border-primary/20 bg-primary/5">
            <CardContent className="space-y-3 p-5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="text-sm font-medium">{t("mass_intentions_form.pending_offline_title")}</p>
                  <p className="text-sm text-muted-foreground">{t("mass_intentions_form.pending_offline_description")}</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
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
                  <div key={item.id} className="rounded-2xl border border-border/60 bg-background/70 p-3">
                    <div className="flex min-w-0 items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-medium">{getIntentionTypeLabel(item.payload.intentionType)}</p>
                        {item.payload.requestedMassDate ? (
                          <p className="mt-1 text-xs text-muted-foreground">Tarehe ya Misa: {item.payload.requestedMassDate}</p>
                        ) : null}
                        <p className="mt-1 break-words text-sm text-muted-foreground">{item.payload.message}</p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {t("mass_intentions_form.saved_at", { date: new Date(item.createdAt).toLocaleString() })}
                        </p>
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="shrink-0 text-destructive"
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
            <TabsTrigger value="mine">{t("mass_intentions_form.my_intentions", { count: myIntentions.length })}</TabsTrigger>
          </TabsList>
          <TabsContent value="mine">
            {myIntentions.length === 0 ? (
              <Card className="rounded-2xl border-border/70 bg-card/90 shadow-sm">
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
          </section>

          <aside className="min-w-0 space-y-4">
            {member && (
              <div className="rounded-2xl bg-card p-5 shadow-sm ring-1 ring-border/60">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10">
                    <User className="h-5 w-5 text-primary" />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{member.full_name}</p>
                    <p className="text-xs text-muted-foreground">Nia zako zinaunganishwa na ushiriki wako wa parokia.</p>
                  </div>
                </div>
              </div>
            )}

            <div className="rounded-2xl bg-muted/50 p-5">
              <h2 className="text-sm font-semibold text-foreground">Kabla ya kuwasilisha</h2>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                Chagua Misa yenye nafasi, andika nia yako kwa utulivu, na hakiki kiasi cha sadaka kinachoonekana kwenye ratiba ya parokia.
              </p>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}

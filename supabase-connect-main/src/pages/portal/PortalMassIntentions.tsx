import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { SupabaseClient } from "@supabase/supabase-js";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PageToolbar, getWorkspacePageActions, useWorkspacePage } from "@/components/workspace";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  CircleDollarSign,
  Cross,
  Flower2,
  Flame,
  Gift,
  Heart,
  HeartPulse,
  Loader2,
  Plane,
  ShieldCheck,
  Sparkles,
  User,
  Users,
} from "lucide-react";
import { formatTZS } from "@/lib/currency";
import { useToast } from "@/hooks/use-toast";
import { MASS_INTENTION_SELECT, mapMassIntentionRecord, submitPortalMassIntention, type MassIntentionWithMember } from "@/lib/member-linked-requests";
import { clearOfflineDraft, readOfflineDraft, writeOfflineDraft } from "@/lib/offline-drafts";
import { useNetworkStatus } from "@/hooks/useNetworkStatus";
import { enqueueOfflineSyncAction, processOfflineSyncQueue, removeOfflineSyncAction } from "@/lib/offline-sync";
import { useOfflineSyncQueue } from "@/hooks/useOfflineSyncQueue";
import { readOfflineCache, withOfflineCache } from "@/lib/offline-cache";
import { useTranslation } from "react-i18next";
import { translateStatus } from "@/lib/translation-helpers";
import { assertClientRateLimit } from "@/lib/client-rate-limit";
import { logSupabaseError } from "@/lib/error-logger";
import { ScriptureText } from "@/components/bible";
import { formatMassTime, type MassOccurrence } from "@/lib/mass-timetable";

const untypedSupabase = supabase as unknown as SupabaseClient;

const intentionTypeOptions = [
  { value: "shukrani", label: "Shukrani", description: "Nia ya kumshukuru Mungu", icon: Gift },
  { value: "marehemu", label: "Marehemu", description: "Kwa roho za waliotangulia", icon: Cross },
  { value: "maombi_maalum", label: "Maombi Maalum", description: "Nia maalum ya familia au binafsi", icon: Sparkles },
  { value: "wagonjwa", label: "Wagonjwa", description: "Kwa uponyaji na faraja", icon: HeartPulse },
  { value: "safari", label: "Safari", description: "Kwa ulinzi na baraka safarini", icon: Plane },
  { value: "mtakatifu_wa_familia", label: "Mtakatifu wa Familia", description: "Kwa maombezi ya mtakatifu wa familia", icon: Flower2 },
  { value: "other", label: "Other", description: "Nia nyingine ya Misa", icon: Heart },
] as const;

type IntentionTypeValue = (typeof intentionTypeOptions)[number]["value"];
type MassIntentionStep = 0 | 1 | 2 | 3;
type StepErrors = Partial<Record<MassIntentionStep, string>>;

const DEFAULT_OFFERING = 5000;
const PLATFORM_FEE_PERCENT = 1;

const massIntentionSteps = [
  { title: "Aina ya Nia", description: "Chagua aina inayofaa nia yako." },
  { title: "Maelezo", description: "Andika ujumbe wa sala kwa ufupi na heshima." },
  { title: "Maelezo ya Misa", description: "Weka tarehe na sadaka ya nia." },
  { title: "Kagua na Thibitisha", description: "Hakiki kabla ya kuwasilisha." },
] as const;

function getIntentionTypeLabel(value: string) {
  return intentionTypeOptions.find((option) => option.value === value)?.label ?? value;
}

function fieldId(name: string) {
  return `mass-intention-${name}`;
}

function formatMassDate(value: string) {
  if (!value) return "Haijachaguliwa";
  return new Date(`${value}T00:00:00`).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
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
  const page = useWorkspacePage();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [currentStep, setCurrentStep] = useState<MassIntentionStep>(0);
  const [stepDirection, setStepDirection] = useState<1 | -1>(1);
  const [stepErrors, setStepErrors] = useState<StepErrors>({});
  const [showSuccess, setShowSuccess] = useState(false);
  const [intentionType, setIntentionType] = useState<IntentionTypeValue>("shukrani");
  const [message, setMessage] = useState("");
  const [offeringAmount, setOfferingAmount] = useState(String(DEFAULT_OFFERING));
  const [massDate, setMassDate] = useState("");
  const [massOccurrenceId, setMassOccurrenceId] = useState("");
  const [tab, setTab] = useState("mine");
  const { churchId, profile } = useAuth();
  const { isOnline } = useNetworkStatus();
  const { toast } = useToast();
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { data: member } = useMemberRecord();
  const shouldReduceMotion = useReducedMotion();
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
      massOccurrenceId: "",
    });
    const draftType = intentionTypeOptions.some((option) => option.value === draft.intentionType)
      ? (draft.intentionType as IntentionTypeValue)
      : "shukrani";
    setIntentionType(draftType);
    setMessage(draft.message || "");
    setOfferingAmount(draft.offeringAmount || String(DEFAULT_OFFERING));
    setMassDate(draft.massDate || "");
    setMassOccurrenceId(draft.massOccurrenceId || "");
  }, [massDraftKey]);

  useEffect(() => {
    if (!massDraftKey) return;
    writeOfflineDraft(massDraftKey, { intentionType, message, offeringAmount, massDate, massOccurrenceId });
  }, [massDraftKey, intentionType, message, offeringAmount, massDate, massOccurrenceId]);

  const { data: availableMasses = [], isLoading: massesLoading } = useQuery({
    queryKey: ["available-mass-occurrences", churchId, massDate],
    enabled: !!churchId && !!massDate && isOnline,
    queryFn: async () => {
      const { data, error } = await untypedSupabase.rpc("get_available_mass_occurrences", {
        p_church_id: churchId,
        p_date: massDate,
      });
      if (error) throw error;
      return (data ?? []) as MassOccurrence[];
    },
  });

  const selectedMass = availableMasses.find((mass) => mass.id === massOccurrenceId) ?? null;

  useEffect(() => {
    if (selectedMass) setOfferingAmount(String(selectedMass.intention_fee ?? 0));
  }, [selectedMass]);

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

          return ((data ?? []) as unknown as MassIntentionWithMember[]).map(mapMassIntentionRecord);
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

          return ((data ?? []) as unknown as MassIntentionWithMember[]).map(mapMassIntentionRecord);
        },
        readOfflineCache(myIntentionsCacheKey, [] as MassIntentionWithMember[]),
      );
    },
    enabled: !!member?.id && !!churchId,
  });

  const parsedOfferingAmount = Number(offeringAmount);
  const churchAmount = Number.isFinite(parsedOfferingAmount) ? Math.max(parsedOfferingAmount, 0) : DEFAULT_OFFERING;
  const grossAmount = Number((churchAmount / (1 - PLATFORM_FEE_PERCENT / 100)).toFixed(2));
  const feeAmount = Number((grossAmount - churchAmount).toFixed(2));
  const selectedIntentionType = intentionTypeOptions.find((option) => option.value === intentionType) ?? intentionTypeOptions[0];
  const churchName = profile?.church_name ?? profile?.church?.name ?? "Parokia yako";

  const validateStep = (step: MassIntentionStep): string | null => {
    const netAmount = Number(offeringAmount);
    if (step === 1 && !message.trim()) return t("mass_intentions_form.error_message_required");
    if (step === 2 && !massDate) return "Tafadhali chagua tarehe ya Misa.";
    if (step === 2 && !massOccurrenceId) return "Tafadhali chagua Misa inayopatikana.";
    if (step === 2 && netAmount < 0) return t("mass_intentions_form.error_minimum_offering");
    if (step === 3) {
      if (!member?.id) return t("mass_intentions_form.error_no_member");
      if (!churchId) return t("mass_intentions_form.error_no_church");
    }
    return null;
  };

  const goToStep = (step: MassIntentionStep) => {
    setStepDirection(step > currentStep ? 1 : -1);
    setCurrentStep(step);
    setStepErrors((current) => ({ ...current, [step]: undefined }));
  };

  const goNext = () => {
    const validationError = validateStep(currentStep);
    if (validationError) {
      setStepErrors((current) => ({ ...current, [currentStep]: validationError }));
      return;
    }
    if (currentStep < 3) goToStep((currentStep + 1) as MassIntentionStep);
  };

  const goBack = () => {
    if (currentStep > 0) goToStep((currentStep - 1) as MassIntentionStep);
  };

  const resetMassIntentionForm = () => {
    setCurrentStep(0);
    setStepDirection(1);
    setStepErrors({});
    setShowSuccess(false);
    setIntentionType("shukrani");
    setMessage("");
    setOfferingAmount(String(DEFAULT_OFFERING));
    setMassDate("");
    setMassOccurrenceId("");
  };

  const submit = useMutation({
    mutationFn: async () => {
      if (!churchId) throw new Error(t("mass_intentions_form.error_no_church"));
      if (!member?.id) throw new Error(t("mass_intentions_form.error_no_member"));
      const parsedAmount = Number(offeringAmount);
      const netAmount = Number.isFinite(parsedAmount) ? Math.max(parsedAmount, 0) : DEFAULT_OFFERING;
      if (!message.trim()) throw new Error(t("mass_intentions_form.error_message_required"));
      if (!massDate) throw new Error("Please select the Mass date.");
      if (!massOccurrenceId) throw new Error("Please select an available Mass.");
      if (netAmount < 0) throw new Error(t("mass_intentions_form.error_minimum_offering"));
      assertClientRateLimit(`mass-intention:${churchId}:${member.id}`, 5, 60 * 60 * 1000, "mass intention submissions");

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
            massOccurrenceId,
          },
        });
        return { queuedOffline: true };
      }

      await submitPortalMassIntention({
        intention_type: intentionType,
        message,
        offering_amount: netAmount,
        member_id: member.id,
        church_id: churchId,
        requested_mass_date: massDate,
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
      const parsedAmount = Number(offeringAmount);
      const amount = Number.isFinite(parsedAmount) ? Math.max(parsedAmount, 0) : DEFAULT_OFFERING;
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
      setShowSuccess(true);
      window.setTimeout(() => {
        setDialogOpen(false);
        resetMassIntentionForm();
      }, 900);
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
  const toolbarActions = useMemo(
    () => getWorkspacePageActions("mass_intentions", page, { create: () => setDialogOpen(true) }),
    [page],
  );

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
                {(intention.mass_date || intention.mass_time || intention.mass_name) && (
                  <p className="mb-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <CalendarDays className="h-3.5 w-3.5" />
                    <span>{intention.mass_date ? formatMassDate(intention.mass_date) : ""}</span>
                    <span>{intention.mass_time ? formatMassTime(intention.mass_time) : ""}</span>
                    <span>{intention.mass_name || ""}</span>
                    <span>{intention.mass_location || ""}</span>
                  </p>
                )}
                <p className="text-sm text-muted-foreground">
                  <ScriptureText text={intention.message} />
                </p>
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
      <div className="mx-auto max-w-3xl space-y-6">
        <PageToolbar
          title="Nia za Misa"
          description="Wasilisha na fuatilia nia ya Misa bila kutoka kwenye workspace yako."
          actions={toolbarActions}
        />
          <Dialog
            open={dialogOpen}
            onOpenChange={(open) => {
              if (submit.isPending) return;
              setDialogOpen(open);
              if (!open) {
                setCurrentStep(0);
                setStepErrors({});
                setShowSuccess(false);
              }
            }}
          >
            <DialogContent
              role="dialog"
              aria-modal="true"
              aria-labelledby="mass-intention-dialog-title"
              aria-describedby="mass-intention-dialog-description"
              className="max-h-[100dvh] w-full max-w-5xl overflow-hidden border-amber-300/20 bg-slate-950/95 p-0 text-slate-50 shadow-[0_30px_90px_-35px_rgba(245,158,11,0.55)] backdrop-blur-xl sm:h-auto sm:max-h-[92dvh] sm:rounded-3xl"
            >
              <form
                className="grid max-h-[100dvh] min-h-[100dvh] overflow-hidden sm:max-h-[92dvh] sm:min-h-0 lg:grid-cols-[320px_minmax(0,1fr)]"
                onSubmit={(event) => {
                  event.preventDefault();
                  const validationError = validateStep(3);
                  if (validationError) {
                    setStepErrors((current) => ({ ...current, 3: validationError }));
                    return;
                  }
                  submit.mutate();
                }}
              >
                <aside className="relative hidden overflow-hidden border-r border-amber-200/10 bg-gradient-to-br from-slate-950 via-stone-950 to-amber-950/50 p-8 lg:block">
                  <div className="absolute -left-24 top-10 h-56 w-56 rounded-full bg-amber-400/15 blur-3xl" aria-hidden="true" />
                  <div className="absolute bottom-10 right-0 h-48 w-48 rounded-full bg-primary/10 blur-3xl" aria-hidden="true" />
                  <div className="absolute inset-0 opacity-[0.08] [background-image:radial-gradient(circle_at_1px_1px,rgba(251,191,36,0.8)_1px,transparent_0)] [background-size:26px_26px]" aria-hidden="true" />
                  <div className="relative flex h-full flex-col">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-amber-200/20 bg-amber-300/10 text-amber-200 shadow-[0_0_32px_rgba(245,158,11,0.18)]">
                      <Cross className="h-5 w-5" aria-hidden="true" />
                    </div>
                    <div className="mt-8">
                      <p className="text-xs font-semibold uppercase tracking-[0.28em] text-amber-200/70">Sala na Sadaka</p>
                      <h2 className="mt-3 font-serif text-3xl font-semibold text-white">Nia ya Misa</h2>
                      <p className="mt-3 text-sm leading-6 text-slate-300">Kuunganisha maombi yetu na sadaka ya Yesu Kristo.</p>
                    </div>
                    <div className="mt-8 space-y-3">
                      {[
                        ["Sala yenye upendo", Heart],
                        ["Kuwaombea wapendwa", Users],
                        ["Taarifa zako zipo salama", ShieldCheck],
                      ].map(([label, Icon]) => (
                        <div key={String(label)} className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-slate-200">
                          <Icon className="h-4 w-4 text-amber-200" aria-hidden="true" />
                          <span>{label}</span>
                        </div>
                      ))}
                    </div>
                    <figure className="mt-auto rounded-3xl border border-amber-200/15 bg-amber-100/[0.06] p-5 shadow-inner shadow-amber-900/20">
                      <blockquote className="font-serif text-lg leading-7 text-amber-50">"Ninyi mkiomba, nami nitawapa."</blockquote>
                      <figcaption className="mt-3 text-xs text-amber-100/70">- Yohana 15:7</figcaption>
                    </figure>
                  </div>
                </aside>

                <section className="flex min-h-0 flex-col bg-[radial-gradient(circle_at_top_right,rgba(251,191,36,0.11),transparent_34%),linear-gradient(180deg,rgba(15,23,42,0.98),rgba(2,6,23,0.98))]">
                  <DialogHeader className="sticky top-0 z-10 border-b border-amber-200/10 bg-slate-950/90 px-5 py-5 text-left backdrop-blur md:px-7">
                    <div className="pr-8">
                      <DialogTitle id="mass-intention-dialog-title" className="font-serif text-2xl text-white">
                        Wasilisha Nia ya Misa
                      </DialogTitle>
                      <DialogDescription id="mass-intention-dialog-description" className="mt-2 text-slate-300">
                        Hatua {currentStep + 1} kati ya {massIntentionSteps.length}: {massIntentionSteps[currentStep].description}
                      </DialogDescription>
                    </div>

                    <div className="mt-5 hidden items-center gap-2 md:flex" aria-label="Hatua za kuwasilisha nia ya Misa">
                      {massIntentionSteps.map((step, index) => {
                        const completed = index < currentStep;
                        const active = index === currentStep;

                        return (
                          <div key={step.title} className="flex flex-1 items-center gap-2">
                            <button
                              type="button"
                              disabled={index > currentStep}
                              onClick={() => goToStep(index as MassIntentionStep)}
                              className={[
                                "flex h-10 w-10 shrink-0 items-center justify-center rounded-full border text-sm font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300/80",
                                active
                                  ? "border-amber-200 bg-amber-300 text-slate-950 shadow-[0_0_28px_rgba(251,191,36,0.38)]"
                                  : completed
                                    ? "border-emerald-300/50 bg-emerald-400/15 text-emerald-100"
                                    : "border-white/10 bg-white/[0.04] text-slate-500",
                              ].join(" ")}
                              aria-current={active ? "step" : undefined}
                            >
                              {completed ? <Check className="h-4 w-4" aria-hidden="true" /> : index + 1}
                            </button>
                            <div className="min-w-0">
                              <p className={active ? "truncate text-sm font-semibold text-amber-100" : "truncate text-sm text-slate-400"}>{step.title}</p>
                            </div>
                            {index < massIntentionSteps.length - 1 ? <div className={completed ? "h-px flex-1 bg-amber-200/50" : "h-px flex-1 bg-white/10"} aria-hidden="true" /> : null}
                          </div>
                        );
                      })}
                    </div>

                    <div className="mt-5 md:hidden">
                      <div className="flex items-center justify-between text-xs text-slate-300">
                        <span>{massIntentionSteps[currentStep].title}</span>
                        <span>{currentStep + 1}/{massIntentionSteps.length}</span>
                      </div>
                      <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/10">
                        <div className="h-full rounded-full bg-gradient-to-r from-amber-400 to-yellow-200 transition-all" style={{ width: `${((currentStep + 1) / massIntentionSteps.length) * 100}%` }} />
                      </div>
                    </div>
                  </DialogHeader>

                  <div className="min-h-0 flex-1 overflow-y-auto px-5 py-6 md:px-7" aria-live="polite">
                    <AnimatePresence mode="wait" custom={stepDirection}>
                      <motion.div
                        key={showSuccess ? "success" : currentStep}
                        custom={stepDirection}
                        initial={shouldReduceMotion ? false : { opacity: 0, x: stepDirection > 0 ? 18 : -18 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, x: stepDirection > 0 ? -18 : 18 }}
                        transition={{ duration: shouldReduceMotion ? 0 : 0.22, ease: "easeOut" }}
                        className="space-y-5"
                      >
                        {showSuccess ? (
                          <div className="flex min-h-[360px] flex-col items-center justify-center text-center">
                            <motion.div
                              initial={shouldReduceMotion ? false : { scale: 0.88, opacity: 0 }}
                              animate={{ scale: 1, opacity: 1 }}
                              className="flex h-20 w-20 items-center justify-center rounded-full border border-emerald-300/30 bg-emerald-400/15 text-emerald-100 shadow-[0_0_36px_rgba(16,185,129,0.22)]"
                            >
                              <Check className="h-9 w-9" aria-hidden="true" />
                            </motion.div>
                            <h3 className="mt-6 font-serif text-2xl text-white">{t("mass_intentions_form.submitted_title")}</h3>
                            <p className="mt-2 max-w-md text-sm leading-6 text-slate-300">
                              Nia yako imepokelewa kwa ajili ya ukaguzi wa parokia. {t("mass_intentions_form.draft_saved")}
                            </p>
                          </div>
                        ) : currentStep === 0 ? (
                          <div className="space-y-4">
                            <div>
                              <h3 className="font-serif text-xl text-white">Chagua aina ya nia</h3>
                              <p className="mt-1 text-sm text-slate-300">Kila nia itaenda kwa ofisi ya parokia kwa utaratibu uliopo.</p>
                            </div>
                            <div className="grid gap-3 sm:grid-cols-2" role="radiogroup" aria-label="Aina ya Nia ya Misa">
                              {intentionTypeOptions.map((option) => {
                                const selected = intentionType === option.value;
                                const Icon = option.icon;

                                return (
                                  <motion.button
                                    key={option.value}
                                    type="button"
                                    role="radio"
                                    aria-checked={selected}
                                    whileHover={shouldReduceMotion ? undefined : { y: -2 }}
                                    whileTap={shouldReduceMotion ? undefined : { scale: 0.98 }}
                                    onClick={() => {
                                      setIntentionType(option.value);
                                      setStepErrors((current) => ({ ...current, 0: undefined }));
                                    }}
                                    className={[
                                      "group relative rounded-3xl border p-4 text-left transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300/80",
                                      selected
                                        ? "border-amber-300/80 bg-amber-300/[0.09] shadow-[inset_0_0_34px_rgba(251,191,36,0.10),0_22px_45px_-34px_rgba(251,191,36,0.65)]"
                                        : "border-white/10 bg-white/[0.04] hover:border-amber-200/35 hover:bg-white/[0.07]",
                                    ].join(" ")}
                                  >
                                    <span className="flex items-start gap-4">
                                      <span className={selected ? "flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-amber-300 text-slate-950 shadow-[0_0_28px_rgba(251,191,36,0.28)]" : "flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white/10 text-amber-100"}>
                                        <Icon className="h-5 w-5" aria-hidden="true" />
                                      </span>
                                      <span className="min-w-0 flex-1">
                                        <span className="block text-sm font-semibold text-white">{option.label}</span>
                                        <span className="mt-1 block text-sm leading-5 text-slate-300">{option.description}</span>
                                      </span>
                                      <motion.span
                                        initial={false}
                                        animate={selected ? { scale: 1, opacity: 1 } : { scale: 0.75, opacity: 0 }}
                                        className="flex h-6 w-6 items-center justify-center rounded-full bg-amber-300 text-slate-950"
                                      >
                                        <Check className="h-3.5 w-3.5" aria-hidden="true" />
                                      </motion.span>
                                    </span>
                                  </motion.button>
                                );
                              })}
                            </div>
                          </div>
                        ) : currentStep === 1 ? (
                          <div className="space-y-5">
                            {member ? (
                              <div className="flex items-center gap-3 rounded-3xl border border-amber-200/15 bg-white/[0.04] p-4">
                                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-amber-300/15 text-amber-100">
                                  <User className="h-5 w-5" aria-hidden="true" />
                                </div>
                                <div className="min-w-0 flex-1">
                                  <p className="truncate text-sm font-semibold text-white">{member.full_name}</p>
                                  <Badge variant="outline" className="mt-1 border-amber-200/20 bg-amber-200/10 text-amber-100">
                                    Member
                                  </Badge>
                                </div>
                              </div>
                            ) : (
                              <div className="rounded-3xl border border-destructive/20 bg-destructive/10 p-4 text-sm text-destructive-foreground">
                                {t("mass_intentions_form.error_no_member")}
                              </div>
                            )}
                            <div className="space-y-2">
                              <Label htmlFor={fieldId("message")} className="text-slate-100">Nia / Ujumbe *</Label>
                              <Textarea
                                id={fieldId("message")}
                                rows={7}
                                placeholder="Andika jina, familia, au ujumbe wa nia ya Misa..."
                                value={message}
                                onChange={(event) => {
                                  setMessage(event.target.value);
                                  setStepErrors((current) => ({ ...current, 1: undefined }));
                                }}
                                required
                                aria-invalid={Boolean(stepErrors[1])}
                                aria-describedby={stepErrors[1] ? fieldId("message-error") : fieldId("message-help")}
                                className="min-h-40 border-white/10 bg-white/[0.06] text-slate-50 placeholder:text-slate-500 focus-visible:ring-amber-300/70"
                              />
                              <div className="flex items-center justify-between gap-3 text-xs">
                                <p id={fieldId("message-help")} className="text-slate-400">{t("mass_intentions_form.draft_saved")}</p>
                                <p className="text-slate-500">{message.length} herufi</p>
                              </div>
                              {stepErrors[1] ? <p id={fieldId("message-error")} className="text-sm text-destructive" aria-live="assertive">{stepErrors[1]}</p> : null}
                            </div>
                          </div>
                        ) : currentStep === 2 ? (
                          <div className="space-y-5">
                            <div className="grid gap-4 sm:grid-cols-2">
                              <div className="space-y-2">
                                <Label htmlFor={fieldId("mass-date")} className="text-slate-100">Tarehe ya Misa *</Label>
                                <div className="relative">
                                  <CalendarDays className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-amber-100/70" aria-hidden="true" />
                                  <Input
                                    id={fieldId("mass-date")}
                                    type="date"
                                    value={massDate}
                                    onChange={(event) => {
                                      setMassDate(event.target.value);
                                      setMassOccurrenceId("");
                                      setStepErrors((current) => ({ ...current, 2: undefined }));
                                    }}
                                    className="h-12 border-white/10 bg-white/[0.06] pl-9 text-slate-50 focus-visible:ring-amber-300/70"
                                    required
                                    aria-invalid={Boolean(stepErrors[2] && !massDate)}
                                  />
                                </div>
                                <p className="text-xs text-slate-400">Chagua tarehe, kisha Misa inayopatikana hapa chini.</p>
                              </div>
                              <div className="space-y-2">
                                <Label htmlFor={fieldId("offering")} className="text-slate-100">Kiasi cha Sadaka ya Misa *</Label>
                                <div className="relative">
                                  <CircleDollarSign className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-amber-100/70" aria-hidden="true" />
                                  <Input
                                    id={fieldId("offering")}
                                    type="number"
                                    min="1000"
                                    placeholder="5000"
                                    value={offeringAmount}
                                    readOnly={!!selectedMass}
                                    onChange={(event) => {
                                      setOfferingAmount(event.target.value);
                                      setStepErrors((current) => ({ ...current, 2: undefined }));
                                    }}
                                    className="h-12 border-white/10 bg-white/[0.06] pl-9 text-slate-50 focus-visible:ring-amber-300/70"
                                    required
                                  />
                                </div>
                                <p className="text-xs text-slate-400">{selectedMass ? "Ada hii imewekwa na parokia kwa Misa uliyochagua." : t("mass_intentions_form.offering_hint", { amount: formatTZS(DEFAULT_OFFERING) })}</p>
                              </div>
                            </div>
                            {massDate ? (
                              <div className="space-y-3">
                                <Label className="text-slate-100">Chagua Misa *</Label>
                                {massesLoading ? (
                                  <div className="flex items-center gap-2 rounded-2xl border border-white/10 p-4 text-sm text-slate-300"><Loader2 className="h-4 w-4 animate-spin" />Inapakia Misa...</div>
                                ) : availableMasses.length === 0 ? (
                                  <div className="rounded-2xl border border-amber-200/20 bg-amber-200/[0.06] p-4 text-sm text-slate-300">Hakuna Misa inayopokea nia tarehe hii. Chagua tarehe nyingine.</div>
                                ) : (
                                  <div className="grid gap-3" role="radiogroup" aria-label="Misa zinazopatikana">
                                    {availableMasses.map((mass) => {
                                      const full = Boolean(mass.is_full);
                                      const selected = massOccurrenceId === mass.id;
                                      return (
                                        <button
                                          key={mass.id}
                                          type="button"
                                          role="radio"
                                          aria-checked={selected}
                                          disabled={full}
                                          onClick={() => { setMassOccurrenceId(mass.id); setStepErrors((current) => ({ ...current, 2: undefined })); }}
                                          className={`rounded-2xl border p-4 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300 ${selected ? "border-amber-300 bg-amber-300/10" : "border-white/10 bg-white/[0.04]"} ${full ? "cursor-not-allowed opacity-50" : "hover:border-amber-200/40"}`}
                                        >
                                          <span className="flex flex-wrap items-start justify-between gap-3">
                                            <span><span className="block font-semibold text-white">{formatMassTime(mass.start_time)} — {mass.name}</span><span className="mt-1 block text-sm text-slate-300">{mass.location_name || churchName}</span></span>
                                            <span className="text-right text-sm"><span className={full ? "block text-rose-300" : "block text-emerald-300"}>{full ? "Fully booked" : mass.remaining_slots == null ? "Nafasi bila kikomo" : `${mass.remaining_slots} spaces remaining`}</span>{mass.intention_fee != null && <span className="mt-1 block text-amber-200">{formatTZS(mass.intention_fee)}</span>}</span>
                                          </span>
                                        </button>
                                      );
                                    })}
                                  </div>
                                )}
                              </div>
                            ) : null}
                            {stepErrors[2] ? <p className="text-sm text-destructive" aria-live="assertive">{stepErrors[2]}</p> : null}
                            {churchAmount >= 1000 && (
                              <div className="space-y-2 rounded-3xl border border-amber-200/15 bg-amber-200/[0.06] p-4">
                                <div className="flex justify-between text-sm text-slate-300">
                                  <span>{t("mass_intentions_form.church_receives")}</span>
                                  <span>{formatTZS(churchAmount)}</span>
                                </div>
                                <div className="flex justify-between text-sm text-slate-300">
                                  <span>{t("mass_intentions_form.platform_fee", { percent: PLATFORM_FEE_PERCENT })}</span>
                                  <span>{formatTZS(feeAmount)}</span>
                                </div>
                                <div className="flex justify-between border-t border-amber-200/15 pt-2 text-base font-semibold text-white">
                                  <span>{t("mass_intentions_form.you_pay")}</span>
                                  <span className="text-amber-200">{formatTZS(grossAmount)}</span>
                                </div>
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="space-y-5">
                            <div className="rounded-3xl border border-amber-200/15 bg-white/[0.04] p-5">
                              <div className="flex items-center justify-between gap-4">
                                <div>
                                  <h3 className="font-serif text-xl text-white">Kagua na Thibitisha</h3>
                                  <p className="mt-1 text-sm text-slate-300">Tafadhali hakiki maelezo haya kabla ya kuwasilisha.</p>
                                </div>
                                <ShieldCheck className="h-6 w-6 text-amber-200" aria-hidden="true" />
                              </div>
                            </div>
                            <div className="grid gap-3">
                              {[
                                ["Mwanachama", member?.full_name ?? t("mass_intentions_form.error_no_member"), 1],
                                ["Aina ya Nia", selectedIntentionType.label, 0],
                                ["Ujumbe", message || "-", 1],
                                ["Tarehe ya Misa", formatMassDate(massDate), 2],
                                ["Muda wa Misa", selectedMass ? `${formatMassTime(selectedMass.start_time)} — ${selectedMass.name}` : "Haijachaguliwa", 2],
                                ["Kanisa / Mahali", selectedMass?.location_name || churchName, 2],
                                ["Sadaka", formatTZS(churchAmount), 2],
                                ["Jumla ya Kulipa", formatTZS(grossAmount), 2],
                                ["Njia ya Malipo", "Mtiririko uliopo wa malipo/uthibitisho utatumika", 2],
                              ].map(([label, value, editStep]) => (
                                <div key={String(label)} className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                                  <div className="flex items-start justify-between gap-3">
                                    <div>
                                      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-amber-100/70">{label}</p>
                                      <p className="mt-1 text-sm leading-6 text-slate-100">{String(value)}</p>
                                    </div>
                                    <Button type="button" variant="ghost" size="sm" onClick={() => goToStep(editStep as MassIntentionStep)} className="text-amber-100 hover:bg-amber-200/10 hover:text-amber-50">
                                      Hariri
                                    </Button>
                                  </div>
                                </div>
                              ))}
                            </div>
                            <p className="rounded-2xl border border-amber-200/15 bg-amber-200/[0.06] p-4 text-sm leading-6 text-slate-300">
                              Nia yako itatumwa kwa parokia yako kwa ukaguzi na utaratibu uliopo. Taarifa zako zipo salama.
                            </p>
                            {stepErrors[3] ? <p className="text-sm text-destructive" aria-live="assertive">{stepErrors[3]}</p> : null}
                          </div>
                        )}
                      </motion.div>
                    </AnimatePresence>
                  </div>

                  <div className="sticky bottom-0 z-10 flex flex-col gap-3 border-t border-amber-200/10 bg-slate-950/95 px-5 py-4 backdrop-blur md:flex-row md:items-center md:justify-between md:px-7">
                    <p className="flex items-center gap-2 text-xs text-slate-400">
                      <ShieldCheck className="h-4 w-4 text-amber-200" aria-hidden="true" />
                      Taarifa zako zipo salama
                    </p>
                    <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                      <Button
                        variant="outline"
                        type="button"
                        disabled={submit.isPending}
                        onClick={() => {
                          setDialogOpen(false);
                          setCurrentStep(0);
                          setStepErrors({});
                        }}
                        className="border-white/15 bg-white/[0.03] text-slate-100 hover:bg-white/[0.08]"
                      >
                        {t("common.cancel")}
                      </Button>
                      {currentStep > 0 && !showSuccess ? (
                        <Button type="button" variant="outline" disabled={submit.isPending} onClick={goBack} className="gap-2 border-white/15 bg-white/[0.03] text-slate-100 hover:bg-white/[0.08]">
                          <ChevronLeft className="h-4 w-4" aria-hidden="true" />
                          Rudi
                        </Button>
                      ) : null}
                      {!showSuccess && currentStep < 3 ? (
                        <Button type="button" onClick={goNext} className="gap-2 bg-gradient-to-r from-amber-300 to-yellow-200 text-slate-950 shadow-[0_14px_34px_-22px_rgba(251,191,36,0.9)] hover:from-amber-200 hover:to-yellow-100 active:scale-[0.99]">
                          Inayofuata
                          <ChevronRight className="h-4 w-4" aria-hidden="true" />
                        </Button>
                      ) : !showSuccess ? (
                        <Button
                          type="submit"
                          disabled={submit.isPending || !message.trim() || !massDate || !massOccurrenceId || !offeringAmount || !member?.id}
                          className="gap-2 bg-gradient-to-r from-amber-300 to-yellow-200 text-slate-950 shadow-[0_14px_34px_-22px_rgba(251,191,36,0.9)] hover:from-amber-200 hover:to-yellow-100 active:scale-[0.99]"
                        >
                          {submit.isPending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
                          Thibitisha na Wasilisha
                        </Button>
                      ) : null}
                    </div>
                  </div>
                </section>
              </form>
            </DialogContent>
          </Dialog>

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
                        <p className="mt-1 text-sm text-muted-foreground">
                          <ScriptureText text={item.payload.message} />
                        </p>
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
            <TabsTrigger value="mine">{t("mass_intentions_form.my_intentions", { count: myIntentions.length })}</TabsTrigger>
          </TabsList>
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

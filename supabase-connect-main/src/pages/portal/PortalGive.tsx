import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, ArrowRight, CheckCircle2, HandCoins, Heart, Loader2, Repeat2, User, WalletCards } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useNavigate, useSearchParams } from "react-router-dom";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/contexts/AuthContext";
import { useMember } from "@/hooks/useMember";
import { supabase } from "@/integrations/supabase/client";
import { formatTZSForLanguage } from "@/lib/currency";
import { useToast } from "@/hooks/use-toast";
import { normalizeAppLanguage } from "@/lib/localization";

type MemberRecord = {
  id: string;
  full_name: string | null;
  phone: string | null;
  email: string | null;
};

type ChurchRecord = {
  id: string;
  name: string | null;
};

type ContributionCategory = {
  id: string;
  name: string;
};

type ContributionRow = {
  id: string;
  amount: number;
  notes: string | null;
  category_id: string | null;
  contribution_categories?: { name: string | null } | null;
};

const CONTRIBUTION_TYPES = ["Sunday Offering", "Tithe", "Building Fund", "Charity", "Mission", "Other"];
const PRESET_AMOUNTS = [5000, 10000, 20000, 50000];
const PAYMENT_METHODS = ["Mobile Money", "Cash", "Bank Transfer"];
const CONTRIBUTION_TYPE_KEY: Record<string, string> = {
  "Sunday Offering": "sunday_offering",
  Tithe: "tithe",
  "Building Fund": "building_fund",
  Charity: "charity",
  Mission: "mission",
  Other: "other",
};
const PAYMENT_METHOD_KEY: Record<string, string> = {
  "Mobile Money": "mobile_money",
  Cash: "cash",
  "Bank Transfer": "bank_transfer",
};

function createSubmissionKey() {
  return crypto.randomUUID();
}

function normalize(value: string | null | undefined) {
  return String(value || "").trim().toLowerCase();
}

function getContributionPurpose(contribution: ContributionRow) {
  const categoryName = contribution.contribution_categories?.name;
  if (categoryName) return categoryName;

  const match = contribution.notes?.match(/^Quick Give:\s*([^|]+)/i);
  return match?.[1]?.trim() || contribution.notes || "General";
}

function findCategoryId(categories: ContributionCategory[], purpose: string) {
  const normalizedPurpose = normalize(purpose);
  return categories.find((category) => normalize(category.name) === normalizedPurpose)?.id || "";
}

export default function PortalGive() {
  const { t, i18n } = useTranslation();
  const language = normalizeAppLanguage(i18n.language) ?? "en";
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { churchId, user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const initialPurpose = searchParams.get("purpose") || CONTRIBUTION_TYPES[0];
  const initialAmount = searchParams.get("amount") || "";
  const [step, setStep] = useState(1);
  const [purpose, setPurpose] = useState(CONTRIBUTION_TYPES.includes(initialPurpose) ? initialPurpose : "Other");
  const [otherPurpose, setOtherPurpose] = useState(CONTRIBUTION_TYPES.includes(initialPurpose) ? "" : initialPurpose);
  const [amount, setAmount] = useState(initialAmount);
  const [phone, setPhone] = useState("");
  const [paymentMethod, setPaymentMethod] = useState(PAYMENT_METHODS[0]);
  const [paymentRef, setPaymentRef] = useState("");
  const [idempotencyKey, setIdempotencyKey] = useState(createSubmissionKey);

  const selectedPurpose = purpose === "Other" ? otherPurpose.trim() || "Other" : purpose;
  const selectedPurposeLabel = purpose === "Other"
    ? otherPurpose.trim() || t("member_portal.giving_account.contribution_types.other")
    : t(`member_portal.giving_account.contribution_types.${CONTRIBUTION_TYPE_KEY[purpose]}`, purpose);
  const selectedPaymentMethodLabel = t(`member_portal.giving_account.payment_methods.${PAYMENT_METHOD_KEY[paymentMethod]}`, paymentMethod);
  const parsedAmount = Number(amount);
  const validAmount = Number.isFinite(parsedAmount) && parsedAmount > 0;

  const { data: member } = useMember<MemberRecord>("id, full_name, phone, email");

  const { data: church } = useQuery({
    queryKey: ["portal-give-church", churchId],
    queryFn: async (): Promise<ChurchRecord | null> => {
      if (!churchId) return null;
      const { data, error } = await supabase.from("churches").select("id, name").eq("id", churchId).maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!churchId,
    staleTime: 10 * 60 * 1000,
  });

  const { data: categories = [] } = useQuery({
    queryKey: ["portal-categories", churchId],
    queryFn: async (): Promise<ContributionCategory[]> => {
      if (!churchId) return [];
      const { data, error } = await supabase
        .from("contribution_categories")
        .select("id, name")
        .eq("church_id", churchId)
        .order("name");

      if (error) throw error;
      return data ?? [];
    },
    enabled: !!churchId,
    staleTime: 10 * 60 * 1000,
  });

  const { data: contributionHistory = [] } = useQuery({
    queryKey: ["quick-give-history", member?.id, churchId],
    queryFn: async (): Promise<ContributionRow[]> => {
      if (!member?.id || !churchId) return [];
      const { data, error } = await supabase
        .from("contributions")
        .select("id, amount, notes, category_id, contribution_categories!contributions_category_id_fkey(name)")
        .eq("church_id", churchId)
        .eq("member_id", member.id)
        .order("date", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) throw error;
      return data ?? [];
    },
    enabled: !!member?.id && !!churchId,
    initialData: () => {
      if (!member?.id || !churchId) return undefined;
      return queryClient.getQueryData<ContributionRow[]>(["member-giving-history", member.id, churchId, "all", "all", "all"]);
    },
    staleTime: 60 * 1000,
  });

  const previousContribution = useMemo(
    () => contributionHistory.find((contribution) => normalize(getContributionPurpose(contribution)) === normalize(selectedPurpose)),
    [contributionHistory, selectedPurpose],
  );

  useEffect(() => {
    if (member?.phone && !phone) setPhone(member.phone);
  }, [member?.phone, phone]);

  useEffect(() => {
    setIdempotencyKey(createSubmissionKey());
  }, [amount, phone, paymentRef, paymentMethod, selectedPurpose]);

  const give = useMutation({
    mutationFn: async () => {
      if (!churchId) throw new Error(t("member_portal.giving_account.no_church_context"));
      if (!validAmount) throw new Error(t("member_portal.giving_account.enter_valid_amount"));

      const categoryId = findCategoryId(categories, selectedPurpose);
      const referenceParts = [paymentMethod, paymentRef.trim()].filter(Boolean);
      const { data, error } = await supabase.rpc("record_contribution_with_key" as never, {
        p_church_id: churchId,
        p_amount: parsedAmount,
        p_idempotency_key: idempotencyKey,
        p_member_id: member?.id || null,
        p_donor_name: member?.full_name || user?.email || "Member",
        p_phone: phone || null,
        p_payment_reference: referenceParts.join(" - ") || null,
        p_category_id: categoryId || null,
        p_notes: `Quick Give: ${selectedPurpose} | Payment Method: ${paymentMethod}`,
      } as never);

      if (error) throw error;
      const result = data as { success?: boolean; error?: string; id?: string } | null;
      if (!result?.success) throw new Error(result?.error || t("member_portal.giving_account.contribution_not_recorded"));
      if (!result.id) throw new Error(t("member_portal.giving_account.receipt_not_opened"));
      return result.id;
    },
    onSuccess: (contributionId) => {
      queryClient.invalidateQueries({ queryKey: ["contributions"] });
      queryClient.invalidateQueries({ queryKey: ["quick-give-history"] });
      queryClient.invalidateQueries({ queryKey: ["simple-member-home"] });
      queryClient.invalidateQueries({ queryKey: ["my-member-record"] });
      queryClient.invalidateQueries({ queryKey: ["member-giving-history"] });
      toast({
        title: t("member_portal.giving_account.thank_you"),
        description: t("member_portal.giving_account.gift_recorded", { amount: formatTZSForLanguage(parsedAmount, language) }),
      });
      navigate(`/portal/contribution-receipt/${contributionId}`);
    },
    onError: (err: any) => toast({ title: t("member_portal.giving_account.error"), description: err.message, variant: "destructive" }),
  });

  const canContinue = step === 1
    ? selectedPurpose.trim().length > 0
    : step === 2
      ? validAmount
      : step === 3
        ? paymentMethod.trim().length > 0
        : true;

  return (
    <main className="min-h-full bg-[linear-gradient(180deg,hsl(var(--background)),hsl(var(--muted)/0.35))] px-4 py-6 pb-28 lg:px-8 lg:pb-10">
    <div className="mx-auto max-w-3xl space-y-5">
      <div>
        <Button type="button" variant="ghost" size="sm" className="-ml-2 rounded-xl" onClick={() => (step > 1 ? setStep(step - 1) : navigate("/portal"))}>
          <ArrowLeft className="mr-2 h-4 w-4" aria-hidden="true" />
          {t("member_portal.common.back")}
        </Button>
        <div className="mt-4 flex items-start gap-4">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-sm">
            <Heart className="h-7 w-7" aria-hidden="true" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight md:text-3xl">{t("member_portal.giving_account.quick_give")}</h1>
            <p className="mt-1 text-sm text-muted-foreground">{t("member_portal.giving_account.quick_give_description")}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-2" role="list" aria-label={t("member_portal.giving_account.quick_give_progress")}>
        {[1, 2, 3, 4].map((item) => (
          <div
            key={item}
            className={`h-2 rounded-full ${item <= step ? "bg-primary" : "bg-muted"}`}
            role="listitem"
            aria-label={t("member_portal.giving_account.step_label", { step: item, current: item === step ? t("member_portal.giving_account.current_step_suffix") : "" })}
            aria-current={item === step ? "step" : undefined}
          />
        ))}
      </div>

      {member ? (
        <Card className="rounded-2xl border-primary/15 bg-primary/5">
          <CardContent className="flex items-center gap-3 p-4">
            <User className="h-5 w-5 text-primary" aria-hidden="true" />
            <div>
              <p className="text-sm font-medium">{member.full_name || user?.email}</p>
              <p className="text-xs text-muted-foreground">{t("member_portal.giving_account.giving_as_registered_member")}</p>
            </div>
          </CardContent>
        </Card>
      ) : null}

      <Card className="rounded-2xl bg-card/95 shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            {step === 1 ? <HandCoins className="h-4 w-4 text-primary" aria-hidden="true" /> : null}
            {step === 2 ? <WalletCards className="h-4 w-4 text-primary" aria-hidden="true" /> : null}
            {step === 3 ? <WalletCards className="h-4 w-4 text-primary" aria-hidden="true" /> : null}
            {step === 4 ? <CheckCircle2 className="h-4 w-4 text-primary" aria-hidden="true" /> : null}
            {step === 1 ? t("member_portal.giving_account.contribution_type") : step === 2 ? t("member_portal.giving_account.amount") : step === 3 ? t("member_portal.giving_account.payment_method") : t("member_portal.giving_account.confirmation")}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          {step === 1 ? (
            <>
              <div className="grid gap-3 sm:grid-cols-2">
                {CONTRIBUTION_TYPES.map((type) => (
                  <Button
                    key={type}
                    type="button"
                    variant={purpose === type ? "default" : "outline"}
                    className="h-14 justify-start rounded-xl text-left"
                    onClick={() => setPurpose(type)}
                    aria-pressed={purpose === type}
                  >
                    {t(`member_portal.giving_account.contribution_types.${CONTRIBUTION_TYPE_KEY[type]}`, type)}
                  </Button>
                ))}
              </div>
              {purpose === "Other" ? (
                <div className="space-y-2">
                  <Label htmlFor="other-purpose">{t("member_portal.giving_account.purpose")}</Label>
                  <Input id="other-purpose" value={otherPurpose} onChange={(event) => setOtherPurpose(event.target.value)} placeholder={t("member_portal.giving_account.enter_purpose")} />
                </div>
              ) : null}
              {previousContribution ? (
                <div className="rounded-xl border border-primary/20 bg-primary/5 p-4">
                  <p className="text-sm font-medium">{t("member_portal.giving_account.give_again")}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{t("member_portal.giving_account.previous_gift", { purpose: selectedPurposeLabel, amount: formatTZSForLanguage(Number(previousContribution.amount ?? 0), language) })}</p>
                  <Button type="button" className="mt-3" size="sm" onClick={() => { setAmount(String(previousContribution.amount)); setStep(3); }}>
                    <Repeat2 className="mr-2 h-4 w-4" aria-hidden="true" />
                    {t("member_portal.giving_account.give_again_amount", { amount: formatTZSForLanguage(Number(previousContribution.amount ?? 0), language) })}
                  </Button>
                </div>
              ) : null}
            </>
          ) : null}

          {step === 2 ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {PRESET_AMOUNTS.map((presetAmount) => (
                  <Button
                    key={presetAmount}
                    type="button"
                    variant={amount === String(presetAmount) ? "default" : "outline"}
                    className="h-14 rounded-xl"
                    onClick={() => setAmount(String(presetAmount))}
                    aria-pressed={amount === String(presetAmount)}
                  >
                    {formatTZSForLanguage(presetAmount, language)}
                  </Button>
                ))}
              </div>
              <div className="space-y-2">
                <Label htmlFor="custom-amount">{t("member_portal.giving_account.custom_amount")}</Label>
                <Input
                  id="custom-amount"
                  type="number"
                  min="1"
                  value={amount}
                  onChange={(event) => setAmount(event.target.value)}
                  placeholder={t("member_portal.giving_account.enter_custom_amount")}
                  className="text-lg font-semibold"
                />
              </div>
            </div>
          ) : null}

          {step === 3 ? (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>{t("member_portal.giving_account.payment_method")}</Label>
                <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                  <SelectTrigger>
                    <SelectValue placeholder={t("member_portal.giving_account.choose_payment_method")} />
                  </SelectTrigger>
                  <SelectContent>
                    {PAYMENT_METHODS.map((method) => (
                      <SelectItem key={method} value={method}>{t(`member_portal.giving_account.payment_methods.${PAYMENT_METHOD_KEY[method]}`, method)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="phone">{t("member_portal.giving_account.phone")}</Label>
                  <Input id="phone" placeholder="+255..." value={phone} onChange={(event) => setPhone(event.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="payment-reference">{t("member_portal.giving_account.payment_reference")}</Label>
                  <Input id="payment-reference" placeholder={t("member_portal.giving_account.payment_reference_placeholder")} value={paymentRef} onChange={(event) => setPaymentRef(event.target.value)} />
                </div>
              </div>
            </div>
          ) : null}

          {step === 4 ? (
            <div className="space-y-3">
              <SummaryRow label={t("member_portal.giving_account.purpose")} value={selectedPurposeLabel} />
              <SummaryRow label={t("member_portal.giving_account.amount")} value={validAmount ? formatTZSForLanguage(parsedAmount, language) : "-"} />
              <SummaryRow label={t("member_portal.giving_account.church")} value={church?.name || t("member_portal.giving_account.your_church")} />
              <SummaryRow label={t("member_portal.giving_account.payment_method")} value={selectedPaymentMethodLabel} />
              {paymentRef.trim() ? <SummaryRow label={t("member_portal.giving_account.reference")} value={paymentRef.trim()} /> : null}
              <Button type="button" className="mt-3 w-full" size="lg" disabled={give.isPending || !validAmount} onClick={() => give.mutate()}>
                {give.isPending ? <Loader2 className="mr-2 h-5 w-5 animate-spin" aria-hidden="true" /> : <HandCoins className="mr-2 h-5 w-5" aria-hidden="true" />}
                {t("member_portal.giving_account.proceed_to_payment")}
              </Button>
            </div>
          ) : null}

          {step < 4 ? (
            <div className="flex justify-end">
              <Button type="button" disabled={!canContinue} onClick={() => setStep((current) => Math.min(4, current + 1))}>
                {t("member_portal.common.continue")}
                <ArrowRight className="ml-2 h-4 w-4" aria-hidden="true" />
              </Button>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
    </main>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-xl border border-border/60 bg-background/50 p-3">
      <p className="text-sm text-muted-foreground">{label}</p>
      <Badge variant="secondary" className="max-w-[65%] justify-end truncate text-right">{value}</Badge>
    </div>
  );
}

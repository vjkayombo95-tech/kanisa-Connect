import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle2, Church, HandCoins, Loader2, ShieldCheck, Smartphone } from "lucide-react";
import { useParams, useSearchParams } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { getChurchPaymentProfile } from "@/lib/qr-payments";
import { logSupabaseError } from "@/lib/error-logger";

const QUICK_AMOUNTS = [5000, 10000, 20000];
const CONTRIBUTION_TYPES = ["Sadaka", "Zaka", "Jengo", "Shukrani", "Special Contribution"] as const;

type ContributionType = (typeof CONTRIBUTION_TYPES)[number];

type PublicGivingChurch = {
  id: string;
  name: string;
  slug: string | null;
  logo_url: string | null;
  tagline: string | null;
};

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-TZ", {
    style: "currency",
    currency: "TZS",
    maximumFractionDigits: 0,
  }).format(amount);
}

function normalizePhone(value: string) {
  return value.replace(/\s+/g, "");
}

function isValidPhoneNumber(value: string) {
  return /^\+?[0-9]{9,15}$/.test(normalizePhone(value));
}

function isValidTransactionId(value: string) {
  if (!value.trim()) return true;
  return /^[A-Za-z0-9._-]{4,80}$/.test(value.trim());
}

export default function PayPage() {
  const { churchSlugOrId } = useParams();
  const [searchParams] = useSearchParams();
  const legacyChurchId = searchParams.get("churchId")?.trim() ?? "";
  const churchLookup = (churchSlugOrId || legacyChurchId).trim();

  const [contributionType, setContributionType] = useState<ContributionType>("Sadaka");
  const [amount, setAmount] = useState("");
  const [memberName, setMemberName] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [note, setNote] = useState("");
  const [transactionId, setTransactionId] = useState("");
  const [errors, setErrors] = useState<Record<string, string | undefined>>({});
  const [successMessage, setSuccessMessage] = useState("");

  const { data: church, isLoading: churchLoading } = useQuery({
    queryKey: ["public-giving-church", churchLookup],
    queryFn: async (): Promise<PublicGivingChurch | null> => {
      if (!churchLookup) return null;

      const { data, error } = await supabase.rpc("get_public_giving_church" as never, {
        p_slug_or_id: churchLookup,
      } as never);

      if (error) {
        logSupabaseError(error, {
          page: "Public Giving",
          component: "PayPage",
          function: "submitContribution",
          operation: "rpc",
          rpc: "submit_public_contribution",
          metadata: {
            church_lookup: churchLookup,
            contribution_type: contributionType,
            has_transaction_id: Boolean(transactionId.trim()),
          },
        });
        throw error;
      }

      const rows = (data ?? []) as PublicGivingChurch[];
      return rows[0] ?? null;
    },
    enabled: !!churchLookup,
    retry: 1,
  });

  const fallbackChurch = useMemo(
    () => (churchLookup && !church ? getChurchPaymentProfile(churchLookup) : null),
    [church, churchLookup],
  );

  const displayChurch = church ?? fallbackChurch;

  const validate = () => {
    const nextErrors: Record<string, string> = {};
    const numericAmount = Number(amount);

    if (!churchLookup) {
      nextErrors.church = "Missing church giving link. Scan a valid church QR code first.";
    }

    if (!church) {
      nextErrors.church = "We could not find this church giving page.";
    }

    if (!amount.trim() || Number.isNaN(numericAmount) || numericAmount <= 0) {
      nextErrors.amount = "Enter an amount greater than zero.";
    }

    if (memberName.trim().length < 2) {
      nextErrors.memberName = "Enter your name.";
    }

    if (!isValidPhoneNumber(phoneNumber)) {
      nextErrors.phoneNumber = "Enter a valid phone number.";
    }

    if (!isValidTransactionId(transactionId)) {
      nextErrors.transactionId = "Use letters, numbers, dots, dashes, or underscores only.";
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const submitContribution = useMutation({
    mutationFn: async () => {
      if (!validate()) return null;

      const { data, error } = await supabase.rpc("submit_public_contribution" as never, {
        p_church_slug_or_id: churchLookup,
        p_contribution_type: contributionType,
        p_amount: Number(amount),
        p_donor_name: memberName.trim(),
        p_phone: normalizePhone(phoneNumber),
        p_note: note.trim() || null,
        p_transaction_id: transactionId.trim() || null,
      } as never);

      if (error) throw error;

      const result = data as { success?: boolean; error?: string; message?: string } | null;
      if (!result?.success) {
        throw new Error(result?.error || "Contribution could not be submitted.");
      }

      return result;
    },
    onSuccess: (result) => {
      if (!result) return;
      setSuccessMessage(result.message || "Thank you. Your contribution has been submitted for confirmation.");
      setErrors({});
      setAmount("");
      setNote("");
      setTransactionId("");
    },
    onError: (error) => {
      logSupabaseError(error, {
        page: "Public Giving",
        component: "PayPage",
        function: "submitContribution",
        operation: "rpc",
        rpc: "submit_public_contribution",
        metadata: {
          church_lookup: churchLookup,
          contribution_type: contributionType,
          has_transaction_id: Boolean(transactionId.trim()),
        },
      });
      setErrors((current) => ({
        ...current,
        submit: error instanceof Error ? error.message : "Contribution could not be submitted.",
      }));
    },
  });

  return (
    <div className="min-h-screen bg-background px-4 py-8 sm:px-6">
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-5xl items-center">
        <div className="grid w-full gap-6 lg:grid-cols-[0.95fr_1.05fr]">
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45 }}
            className="relative overflow-hidden rounded-[32px] border border-primary/15 bg-[radial-gradient(circle_at_top_left,rgba(245,158,11,0.12),transparent_34%),linear-gradient(180deg,rgba(11,15,22,0.98),rgba(14,20,30,0.94))] p-6 shadow-[0_35px_90px_-48px_rgba(0,0,0,0.92)] sm:p-8"
          >
            <div className="pointer-events-none absolute inset-x-10 top-0 h-28 rounded-full bg-primary/10 blur-3xl" />
            <div className="relative">
              <p className="text-xs font-semibold uppercase tracking-[0.28em] text-primary/75">Secure Giving</p>
              <div className="mt-5 flex items-center gap-4">
                {displayChurch?.logo_url ? (
                  <img
                    src={displayChurch.logo_url}
                    alt={`${displayChurch.name} logo`}
                    loading="lazy"
                    className="h-16 w-16 rounded-2xl border border-primary/20 object-cover"
                  />
                ) : (
                  <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 text-primary">
                    <Church className="h-8 w-8" />
                  </div>
                )}
                <div className="min-w-0">
                  <h1 className="text-3xl font-semibold text-foreground">
                    {churchLoading ? "Loading church..." : displayChurch?.name ?? "Church giving"}
                  </h1>
                  <p className="mt-2 max-w-md text-sm leading-6 text-muted-foreground">
                    {displayChurch?.tagline ?? "Use the giving form to submit your contribution securely."}
                  </p>
                </div>
              </div>

              <div className="mt-8 space-y-4">
                <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 text-primary">
                      <ShieldCheck className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-foreground">Submitted for confirmation</p>
                      <p className="text-sm text-muted-foreground">Your contribution request is recorded for church confirmation.</p>
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 text-primary">
                      <HandCoins className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-foreground">Fast contribution flow</p>
                      <p className="text-sm text-muted-foreground">Choose a type, enter the amount, and add your transaction reference.</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 18 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.45, delay: 0.08 }}
          >
            <Card className="overflow-hidden rounded-[32px] border-white/8 bg-card/90 shadow-[0_28px_70px_-42px_rgba(0,0,0,0.8)]">
              <CardContent className="space-y-5 p-6 sm:p-8">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.24em] text-primary/80">Giving Form</p>
                  <h2 className="mt-2 text-2xl font-semibold text-foreground">Submit your contribution</h2>
                  <p className="mt-2 text-sm text-muted-foreground">No login required.</p>
                  {errors.church || errors.submit ? (
                    <p className="mt-3 rounded-xl border border-destructive/25 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                      {errors.church || errors.submit}
                    </p>
                  ) : null}
                </div>

                <div className="space-y-2">
                  <Label>Contribution type</Label>
                  <Select value={contributionType} onValueChange={(value) => setContributionType(value as ContributionType)}>
                    <SelectTrigger className="h-12 rounded-2xl border-white/10 bg-background/80">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CONTRIBUTION_TYPES.map((type) => (
                        <SelectItem key={type} value={type}>{type}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="amount">Amount</Label>
                  <Input
                    id="amount"
                    type="number"
                    min="1"
                    inputMode="numeric"
                    placeholder="Enter amount"
                    value={amount}
                    onChange={(event) => {
                      setAmount(event.target.value);
                      setErrors((current) => ({ ...current, amount: undefined }));
                    }}
                    className="h-12 rounded-2xl border-white/10 bg-background/80 px-4"
                  />
                  {errors.amount ? <p className="text-sm text-destructive">{errors.amount}</p> : null}
                </div>

                <div className="grid grid-cols-3 gap-3">
                  {QUICK_AMOUNTS.map((quickAmount) => (
                    <motion.div key={quickAmount} whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.98 }}>
                      <Button
                        type="button"
                        variant="outline"
                        className="h-12 w-full rounded-2xl border-white/10 bg-background/60 text-foreground hover:border-primary/40 hover:bg-primary/10"
                        onClick={() => {
                          setAmount(String(quickAmount));
                          setErrors((current) => ({ ...current, amount: undefined }));
                        }}
                      >
                        {quickAmount.toLocaleString()}
                      </Button>
                    </motion.div>
                  ))}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="memberName">Member name</Label>
                  <Input
                    id="memberName"
                    placeholder="Your name"
                    value={memberName}
                    onChange={(event) => {
                      setMemberName(event.target.value);
                      setErrors((current) => ({ ...current, memberName: undefined }));
                    }}
                    className="h-12 rounded-2xl border-white/10 bg-background/80"
                  />
                  {errors.memberName ? <p className="text-sm text-destructive">{errors.memberName}</p> : null}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="phoneNumber">Phone number</Label>
                  <div className="relative">
                    <Smartphone className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="phoneNumber"
                      type="tel"
                      inputMode="tel"
                      placeholder="e.g. 0712345678 or +255712345678"
                      value={phoneNumber}
                      onChange={(event) => {
                        setPhoneNumber(event.target.value);
                        setErrors((current) => ({ ...current, phoneNumber: undefined }));
                      }}
                      className="h-12 rounded-2xl border-white/10 bg-background/80 pl-11"
                    />
                  </div>
                  {errors.phoneNumber ? <p className="text-sm text-destructive">{errors.phoneNumber}</p> : null}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="transactionId">Transaction ID</Label>
                  <Input
                    id="transactionId"
                    placeholder="Payment reference after sending"
                    value={transactionId}
                    onChange={(event) => {
                      setTransactionId(event.target.value);
                      setErrors((current) => ({ ...current, transactionId: undefined }));
                    }}
                    className="h-12 rounded-2xl border-white/10 bg-background/80"
                  />
                  {errors.transactionId ? <p className="text-sm text-destructive">{errors.transactionId}</p> : null}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="note">Optional note</Label>
                  <Textarea
                    id="note"
                    placeholder="Add a note if needed"
                    value={note}
                    onChange={(event) => setNote(event.target.value)}
                    className="min-h-24 rounded-2xl border-white/10 bg-background/80"
                  />
                </div>

                <motion.div whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }}>
                  <Button
                    className="h-12 w-full rounded-2xl text-base shadow-[0_18px_40px_-24px_rgba(245,158,11,0.7)]"
                    onClick={() => submitContribution.mutate()}
                    disabled={submitContribution.isPending || churchLoading || !churchLookup}
                  >
                    {submitContribution.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    Submit Contribution
                  </Button>
                </motion.div>

                <AnimatePresence mode="wait">
                  {successMessage ? (
                    <motion.div
                      key="success"
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -8 }}
                      className="rounded-2xl border border-primary/25 bg-primary/10 p-4"
                    >
                      <div className="flex items-start gap-3">
                        <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                        <div>
                          <p className="text-base font-medium text-foreground">{successMessage}</p>
                          <p className="mt-1 text-sm text-muted-foreground">
                            {amount ? `${formatCurrency(Number(amount))} submitted for ${displayChurch?.name ?? "this church"}.` : "Your request is ready for confirmation."}
                          </p>
                        </div>
                      </div>
                    </motion.div>
                  ) : null}
                </AnimatePresence>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </div>
    </div>
  );
}

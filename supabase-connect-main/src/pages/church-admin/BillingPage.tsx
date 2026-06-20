import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { CheckCircle2, Clock, CreditCard, Loader2, Lock, Puzzle, Star, Upload, Users } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/contexts/AuthContext";
import { useBillingAccess } from "@/hooks/use-billing-access";
import { BILLING_ADDONS, BILLING_PLANS, BillingPlan, ENABLE_MEMBER_PORTAL_BILLING, getPlanDefinition } from "@/lib/billing";
import { formatTZS } from "@/lib/currency";
import { supabase } from "@/integrations/supabase/client";
import { usePaginatedQuery } from "@/hooks/use-paginated-query";
import { assertClientRateLimit } from "@/lib/client-rate-limit";
import { logSupabaseError } from "@/lib/error-logger";

type SubscriptionPayment = {
  id: string;
  plan: BillingPlan;
  amount: number;
  payment_reference: string;
  status: "pending" | "approved" | "rejected";
  created_at: string;
  rejection_reason: string | null;
};

const DEFAULT_PAYMENT_INSTRUCTIONS = {
  billing_payment_method: "Mobile Money / Lipa Namba",
  billing_lipa_number: "Contact support for the current Lipa Namba",
  billing_payment_instructions: "Pay the exact amount, then enter your transaction reference below for verification.",
};

export default function BillingPage() {
  const { churchId } = useAuth();
  const queryClient = useQueryClient();
  const [selectedPlan, setSelectedPlan] = useState<BillingPlan | null>(null);
  const [paymentReference, setPaymentReference] = useState("");
  const [payerPhone, setPayerPhone] = useState("");
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [paymentTotalCount, setPaymentTotalCount] = useState(0);
  const paymentPagination = usePaginatedQuery({ totalCount: paymentTotalCount, resetKey: churchId });
  const { subscription, addons, currentPlan, currentPlanDefinition, currentStatus, memberLimit, isExpired, hasAddon, isLoading, isTrial, trialDaysRemaining } = useBillingAccess();
  const { data: memberCount = 0 } = useQuery({
    queryKey: ["billing-member-count", churchId],
    queryFn: async () => {
      if (!churchId) return 0;
      const { count, error } = await supabase
        .from("members")
        .select("id", { count: "exact", head: true })
        .eq("church_id", churchId);
      if (error) throw error;
      return count ?? 0;
    },
    enabled: !!churchId,
  });
  const memberUsageRatio = memberLimit ? memberCount / memberLimit : 0;
  const nearMemberLimit = memberLimit !== null && memberUsageRatio >= 0.8;

  const { data: paymentInstructions = DEFAULT_PAYMENT_INSTRUCTIONS } = useQuery({
    queryKey: ["billing-payment-instructions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("platform_settings")
        .select("billing_payment_method, billing_lipa_number, billing_payment_instructions")
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      return data ?? DEFAULT_PAYMENT_INSTRUCTIONS;
    },
  });

  const { data: paymentRequestsPage = { rows: [] as SubscriptionPayment[], count: 0 } } = useQuery({
    queryKey: ["subscription-payments", churchId, paymentPagination.page, paymentPagination.pageSize],
    queryFn: async () => {
      if (!churchId) return { rows: [] as SubscriptionPayment[], count: 0 };
      const { data, error, count } = await supabase
        .from("subscription_payments")
        .select("id, plan, amount, payment_reference, status, created_at, rejection_reason", { count: "exact" })
        .eq("church_id", churchId)
        .order("created_at", { ascending: false })
        .range(paymentPagination.from, paymentPagination.to);

      if (error) throw error;
      return { rows: (data ?? []) as SubscriptionPayment[], count: count ?? 0 };
    },
    enabled: !!churchId,
  });
  const paymentRequests = paymentRequestsPage.rows;

  useEffect(() => {
    setPaymentTotalCount(paymentRequestsPage.count);
  }, [paymentRequestsPage.count]);
  const pendingPayment = paymentRequests.find((payment) => payment.status === "pending");
  const mostRecentRejectedPayment = paymentRequests.find((payment) => payment.status === "rejected");

  const submitPaymentMutation = useMutation({
    mutationFn: async (plan: BillingPlan) => {
      if (!churchId) {
        throw new Error("No church selected.");
      }

      if (plan === "free") {
        throw new Error("Select a paid plan to submit payment.");
      }

      if (!paymentReference.trim()) {
        throw new Error("Enter your mobile-money transaction reference.");
      }

      assertClientRateLimit(`payment-submit:${churchId}`, 3, 15 * 60 * 1000, "payment submissions");

      let receiptUrl: string | null = null;
      if (receiptFile) {
        if (receiptFile.size > 5 * 1024 * 1024) {
          throw new Error("Receipt file must be 5MB or smaller.");
        }

        const safeFileName = receiptFile.name.replace(/[^a-zA-Z0-9._-]/g, "-");
        const receiptPath = `${churchId}/${crypto.randomUUID()}-${safeFileName}`;
        const { error: uploadError } = await supabase.storage
          .from("billing-receipts")
          .upload(receiptPath, receiptFile, { contentType: receiptFile.type || undefined });

        if (uploadError) {
          logSupabaseError(uploadError, {
            page: "Billing",
            component: "BillingPage",
            function: "submitPayment",
            church_id: churchId,
            operation: "storage.upload",
            bucket: "billing-receipts",
            metadata: { plan, receipt_size: receiptFile.size },
          });
          throw uploadError;
        }
        receiptUrl = receiptPath;
      }

      const { error } = await supabase.rpc("submit_subscription_payment", {
        _church_id: churchId,
        _plan: plan,
        _payment_reference: paymentReference.trim(),
        _payer_phone: payerPhone.trim() || null,
        _receipt_url: receiptUrl,
      });

      if (error) {
        logSupabaseError(error, {
          page: "Billing",
          component: "BillingPage",
          function: "submitPayment",
          church_id: churchId,
          operation: "rpc",
          rpc: "submit_subscription_payment",
          metadata: { plan, has_receipt: !!receiptUrl },
        });
        throw error;
      }
    },
    onSuccess: async (_, plan) => {
      toast.success(`${getPlanDefinition(plan).name} payment submitted for verification.`);
      setSelectedPlan(null);
      setPaymentReference("");
      setPayerPhone("");
      setReceiptFile(null);
      await queryClient.invalidateQueries({ queryKey: ["subscription-payments", churchId] });
    },
    onError: (error: Error) => {
      toast.error(error.message || "Unable to submit payment.");
    },
  });

  const unlockAddonMutation = useMutation({
    mutationFn: async () => {
      if (!churchId) {
        throw new Error("No church selected.");
      }

      const { error } = await supabase.from("addons").upsert(
        {
          church_id: churchId,
          addon_name: "member_portal",
          purchased: true,
          purchased_at: new Date().toISOString(),
        },
        {
          onConflict: "church_id,addon_name",
        },
      );

      if (error) {
        throw error;
      }
    },
    onSuccess: async () => {
      toast.success("Member Portal unlocked.");
      await queryClient.invalidateQueries({ queryKey: ["billing-addons", churchId] });
    },
    onError: (error: Error) => {
      toast.error(error.message || "Unable to unlock add-on.");
    },
  });

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold font-serif">Billing & Subscription</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Manage your church plan, expiry, and add-ons for Kanisa Connect.
        </p>
      </div>

      <Card className="glass-card gold-glow border-primary/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base font-sans">
            <CreditCard className="h-4 w-4 text-primary" />
            Current Subscription
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <h2 className="text-2xl font-bold font-serif">{currentPlanDefinition.name}</h2>
              {isExpired && <Badge variant="outline" className="border-destructive/30 text-destructive">Expired</Badge>}
              {!isExpired && <Badge variant="outline" className="border-success/30 text-success capitalize">{currentStatus}</Badge>}
            </div>
            <p className="text-sm text-muted-foreground">{currentPlanDefinition.description}</p>
            <p className="text-sm text-muted-foreground">
              {currentPlanDefinition.price === 0 ? "Default free plan" : `${formatTZS(currentPlanDefinition.price)} per month`}
            </p>
            {subscription.expires_at && (
              <p className="text-xs text-muted-foreground">
                {isTrial ? "Trial expires" : "Expires"} on {new Date(subscription.expires_at).toLocaleDateString()}
              </p>
            )}
            <p className="text-xs text-muted-foreground">
              Member usage: {memberLimit === null ? `${memberCount} / Unlimited` : `${memberCount} / ${memberLimit} members`}
            </p>
          </div>

          <div className="rounded-2xl border border-border/60 bg-background/50 p-4">
            <p className="text-xs uppercase tracking-[0.22em] text-primary">Portal Add-on</p>
            <p className="mt-2 text-sm font-medium">
              {!ENABLE_MEMBER_PORTAL_BILLING
                ? "Member Portal is currently free"
                : hasAddon("member_portal")
                  ? "Member Portal unlocked"
                  : "Member Portal locked"}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {!ENABLE_MEMBER_PORTAL_BILLING
                ? "Member Portal currently free during early access."
                : hasAddon("member_portal")
                  ? "Members can access the portal experience."
                  : "Unlock once for 50,000 TZS."}
            </p>
          </div>
        </CardContent>
      </Card>

      {nearMemberLimit && (
        <Card className="glass-card border-primary/30 bg-primary/8">
          <CardContent className="p-5">
            <p className="text-sm font-semibold text-primary">You are approaching your member limit</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Your workspace is using {memberCount} of {memberLimit} member places. Upgrade to keep adding members without interruption.
            </p>
          </CardContent>
        </Card>
      )}

      {pendingPayment && (
        <Card className="glass-card border-primary/30 bg-primary/8">
          <CardContent className="flex flex-col gap-3 p-5 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="flex items-center gap-2 text-sm font-semibold text-primary">
                <Clock className="h-4 w-4" />
                Payment pending verification
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                Your {getPlanDefinition(pendingPayment.plan).name} payment of {formatTZS(Number(pendingPayment.amount))} was submitted on{" "}
                {new Date(pendingPayment.created_at).toLocaleDateString()}. Your current plan remains active until approval.
              </p>
              <p className="mt-1 text-xs text-muted-foreground">Reference: {pendingPayment.payment_reference}</p>
            </div>
            <Badge variant="outline" className="w-fit border-primary/30 text-primary">Pending</Badge>
          </CardContent>
        </Card>
      )}

      {!pendingPayment && mostRecentRejectedPayment && (
        <Card className="glass-card border-destructive/25 bg-destructive/5">
          <CardContent className="p-5">
            <p className="text-sm font-semibold text-destructive">Latest payment submission was rejected</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {mostRecentRejectedPayment.rejection_reason || "Please check the payment reference or receipt and submit again."}
            </p>
          </CardContent>
        </Card>
      )}

      {isTrial && (
        <Card className="glass-card border-primary/30 bg-primary/8">
          <CardContent className="flex flex-col gap-2 p-5 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-sm font-semibold text-primary">Free Trial - {trialDaysRemaining} days remaining</p>
              <p className="text-sm text-muted-foreground">
                Your church currently has full Pro access while the 7-day onboarding trial is active.
              </p>
            </div>
            <Badge className="gradient-gold text-primary-foreground">Trial</Badge>
          </CardContent>
        </Card>
      )}

      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <Star className="h-4 w-4 text-primary" />
          <h2 className="text-lg font-semibold font-serif">Plans</h2>
        </div>

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-5">
          {BILLING_PLANS.map((plan) => {
            const isCurrent = plan.id === currentPlan;
            const isRecommended = plan.highlighted;
            const isBusy = submitPaymentMutation.isPending && submitPaymentMutation.variables === plan.id;

            return (
              <Card
                key={plan.id}
                className={[
                  "glass-card relative flex h-full flex-col border-border/60 transition-all duration-200",
                  isCurrent ? "ring-2 ring-primary/35 gold-glow" : "hover:border-primary/20 hover:gold-glow",
                  isRecommended ? "overflow-hidden border-primary/30" : "",
                ].join(" ")}
              >
                {isRecommended && (
                  <div className="absolute right-4 top-4 rounded-full bg-primary px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-primary-foreground">
                    Recommended
                  </div>
                )}

                <CardHeader className="space-y-3">
                  <div className="space-y-1">
                    <CardTitle className="text-base font-sans">{plan.name}</CardTitle>
                    <p className="text-sm text-muted-foreground">{plan.description}</p>
                  </div>
                  <div>
                    <p className="text-3xl font-bold font-serif">
                      {formatTZS(plan.price)}
                      <span className="ml-1 text-sm font-normal text-muted-foreground">
                        {plan.price === 0 ? "" : "/month"}
                      </span>
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {plan.maxMembers ? `Up to ${plan.maxMembers} members` : "Unlimited members"}
                    </p>
                  </div>
                </CardHeader>

                <CardContent className="flex flex-1 flex-col gap-4">
                  <ul className="space-y-2">
                    {plan.features.map((feature) => (
                      <li key={feature} className="flex items-start gap-2 text-sm text-muted-foreground">
                        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" />
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>

                  <div className="mt-auto">
                    {isCurrent ? (
                      <Button className="w-full" disabled>
                        Current Plan
                      </Button>
                    ) : plan.price === 0 ? (
                      <Button className="w-full" variant="outline" disabled>
                        Free Plan
                      </Button>
                    ) : (
                      <Button
                        className="w-full"
                        variant={isRecommended ? "default" : "outline"}
                        onClick={() => setSelectedPlan(plan.id)}
                        disabled={submitPaymentMutation.isPending || !!pendingPayment || !churchId}
                      >
                        {isBusy ? "Submitting..." : pendingPayment ? "Verification Pending" : "Select & Pay"}
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </section>

      {ENABLE_MEMBER_PORTAL_BILLING ? (
        <section className="space-y-4">
          <div className="flex items-center gap-2">
            <Puzzle className="h-4 w-4 text-primary" />
            <h2 className="text-lg font-semibold font-serif">One-Time Add-on</h2>
          </div>

          {BILLING_ADDONS.map((addon) => {
            const purchased = hasAddon(addon.id);

            return (
              <Card key={addon.id} className="glass-card border-primary/20">
                <CardContent className="grid gap-6 p-6 lg:grid-cols-[1.2fr,0.8fr]">
                  <div className="space-y-4">
                    <div className="flex flex-wrap items-center gap-3">
                      <h3 className="text-xl font-bold font-serif">{addon.name}</h3>
                      <Badge className="gradient-gold text-primary-foreground">One-Time</Badge>
                      {purchased && <Badge variant="outline" className="border-success/30 text-success">Unlocked</Badge>}
                    </div>

                    <p className="text-sm text-muted-foreground">{addon.description}</p>

                    <ul className="grid gap-2 md:grid-cols-2">
                      {addon.features.map((feature) => (
                        <li key={feature} className="flex items-start gap-2 text-sm text-muted-foreground">
                          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" />
                          <span>{feature}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="rounded-2xl border border-border/60 bg-background/40 p-5">
                    <p className="text-xs uppercase tracking-[0.22em] text-primary">Unlock Member Portal</p>
                    <p className="mt-2 text-3xl font-bold font-serif">{formatTZS(addon.price)}</p>
                    <p className="mt-2 text-sm text-muted-foreground">
                      Give members their own login, dashboard, prayers, and contribution history.
                    </p>
                    <Button
                      className="mt-5 w-full"
                      onClick={() => unlockAddonMutation.mutate()}
                      disabled={unlockAddonMutation.isPending || purchased || !churchId}
                    >
                      {purchased ? "Already Unlocked" : "Unlock Member Portal"}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </section>
      ) : (
        <Card className="glass-card border-primary/20 bg-primary/5">
          <CardContent className="flex items-center justify-between gap-4 p-5">
            <div>
              <p className="text-sm font-semibold text-primary">Member Portal currently free during early access</p>
              <p className="text-sm text-muted-foreground">
                Billing for the Member Portal is temporarily disabled. You can re-enable it later by toggling `ENABLE_MEMBER_PORTAL_BILLING`.
              </p>
            </div>
            <Badge className="gradient-gold text-primary-foreground">Early Access</Badge>
          </CardContent>
        </Card>
      )}

      <section className="grid gap-4 lg:grid-cols-2">
        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base font-sans">
              <Lock className="h-4 w-4 text-primary" />
              Feature Locking
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <p>Locked features will show a clear upgrade state with a premium call-to-action.</p>
            <p>Examples wired in this build:</p>
            <p>`Analytics` is gated behind the `pro` tier.</p>
            <p>
              {ENABLE_MEMBER_PORTAL_BILLING
                ? "`Member Portal` is gated behind the one-time add-on purchase."
                : "`Member Portal` is temporarily free during early access."}
            </p>
          </CardContent>
        </Card>

        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base font-sans">
              <Users className="h-4 w-4 text-primary" />
              Subscription Logic
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <p>Each church has a single current subscription. New workspaces begin on a Pro trial.</p>
            <p>Paid upgrades become active only after Super Admin verifies the submitted mobile-money payment.</p>
            <p>Expiry is supported through the `expires_at` column and automatically falls back to `Free` in the UI.</p>
          </CardContent>
        </Card>
      </section>

      {isLoading && (
        <p className="text-sm text-muted-foreground">Loading billing details...</p>
      )}

      <Dialog open={selectedPlan !== null} onOpenChange={(open) => !open && setSelectedPlan(null)}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Submit Lipa Namba Payment</DialogTitle>
            <DialogDescription>
              Your plan changes only after a Super Admin verifies this payment.
            </DialogDescription>
          </DialogHeader>

          {selectedPlan && (
            <div className="space-y-4">
              <div className="rounded-xl border border-primary/20 bg-primary/5 p-4">
                <div className="flex items-center justify-between">
                  <p className="font-medium">{getPlanDefinition(selectedPlan).name} Plan</p>
                  <p className="text-lg font-semibold text-primary">{formatTZS(getPlanDefinition(selectedPlan).price)}</p>
                </div>
                <p className="mt-3 text-xs uppercase tracking-[0.2em] text-muted-foreground">{paymentInstructions.billing_payment_method}</p>
                <p className="mt-1 text-xl font-semibold">{paymentInstructions.billing_lipa_number}</p>
                <p className="mt-2 text-sm text-muted-foreground">{paymentInstructions.billing_payment_instructions}</p>
                <p className="mt-2 text-sm text-muted-foreground">
                  Use your church name as the payment reference where possible, then provide the mobile-money transaction code below.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="payment-reference">Transaction Reference *</Label>
                <Input
                  id="payment-reference"
                  value={paymentReference}
                  onChange={(event) => setPaymentReference(event.target.value)}
                  placeholder="e.g. QFH4AB12CD"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="payer-phone">Payer Phone Number</Label>
                <Input
                  id="payer-phone"
                  value={payerPhone}
                  onChange={(event) => setPayerPhone(event.target.value)}
                  placeholder="e.g. 2557..."
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="payment-receipt">Receipt (optional)</Label>
                <Input
                  id="payment-receipt"
                  type="file"
                  accept="image/png,image/jpeg,image/webp,application/pdf"
                  onChange={(event) => setReceiptFile(event.target.files?.[0] ?? null)}
                />
                <p className="text-xs text-muted-foreground">
                  PNG, JPG, WebP, or PDF up to 5MB. Receipts are stored privately for verification.
                </p>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedPlan(null)} disabled={submitPaymentMutation.isPending}>
              Cancel
            </Button>
            <Button
              onClick={() => selectedPlan && submitPaymentMutation.mutate(selectedPlan)}
              disabled={!selectedPlan || !paymentReference.trim() || submitPaymentMutation.isPending}
            >
              {submitPaymentMutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Upload className="mr-2 h-4 w-4" />
              )}
              Submit Payment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

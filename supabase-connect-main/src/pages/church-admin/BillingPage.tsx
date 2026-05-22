import { useMutation, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, CreditCard, Lock, Puzzle, Sparkles, Star, Users } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/contexts/AuthContext";
import { useBillingAccess } from "@/hooks/use-billing-access";
import { BILLING_ADDONS, BILLING_PLANS, BillingPlan, ENABLE_MEMBER_PORTAL_BILLING, getPlanDefinition } from "@/lib/billing";
import { formatTZS } from "@/lib/currency";
import { supabase } from "@/integrations/supabase/client";

function nextBillingDate(plan: BillingPlan) {
  if (plan === "free") {
    return null;
  }

  const nextDate = new Date();
  nextDate.setMonth(nextDate.getMonth() + 1);
  return nextDate.toISOString();
}

export default function BillingPage() {
  const { churchId } = useAuth();
  const queryClient = useQueryClient();
  const { subscription, addons, currentPlan, currentPlanDefinition, isExpired, hasAddon, isLoading, isTrial, trialDaysRemaining } = useBillingAccess();

  const upgradePlanMutation = useMutation({
    mutationFn: async (plan: BillingPlan) => {
      if (!churchId) {
        throw new Error("No church selected.");
      }

      await supabase
        .from("subscriptions")
        .update({
          status: "expired",
          expires_at: new Date().toISOString(),
        })
        .eq("church_id", churchId)
        .eq("status", "active");

      const { error } = await supabase.from("subscriptions").insert({
        church_id: churchId,
        plan,
        status: "active",
        started_at: new Date().toISOString(),
        expires_at: nextBillingDate(plan),
      });

      if (error) {
        throw error;
      }
    },
    onSuccess: async (_, plan) => {
      toast.success(`${getPlanDefinition(plan).name} plan activated.`);
      await queryClient.invalidateQueries({ queryKey: ["billing-subscription", churchId] });
    },
    onError: (error: Error) => {
      toast.error(error.message || "Unable to update plan.");
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
              {!isExpired && <Badge variant="outline" className="border-success/30 text-success">{subscription.status}</Badge>}
            </div>
            <p className="text-sm text-muted-foreground">{currentPlanDefinition.description}</p>
            <p className="text-sm text-muted-foreground">
              {currentPlanDefinition.price === 0 ? "Default free plan" : `${formatTZS(currentPlanDefinition.price)} per month`}
            </p>
            {subscription.expires_at && (
              <p className="text-xs text-muted-foreground">
                Expires on {new Date(subscription.expires_at).toLocaleDateString()}
              </p>
            )}
            <p className="text-xs text-muted-foreground">
              Member limit: {currentPlanDefinition.maxMembers ? `${currentPlanDefinition.maxMembers} members` : "Unlimited members"}
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
            const isBusy = upgradePlanMutation.isPending && upgradePlanMutation.variables === plan.id;

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
                    ) : (
                      <Button
                        className="w-full"
                        variant={isRecommended ? "default" : "outline"}
                        onClick={() => upgradePlanMutation.mutate(plan.id)}
                        disabled={upgradePlanMutation.isPending || !churchId}
                      >
                        {isBusy ? "Updating..." : "Upgrade"}
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
            <p>Each church has a single active subscription. Default plan is `Free`.</p>
            <p>Upgrades create a fresh active subscription and mark the previous one as expired.</p>
            <p>Expiry is supported through the `expires_at` column and automatically falls back to `Free` in the UI.</p>
          </CardContent>
        </Card>
      </section>

      {isLoading && (
        <p className="text-sm text-muted-foreground">Loading billing details...</p>
      )}
    </div>
  );
}

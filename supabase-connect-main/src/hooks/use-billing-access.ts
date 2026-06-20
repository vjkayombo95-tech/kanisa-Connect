import { useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";

import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import {
  AddonRecord,
  BillingAddonName,
  BillingFeature,
  BillingPlan,
  SubscriptionRecord,
  getPlanDefinition,
  getMemberLimit,
  hasMemberPortalAccess,
  getTrialDaysRemaining,
  hasAddon,
  hasFeature,
  isMissingBillingTableError,
  isSubscriptionExpired,
} from "@/lib/billing";

export function useBillingAccess(options: { enabled?: boolean } = {}) {
  const { churchId } = useAuth();
  const enabled = options.enabled ?? true;

  const subscriptionQuery = useQuery({
    queryKey: ["billing-subscription", churchId],
    queryFn: async () => {
      if (!churchId) {
        return null;
      }

      const { data, error } = await supabase
        .from("subscriptions")
        .select("*")
        .eq("church_id", churchId)
        .in("status", ["active", "trial"])
        .order("started_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error && isMissingBillingTableError(error)) {
        return { subscription: null, configured: false };
      }

      if (error) {
        throw error;
      }

      return { subscription: (data ?? null) as SubscriptionRecord | null, configured: true };
    },
    enabled: enabled && !!churchId,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  useEffect(() => {
    const subscription = subscriptionQuery.data?.subscription;
    if (!churchId || !subscription || !subscription.expires_at) {
      return;
    }

    if (!["active", "trial"].includes(subscription.status)) {
      return;
    }

    if (new Date(subscription.expires_at).getTime() >= Date.now()) {
      return;
    }

    void supabase
      .from("subscriptions")
      .update({
        plan: "free",
        status: "expired",
      })
      .eq("id", subscription.id)
      .then(async ({ error }) => {
        if (!error) {
          await subscriptionQuery.refetch();
        }
      });
  }, [churchId, subscriptionQuery.data, subscriptionQuery.refetch]);

  const addonsQuery = useQuery({
    queryKey: ["billing-addons", churchId],
    queryFn: async () => {
      if (!churchId) {
        return [];
      }

      const { data, error } = await supabase
        .from("addons")
        .select("*")
        .eq("church_id", churchId);

      if (error && isMissingBillingTableError(error)) {
        return [];
      }

      if (error) {
        throw error;
      }

      return (data ?? []) as AddonRecord[];
    },
    enabled: enabled && !!churchId,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const resolved = useMemo(() => {
    const rawSubscription = subscriptionQuery.data?.subscription ?? null;
    const addons = addonsQuery.data ?? [];
    const expired = isSubscriptionExpired(rawSubscription);
    const billingConfigured = subscriptionQuery.data?.configured ?? true;

    const subscription: SubscriptionRecord = rawSubscription ?? {
      id: "free",
      church_id: churchId ?? "",
      plan: "free",
      status: "active",
      started_at: new Date(0).toISOString(),
      expires_at: null,
    };

    const currentPlan: BillingPlan = expired ? "free" : subscription.plan;
    const currentStatus = expired ? "expired" : subscription.status;
    const memberLimit = billingConfigured ? getMemberLimit(currentPlan, currentStatus) : null;

    return {
      subscription,
      addons,
      currentPlan,
      currentStatus,
      currentPlanDefinition: getPlanDefinition(currentPlan),
      billingConfigured,
      isExpired: expired,
      isTrial: currentStatus === "trial",
      trialDaysRemaining: currentStatus === "trial" ? getTrialDaysRemaining(subscription.expires_at) : 0,
      memberLimit,
      memberPortalAccess: hasMemberPortalAccess(currentPlan, addons, currentStatus),
      hasFeature: (feature: BillingFeature) => hasFeature(currentPlan, feature, currentStatus),
      hasAddon: (addonName: BillingAddonName) => currentStatus === "trial" || hasAddon(addons, addonName),
    };
  }, [addonsQuery.data, churchId, subscriptionQuery.data]);

  return {
    ...resolved,
    isLoading: subscriptionQuery.isLoading || addonsQuery.isLoading,
    refetch: async () => {
      await Promise.all([subscriptionQuery.refetch(), addonsQuery.refetch()]);
    },
  };
}

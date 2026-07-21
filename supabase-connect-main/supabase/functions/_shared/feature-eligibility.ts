import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

type ServiceClient = ReturnType<typeof createClient>;

// Service-role jobs bypass RLS by design, so they must enforce tenant feature
// state and subscription eligibility explicitly before processing tenant data.
export async function isServiceFeatureAvailable(
  client: ServiceClient,
  churchId: string,
  featureKey: string,
): Promise<boolean> {
  const { data: feature, error: featureError } = await client
    .from("platform_features")
    .select("id, globally_enabled, available_plans")
    .eq("key", featureKey)
    .maybeSingle();
  if (featureError || !feature?.globally_enabled || !Array.isArray(feature.available_plans)) return false;

  const [{ data: churchFeature, error: churchError }, { data: subscription, error: subscriptionError }] = await Promise.all([
    client.from("church_features").select("enabled").eq("church_id", churchId).eq("feature_id", feature.id).maybeSingle(),
    client.from("subscriptions").select("plan, expires_at").eq("church_id", churchId).in("status", ["active", "trial"]).order("started_at", { ascending: false }).limit(1).maybeSingle(),
  ]);
  if (churchError || subscriptionError || churchFeature?.enabled !== true || !subscription) return false;
  if (subscription.expires_at && new Date(subscription.expires_at) <= new Date()) return false;
  return feature.available_plans.includes(subscription.plan);
}

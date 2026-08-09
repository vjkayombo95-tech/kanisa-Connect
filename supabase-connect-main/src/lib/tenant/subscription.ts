import type { TenantFeatureKey, TenantPlanId, TenantSubscription } from "./types";

export type TenantPlanDefinition = {
  id: TenantPlanId;
  name: string;
  description: string;
  maxChurches: number | null;
  maxMembers: number | null;
  includedFeatures: TenantFeatureKey[];
};

export const TENANT_PLAN_ORDER: TenantPlanId[] = ["free", "starter", "growth", "diocese", "enterprise"];

export const TENANT_PLANS: Record<TenantPlanId, TenantPlanDefinition> = {
  free: {
    id: "free",
    name: "Free",
    description: "Self-service evaluation for a small parish team.",
    maxChurches: 1,
    maxMembers: 50,
    includedFeatures: ["bible", "notifications"],
  },
  starter: {
    id: "starter",
    name: "Starter",
    description: "Core parish operations for a single growing church.",
    maxChurches: 1,
    maxMembers: 250,
    includedFeatures: ["bible", "notifications", "reports", "mass_intentions"],
  },
  growth: {
    id: "growth",
    name: "Growth",
    description: "Full parish engagement with giving, care, ministries, and reporting.",
    maxChurches: 1,
    maxMembers: null,
    includedFeatures: [
      "bible",
      "community_help",
      "finance",
      "mass_intentions",
      "notifications",
      "reports",
      "volunteer_module",
    ],
  },
  diocese: {
    id: "diocese",
    name: "Diocese",
    description: "Multi-parish oversight and shared regional configuration.",
    maxChurches: null,
    maxMembers: null,
    includedFeatures: [
      "bible",
      "community_help",
      "finance",
      "livestream",
      "mass_intentions",
      "notifications",
      "reports",
      "volunteer_module",
    ],
  },
  enterprise: {
    id: "enterprise",
    name: "Enterprise",
    description: "White-label, integration-ready deployment for large networks.",
    maxChurches: null,
    maxMembers: null,
    includedFeatures: [
      "bible",
      "community_help",
      "finance",
      "future_ai",
      "livestream",
      "mass_intentions",
      "notifications",
      "reports",
      "volunteer_module",
    ],
  },
};

export const DEFAULT_TENANT_SUBSCRIPTION: TenantSubscription = {
  plan: "free",
  status: "trial",
  startedAt: null,
  renewsAt: null,
  trialEndsAt: null,
};

export function getTenantPlan(plan: TenantPlanId) {
  return TENANT_PLANS[plan] ?? TENANT_PLANS.free;
}

export function tenantPlanIncludesFeature(plan: TenantPlanId, feature: TenantFeatureKey) {
  return getTenantPlan(plan).includedFeatures.includes(feature);
}

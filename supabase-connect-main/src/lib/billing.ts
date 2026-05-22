export type BillingPlan = "free" | "basic" | "intermediate" | "pro" | "enterprise";
export type BillingStatus = "active" | "trial" | "expired";
export type BillingAddonName = "member_portal";
export type MemberPortalAccess = "full" | "limited" | "none";
export const ENABLE_MEMBER_PORTAL_BILLING = false;

export type BillingFeature =
  | "basic_dashboard"
  | "members"
  | "contributions"
  | "events"
  | "reports"
  | "focus_mode"
  | "typewriter"
  | "sound"
  | "multi_language"
  | "groups"
  | "communication"
  | "analytics"
  | "branding"
  | "api"
  | "multi_branch";

export type SubscriptionRecord = {
  id: string;
  church_id: string;
  plan: BillingPlan;
  status: BillingStatus;
  started_at: string;
  expires_at: string | null;
};

export type AddonRecord = {
  id: string;
  church_id: string;
  addon_name: BillingAddonName;
  purchased: boolean;
  purchased_at: string | null;
};

export type PricingPlan = {
  id: BillingPlan;
  name: string;
  price: number;
  description: string;
  maxMembers: number | null;
  highlighted?: boolean;
  features: string[];
};

export const BILLING_PLAN_ORDER: BillingPlan[] = ["free", "basic", "intermediate", "pro", "enterprise"];

export const BILLING_PLANS: PricingPlan[] = [
  {
    id: "free",
    name: "Free",
    price: 0,
    description: "For small congregations getting started with Kanisa Connect.",
    maxMembers: 50,
    features: ["Basic dashboard", "Up to 50 members"],
  },
  {
    id: "basic",
    name: "Basic",
    price: 50000,
    description: "Core church operations for growing ministries.",
    maxMembers: 150,
    features: ["Members management", "Contributions tracking", "Events", "Basic reports"],
  },
  {
    id: "intermediate",
    name: "Intermediate",
    price: 80000,
    description: "The most balanced plan for a modern, engaging church experience.",
    maxMembers: null,
    highlighted: true,
    features: ["Everything in Basic", "Focus Mode", "Typewriter animations", "Sound system", "Unlimited members"],
  },
  {
    id: "pro",
    name: "Pro",
    price: 120000,
    description: "Communication and insights for multi-ministry churches.",
    maxMembers: null,
    features: ["Everything in Intermediate", "Multi-language support", "Groups & ministries", "Communication system", "Advanced analytics"],
  },
  {
    id: "enterprise",
    name: "Enterprise",
    price: 150000,
    description: "For large churches that need scale, branding, and integrations.",
    maxMembers: null,
    features: ["Everything in Pro", "Custom branding", "Multi-branch support", "API access", "Priority support"],
  },
];

export const BILLING_ADDONS: Array<{
  id: BillingAddonName;
  name: string;
  price: number;
  description: string;
  features: string[];
}> = [
  {
    id: "member_portal",
    name: "Member Portal",
    price: 50000,
    description: "One-time unlock for member login, self-service dashboards, giving history, prayers, and communication.",
    features: [
      "Member login system",
      "Personal dashboard",
      "Contributions history",
      "Prayer requests",
      "Communication features",
    ],
  },
];

const FEATURE_MAP: Record<BillingPlan, BillingFeature[]> = {
  free: ["basic_dashboard"],
  basic: ["members", "contributions", "events", "reports"],
  intermediate: ["focus_mode", "typewriter", "sound"],
  pro: ["multi_language", "groups", "communication", "analytics"],
  enterprise: ["branding", "api", "multi_branch"],
};

export function getPlanDefinition(plan: BillingPlan) {
  return BILLING_PLANS.find((entry) => entry.id === plan) ?? BILLING_PLANS[0];
}

export function hasFeature(plan: BillingPlan, feature: BillingFeature, status: BillingStatus = "active") {
  if (status === "trial") {
    return true;
  }

  const currentPlanIndex = BILLING_PLAN_ORDER.indexOf(plan);

  return BILLING_PLAN_ORDER.some((planId, index) => {
    if (index > currentPlanIndex) {
      return false;
    }

    return FEATURE_MAP[planId].includes(feature);
  });
}

export function getMemberLimit(plan: BillingPlan, status: BillingStatus = "active") {
  if (status === "trial") {
    return null;
  }

  return getPlanDefinition(plan).maxMembers;
}

export function hasAddon(addons: AddonRecord[], addonName: BillingAddonName) {
  return addons.some((addon) => addon.addon_name === addonName && addon.purchased);
}

export function hasMemberPortalAccess(
  plan: BillingPlan,
  addons: AddonRecord[],
  status: BillingStatus = "active",
): MemberPortalAccess {
  if (!ENABLE_MEMBER_PORTAL_BILLING) {
    return "full";
  }

  if (status === "trial") {
    return "full";
  }

  if (hasAddon(addons, "member_portal")) {
    return "full";
  }

  if (plan === "free") {
    return "limited";
  }

  return "none";
}

export function isSubscriptionExpired(subscription: SubscriptionRecord | null) {
  if (!subscription) {
    return false;
  }

  if (subscription.status === "expired") {
    return true;
  }

  if (!subscription.expires_at) {
    return false;
  }

  return new Date(subscription.expires_at).getTime() < Date.now();
}

export function getTrialDaysRemaining(expiresAt: string | null) {
  if (!expiresAt) {
    return 0;
  }

  const remainingMs = new Date(expiresAt).getTime() - Date.now();
  if (remainingMs <= 0) {
    return 0;
  }

  return Math.ceil(remainingMs / (1000 * 60 * 60 * 24));
}

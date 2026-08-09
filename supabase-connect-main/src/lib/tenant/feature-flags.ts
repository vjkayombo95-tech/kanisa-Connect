import { tenantPlanIncludesFeature } from "./subscription";
import type { TenantFeatureFlags, TenantFeatureKey, TenantPlanId } from "./types";

export const TENANT_FEATURE_KEYS: TenantFeatureKey[] = [
  "livestream",
  "community_help",
  "finance",
  "mass_intentions",
  "bible",
  "volunteer_module",
  "notifications",
  "reports",
  "future_ai",
];

export const TENANT_FEATURE_LABELS: Record<TenantFeatureKey, string> = {
  livestream: "Livestream",
  community_help: "Community Help",
  finance: "Finance",
  mass_intentions: "Mass Intentions",
  bible: "Bible",
  volunteer_module: "Volunteer Module",
  notifications: "Notifications",
  reports: "Reports",
  future_ai: "Future AI",
};

export type TenantFeatureOverrides = Partial<Record<TenantFeatureKey, boolean>>;

export function buildTenantFeatureFlags(
  plan: TenantPlanId,
  overrides: TenantFeatureOverrides = {},
): TenantFeatureFlags {
  return TENANT_FEATURE_KEYS.reduce((flags, key) => {
    const hasOverride = typeof overrides[key] === "boolean";

    flags[key] = {
      enabled: hasOverride ? Boolean(overrides[key]) : tenantPlanIncludesFeature(plan, key),
      source: hasOverride ? "tenant_override" : "plan",
    };

    return flags;
  }, {} as TenantFeatureFlags);
}

export function isTenantFeatureEnabled(flags: TenantFeatureFlags, key: TenantFeatureKey) {
  return flags[key]?.enabled ?? false;
}

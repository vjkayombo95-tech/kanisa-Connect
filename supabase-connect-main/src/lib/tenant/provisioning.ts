import { buildTenantBranding } from "./branding";
import { buildTenantFeatureFlags } from "./feature-flags";
import { buildTenantRegionalSettings } from "./regional";
import { DEFAULT_TENANT_SUBSCRIPTION } from "./subscription";
import { buildTenantStorageConfiguration } from "./storage";
import type {
  Tenant,
  TenantNotificationSettings,
  TenantProvisioningInput,
  TenantProvisioningPlan,
  TenantProvisioningStep,
} from "./types";

const PROVISIONING_STEPS: Array<{
  id: TenantProvisioningStep;
  label: string;
  required: boolean;
  readyForAutomation: boolean;
}> = [
  { id: "create_tenant", label: "Create tenant record", required: true, readyForAutomation: false },
  { id: "create_church", label: "Create church metadata", required: true, readyForAutomation: true },
  { id: "prepare_storage", label: "Prepare storage folders", required: true, readyForAutomation: false },
  { id: "create_default_roles", label: "Create default roles", required: true, readyForAutomation: true },
  { id: "register_workspace", label: "Register workspace", required: true, readyForAutomation: true },
  { id: "apply_settings", label: "Apply tenant settings", required: true, readyForAutomation: false },
  { id: "apply_feature_flags", label: "Apply feature flags", required: true, readyForAutomation: false },
  { id: "prepare_calendar", label: "Prepare parish calendar", required: false, readyForAutomation: true },
  { id: "create_default_communities", label: "Create default communities", required: false, readyForAutomation: true },
  { id: "create_default_ministries", label: "Create default ministries", required: false, readyForAutomation: true },
];

const DEFAULT_NOTIFICATION_SETTINGS: TenantNotificationSettings = {
  emailEnabled: false,
  smsEnabled: false,
  pushEnabled: false,
  whatsappEnabled: false,
  senderName: null,
};

function createTenantId(input: TenantProvisioningInput) {
  if (input.tenantId) return input.tenantId;

  const slug = (input.slug || input.churchName)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return slug || crypto.randomUUID();
}

export function createTenantProvisioningPlan(input: TenantProvisioningInput): TenantProvisioningPlan {
  const tenantId = createTenantId(input);

  return {
    tenantId,
    churchName: input.churchName,
    plan: input.plan ?? "free",
    steps: PROVISIONING_STEPS.map((step) => ({ ...step })),
  };
}

export function buildTenantDraft(input: TenantProvisioningInput): Tenant {
  const tenantId = createTenantId(input);
  const plan = input.plan ?? "free";

  return {
    id: tenantId,
    church: {
      churchId: tenantId,
      tenantId,
      name: input.churchName,
      slug: input.slug ?? null,
      code: null,
      email: null,
      phone: null,
      address: null,
    },
    branding: buildTenantBranding({
      primaryColor: input.primaryColor ?? undefined,
    }),
    features: buildTenantFeatureFlags(plan),
    subscription: {
      ...DEFAULT_TENANT_SUBSCRIPTION,
      plan,
    },
    storage: buildTenantStorageConfiguration(tenantId),
    notifications: DEFAULT_NOTIFICATION_SETTINGS,
    regional: buildTenantRegionalSettings({
      country: input.country,
      language: input.language,
      timezone: input.timezone,
      currency: input.currency,
      liturgicalRegion: input.liturgicalRegion,
    }),
  };
}

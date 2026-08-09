export type TenantId = string;
export type ChurchId = string;

export type TenantPlanId = "free" | "starter" | "growth" | "diocese" | "enterprise";

export type TenantFeatureKey =
  | "livestream"
  | "community_help"
  | "finance"
  | "mass_intentions"
  | "bible"
  | "volunteer_module"
  | "notifications"
  | "reports"
  | "future_ai";

export type TenantFeatureState = {
  enabled: boolean;
  source: "plan" | "tenant_override" | "platform_default";
  reason?: string;
};

export type TenantFeatureFlags = Record<TenantFeatureKey, TenantFeatureState>;

export type TenantBranding = {
  logoUrl: string | null;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  parishBannerUrl: string | null;
  appIconUrl: string | null;
  whiteLabelName: string | null;
};

export type TenantStorageConfiguration = {
  bucketPrefix: string;
  churchAssetsPath: string;
  memberAssetsPath: string;
  receiptsPath: string;
  importsPath: string;
};

export type TenantNotificationSettings = {
  emailEnabled: boolean;
  smsEnabled: boolean;
  pushEnabled: boolean;
  whatsappEnabled: boolean;
  senderName: string | null;
};

export type TenantRegionalSettings = {
  country: string;
  language: string;
  timezone: string;
  currency: string;
  dateFormat: string;
  liturgicalRegion: string;
  localHolidayRegion: string | null;
};

export type TenantSubscription = {
  plan: TenantPlanId;
  status: "trial" | "active" | "past_due" | "cancelled" | "expired";
  startedAt: string | null;
  renewsAt: string | null;
  trialEndsAt: string | null;
};

export type TenantChurchMetadata = {
  churchId: ChurchId;
  tenantId: TenantId;
  name: string;
  slug: string | null;
  code: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
};

export type Tenant = {
  id: TenantId;
  church: TenantChurchMetadata;
  branding: TenantBranding;
  features: TenantFeatureFlags;
  subscription: TenantSubscription;
  storage: TenantStorageConfiguration;
  notifications: TenantNotificationSettings;
  regional: TenantRegionalSettings;
};

export type TenantProvisioningInput = {
  tenantId?: TenantId;
  churchName: string;
  slug?: string | null;
  country?: string;
  language?: string;
  timezone?: string;
  currency?: string;
  liturgicalRegion?: string;
  plan?: TenantPlanId;
  primaryColor?: string | null;
  defaultCommunities?: string[];
  defaultMinistries?: string[];
};

export type TenantProvisioningStep =
  | "create_tenant"
  | "create_church"
  | "prepare_storage"
  | "create_default_roles"
  | "register_workspace"
  | "apply_settings"
  | "apply_feature_flags"
  | "prepare_calendar"
  | "create_default_communities"
  | "create_default_ministries";

export type TenantProvisioningPlan = {
  tenantId: TenantId;
  churchName: string;
  plan: TenantPlanId;
  steps: Array<{
    id: TenantProvisioningStep;
    label: string;
    required: boolean;
    readyForAutomation: boolean;
  }>;
};

export type PlatformStatusCheckKey =
  | "configuration_complete"
  | "storage_ready"
  | "branding_complete"
  | "daily_readings_loaded"
  | "bible_available"
  | "notifications_configured";

export type PlatformStatusCheck = {
  key: PlatformStatusCheckKey;
  ok: boolean;
  label: string;
  detail: string;
  severity: "info" | "warning" | "critical";
};

export type PlatformStatus = {
  tenantId: TenantId;
  readyForPilot: boolean;
  readyForProduction: boolean;
  checks: PlatformStatusCheck[];
};

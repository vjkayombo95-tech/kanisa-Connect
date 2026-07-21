export type AppEnvironment = "production" | "staging" | "development" | "test";

const supportedEnvironments: AppEnvironment[] = ["production", "staging", "development", "test"];
const serviceRoleClaims = new Set(["service_role", "supabase_admin"]);
const unsafeKeyFragments = ["placeholder", "your-", "example", "service_role"];

export type EnvironmentDiagnostic = {
  environment: AppEnvironment;
  supabaseProjectRef: string | null;
  expectedProjectRef: string | null;
  hasSupabaseUrl: boolean;
  hasSupabaseKey: boolean;
  usingPublishableKey: boolean;
  requiredVariables: string[];
  optionalVariables: string[];
  storageBuckets: string[];
  featureFlags: string[];
  errors: string[];
  warnings: string[];
};

function projectRefFromUrl(url?: string): string | undefined {
  if (!url) return undefined;

  try {
    const hostname = new URL(url).hostname;
    const match = hostname.match(/^([a-z0-9-]+)\.supabase\.co$/i);
    return match?.[1];
  } catch {
    return undefined;
  }
}

function isLocalDevelopmentSupabaseUrl(url?: string) {
  if (!url) return false;

  try {
    const parsed = new URL(url);
    return parsed.protocol === "http:" && parsed.hostname === "127.0.0.1" && parsed.port === "54321";
  } catch {
    return false;
  }
}

const configuredEnvironment = import.meta.env.VITE_APP_ENV || (import.meta.env.PROD ? "production" : "development");
export const appEnvironment: AppEnvironment = supportedEnvironments.includes(configuredEnvironment as AppEnvironment)
  ? (configuredEnvironment as AppEnvironment)
  : "development";

export const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim();
export const supabasePublishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim();
const configuredAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim();
export const supabaseAnonKey = supabasePublishableKey || configuredAnonKey;
export const supabaseProjectRef = projectRefFromUrl(supabaseUrl);
const isLocalSupabaseUrlAllowed = appEnvironment === "development" && isLocalDevelopmentSupabaseUrl(supabaseUrl);
export const environmentValidationErrors: string[] = [];
export const environmentValidationWarnings: string[] = [];
export const requiredEnvironmentVariables = ["VITE_APP_ENV", "VITE_SUPABASE_URL", "VITE_SUPABASE_ANON_KEY"];
export const optionalEnvironmentVariables = [
  "VITE_SUPABASE_PUBLISHABLE_KEY",
  "VITE_EXPECTED_SUPABASE_PROJECT_REF",
  "VITE_ENABLE_PLEDGE_REALTIME",
];
export const requiredStorageBuckets = [
  "avatars",
  "church-assets",
  "billing-receipts",
  "catholic-content",
  "record-preservation-proofs",
];
export const supportedFeatureFlags = ["VITE_ENABLE_PLEDGE_REALTIME"];

if (!supportedEnvironments.includes(configuredEnvironment as AppEnvironment)) {
  environmentValidationErrors.push("VITE_APP_ENV must be production, staging, development, or test.");
}

if (!supabaseUrl || !supabaseAnonKey) {
  environmentValidationErrors.push("VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY or VITE_SUPABASE_PUBLISHABLE_KEY are required.");
}

if (supabaseUrl && !supabaseProjectRef && !isLocalSupabaseUrlAllowed) {
  environmentValidationErrors.push("VITE_SUPABASE_URL must be an HTTPS <project-ref>.supabase.co URL.");
}

const configuredExpectedProjectRef = import.meta.env.VITE_EXPECTED_SUPABASE_PROJECT_REF?.trim();
const expectedProjectRef = projectRefFromUrl(configuredExpectedProjectRef) ?? configuredExpectedProjectRef;

if ((appEnvironment === "staging" || appEnvironment === "production") && !expectedProjectRef) {
  environmentValidationErrors.push("Expected Supabase project ref is required.");
}

if ((appEnvironment === "staging" || appEnvironment === "production") && expectedProjectRef && supabaseProjectRef && expectedProjectRef !== supabaseProjectRef) {
  environmentValidationErrors.push("The configured Supabase URL does not match VITE_EXPECTED_SUPABASE_PROJECT_REF.");
}

if (supabaseAnonKey && unsafeKeyFragments.some((fragment) => supabaseAnonKey.toLowerCase().includes(fragment))) {
  environmentValidationErrors.push("Supabase client key appears to be a placeholder or unsafe key. Use the anon or publishable client key only.");
}

for (const [name, value] of [
  ["VITE_SUPABASE_ANON_KEY", configuredAnonKey],
  ["VITE_SUPABASE_PUBLISHABLE_KEY", supabasePublishableKey],
] as const) {
  if (value && getJwtRoleClaim(value) && serviceRoleClaims.has(getJwtRoleClaim(value) ?? "")) {
    environmentValidationErrors.push(`${name} contains a service-role key. Service-role keys must never be exposed through Vite client environment variables.`);
  }
}

if (supabasePublishableKey && import.meta.env.VITE_SUPABASE_ANON_KEY?.trim()) {
  environmentValidationWarnings.push("Both VITE_SUPABASE_PUBLISHABLE_KEY and VITE_SUPABASE_ANON_KEY are set; publishable key will be used after both client keys pass safety validation.");
}

if (supabasePublishableKey && !supabasePublishableKey.startsWith("sb_publishable_")) {
  environmentValidationErrors.push("VITE_SUPABASE_PUBLISHABLE_KEY must start with sb_publishable_. Use VITE_SUPABASE_ANON_KEY for legacy anon JWT keys.");
}

if (configuredExpectedProjectRef && configuredExpectedProjectRef !== expectedProjectRef) {
  environmentValidationWarnings.push("VITE_EXPECTED_SUPABASE_PROJECT_REF should contain only the project ref, not the full Supabase URL.");
}

if (appEnvironment === "production" && import.meta.env.DEV) {
  environmentValidationWarnings.push("VITE_APP_ENV is production while Vite is running in development mode.");
}

export const isEnvironmentValid = environmentValidationErrors.length === 0;
export const isStaging = appEnvironment === "staging";

function getJwtRoleClaim(value: string): string | null {
  const [, payload] = value.split(".");
  if (!payload) return null;

  try {
    const decoded = JSON.parse(atob(payload.replace(/-/g, "+").replace(/_/g, "/")));
    return typeof decoded.role === "string" ? decoded.role : null;
  } catch {
    return null;
  }
}

export const environmentDiagnostics: EnvironmentDiagnostic = {
  environment: appEnvironment,
  supabaseProjectRef: supabaseProjectRef ?? null,
  expectedProjectRef: expectedProjectRef ?? null,
  hasSupabaseUrl: !!supabaseUrl,
  hasSupabaseKey: !!supabaseAnonKey,
  usingPublishableKey: !!supabasePublishableKey,
  requiredVariables: requiredEnvironmentVariables,
  optionalVariables: optionalEnvironmentVariables,
  storageBuckets: requiredStorageBuckets,
  featureFlags: supportedFeatureFlags,
  errors: environmentValidationErrors,
  warnings: environmentValidationWarnings,
};

export function logEnvironmentStatus() {
  const details = {
    environment: environmentDiagnostics.environment,
    supabaseProjectRef: environmentDiagnostics.supabaseProjectRef ?? "unavailable",
    usingPublishableKey: environmentDiagnostics.usingPublishableKey,
  };

  if (!isEnvironmentValid) {
    console.error("[Kanisa Connect] Environment configuration rejected", { ...details, errors: environmentValidationErrors });
    return;
  }

  if (import.meta.env.DEV) console.info("[Kanisa Connect] Environment configured", details);

  if (import.meta.env.DEV) {
    environmentValidationWarnings.forEach((warning) => console.warn("[Kanisa Connect]", warning));
  }
}

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

const configuredEnvironment = import.meta.env.VITE_APP_ENV || (import.meta.env.PROD ? "production" : "development");
export const appEnvironment: AppEnvironment = supportedEnvironments.includes(configuredEnvironment as AppEnvironment)
  ? (configuredEnvironment as AppEnvironment)
  : "development";

export const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim();
export const supabasePublishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim();
export const supabaseAnonKey = supabasePublishableKey || import.meta.env.VITE_SUPABASE_ANON_KEY?.trim();
export const supabaseProjectRef = projectRefFromUrl(supabaseUrl);
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

if (supabaseUrl && !supabaseProjectRef) {
  environmentValidationErrors.push("VITE_SUPABASE_URL must be an HTTPS <project-ref>.supabase.co URL.");
}

const expectedProjectRef = import.meta.env.VITE_EXPECTED_SUPABASE_PROJECT_REF?.trim();

if ((appEnvironment === "staging" || appEnvironment === "production") && !expectedProjectRef) {
  environmentValidationErrors.push("Expected Supabase project ref is required.");
}

if (expectedProjectRef && supabaseProjectRef && expectedProjectRef !== supabaseProjectRef) {
  environmentValidationErrors.push("The configured Supabase URL does not match VITE_EXPECTED_SUPABASE_PROJECT_REF.");
}

if (supabaseAnonKey && unsafeKeyFragments.some((fragment) => supabaseAnonKey.toLowerCase().includes(fragment))) {
  environmentValidationErrors.push("Supabase client key appears to be a placeholder or unsafe key. Use the anon or publishable client key only.");
}

if (supabaseAnonKey && getJwtRoleClaim(supabaseAnonKey) && serviceRoleClaims.has(getJwtRoleClaim(supabaseAnonKey) ?? "")) {
  environmentValidationErrors.push("Supabase service-role keys must never be exposed through Vite client environment variables.");
}

if (supabasePublishableKey && import.meta.env.VITE_SUPABASE_ANON_KEY?.trim()) {
  environmentValidationWarnings.push("Both VITE_SUPABASE_PUBLISHABLE_KEY and VITE_SUPABASE_ANON_KEY are set; publishable key will be used.");
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

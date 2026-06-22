export type AppEnvironment = "production" | "staging" | "development" | "test";

const supportedEnvironments: AppEnvironment[] = ["production", "staging", "development", "test"];

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
export const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim();
export const supabaseProjectRef = projectRefFromUrl(supabaseUrl);
export const environmentValidationErrors: string[] = [];
export const environmentValidationWarnings: string[] = [];

if (!supportedEnvironments.includes(configuredEnvironment as AppEnvironment)) {
  environmentValidationErrors.push("VITE_APP_ENV must be production, staging, development, or test.");
}

if (!supabaseUrl || !supabaseAnonKey) {
  environmentValidationErrors.push("VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are required.");
}

if (supabaseUrl && !supabaseProjectRef) {
  environmentValidationErrors.push("VITE_SUPABASE_URL must be an HTTPS <project-ref>.supabase.co URL.");
}

const expectedProjectRef = import.meta.env.VITE_EXPECTED_SUPABASE_PROJECT_REF?.trim();
const productionProjectRef = import.meta.env.VITE_PRODUCTION_SUPABASE_PROJECT_REF?.trim();

if ((appEnvironment === "staging" || appEnvironment === "production") && !expectedProjectRef) {
  environmentValidationErrors.push("VITE_EXPECTED_SUPABASE_PROJECT_REF is required for staging and production builds.");
}

if (expectedProjectRef && supabaseProjectRef && expectedProjectRef !== supabaseProjectRef) {
  environmentValidationErrors.push("The configured Supabase URL does not match VITE_EXPECTED_SUPABASE_PROJECT_REF.");
}

if (appEnvironment === "staging" && productionProjectRef && supabaseProjectRef === productionProjectRef) {
  environmentValidationErrors.push("STAGING is configured to use the production Supabase project.");
}

if (appEnvironment === "production" && productionProjectRef && supabaseProjectRef !== productionProjectRef) {
  environmentValidationErrors.push("PRODUCTION is configured to use a non-production Supabase project.");
}

if ((appEnvironment === "staging" || appEnvironment === "production") && !productionProjectRef) {
  environmentValidationWarnings.push("VITE_PRODUCTION_SUPABASE_PROJECT_REF is not set; cross-environment protection is incomplete.");
}

export const isEnvironmentValid = environmentValidationErrors.length === 0;
export const isStaging = appEnvironment === "staging";

export function logEnvironmentStatus() {
  const details = { environment: appEnvironment, supabaseProjectRef: supabaseProjectRef ?? "unavailable" };
  if (isEnvironmentValid) console.info("[Kanisa Connect] Environment configured", details);
  else console.error("[Kanisa Connect] Environment configuration rejected", { ...details, errors: environmentValidationErrors });
  environmentValidationWarnings.forEach((warning) => console.warn("[Kanisa Connect]", warning));
}

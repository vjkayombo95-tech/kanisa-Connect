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

if ((appEnvironment === "staging" || appEnvironment === "production") && !expectedProjectRef) {
  environmentValidationErrors.push("Expected Supabase project ref is required.");
}

if (expectedProjectRef && supabaseProjectRef && expectedProjectRef !== supabaseProjectRef) {
  environmentValidationErrors.push("The configured Supabase URL does not match VITE_EXPECTED_SUPABASE_PROJECT_REF.");
}

export const isEnvironmentValid = environmentValidationErrors.length === 0;
export const isStaging = appEnvironment === "staging";

export function logEnvironmentStatus() {
  const details = { environment: appEnvironment, supabaseProjectRef: supabaseProjectRef ?? "unavailable" };
  if (!isEnvironmentValid) {
    console.error("[Kanisa Connect] Environment configuration rejected", { ...details, errors: environmentValidationErrors });
    return;
  }
  if (import.meta.env.DEV) console.info("[Kanisa Connect] Environment configured", details);
  if (import.meta.env.DEV) {
    environmentValidationWarnings.forEach((warning) => console.warn("[Kanisa Connect]", warning));
  }
}

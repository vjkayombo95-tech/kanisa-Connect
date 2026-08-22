import { afterEach, describe, expect, it, vi } from "vitest";

const productionProjectRef = "cbaxiiqlzrwvmuplhusm";

async function loadEnvironment({
  dev,
  valid,
}: {
  dev: boolean;
  valid: boolean;
}) {
  vi.resetModules();
  vi.stubEnv("DEV", dev);
  vi.stubEnv("PROD", !dev);
  vi.stubEnv("VITE_APP_ENV", dev ? "development" : "production");
  vi.stubEnv("VITE_SUPABASE_URL", valid ? `https://${productionProjectRef}.supabase.co` : "");
  vi.stubEnv("VITE_SUPABASE_ANON_KEY", valid ? "test-anon-key" : "");
  vi.stubEnv("VITE_EXPECTED_SUPABASE_PROJECT_REF", productionProjectRef);

  return import("@/lib/environment");
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

describe("environment status logging", () => {
  it("allows an informational message for a valid development environment without logging rejection", async () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => undefined);
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const environment = await loadEnvironment({ dev: true, valid: true });

    environment.logEnvironmentStatus();

    expect(environment.isEnvironmentValid).toBe(true);
    expect(info).toHaveBeenCalledWith("[Kanisa Connect] Environment configured", expect.any(Object));
    expect(error).not.toHaveBeenCalled();
  });

  it("does not log a rejection for a valid production environment", async () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => undefined);
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const environment = await loadEnvironment({ dev: false, valid: true });

    environment.logEnvironmentStatus();

    expect(environment.isEnvironmentValid).toBe(true);
    expect(info).not.toHaveBeenCalled();
    expect(error).not.toHaveBeenCalled();
  });

  it("logs a rejection for an invalid development environment", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const environment = await loadEnvironment({ dev: true, valid: false });

    environment.logEnvironmentStatus();

    expect(environment.isEnvironmentValid).toBe(false);
    expect(error).toHaveBeenCalledWith(
      "[Kanisa Connect] Environment configuration rejected",
      expect.objectContaining({ errors: environment.environmentValidationErrors }),
    );
  });

  it("logs a rejection for an invalid production environment", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const environment = await loadEnvironment({ dev: false, valid: false });

    environment.logEnvironmentStatus();

    expect(environment.isEnvironmentValid).toBe(false);
    expect(error).toHaveBeenCalledWith(
      "[Kanisa Connect] Environment configuration rejected",
      expect.objectContaining({ errors: environment.environmentValidationErrors }),
    );
  });
});

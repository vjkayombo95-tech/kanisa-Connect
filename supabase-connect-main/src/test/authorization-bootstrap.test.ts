import { readFile } from "node:fs/promises";
import { describe, expect, it, vi } from "vitest";
import {
  AuthorizationBootstrapError,
  classifyAuthorizationFailure,
  isActiveAuthorizationLoad,
  isTransientAuthorizationFailure,
  runAuthorizationOperation,
  runWithTimeout,
  safeAuthorizationDiagnostic,
} from "@/lib/authorization-bootstrap";

describe("authorization bootstrap resilience", () => {
  it("classifies transient failures separately from definitive failures", () => {
    expect(classifyAuthorizationFailure(new TypeError("Failed to fetch"))).toBe("NETWORK");
    expect(classifyAuthorizationFailure(new AuthorizationBootstrapError("late", "TIMEOUT"))).toBe("TIMEOUT");
    expect(classifyAuthorizationFailure({ message: "permission denied", code: "42501", status: 403 })).toBe("HTTP_AUTH");
    expect(classifyAuthorizationFailure({ message: "database failure", code: "P0001" })).toBe("DATABASE");
    expect(isTransientAuthorizationFailure("NETWORK")).toBe(true);
    expect(isTransientAuthorizationFailure("DATABASE")).toBe(false);
  });

  it("times out and aborts a hanging context request", async () => {
    vi.useFakeTimers();
    let aborted = false;
    const result = runWithTimeout<never>((signal) => new Promise((_, reject) => {
      signal.addEventListener("abort", () => {
        aborted = true;
        reject(new DOMException("Aborted", "AbortError"));
      });
    }), 100);
    const assertion = expect(result).rejects.toMatchObject({ classification: "TIMEOUT" });
    await vi.advanceTimersByTimeAsync(100);
    await assertion;
    expect(aborted).toBe(true);
    vi.useRealTimers();
  });

  it("retries an initial network failure and returns the successful context", async () => {
    const operation = vi.fn()
      .mockRejectedValueOnce(new TypeError("Failed to fetch"))
      .mockResolvedValueOnce({ church_id: "church-1" });
    await expect(runAuthorizationOperation(operation, { retryDelaysMs: [0] }))
      .resolves.toEqual({ church_id: "church-1" });
    expect(operation).toHaveBeenCalledTimes(2);
  });

  it("stops after the bounded number of repeated network failures", async () => {
    const operation = vi.fn().mockRejectedValue(new TypeError("Failed to fetch"));
    await expect(runAuthorizationOperation(operation, { maxAttempts: 3, retryDelaysMs: [0, 0] }))
      .rejects.toMatchObject({ classification: "NETWORK" });
    expect(operation).toHaveBeenCalledTimes(3);
  });

  it("allows only the latest success or failure to control authorization", () => {
    const request1 = 1;
    const request2 = 2;
    const active = request2;
    expect(isActiveAuthorizationLoad(request2, active)).toBe(true);
    expect(isActiveAuthorizationLoad(request1, active)).toBe(false); // old failure after new success
    expect(isActiveAuthorizationLoad(request1, active)).toBe(false); // old success after new failure
  });

  it("emits only safe structured error fields", () => {
    const diagnostic = safeAuthorizationDiagnostic({
      code: "42501", status: 403, access_token: "secret", refresh_token: "secret", message: "sensitive",
    });
    expect(diagnostic).toEqual({ supabaseErrorCode: "42501", httpStatus: 403 });
    expect(JSON.stringify(diagnostic)).not.toContain("secret");
  });

  it("wires deduplication, retry, online recovery, and non-authoritative realtime recovery", async () => {
    const auth = await readFile("src/contexts/AuthContext.tsx", "utf8");
    expect(auth).toContain("inFlightLoadRef.current?.userId === currentUser.id");
    expect(auth).toContain("runAuthorizationOperation");
    expect(auth).toContain('window.addEventListener("online", refreshOnOnline)');
    expect(auth).toContain('status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED"');
    expect(auth).not.toContain("failClosedAuthorization(user.id, churchId)");
    expect(auth).toContain("staleResultIgnored: true");
  });
});

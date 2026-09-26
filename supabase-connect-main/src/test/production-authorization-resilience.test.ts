import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { AuthorizationBootstrapError, classifyAuthorizationFailure, isActiveAuthorizationLoad, isTransientAuthorizationFailure, runAuthorizationOperation, safeAuthorizationDiagnostic } from "@/lib/authorization-bootstrap";
import { getAuthorizationRealtimeStatusAction } from "@/lib/authorization-realtime-lifecycle";

describe("production authorization resilience", () => {
  it.each([
    [new TypeError("Failed to fetch"), true, "NETWORK"],
    [{ message:"TypeError: Failed to fetch",details:"wrapped fetchWithAuth",code:"" },true,"NETWORK"],
    [new Error("NetworkError"),true,"NETWORK"], [new Error("Network request failed"),true,"NETWORK"],
    [new Error("fetch failed"),true,"NETWORK"], [new Error("Load failed"),true,"NETWORK"],
    [new Error("Failed to fetch"),false,"OFFLINE"], [new AuthorizationBootstrapError("late","TIMEOUT"),true,"TIMEOUT"],
    [{message:"denied",status:401},true,"HTTP_AUTH"], [{message:"denied",status:403},true,"HTTP_AUTH"],
    [{message:"permission denied",code:"42501"},true,"DATABASE"],
  ])("classifies %o", (error, online, expected) => expect(classifyAuthorizationFailure(error, online)).toBe(expected));

  it("retries transient failures twice and recovers", async () => {
    const operation=vi.fn().mockRejectedValueOnce(new TypeError("Failed to fetch")).mockRejectedValueOnce(new Error("NetworkError")).mockResolvedValue({church_id:"church-1"});
    await expect(runAuthorizationOperation(operation,{retryDelaysMs:[0,0]})).resolves.toEqual({church_id:"church-1"}); expect(operation).toHaveBeenCalledTimes(3);
  });
  it("stops after bounded transient exhaustion", async () => { const operation=vi.fn().mockRejectedValue(new TypeError("Failed to fetch")); await expect(runAuthorizationOperation(operation,{retryDelaysMs:[0,0]})).rejects.toMatchObject({classification:"NETWORK"}); expect(operation).toHaveBeenCalledTimes(3) });
  it("does not retry definitive failures", async () => { const operation=vi.fn().mockRejectedValue({message:"permission denied",code:"42501"}); await expect(runAuthorizationOperation(operation,{retryDelaysMs:[0,0]})).rejects.toMatchObject({classification:"DATABASE"}); expect(operation).toHaveBeenCalledTimes(1) });
  it("times out and aborts", async () => { vi.useFakeTimers(); let aborted=false; const pending=runAuthorizationOperation<never>((signal)=>new Promise((_,reject)=>signal.addEventListener("abort",()=>{aborted=true;reject(new DOMException("Aborted","AbortError"))})),{maxAttempts:1,timeoutMs:25}); const assertion=expect(pending).rejects.toMatchObject({classification:"TIMEOUT"}); await vi.advanceTimersByTimeAsync(25); await assertion; expect(aborted).toBe(true); vi.useRealTimers() });
  it("accepts only the active success or failure", () => { expect(isActiveAuthorizationLoad(2,2)).toBe(true); expect(isActiveAuthorizationLoad(1,2)).toBe(false) });
  it("emits no sensitive diagnostic values", () => { const value=safeAuthorizationDiagnostic({code:"42501",status:403,access_token:"secret",refresh_token:"secret",profile:{email:"private"}}); expect(value).toEqual({classification:"HTTP_AUTH",code:"42501",status:403}); expect(JSON.stringify(value)).not.toMatch(/secret|private/) });
  it("marks only connectivity classes transient", () => { expect(["NETWORK","OFFLINE","TIMEOUT"].every(value=>isTransientAuthorizationFailure(value as any))).toBe(true); expect(["HTTP_AUTH","DATABASE","INVALID_CONTEXT","UNKNOWN"].some(value=>isTransientAuthorizationFailure(value as any))).toBe(false) });
  it("wires stale guards, dedup, coalescing, advisory realtime and reset invalidation", () => { const source=readFileSync("src/contexts/AuthContext.tsx","utf8"), realtime=readFileSync("src/lib/authorization-realtime-lifecycle.ts","utf8"); expect(source).toContain("++sequence.current"); expect(source).toContain("isActiveAuthorizationLoad"); expect(source).toContain("inFlight.current?.userId"); expect(source).toContain("scheduled.current=setTimeout"); expect(source).toContain('window.addEventListener("online"'); expect(realtime).toContain('"CHANNEL_ERROR"'); expect(realtime).toContain('"TIMED_OUT"'); expect(realtime).toContain('"CLOSED"'); expect(source).toContain("sequence.current+=1"); expect(`${source}\n${realtime}`).not.toMatch(/CHANNEL_ERROR[\s\S]{0,200}clearAuthorization/) });
  it("ignores realtime statuses after cleanup and avoids cleanup-triggered refresh", () => {
    expect(getAuthorizationRealtimeStatusAction("CLOSED", false)).toEqual({ shouldLog: false, level: "default", refreshReason: null });
    expect(getAuthorizationRealtimeStatusAction("CHANNEL_ERROR", false)).toEqual({ shouldLog: false, level: "default", refreshReason: null });
    expect(getAuthorizationRealtimeStatusAction("TIMED_OUT", false)).toEqual({ shouldLog: false, level: "default", refreshReason: null });
  });
  it("keeps normal and duplicate realtime statuses informational", () => {
    const subscribed = getAuthorizationRealtimeStatusAction("SUBSCRIBED", true);
    expect(subscribed).toEqual({ shouldLog: true, level: "info", refreshReason: null });
    expect(getAuthorizationRealtimeStatusAction("SUBSCRIBED", true)).toEqual(subscribed);
    expect(getAuthorizationRealtimeStatusAction("CLOSED", true)).toEqual({ shouldLog: true, level: "info", refreshReason: "REALTIME_CLOSED" });
  });
  it("keeps unexpected realtime failures actionable", () => {
    expect(getAuthorizationRealtimeStatusAction("CHANNEL_ERROR", true)).toEqual({ shouldLog: true, level: "warn", refreshReason: "REALTIME_CHANNEL_ERROR" });
    expect(getAuthorizationRealtimeStatusAction("TIMED_OUT", true)).toEqual({ shouldLog: true, level: "warn", refreshReason: "REALTIME_TIMED_OUT" });
  });
  it("guards realtime callbacks through cleanup and recreates channels when auth user changes", () => {
    const source=readFileSync("src/contexts/AuthContext.tsx","utf8");
    expect(source).toContain('},()=>{if(active)scheduleRefresh("REALTIME_PROFILE")}');
    expect(source).toContain('},()=>{if(active)scheduleRefresh("REALTIME_ROLE")}');
    expect(source).toContain("getAuthorizationRealtimeStatusAction(status,active)");
    expect(source).toContain("return()=>{active=false;void supabase.removeChannel(channel)}");
    expect(source).toContain("},[scheduleRefresh,user]);");
  });
  it("keeps authentication errors separate from authorization connectivity UX", () => { const login=readFileSync("src/pages/auth/LoginPage.tsx","utf8"), route=readFileSync("src/components/auth/ProtectedRoute.tsx","utf8"); expect(login).toContain("authorizationConnectivityIssue"); expect(login).toContain("still signed in"); expect(login).toContain("invalid login credentials"); expect(route).toContain("shared.auth.workspace_access_title"); expect(route).toContain("shared.actions.retry") });
  it("does not introduce forbidden architecture or sensitive logging", () => { const auth=readFileSync("src/contexts/AuthContext.tsx","utf8"); expect(auth).toContain('rpc("get_current_user_context"'); expect(auth).not.toMatch(/church_memberships|multi-church|access_token|refresh_token|password/i) });
});

export type AuthorizationRealtimeDiagnosticLevel = "default" | "info" | "warn";

export type AuthorizationRealtimeStatusAction = {
  shouldLog: boolean;
  level: AuthorizationRealtimeDiagnosticLevel;
  refreshReason: string | null;
};

export function getAuthorizationRealtimeStatusAction(status: string, active: boolean): AuthorizationRealtimeStatusAction {
  if (!active) return { shouldLog: false, level: "default", refreshReason: null };
  if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") return { shouldLog: true, level: "warn", refreshReason: `REALTIME_${status}` };
  if (status === "CLOSED") return { shouldLog: true, level: "info", refreshReason: "REALTIME_CLOSED" };
  if (status === "SUBSCRIBED") return { shouldLog: true, level: "info", refreshReason: null };
  return { shouldLog: true, level: "info", refreshReason: null };
}

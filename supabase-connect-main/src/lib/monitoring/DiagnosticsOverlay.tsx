import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { environmentDiagnostics } from "@/lib/environment";
import { getBufferedMetrics, trackBundleLoadTiming } from "@/lib/monitoring";

export function DiagnosticsOverlay() {
  const [open, setOpen] = useState(false);
  const location = useLocation();
  const queryClient = useQueryClient();
  const { churchId, user, userRole, isSuperAdmin } = useAuth();

  const queryCacheSize = queryClient.getQueryCache().getAll().length;
  const metrics = getBufferedMetrics();
  const bundles = useMemo(() => trackBundleLoadTiming().slice(-5), [open]);

  if (!import.meta.env.DEV) return null;

  return (
    <div className="fixed bottom-3 right-3 z-[100] max-w-sm rounded-lg border border-border bg-background/95 text-xs shadow-lg backdrop-blur">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="w-full px-3 py-2 text-left font-semibold text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
        aria-expanded={open}
        aria-label="Toggle developer diagnostics"
      >
        Diagnostics
      </button>
      {open ? (
        <div className="space-y-2 border-t border-border p-3 text-muted-foreground">
          <p>Environment: {environmentDiagnostics.environment}</p>
          <p>Route: {location.pathname}</p>
          <p>Church: {churchId ?? "none"}</p>
          <p>User: {user?.id ?? "anonymous"}</p>
          <p>Role: {isSuperAdmin ? "super_admin" : userRole ?? "unknown"}</p>
          <p>React Query cache: {queryCacheSize} queries</p>
          <p>Metrics buffered: {metrics.length}</p>
          <p>Feature flags: {environmentDiagnostics.featureFlags.join(", ") || "none"}</p>
          <p>Current workspace: {isSuperAdmin ? "super_admin" : userRole ?? "unresolved"}</p>
          {bundles.length ? (
            <div>
              <p className="font-medium text-foreground">Recent bundles</p>
              <ul className="mt-1 space-y-1">
                {bundles.map((bundle) => (
                  <li key={`${bundle.name}-${bundle.durationMs}`}>
                    {bundle.name}: {bundle.durationMs}ms
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

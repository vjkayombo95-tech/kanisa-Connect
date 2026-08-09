import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Suspense, lazy, useEffect, useState } from "react";
import { BrowserRouter, Navigate, Route, Routes, useLocation } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { useAuth } from "@/contexts/AuthContext";
import { ChurchThemeProvider } from "@/contexts/ChurchThemeContext";
import { RadioPlayerProvider } from "@/contexts/RadioPlayerContext";
import { AppErrorBoundary } from "@/components/AppErrorBoundary";
import { PreviewViewport } from "@/components/PreviewViewport";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Toaster } from "@/components/ui/toaster";
import { isSupabaseConfigured } from "@/integrations/supabase/client";
import { environmentDiagnostics, isStaging } from "@/lib/environment";
import { RoutePerformanceMonitor, createQueryDurationTracker, trackPageLoad } from "@/lib/monitoring";
import { StagingBanner } from "@/components/StagingBanner";
import { markStartupEvent } from "@/lib/startup-diagnostics";

const Index = lazy(() => import("./pages/Index"));
const NotFound = lazy(() => import("./pages/NotFound"));
const LoginPage = lazy(() => import("./pages/auth/LoginPage"));
const ForgotPasswordPage = lazy(() => import("./pages/auth/ForgotPasswordPage"));
const OnboardingPage = lazy(() => import("./pages/auth/OnboardingPage"));
const InvitePage = lazy(() => import("./pages/auth/InvitePage"));
const RegisterPage = lazy(() => import("./pages/auth/RegisterPage"));
const JoinChurchPage = lazy(() => import("./pages/auth/JoinChurchPage"));
const ScanQR = lazy(() => import("./pages/ScanQR"));
const PayPage = lazy(() => import("./pages/PayPage"));
const KanisaAIPlayground = lazy(() => import("./pages/dev/KanisaAIPlayground"));
const AutomationPlayground = lazy(() => import("./pages/dev/AutomationPlayground"));
const BibleLicensesPage = lazy(() => import("./pages/BibleLicensesPage"));

const MemberRoutes = lazy(() => import("./routes/MemberRoutes"));
const StaffRoutes = lazy(() => import("./routes/StaffRoutes"));
const AdminRoutes = lazy(() => import("./routes/AdminRoutes"));
const PastoralRoutes = lazy(() => import("./routes/PastoralRoutes"));
const FinanceRoutes = lazy(() => import("./routes/FinanceRoutes"));
const SuperAdminRoutes = lazy(() => import("./routes/SuperAdminRoutes"));
const KanisaCommandCenter = lazy(() =>
  import("@/components/ai/KanisaCommandCenter").then((module) => ({ default: module.KanisaCommandCenter })),
);

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      gcTime: 15 * 60_000,
      retry: 1,
      refetchOnWindowFocus: false,
      refetchOnReconnect: true,
    },
    mutations: {
      retry: 1,
    },
  },
});

createQueryDurationTracker(queryClient);
trackPageLoad();

function RouteLoadingFallback() {
  return (
    <div className="min-h-screen bg-background px-4 py-8">
      <div className="mx-auto max-w-6xl space-y-5">
        <Skeleton className="h-20 rounded-2xl" />
        <div className="grid gap-4 md:grid-cols-3">
          <Skeleton className="h-36 rounded-2xl" />
          <Skeleton className="h-36 rounded-2xl" />
          <Skeleton className="h-36 rounded-2xl" />
        </div>
        <Skeleton className="h-72 rounded-2xl" />
      </div>
    </div>
  );
}

function StartupRouteMarker() {
  const location = useLocation();

  useEffect(() => {
    markStartupEvent("first_route_rendered", { route: `${location.pathname}${location.search}` });
  }, [location.pathname, location.search]);

  return null;
}

function DeferredGlobalTools() {
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    markStartupEvent("global_tools_defer_started");
    const run = () => {
      setEnabled(true);
      markStartupEvent("global_tools_enabled");
    };

    if ("requestIdleCallback" in window) {
      const handle = window.requestIdleCallback(run, { timeout: 1500 });
      return () => window.cancelIdleCallback(handle);
    }

    const handle = window.setTimeout(run, 800);
    return () => window.clearTimeout(handle);
  }, []);

  if (!enabled) return null;

  return (
    <Suspense fallback={null}>
      <KanisaCommandCenter />
    </Suspense>
  );
}

function LegacyChurchAdminSystemHealthRedirect() {
  const { isSuperAdmin } = useAuth();

  return <Navigate to={isSuperAdmin ? "/super-admin/system-health" : "/church-admin"} replace />;
}

function ChurchAdminWorkspaceRoute() {
  const { isLoading, isSuperAdmin } = useAuth();

  if (!isLoading && isSuperAdmin) {
    return <Navigate to="/super-admin" replace />;
  }

  return (
    <ProtectedRoute requireChurch requireAdmin>
      <AdminRoutes />
    </ProtectedRoute>
  );
}

function AppRoutes() {
  return (
    <Suspense fallback={<RouteLoadingFallback />}>
      <StartupRouteMarker />
      <Routes>
        <Route path="/" element={<Index />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route
          path="/onboarding"
          element={
            <ProtectedRoute>
              <OnboardingPage />
            </ProtectedRoute>
          }
        />
        <Route path="/invite" element={<InvitePage />} />
        <Route path="/invite/:token" element={<InvitePage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/register/:churchCode" element={<RegisterPage />} />
        <Route path="/join-church" element={<JoinChurchPage />} />
        <Route path="/join/:slug" element={<RegisterPage />} />
        <Route path="/scan-qr" element={<ScanQR />} />
        <Route path="/give/:churchSlugOrId" element={<PayPage />} />
        <Route path="/pay" element={<PayPage />} />
        <Route path="/bible-licenses" element={<BibleLicensesPage />} />
        {import.meta.env.DEV ? (
          <>
            <Route
              path="/dev/kanisa-ai"
              element={
                <ProtectedRoute>
                  <KanisaAIPlayground />
                </ProtectedRoute>
              }
            />
            <Route
              path="/dev/automation"
              element={
                <ProtectedRoute>
                  <AutomationPlayground />
                </ProtectedRoute>
              }
            />
          </>
        ) : null}

        <Route
          path="/portal/*"
          element={
            <ProtectedRoute requireChurch>
              <MemberRoutes />
            </ProtectedRoute>
          }
        />
        <Route
          path="/member/*"
          element={
            <ProtectedRoute requireChurch>
              <MemberRoutes />
            </ProtectedRoute>
          }
        />
        <Route
          path="/community/:communityId/*"
          element={
            <ProtectedRoute requireChurch>
              <StaffRoutes />
            </ProtectedRoute>
          }
        />
        <Route
          path="/pastoral/*"
          element={
            <ProtectedRoute requireChurch requireAdmin allowedRoles={["pastor"]}>
              <PastoralRoutes />
            </ProtectedRoute>
          }
        />
        <Route
          path="/finance/*"
          element={
            <ProtectedRoute requireChurch requireAdmin allowedRoles={["treasurer"]}>
              <FinanceRoutes />
            </ProtectedRoute>
          }
        />
        <Route
          path="/church-admin/system-health"
          element={<LegacyChurchAdminSystemHealthRedirect />}
        />
        <Route
          path="/church-admin/*"
          element={<ChurchAdminWorkspaceRoute />}
        />
        <Route
          path="/super-admin/*"
          element={
            <ProtectedRoute requireSuperAdmin>
              <SuperAdminRoutes />
            </ProtectedRoute>
          }
        />

        <Route path="*" element={<NotFound />} />
      </Routes>
    </Suspense>
  );
}

const App = () => {
  useEffect(() => {
    markStartupEvent("app_mounted");
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AppErrorBoundary>
          <div
            className={isStaging
              ? "min-h-screen pt-[var(--staging-banner-height)] [--staging-banner-height:calc(2rem+env(safe-area-inset-top,0px))]"
              : "min-h-screen"}
          >
            <StagingBanner />
            {!isSupabaseConfigured ? (
              <div className="min-h-screen bg-background px-4 py-16">
                <div className="mx-auto max-w-2xl rounded-2xl border border-destructive/20 bg-card p-8 shadow-xl">
                  <p className="text-xs font-semibold uppercase tracking-[0.24em] text-destructive">
                    Setup Required
                  </p>
                  <h1 className="mt-3 text-2xl font-bold font-serif">
                    Supabase connection is missing.
                  </h1>
                  <p className="mt-3 text-sm text-muted-foreground">
                    {environmentDiagnostics.errors.map((error) => <span key={error} className="block">{error}</span>)}
                    {environmentDiagnostics.warnings.map((warning) => <span key={warning} className="block text-amber-600">{warning}</span>)}
                    <span className="mt-3 block">
                      Environment: {environmentDiagnostics.environment}; Supabase project:{" "}
                      {environmentDiagnostics.supabaseProjectRef ?? "unavailable"}.
                    </span>
                  </p>
                  <Button onClick={() => window.location.reload()}>
                    Reload App
                  </Button>
                </div>
              </div>
            ) : (
              <AuthProvider>
                <RadioPlayerProvider>
                  <ChurchThemeProvider>
                    <PreviewViewport>
                      <RoutePerformanceMonitor />
                      <AppRoutes />
                      <DeferredGlobalTools />
                    </PreviewViewport>
                  </ChurchThemeProvider>
                </RadioPlayerProvider>
              </AuthProvider>
            )}
            <Toaster />
          </div>
        </AppErrorBoundary>
      </BrowserRouter>
    </QueryClientProvider>
  );
};

export default App;

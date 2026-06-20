import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Suspense, lazy } from "react";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { ChurchThemeProvider } from "@/contexts/ChurchThemeContext";
import { AppErrorBoundary } from "@/components/AppErrorBoundary";
import { PreviewViewport } from "@/components/PreviewViewport";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { Button } from "@/components/ui/button";
import { Toaster } from "@/components/ui/toaster";
import { isSupabaseConfigured } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";

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

const MemberRoutes = lazy(() => import("./routes/MemberRoutes"));
const StaffRoutes = lazy(() => import("./routes/StaffRoutes"));
const AdminRoutes = lazy(() => import("./routes/AdminRoutes"));
const SuperAdminRoutes = lazy(() => import("./routes/SuperAdminRoutes"));

const queryClient = new QueryClient();

function RouteLoadingFallback() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  );
}

function AppRoutes() {
  return (
    <Suspense fallback={<RouteLoadingFallback />}>
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
        <Route path="/pay" element={<PayPage />} />

        <Route
          path="/portal/*"
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
          path="/church-admin/*"
          element={
            <ProtectedRoute requireChurch requireAdmin>
              <AdminRoutes />
            </ProtectedRoute>
          }
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
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AppErrorBoundary>
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
                  Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY
                </p>
                <Button onClick={() => window.location.reload()}>
                  Reload App
                </Button>
              </div>
            </div>
          ) : (
            <AuthProvider>
              <ChurchThemeProvider>
                <PreviewViewport>
                  <AppRoutes />
                </PreviewViewport>
              </ChurchThemeProvider>
            </AuthProvider>
          )}
          <Toaster />
        </AppErrorBoundary>
      </BrowserRouter>
    </QueryClientProvider>
  );
};

export default App;

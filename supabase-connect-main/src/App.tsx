import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Suspense, lazy } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { ChurchThemeProvider } from "@/contexts/ChurchThemeContext";
import { AppErrorBoundary } from "@/components/AppErrorBoundary";
import { PreviewViewport } from "@/components/PreviewViewport";
import { Button } from "@/components/ui/button";
import { isSupabaseConfigured } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";

// Pages
const Index = lazy(() => import("./pages/Index"));
const NotFound = lazy(() => import("./pages/NotFound"));
const LoginPage = lazy(() => import("./pages/auth/LoginPage"));
const OnboardingPage = lazy(() => import("./pages/auth/OnboardingPage"));
const InvitePage = lazy(() => import("./pages/auth/InvitePage"));
const RegisterPage = lazy(() => import("./pages/auth/RegisterPage"));
const JoinChurchPage = lazy(() => import("./pages/auth/JoinChurchPage"));
const ScanQR = lazy(() => import("./pages/ScanQR"));
const PayPage = lazy(() => import("./pages/PayPage"));

const ChurchAdminLayout = lazy(() =>
  import("./components/church-admin/ChurchAdminLayout").then((module) => ({ default: module.ChurchAdminLayout })),
);
const ChurchDashboard = lazy(() => import("./pages/church-admin/ChurchDashboard"));
const ChurchQRPage = lazy(() => import("./pages/church-admin/ChurchQRPage"));
const AnalyticsAssistantPage = lazy(() => import("./pages/church-admin/AnalyticsAssistantPage"));
const MembersPage = lazy(() => import("./pages/church-admin/MembersPage"));
const ContributionsPage = lazy(() => import("./pages/church-admin/ContributionsPage"));
const PledgesPage = lazy(() => import("./pages/church-admin/PledgesPage"));
const CommunitiesPage = lazy(() => import("./pages/church-admin/CommunitiesPage"));
const MinistriesPage = lazy(() => import("./pages/church-admin/MinistriesPage"));
const FamiliesPage = lazy(() => import("./pages/church-admin/FamiliesPage"));
const EventsPage = lazy(() => import("./pages/church-admin/EventsPage"));
const EventRequestsPage = lazy(() => import("./pages/church-admin/EventRequestsPage"));
const AnnouncementsPage = lazy(() => import("./pages/church-admin/AnnouncementsPage"));
const SermonsPage = lazy(() => import("./pages/church-admin/SermonsPage"));
const BibleVersesPage = lazy(() => import("./pages/church-admin/BibleVersesPage"));
const PrayerRequestsPage = lazy(() => import("./pages/church-admin/PrayerRequestsPage"));
const MassIntentionsPage = lazy(() => import("./pages/church-admin/MassIntentionsPage"));
const CommunityHelpPage = lazy(() => import("./pages/church-admin/CommunityHelpPage"));
const NotificationsPage = lazy(() => import("./pages/church-admin/NotificationsPage"));
const ChannelsPage = lazy(() => import("./pages/church-admin/ChannelsPage"));
const RolesPage = lazy(() => import("./pages/church-admin/RolesPage"));
const SettingsPage = lazy(() => import("./pages/church-admin/SettingsPage"));
const ReportsPage = lazy(() => import("./pages/church-admin/ReportsPage"));
const AnalyticsPage = lazy(() => import("./pages/church-admin/AnalyticsPage"));
const DataImportPage = lazy(() => import("./pages/church-admin/DataImportPage"));
const AuditLogsPage = lazy(() => import("./pages/church-admin/AuditLogsPage"));
const BillingPage = lazy(() => import("./pages/church-admin/BillingPage"));

const PortalLayout = lazy(() =>
  import("./components/portal/PortalLayout").then((module) => ({ default: module.PortalLayout })),
);
const PortalEvents = lazy(() => import("./pages/portal/PortalEvents"));
const PortalHome = lazy(() => import("./pages/portal/PortalHome"));
const PortalSermons = lazy(() => import("./pages/portal/PortalSermons"));
const PortalAnnouncements = lazy(() => import("./pages/portal/PortalAnnouncements"));
const PortalGive = lazy(() => import("./pages/portal/PortalGive"));
const PortalPledges = lazy(() => import("./pages/portal/PortalPledges"));
const PortalPrayerRequests = lazy(() => import("./pages/portal/PortalPrayerRequests"));
const PortalMassIntentions = lazy(() => import("./pages/portal/PortalMassIntentions"));
const PortalCommunityHelp = lazy(() => import("./pages/portal/PortalCommunityHelp"));
const PortalChannels = lazy(() => import("./pages/portal/PortalChannels"));
const EventRequests = lazy(() => import("./pages/portal/EventRequests"));
const MemberDashboard = lazy(() => import("./components/portal/MemberDashboard"));
const PortalDashboard = lazy(() => import("./pages/portal/PortalDashboard"));

const SuperAdminLayout = lazy(() =>
  import("./components/super-admin/SuperAdminLayout").then((module) => ({ default: module.SuperAdminLayout })),
);
const PlatformDashboard = lazy(() => import("./pages/super-admin/PlatformDashboard"));
const ChurchManagement = lazy(() => import("./pages/super-admin/ChurchManagement"));
const SASubscriptionsPage = lazy(() => import("./pages/super-admin/SubscriptionsPage"));
const FeatureManagement = lazy(() => import("./pages/super-admin/FeatureManagement"));
const RevenueAnalytics = lazy(() => import("./pages/super-admin/RevenueAnalytics"));
const SystemLogs = lazy(() => import("./pages/super-admin/SystemLogs"));
const UserActivity = lazy(() => import("./pages/super-admin/UserActivity"));
const PlatformSettingsPage = lazy(() => import("./pages/super-admin/PlatformSettingsPage"));

const CommunityLeaderLayout = lazy(() =>
  import("./components/community-leader/CommunityLeaderLayout").then((module) => ({ default: module.CommunityLeaderLayout })),
);
const CommunityDashboardPage = lazy(() => import("./pages/community-leader/CommunityDashboard"));
const CommunityMembersPage = lazy(() => import("./pages/community-leader/CommunityMembersPage"));
const CommunityContributionsPage = lazy(() => import("./pages/community-leader/CommunityContributionsPage"));
const CommunityPledgesPage = lazy(() => import("./pages/community-leader/CommunityPledgesPage"));
const CommunityReportsPage = lazy(() => import("./pages/community-leader/CommunityReportsPage"));
const CommunityLeadershipPage = lazy(() => import("./pages/community-leader/CommunityLeadershipPage"));
const CommunityChannelsPage = lazy(() => import("./pages/community-leader/CommunityChannelsPage"));

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
        <Route path="/onboarding" element={<OnboardingPage />} />
        <Route path="/invite" element={<InvitePage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/register/:churchCode" element={<RegisterPage />} />
        <Route path="/join-church" element={<JoinChurchPage />} />
        <Route path="/join/:churchCode" element={<JoinChurchPage />} />
        <Route path="/scan-qr" element={<ScanQR />} />
        <Route path="/pay" element={<PayPage />} />

        <Route path="/super-admin" element={<SuperAdminLayout />}>
          <Route index element={<PlatformDashboard />} />
          <Route path="churches" element={<ChurchManagement />} />
          <Route path="subscriptions" element={<SASubscriptionsPage />} />
          <Route path="features" element={<FeatureManagement />} />
          <Route path="revenue" element={<RevenueAnalytics />} />
          <Route path="logs" element={<SystemLogs />} />
          <Route path="activity" element={<UserActivity />} />
          <Route path="settings" element={<PlatformSettingsPage />} />
        </Route>

        <Route path="/church-admin" element={<ChurchAdminLayout />}>
          <Route index element={<ChurchDashboard />} />
          <Route path="qr-payments" element={<ChurchQRPage />} />
          <Route path="members" element={<MembersPage />} />
          <Route path="contributions" element={<ContributionsPage />} />
          <Route path="pledges" element={<PledgesPage />} />
          <Route path="communities" element={<CommunitiesPage />} />
          <Route path="ministries" element={<MinistriesPage />} />
          <Route path="families" element={<FamiliesPage />} />
          <Route path="events" element={<EventsPage />} />
          <Route path="event-requests" element={<EventRequestsPage />} />
          <Route path="announcements" element={<AnnouncementsPage />} />
          <Route path="sermons" element={<SermonsPage />} />
          <Route path="bible-verses" element={<BibleVersesPage />} />
          <Route path="prayer-requests" element={<PrayerRequestsPage />} />
          <Route path="mass-intentions" element={<MassIntentionsPage />} />
          <Route path="community-help" element={<CommunityHelpPage />} />
          <Route path="notifications" element={<NotificationsPage />} />
          <Route path="channels" element={<ChannelsPage />} />
          <Route path="roles" element={<RolesPage />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="reports" element={<ReportsPage />} />
          <Route path="analytics" element={<AnalyticsPage />} />
          <Route path="analytics-assistant" element={<AnalyticsAssistantPage />} />
          <Route path="data-import" element={<DataImportPage />} />
          <Route path="audit-logs" element={<AuditLogsPage />} />
          <Route path="billing" element={<BillingPage />} />
        </Route>

        <Route path="/portal" element={<PortalLayout />}>
          <Route index element={<MemberDashboard />} />
          <Route path="bible-verses" element={<PortalHome />} />
          <Route path="dashboard" element={<PortalDashboard />} />
          <Route path="events" element={<PortalEvents />} />
          <Route path="event-requests" element={<EventRequests />} />
          <Route path="sermons" element={<PortalSermons />} />
          <Route path="announcements" element={<PortalAnnouncements />} />
          <Route path="give" element={<PortalGive />} />
          <Route path="pledges" element={<PortalPledges />} />
          <Route path="prayer-requests" element={<PortalPrayerRequests />} />
          <Route path="mass-intentions" element={<PortalMassIntentions />} />
          <Route path="community-help" element={<PortalCommunityHelp />} />
          <Route path="channels" element={<PortalChannels />} />
        </Route>

        <Route path="/community/:communityId" element={<CommunityLeaderLayout />}>
          <Route index element={<Navigate to="dashboard" replace />} />
          <Route path="dashboard" element={<CommunityDashboardPage />} />
          <Route path="members" element={<CommunityMembersPage />} />
          <Route path="contributions" element={<CommunityContributionsPage />} />
          <Route path="pledges" element={<CommunityPledgesPage />} />
          <Route path="reports" element={<CommunityReportsPage />} />
          <Route path="leadership" element={<CommunityLeadershipPage />} />
          <Route path="channels" element={<CommunityChannelsPage />} />
        </Route>

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
        </AppErrorBoundary>
      </BrowserRouter>
    </QueryClientProvider>
  );
};
export default App;

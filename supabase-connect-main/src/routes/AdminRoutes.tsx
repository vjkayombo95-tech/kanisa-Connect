import { Suspense, lazy } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { Loader2 } from "lucide-react";

import { useFeatureAccess } from "@/hooks/use-feature-access";
import { useChurchPermission } from "@/hooks/use-church-permission";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { startMemberPreview } from "@/lib/member-preview";
import { WorkspaceRouteLayout } from "./WorkspaceRouteLayout";

const ChurchDashboard = lazy(() => import("@/pages/church-admin/ChurchDashboard"));
const FinanceDashboard = lazy(() => import("@/pages/church-admin/FinanceDashboard"));
const PriestDashboard = lazy(() => import("@/pages/church-admin/PriestDashboard"));
const ChurchQRPage = lazy(() => import("@/pages/church-admin/ChurchQRPage"));
const AnalyticsAssistantPage = lazy(() => import("@/pages/church-admin/AnalyticsAssistantPage"));
const KanisaAIHome = lazy(() => import("@/pages/ai/KanisaAIHome"));
const MembersPage = lazy(() => import("@/pages/church-admin/MembersPage"));
const ContributionsPage = lazy(() => import("@/pages/church-admin/ContributionsPage"));
const PledgesPage = lazy(() => import("@/pages/church-admin/PledgesPage"));
const CommunitiesPage = lazy(() => import("@/pages/church-admin/CommunitiesPage"));
const MinistriesPage = lazy(() => import("@/pages/church-admin/MinistriesPage"));
const FamiliesPage = lazy(() => import("@/pages/church-admin/FamiliesPage"));
const EventsPage = lazy(() => import("@/pages/church-admin/EventsPage"));
const EventRegistrationsPage = lazy(() => import("@/pages/church-admin/EventRegistrationsPage"));
const ParishCalendarPage = lazy(() => import("@/pages/portal/ParishCalendarPage"));
const MassSchedulePage = lazy(() => import("@/pages/church-admin/MassSchedulePage"));
const EventRequestsPage = lazy(() => import("@/pages/church-admin/EventRequestsPage"));
const AnnouncementsPage = lazy(() => import("@/pages/church-admin/AnnouncementsPage"));
const SermonsPage = lazy(() => import("@/pages/church-admin/SermonsPage"));
const BibleVersesPage = lazy(() => import("@/pages/church-admin/BibleVersesPage"));
const DailyReadingsPage = lazy(() => import("@/pages/portal/DailyReadingsPage"));
const MemberLibraryPage = lazy(() => import("@/pages/portal/MemberLibraryPage"));
const MemberSaintDetailsPage = lazy(() => import("@/pages/portal/MemberSaintDetailsPage"));
const PortalPrayerPage = lazy(() => import("@/pages/portal/PortalPrayerPage"));
const MemberBibleHomePage = lazy(() => import("@/pages/portal/MemberBibleHomePage"));
const MemberBibleBookPage = lazy(() => import("@/pages/portal/MemberBibleBookPage"));
const MemberBibleChapterPage = lazy(() => import("@/pages/portal/MemberBibleChapterPage"));
const PrayerRequestsPage = lazy(() => import("@/pages/church-admin/PrayerRequestsPage"));
const PrayerLibraryPage = lazy(() => import("@/pages/church-admin/PrayerLibraryPage"));
const MassIntentionsPage = lazy(() => import("@/pages/church-admin/MassIntentionsPage"));
const MassTimetablePage = lazy(() => import("@/pages/church-admin/MassTimetablePage"));
const CommunityHelpPage = lazy(() => import("@/pages/church-admin/CommunityHelpPage"));
const NotificationsPage = lazy(() => import("@/pages/church-admin/NotificationsPage"));
const ChannelsPage = lazy(() => import("@/pages/church-admin/ChannelsPage"));
const RolesPage = lazy(() => import("@/pages/church-admin/RolesPage"));
const SettingsPage = lazy(() => import("@/pages/church-admin/SettingsPage"));
const FeaturesPermissionsPage = lazy(() => import("@/pages/church-admin/FeaturesPermissionsPage"));
const ReportsPage = lazy(() => import("@/pages/church-admin/ReportsPage"));
const AnalyticsPage = lazy(() => import("@/pages/church-admin/AnalyticsPage"));
const DataImportPage = lazy(() => import("@/pages/church-admin/DataImportPage"));
const AuditLogsPage = lazy(() => import("@/pages/church-admin/AuditLogsPage"));
const BillingPage = lazy(() => import("@/pages/church-admin/BillingPage"));
const OperationsPage = lazy(() => import("@/pages/church-admin/OperationsPage"));
const AudioDashboardPage = lazy(() => import("@/pages/church-admin/audio/AudioDashboardPage"));
const AudioJobsPage = lazy(() => import("@/pages/church-admin/audio/AudioJobsPage"));
const AudioUploadPage = lazy(() => import("@/pages/church-admin/audio/AudioUploadPage"));
const AudioReviewPage = lazy(() => import("@/pages/church-admin/audio/AudioReviewPage"));
const AudioSettingsPage = lazy(() => import("@/pages/church-admin/audio/AudioSettingsPage"));
const LivestreamsPage = lazy(() => import("@/pages/church-admin/LivestreamsPage"));

function SectionFallback() {
  return (
    <div className="min-h-[50vh] flex items-center justify-center">
      <Loader2 className="h-6 w-6 animate-spin text-primary" />
    </div>
  );
}

function MemberPreviewRedirect() {
  startMemberPreview();
  return <Navigate to="/portal" replace />;
}

function FeatureProtectedRoute({ children, featureKey }: { children: React.ReactNode; featureKey: string }) {
  const { isFeatureEnabled, isLoading } = useFeatureAccess();

  if (isLoading) return <SectionFallback />;
  if (!isFeatureEnabled(featureKey)) return <Navigate to="/church-admin" replace />;

  return children;
}

function ManagePermissionsRoute() {
  const { allowed, isLoading } = useChurchPermission("feature_permissions_admin", "manage");
  if (isLoading) return <SectionFallback />;
  if (!allowed) return <Card><CardHeader><CardTitle>Access denied</CardTitle><CardDescription>Only a Church Admin with role-management permission can change feature and role controls.</CardDescription></CardHeader></Card>;
  return <FeaturesPermissionsPage />;
}

export default function AdminRoutes() {
  return (
    <Suspense fallback={<SectionFallback />}>
      <Routes>
        <Route element={<WorkspaceRouteLayout workspaceId="church_admin" />}>
          <Route index element={<ChurchDashboard />} />
          <Route path="finance" element={<FinanceDashboard />} />
          <Route path="priest-dashboard" element={<PriestDashboard />} />
          <Route path="qr-payments" element={<ChurchQRPage />} />
          <Route path="members" element={<MembersPage />} />
          <Route path="contributions" element={<ContributionsPage />} />
          <Route path="pledges" element={<PledgesPage />} />
          <Route path="communities" element={<CommunitiesPage />} />
          <Route path="ministries" element={<MinistriesPage />} />
          <Route path="families" element={<FamiliesPage />} />
          <Route path="events" element={<EventsPage />} />
          <Route path="events/:eventId/registrations" element={<EventRegistrationsPage />} />
          <Route path="calendar" element={<ParishCalendarPage workspace="church_admin" />} />
          <Route path="pastoral-calendar" element={<ParishCalendarPage workspace="pastoral" />} />
          <Route path="finance-calendar" element={<ParishCalendarPage workspace="finance" />} />
          <Route path="mass-schedule" element={<MassSchedulePage />} />
          <Route path="event-requests" element={<EventRequestsPage />} />
          <Route path="announcements" element={<AnnouncementsPage />} />
          <Route path="sermons" element={<SermonsPage />} />
          <Route path="bible-verses" element={<BibleVersesPage />} />
          <Route path="daily-readings" element={<DailyReadingsPage />} />
          <Route path="saints" element={<MemberLibraryPage />} />
          <Route path="saints/:saintId" element={<MemberSaintDetailsPage />} />
          <Route path="library/:slug" element={<MemberSaintDetailsPage />} />
          <Route path="prayers/:prayerId" element={<PortalPrayerPage />} />
          <Route path="bible" element={<MemberBibleHomePage />} />
          <Route path="bible/:bookId" element={<MemberBibleBookPage />} />
          <Route path="bible/:bookId/chapter/:chapterNumber" element={<MemberBibleChapterPage />} />
          <Route path="prayer-requests" element={<PrayerRequestsPage />} />
          <Route path="prayers" element={<PrayerLibraryPage />} />
          <Route path="mass-intentions" element={<MassIntentionsPage />} />
          <Route
            path="mass-timetable"
            element={
              <FeatureProtectedRoute featureKey="mass_intentions">
                <MassTimetablePage />
              </FeatureProtectedRoute>
            }
          />
          <Route path="community-help" element={<CommunityHelpPage />} />
          <Route path="notifications" element={<NotificationsPage />} />
          <Route path="channels" element={<ChannelsPage />} />
          <Route path="roles" element={<RolesPage />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="settings/features-permissions" element={<ManagePermissionsRoute />} />
          <Route path="settings/billing" element={<BillingPage />} />
          <Route path="reports" element={<ReportsPage />} />
          <Route path="analytics" element={<AnalyticsPage />} />
          <Route path="analytics-assistant" element={<AnalyticsAssistantPage />} />
          <Route path="finance-intelligence" element={<AnalyticsAssistantPage />} />
          <Route path="kanisa-ai" element={<KanisaAIHome />} />
          <Route path="data-import" element={<DataImportPage />} />
          <Route path="audit-logs" element={<AuditLogsPage />} />
          <Route path="billing" element={<BillingPage />} />
          <Route path="operations" element={<OperationsPage />} />
          <Route path="audio" element={<AudioDashboardPage />} />
          <Route path="audio/jobs" element={<AudioJobsPage />} />
          <Route path="audio/jobs/:id" element={<AudioReviewPage />} />
          <Route path="audio/upload" element={<AudioUploadPage />} />
          <Route path="audio/review/:id" element={<AudioReviewPage />} />
          <Route path="audio/settings" element={<AudioSettingsPage />} />
          <Route path="livestreams" element={<LivestreamsPage />} />
          <Route path="preview-member" element={<MemberPreviewRedirect />} />
        </Route>
      </Routes>
    </Suspense>
  );
}

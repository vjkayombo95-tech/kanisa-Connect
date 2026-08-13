import { Suspense, lazy } from "react";
import { Route, Routes } from "react-router-dom";
import { Loader2 } from "lucide-react";

const ChurchAdminLayout = lazy(() =>
  import("@/components/church-admin/ChurchAdminLayout").then((module) => ({ default: module.ChurchAdminLayout })),
);
const ChurchDashboard = lazy(() => import("@/pages/church-admin/ChurchDashboard"));
const ChurchQRPage = lazy(() => import("@/pages/church-admin/ChurchQRPage"));
const AnalyticsAssistantPage = lazy(() => import("@/pages/church-admin/AnalyticsAssistantPage"));
const MembersPage = lazy(() => import("@/pages/church-admin/MembersPage"));
const ContributionsPage = lazy(() => import("@/pages/church-admin/ContributionsPage"));
const PledgesPage = lazy(() => import("@/pages/church-admin/PledgesPage"));
const CommunitiesPage = lazy(() => import("@/pages/church-admin/CommunitiesPage"));
const MinistriesPage = lazy(() => import("@/pages/church-admin/MinistriesPage"));
const FamiliesPage = lazy(() => import("@/pages/church-admin/FamiliesPage"));
const EventsPage = lazy(() => import("@/pages/church-admin/EventsPage"));
const MassSchedulePage = lazy(() => import("@/pages/church-admin/MassSchedulePage"));
const EventRequestsPage = lazy(() => import("@/pages/church-admin/EventRequestsPage"));
const AnnouncementsPage = lazy(() => import("@/pages/church-admin/AnnouncementsPage"));
const SermonsPage = lazy(() => import("@/pages/church-admin/SermonsPage"));
const BibleVersesPage = lazy(() => import("@/pages/church-admin/BibleVersesPage"));
const PrayerRequestsPage = lazy(() => import("@/pages/church-admin/PrayerRequestsPage"));
const MassIntentionsPage = lazy(() => import("@/pages/church-admin/MassIntentionsPage"));
const CommunityHelpPage = lazy(() => import("@/pages/church-admin/CommunityHelpPage"));
const NotificationsPage = lazy(() => import("@/pages/church-admin/NotificationsPage"));
const ChannelsPage = lazy(() => import("@/pages/church-admin/ChannelsPage"));
const RolesPage = lazy(() => import("@/pages/church-admin/RolesPage"));
const SettingsPage = lazy(() => import("@/pages/church-admin/SettingsPage"));
const ReportsPage = lazy(() => import("@/pages/church-admin/ReportsPage"));
const AnalyticsPage = lazy(() => import("@/pages/church-admin/AnalyticsPage"));
const DataImportPage = lazy(() => import("@/pages/church-admin/DataImportPage"));
const AuditLogsPage = lazy(() => import("@/pages/church-admin/AuditLogsPage"));
const BillingPage = lazy(() => import("@/pages/church-admin/BillingPage"));
const LivestreamsPage = lazy(() => import("@/pages/church-admin/LivestreamsPage"));

function SectionFallback() {
  return (
    <div className="min-h-[50vh] flex items-center justify-center">
      <Loader2 className="h-6 w-6 animate-spin text-primary" />
    </div>
  );
}

export default function AdminRoutes() {
  return (
    <Suspense fallback={<SectionFallback />}>
      <Routes>
        <Route element={<ChurchAdminLayout />}>
          <Route index element={<ChurchDashboard />} />
          <Route path="qr-payments" element={<ChurchQRPage />} />
          <Route path="members" element={<MembersPage />} />
          <Route path="contributions" element={<ContributionsPage />} />
          <Route path="pledges" element={<PledgesPage />} />
          <Route path="communities" element={<CommunitiesPage />} />
          <Route path="ministries" element={<MinistriesPage />} />
          <Route path="families" element={<FamiliesPage />} />
          <Route path="events" element={<EventsPage />} />
          <Route path="mass-schedule" element={<MassSchedulePage />} />
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
          <Route path="settings/billing" element={<BillingPage />} />
          <Route path="reports" element={<ReportsPage />} />
          <Route path="analytics" element={<AnalyticsPage />} />
          <Route path="analytics-assistant" element={<AnalyticsAssistantPage />} />
          <Route path="data-import" element={<DataImportPage />} />
          <Route path="audit-logs" element={<AuditLogsPage />} />
          <Route path="billing" element={<BillingPage />} />
          <Route path="livestreams" element={<LivestreamsPage />} />
        </Route>
      </Routes>
    </Suspense>
  );
}

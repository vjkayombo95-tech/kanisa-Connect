import { Suspense, lazy } from "react";
import { Route, Routes } from "react-router-dom";
import { Loader2 } from "lucide-react";

import { WorkspaceRouteLayout } from "./WorkspaceRouteLayout";

const PlatformDashboard = lazy(() => import("@/pages/super-admin/PlatformDashboard"));
const ChurchManagement = lazy(() => import("@/pages/super-admin/ChurchManagement"));
const SASubscriptionsPage = lazy(() => import("@/pages/super-admin/SubscriptionsPage"));
const BillingVerificationPage = lazy(() => import("@/pages/super-admin/BillingVerificationPage"));
const MemberRecordSubscriptionsPage = lazy(() => import("@/pages/super-admin/MemberRecordSubscriptionsPage"));
const FeatureManagement = lazy(() => import("@/pages/super-admin/FeatureManagement"));
const RevenueAnalytics = lazy(() => import("@/pages/super-admin/RevenueAnalytics"));
const SystemLogs = lazy(() => import("@/pages/super-admin/SystemLogs"));
const AuditLogsPage = lazy(() => import("@/pages/super-admin/AuditLogsPage"));
const SuperAdminSystemLogsPage = lazy(() => import("@/pages/super-admin/SuperAdminSystemLogsPage"));
const SystemHealthPage = lazy(() => import("@/pages/super-admin/SystemHealthPage"));
const SystemJobsPage = lazy(() => import("@/pages/super-admin/SystemJobsPage"));
const JobDetailsPage = lazy(() => import("@/pages/super-admin/JobDetailsPage"));
const JobHistoryPage = lazy(() => import("@/pages/super-admin/JobHistoryPage"));
const UserActivity = lazy(() => import("@/pages/super-admin/UserActivity"));
const PlatformSettingsPage = lazy(() => import("@/pages/super-admin/PlatformSettingsPage"));
const CatholicSaintsPage = lazy(() => import("@/pages/super-admin/CatholicSaintsPage"));
const SuperAdminCatholicDashboard = lazy(() => import("@/pages/super-admin/SuperAdminCatholicDashboard"));
const SuperAdminSaintsPage = lazy(() => import("@/pages/super-admin/SuperAdminSaintsPage"));
const SuperAdminDailyReadingsPage = lazy(() => import("@/pages/super-admin/SuperAdminDailyReadingsPage"));
const SuperAdminPrayerLibraryPage = lazy(() => import("@/pages/super-admin/SuperAdminPrayerLibraryPage"));
const SuperAdminPrayerImportPage = lazy(() => import("@/pages/super-admin/SuperAdminPrayerImportPage"));
const SuperAdminLiturgicalCalendarPage = lazy(() => import("@/pages/super-admin/SuperAdminLiturgicalCalendarPage"));
const SuperAdminImportCenter = lazy(() => import("@/pages/super-admin/SuperAdminImportCenter"));
const BibleTranslationManagerPage = lazy(() => import("@/pages/super-admin/BibleTranslationManagerPage"));
const KanisaAIHome = lazy(() => import("@/pages/ai/KanisaAIHome"));
const RoleServicesPage = lazy(() => import("@/pages/RoleServicesPage"));
const RadioDirectoryPage = lazy(() => import("@/pages/super-admin/RadioDirectoryPage"));

function SectionFallback() {
  return (
    <div className="min-h-[50vh] flex items-center justify-center">
      <Loader2 className="h-6 w-6 animate-spin text-primary" />
    </div>
  );
}

export default function SuperAdminRoutes() {
  return (
    <Suspense fallback={<SectionFallback />}>
      <Routes>
        <Route element={<WorkspaceRouteLayout workspaceId="super_admin" />}>
          <Route index element={<PlatformDashboard />} />
          <Route path="services" element={<RoleServicesPage />} />
          <Route path="churches" element={<ChurchManagement />} />
          <Route path="subscriptions" element={<SASubscriptionsPage />} />
          <Route path="billing-verification" element={<BillingVerificationPage />} />
          <Route path="record-preservation" element={<MemberRecordSubscriptionsPage />} />
          <Route path="features" element={<FeatureManagement />} />
          <Route path="radio" element={<RadioDirectoryPage />} />
          <Route path="revenue" element={<RevenueAnalytics />} />
          <Route path="logs" element={<SystemLogs />} />
          <Route path="audit-logs" element={<AuditLogsPage />} />
          <Route path="system-logs" element={<SuperAdminSystemLogsPage />} />
          <Route path="system-health" element={<SystemHealthPage />} />
          <Route path="system-jobs" element={<SystemJobsPage />} />
          <Route path="system-jobs/:jobId" element={<JobDetailsPage />} />
          <Route path="job-history" element={<JobHistoryPage />} />
          <Route path="catholic-content" element={<SuperAdminCatholicDashboard />} />
          <Route path="catholic-content/saints" element={<SuperAdminSaintsPage />} />
          <Route path="catholic-content/saints/cms" element={<CatholicSaintsPage />} />
          <Route path="catholic-content/daily-readings" element={<SuperAdminDailyReadingsPage />} />
          <Route path="catholic-content/prayer-library" element={<SuperAdminPrayerLibraryPage />} />
          <Route path="catholic-content/prayer-library/import" element={<SuperAdminPrayerImportPage />} />
          <Route path="catholic-content/liturgical-calendar" element={<SuperAdminLiturgicalCalendarPage />} />
          <Route path="catholic-content/import-center" element={<SuperAdminImportCenter />} />
          <Route path="bible-translations" element={<BibleTranslationManagerPage />} />
          <Route path="activity" element={<UserActivity />} />
          <Route path="settings" element={<PlatformSettingsPage />} />
          <Route path="kanisa-ai" element={<KanisaAIHome />} />
        </Route>
      </Routes>
    </Suspense>
  );
}

import { Suspense, lazy } from "react";
import { Route, Routes } from "react-router-dom";

import { Skeleton } from "@/components/ui/skeleton";
import { WorkspaceRouteLayout } from "./WorkspaceRouteLayout";

const FinanceDashboard = lazy(() => import("@/pages/church-admin/FinanceDashboard"));
const ContributionsPage = lazy(() => import("@/pages/church-admin/ContributionsPage"));
const PledgesPage = lazy(() => import("@/pages/church-admin/PledgesPage"));
const CommunityHelpPage = lazy(() => import("@/pages/church-admin/CommunityHelpPage"));
const ReportsPage = lazy(() => import("@/pages/church-admin/ReportsPage"));
const SettingsPage = lazy(() => import("@/pages/church-admin/SettingsPage"));
const AuditLogsPage = lazy(() => import("@/pages/church-admin/AuditLogsPage"));
const AnalyticsAssistantPage = lazy(() => import("@/pages/church-admin/AnalyticsAssistantPage"));
const KanisaAIHome = lazy(() => import("@/pages/ai/KanisaAIHome"));
const ParishCalendarPage = lazy(() => import("@/pages/portal/ParishCalendarPage"));
const DailyReadingsPage = lazy(() => import("@/pages/portal/DailyReadingsPage"));
const MemberLibraryPage = lazy(() => import("@/pages/portal/MemberLibraryPage"));
const MemberSaintDetailsPage = lazy(() => import("@/pages/portal/MemberSaintDetailsPage"));
const MemberBibleHomePage = lazy(() => import("@/pages/portal/MemberBibleHomePage"));
const MemberBibleBookPage = lazy(() => import("@/pages/portal/MemberBibleBookPage"));
const MemberBibleChapterPage = lazy(() => import("@/pages/portal/MemberBibleChapterPage"));

function SectionFallback() {
  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <Skeleton className="h-28 rounded-[28px]" />
      <Skeleton className="h-72 rounded-[28px]" />
    </div>
  );
}

export default function FinanceRoutes() {
  return (
    <Suspense fallback={<SectionFallback />}>
      <Routes>
        <Route element={<WorkspaceRouteLayout workspaceId="finance" />}>
          <Route index element={<FinanceDashboard />} />
          <Route path="dashboard" element={<FinanceDashboard />} />
          <Route path="contributions" element={<ContributionsPage />} />
          <Route path="receipts" element={<ContributionsPage />} />
          <Route path="pledges" element={<PledgesPage />} />
          <Route path="community-help" element={<CommunityHelpPage />} />
          <Route path="calendar" element={<ParishCalendarPage workspace="finance" />} />
          <Route path="daily-readings" element={<DailyReadingsPage />} />
          <Route path="saints" element={<MemberLibraryPage />} />
          <Route path="saints/:saintId" element={<MemberSaintDetailsPage />} />
          <Route path="library/:slug" element={<MemberSaintDetailsPage />} />
          <Route path="bible" element={<MemberBibleHomePage />} />
          <Route path="bible/:bookId" element={<MemberBibleBookPage />} />
          <Route path="bible/:bookId/chapter/:chapterNumber" element={<MemberBibleChapterPage />} />
          <Route path="reports" element={<ReportsPage />} />
          <Route path="finance-intelligence" element={<AnalyticsAssistantPage />} />
          <Route path="kanisa-ai" element={<KanisaAIHome />} />
          <Route path="exports" element={<ReportsPage />} />
          <Route path="audit-logs" element={<AuditLogsPage />} />
          <Route path="settings" element={<SettingsPage />} />
        </Route>
      </Routes>
    </Suspense>
  );
}

import { Suspense, lazy } from "react";
import { Route, Routes } from "react-router-dom";

import { Skeleton } from "@/components/ui/skeleton";
import { WorkspaceRouteLayout } from "./WorkspaceRouteLayout";

const PriestDashboard = lazy(() => import("@/pages/church-admin/PriestDashboard"));
const MassIntentionsPage = lazy(() => import("@/pages/church-admin/MassIntentionsPage"));
const PrayerRequestsPage = lazy(() => import("@/pages/church-admin/PrayerRequestsPage"));
const CommunityHelpPage = lazy(() => import("@/pages/church-admin/CommunityHelpPage"));
const EventsPage = lazy(() => import("@/pages/church-admin/EventsPage"));
const AnnouncementsPage = lazy(() => import("@/pages/church-admin/AnnouncementsPage"));
const ContributionsPage = lazy(() => import("@/pages/church-admin/ContributionsPage"));
const MassSchedulePage = lazy(() => import("@/pages/church-admin/MassSchedulePage"));
const SacramentsPage = lazy(() => import("@/pages/church-admin/SacramentsPage"));
const ParishCalendarPage = lazy(() => import("@/pages/portal/ParishCalendarPage"));
const DailyReadingsPage = lazy(() => import("@/pages/portal/DailyReadingsPage"));
const MemberLibraryPage = lazy(() => import("@/pages/portal/MemberLibraryPage"));
const MemberSaintDetailsPage = lazy(() => import("@/pages/portal/MemberSaintDetailsPage"));
const LiturgicalCalendarPage = lazy(() => import("@/pages/portal/LiturgicalCalendarPage"));
const PortalPrayerPage = lazy(() => import("@/pages/portal/PortalPrayerPage"));
const MemberBibleHomePage = lazy(() => import("@/pages/portal/MemberBibleHomePage"));
const MemberBibleBookPage = lazy(() => import("@/pages/portal/MemberBibleBookPage"));
const MemberBibleChapterPage = lazy(() => import("@/pages/portal/MemberBibleChapterPage"));
const KanisaAIHome = lazy(() => import("@/pages/ai/KanisaAIHome"));
const RoleServicesPage = lazy(() => import("@/pages/RoleServicesPage"));

function SectionFallback() {
  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <Skeleton className="h-28 rounded-[28px]" />
      <Skeleton className="h-72 rounded-[28px]" />
    </div>
  );
}

export default function PastoralRoutes() {
  return (
    <Suspense fallback={<SectionFallback />}>
      <Routes>
        <Route element={<WorkspaceRouteLayout workspaceId="pastoral" />}>
          <Route index element={<PriestDashboard />} />
          <Route path="services" element={<RoleServicesPage />} />
          <Route path="dashboard" element={<PriestDashboard />} />
          <Route path="mass-intentions" element={<MassIntentionsPage />} />
          <Route path="prayer-requests" element={<PrayerRequestsPage />} />
          <Route path="community-help" element={<CommunityHelpPage />} />
          <Route path="calendar" element={<ParishCalendarPage workspace="pastoral" />} />
          <Route path="events" element={<EventsPage />} />
          <Route path="announcements" element={<AnnouncementsPage />} />
          <Route path="liturgy" element={<DailyReadingsPage />} />
          <Route path="daily-readings" element={<DailyReadingsPage />} />
          <Route path="kanisa-ai" element={<KanisaAIHome />} />
          <Route path="bible" element={<MemberBibleHomePage />} />
          <Route path="bible/:bookId" element={<MemberBibleBookPage />} />
          <Route path="bible/:bookId/chapter/:chapterNumber" element={<MemberBibleChapterPage />} />
          <Route path="saints" element={<MemberLibraryPage />} />
          <Route path="saints/:saintId" element={<MemberSaintDetailsPage />} />
          <Route path="library/:slug" element={<MemberSaintDetailsPage />} />
          <Route path="liturgical-calendar" element={<LiturgicalCalendarPage />} />
          <Route path="prayers/:prayerId" element={<PortalPrayerPage />} />
          <Route path="contributions" element={<ContributionsPage />} />
          <Route path="mass-schedule" element={<MassSchedulePage />} />
          <Route path="sacraments" element={<SacramentsPage />} />
        </Route>
      </Routes>
    </Suspense>
  );
}

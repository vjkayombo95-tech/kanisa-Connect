import { Suspense, lazy } from "react";
import { Navigate, Route, Routes } from "react-router-dom";

import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/contexts/AuthContext";
import { isMemberPreviewActive } from "@/lib/member-preview";
import { getDefaultRouteForRoles, isAdminRoles } from "@/lib/role-utils";
import { WorkspaceRouteLayout } from "./WorkspaceRouteLayout";

const PortalEvents = lazy(() => import("@/pages/portal/PortalEvents"));
const ParishCalendarPage = lazy(() => import("@/pages/portal/ParishCalendarPage"));
const PortalHome = lazy(() => import("@/pages/portal/PortalHome"));
const LiturgyHomePage = lazy(() => import("@/pages/portal/LiturgyHomePage"));
const MyParishPage = lazy(() => import("@/pages/portal/MyParishPage"));
const PortalSermons = lazy(() => import("@/pages/portal/PortalSermons"));
const PortalAnnouncements = lazy(() => import("@/pages/portal/PortalAnnouncements"));
const PortalGive = lazy(() => import("@/pages/portal/PortalGive"));
const PortalContributionHistoryPage = lazy(() => import("@/pages/portal/PortalContributionHistoryPage"));
const PortalContributionReceiptPage = lazy(() => import("@/pages/portal/PortalContributionReceiptPage"));
const PortalPledges = lazy(() => import("@/pages/portal/PortalPledges"));
const PortalPrayerRequests = lazy(() => import("@/pages/portal/PortalPrayerRequests"));
const MemberPrayerLibraryPage = lazy(() => import("@/pages/portal/MemberPrayerLibraryPage"));
const MemberPrayerDetailPage = lazy(() => import("@/pages/portal/MemberPrayerDetailPage"));
const PortalReflectionPage = lazy(() => import("@/pages/portal/PortalReflectionPage"));
const PortalMassIntentions = lazy(() => import("@/pages/portal/PortalMassIntentions"));
const PortalMinistries = lazy(() => import("@/pages/portal/PortalMinistries"));
const PortalCommunityHelp = lazy(() => import("@/pages/portal/PortalCommunityHelp"));
const PortalChannels = lazy(() => import("@/pages/portal/PortalChannels"));
const EventRequests = lazy(() => import("@/pages/portal/EventRequests"));
const MemberDashboard = lazy(() => import("@/components/portal/MemberDashboard"));
const PortalDashboard = lazy(() => import("@/pages/portal/PortalDashboard"));
const MemberLibraryPage = lazy(() => import("@/pages/portal/MemberLibraryPage"));
const MemberSaintDetailsPage = lazy(() => import("@/pages/portal/MemberSaintDetailsPage"));
const LiturgicalCalendarPage = lazy(() => import("@/pages/portal/LiturgicalCalendarPage"));
const DailyReadingsPage = lazy(() => import("@/pages/portal/DailyReadingsPage"));
const MemberBibleHomePage = lazy(() => import("@/pages/portal/MemberBibleHomePage"));
const MemberBibleBookPage = lazy(() => import("@/pages/portal/MemberBibleBookPage"));
const MemberBibleChapterPage = lazy(() => import("@/pages/portal/MemberBibleChapterPage"));
const KanisaAssistantPage = lazy(() => import("@/pages/portal/KanisaAssistantPage"));
const MemberServicesPage = lazy(() => import("@/pages/portal/MemberServicesPage"));
const MemberLivestreamPage = lazy(() => import("@/pages/portal/MemberLivestreamPage"));

function SectionFallback() {
  return (
    <div className="min-h-[50vh] px-4 py-6 lg:px-8">
      <div className="mx-auto max-w-5xl space-y-4">
        <Skeleton className="h-28 rounded-[28px]" />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Skeleton className="h-32 rounded-3xl" />
          <Skeleton className="h-32 rounded-3xl" />
          <Skeleton className="h-32 rounded-3xl sm:col-span-2 lg:col-span-1" />
        </div>
      </div>
    </div>
  );
}

function PortalIndexRoute() {
  const { isSuperAdmin, userRoles } = useAuth();

  if ((isSuperAdmin || isAdminRoles(userRoles)) && !isMemberPreviewActive()) {
    return <Navigate to={getDefaultRouteForRoles(userRoles, isSuperAdmin)} replace />;
  }

  return <MemberDashboard />;
}

function PortalDashboardRoute() {
  const { isSuperAdmin, userRoles } = useAuth();

  if ((isSuperAdmin || isAdminRoles(userRoles)) && !isMemberPreviewActive()) {
    return <Navigate to={getDefaultRouteForRoles(userRoles, isSuperAdmin)} replace />;
  }

  return <PortalDashboard />;
}

export default function MemberRoutes() {
  return (
    <Suspense fallback={<SectionFallback />}>
      <Routes>
        <Route element={<WorkspaceRouteLayout workspaceId="member" />}>
          <Route index element={<PortalIndexRoute />} />
          <Route path="services" element={<MemberServicesPage />} />
          <Route path="live/:streamId" element={<MemberLivestreamPage />} />
          <Route path="today" element={<LiturgyHomePage />} />
          <Route path="my-parish" element={<MyParishPage />} />
          <Route path="bible-verses" element={<PortalHome />} />
          <Route path="dashboard" element={<PortalDashboardRoute />} />
          <Route path="events" element={<PortalEvents />} />
          <Route path="calendar" element={<ParishCalendarPage workspace="member" />} />
          <Route path="event-requests" element={<EventRequests />} />
          <Route path="sermons" element={<PortalSermons />} />
          <Route path="announcements" element={<PortalAnnouncements />} />
          <Route path="give" element={<PortalGive />} />
          <Route path="contribution-history" element={<PortalContributionHistoryPage />} />
          <Route path="contribution-receipt/:contributionId" element={<PortalContributionReceiptPage />} />
          <Route path="pledges" element={<PortalPledges />} />
          <Route path="prayer-requests" element={<PortalPrayerRequests />} />
          <Route path="prayers" element={<MemberPrayerLibraryPage />} />
          <Route path="prayers/:slug" element={<MemberPrayerDetailPage />} />
          <Route path="reflections" element={<PortalReflectionPage />} />
          <Route path="reflections/:reflectionId" element={<PortalReflectionPage />} />
          <Route path="mass-intentions" element={<PortalMassIntentions />} />
          <Route path="ministries" element={<PortalMinistries />} />
          <Route path="ministries/:ministryId" element={<PortalMinistries />} />
          <Route path="community-help" element={<PortalCommunityHelp />} />
          <Route path="channels" element={<PortalChannels />} />
          <Route path="library" element={<MemberLibraryPage />} />
          <Route path="library/:slug" element={<MemberSaintDetailsPage />} />
          <Route path="saints/:saintId" element={<MemberSaintDetailsPage />} />
          <Route path="liturgical-calendar" element={<LiturgicalCalendarPage />} />
          <Route path="daily-readings" element={<DailyReadingsPage />} />
          <Route path="kanisa-ai" element={<KanisaAssistantPage />} />
          <Route path="bible" element={<MemberBibleHomePage />} />
          <Route path="bible/:bookId" element={<MemberBibleBookPage />} />
          <Route path="bible/:bookId/chapter/:chapterNumber" element={<MemberBibleChapterPage />} />
        </Route>
      </Routes>
    </Suspense>
  );
}

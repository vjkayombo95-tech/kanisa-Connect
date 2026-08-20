import { Suspense, lazy } from "react";
import { Route, Routes } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { PersistentLivestreamPlayer } from "@/components/portal/PersistentLivestreamPlayer";
import { PersistentLivestreamProvider } from "@/contexts/PersistentLivestreamContext";
import { LiveMediaCoordinatorProvider } from "@/contexts/LiveMediaCoordinator";
import { RadioPlayerProvider } from "@/contexts/RadioPlayerContext";
import { PersistentRadioPlayer } from "@/components/portal/PersistentRadioPlayer";
import { UlizaKanisaFeatureGate } from "@/components/portal/UlizaKanisaFeatureGate";

const PortalLayout = lazy(() =>
  import("@/components/portal/PortalLayout").then((module) => ({ default: module.PortalLayout })),
);
const PortalEvents = lazy(() => import("@/pages/portal/PortalEvents"));
const PortalHome = lazy(() => import("@/pages/portal/PortalHome"));
const PortalSermons = lazy(() => import("@/pages/portal/PortalSermons"));
const PortalAnnouncements = lazy(() => import("@/pages/portal/PortalAnnouncements"));
const PortalGive = lazy(() => import("@/pages/portal/PortalGive"));
const PortalPledges = lazy(() => import("@/pages/portal/PortalPledges"));
const PortalPrayerRequests = lazy(() => import("@/pages/portal/PortalPrayerRequests"));
const PortalMassIntentions = lazy(() => import("@/pages/portal/PortalMassIntentions"));
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
const MemberLivestreamPage = lazy(() => import("@/pages/portal/MemberLivestreamPage"));
const MemberServicesPage = lazy(() => import("@/pages/portal/MemberServicesPage"));
const PortalContributionHistoryPage = lazy(() => import("@/pages/portal/PortalContributionHistoryPage"));
const PortalContributionReceiptPage = lazy(() => import("@/pages/portal/PortalContributionReceiptPage"));
const ReflectionsPage = lazy(() => import("@/pages/portal/ReflectionsPage"));
const ReflectionDetailPage = lazy(() => import("@/pages/portal/ReflectionDetailPage"));
const PrayersPage = lazy(() => import("@/pages/portal/PrayersPage"));
const PrayerDetailPage = lazy(() => import("@/pages/portal/PrayerDetailPage"));
const MemberRadioPage = lazy(() => import("@/pages/portal/MemberRadioPage"));
const ParishCalendarPage = lazy(() => import("@/pages/ParishCalendarPage"));
const KanisaAssistantPage = lazy(() => import("@/pages/portal/KanisaAssistantPage"));

function SectionFallback() {
  return (
    <div className="min-h-[50vh] bg-background px-4 py-8">
      <div className="mx-auto max-w-5xl space-y-4">
        <div className="h-24 animate-pulse rounded-[28px] bg-muted" />
        <div className="grid grid-cols-2 gap-3">
          <div className="h-28 animate-pulse rounded-3xl bg-muted" />
          <div className="h-28 animate-pulse rounded-3xl bg-muted" />
        </div>
        <span className="sr-only"><Loader2 className="h-6 w-6 animate-spin" />Inapakia</span>
      </div>
    </div>
  );
}

export default function MemberRoutes() {
  return (
    <LiveMediaCoordinatorProvider>
    <PersistentLivestreamProvider>
    <RadioPlayerProvider>
      <Suspense fallback={<SectionFallback />}>
        <Routes>
        <Route element={<PortalLayout />}>
          <Route index element={<MemberDashboard />} />
          <Route path="services" element={<MemberServicesPage />} />
          <Route path="kanisa-ai" element={<UlizaKanisaFeatureGate><KanisaAssistantPage /></UlizaKanisaFeatureGate>} />
          <Route path="calendar" element={<ParishCalendarPage workspace="member" />} />
          <Route path="bible-verses" element={<PortalHome />} />
          <Route path="dashboard" element={<PortalDashboard />} />
          <Route path="events" element={<PortalEvents />} />
          <Route path="event-requests" element={<EventRequests />} />
          <Route path="sermons" element={<PortalSermons />} />
          <Route path="announcements" element={<PortalAnnouncements />} />
          <Route path="give" element={<PortalGive />} />
          <Route path="contribution-history" element={<PortalContributionHistoryPage />} />
          <Route path="contribution-receipt/:contributionId" element={<PortalContributionReceiptPage />} />
          <Route path="pledges" element={<PortalPledges />} />
          <Route path="prayer-requests" element={<PortalPrayerRequests />} />
          <Route path="mass-intentions" element={<PortalMassIntentions />} />
          <Route path="community-help" element={<PortalCommunityHelp />} />
          <Route path="channels" element={<PortalChannels />} />
          <Route path="library" element={<MemberLibraryPage />} />
          <Route path="library/:slug" element={<MemberSaintDetailsPage />} />
          <Route path="saints/:saintId" element={<MemberSaintDetailsPage />} />
          <Route path="reflections" element={<ReflectionsPage />} />
          <Route path="reflections/:reflectionId" element={<ReflectionDetailPage />} />
          <Route path="prayers" element={<PrayersPage />} />
          <Route path="prayers/:slug" element={<PrayerDetailPage />} />
          <Route path="liturgical-calendar" element={<LiturgicalCalendarPage />} />
          <Route path="daily-readings" element={<DailyReadingsPage />} />
          <Route path="bible" element={<MemberBibleHomePage />} />
          <Route path="bible/:bookId" element={<MemberBibleBookPage />} />
          <Route path="bible/:bookId/chapter/:chapterNumber" element={<MemberBibleChapterPage />} />
          <Route path="live/:streamId" element={<MemberLivestreamPage />} />
          <Route path="radio" element={<MemberRadioPage />} />
        </Route>
        </Routes>
      </Suspense>
      <PersistentLivestreamPlayer />
      <PersistentRadioPlayer />
    </RadioPlayerProvider>
    </PersistentLivestreamProvider>
    </LiveMediaCoordinatorProvider>
  );
}

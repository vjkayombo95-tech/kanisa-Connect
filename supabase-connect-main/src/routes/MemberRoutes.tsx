import { Suspense, lazy } from "react";
import { Route, Routes } from "react-router-dom";
import { Loader2 } from "lucide-react";

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

function SectionFallback() {
  return (
    <div className="min-h-[50vh] flex items-center justify-center">
      <Loader2 className="h-6 w-6 animate-spin text-primary" />
    </div>
  );
}

export default function MemberRoutes() {
  return (
    <Suspense fallback={<SectionFallback />}>
      <Routes>
        <Route element={<PortalLayout />}>
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
      </Routes>
    </Suspense>
  );
}

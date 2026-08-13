import { Suspense, lazy } from "react";
import { Navigate, Route, Routes, useParams } from "react-router-dom";
import { Loader2 } from "lucide-react";
import StaffServicesPage from "@/pages/StaffServicesPage";
import { getCommunityMobileConfig } from "@/lib/staff-mobile-registry";

const CommunityLeaderLayout = lazy(() =>
  import("@/components/community-leader/CommunityLeaderLayout").then((module) => ({ default: module.CommunityLeaderLayout })),
);
const CommunityDashboardPage = lazy(() => import("@/pages/community-leader/CommunityDashboard"));
const CommunityMembersPage = lazy(() => import("@/pages/community-leader/CommunityMembersPage"));
const CommunityContributionsPage = lazy(() => import("@/pages/community-leader/CommunityContributionsPage"));
const CommunityPledgesPage = lazy(() => import("@/pages/community-leader/CommunityPledgesPage"));
const CommunityReportsPage = lazy(() => import("@/pages/community-leader/CommunityReportsPage"));
const CommunityLeadershipPage = lazy(() => import("@/pages/community-leader/CommunityLeadershipPage"));
const CommunityChannelsPage = lazy(() => import("@/pages/community-leader/CommunityChannelsPage"));

function SectionFallback() {
  return (
    <div className="min-h-[50vh] flex items-center justify-center">
      <Loader2 className="h-6 w-6 animate-spin text-primary" />
    </div>
  );
}

function CommunityServicesRoute() {
  const { communityId } = useParams<{ communityId: string }>();
  return communityId ? <StaffServicesPage config={getCommunityMobileConfig(communityId)} /> : <Navigate to="/portal" replace />;
}

export default function StaffRoutes() {
  return (
    <Suspense fallback={<SectionFallback />}>
      <Routes>
        <Route element={<CommunityLeaderLayout />}>
          <Route index element={<Navigate to="dashboard" replace />} />
          <Route path="dashboard" element={<CommunityDashboardPage />} />
          <Route path="services" element={<CommunityServicesRoute />} />
          <Route path="members" element={<CommunityMembersPage />} />
          <Route path="contributions" element={<CommunityContributionsPage />} />
          <Route path="pledges" element={<CommunityPledgesPage />} />
          <Route path="reports" element={<CommunityReportsPage />} />
          <Route path="leadership" element={<CommunityLeadershipPage />} />
          <Route path="channels" element={<CommunityChannelsPage />} />
        </Route>
      </Routes>
    </Suspense>
  );
}

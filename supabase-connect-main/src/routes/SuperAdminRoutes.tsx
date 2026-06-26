import { Suspense, lazy } from "react";
import { Route, Routes } from "react-router-dom";
import { Loader2 } from "lucide-react";

const SuperAdminLayout = lazy(() =>
  import("@/components/super-admin/SuperAdminLayout").then((module) => ({ default: module.SuperAdminLayout })),
);
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
const UserActivity = lazy(() => import("@/pages/super-admin/UserActivity"));
const PlatformSettingsPage = lazy(() => import("@/pages/super-admin/PlatformSettingsPage"));

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
        <Route element={<SuperAdminLayout />}>
          <Route index element={<PlatformDashboard />} />
          <Route path="churches" element={<ChurchManagement />} />
          <Route path="subscriptions" element={<SASubscriptionsPage />} />
          <Route path="billing-verification" element={<BillingVerificationPage />} />
          <Route path="record-preservation" element={<MemberRecordSubscriptionsPage />} />
          <Route path="features" element={<FeatureManagement />} />
          <Route path="revenue" element={<RevenueAnalytics />} />
          <Route path="logs" element={<SystemLogs />} />
          <Route path="audit-logs" element={<AuditLogsPage />} />
          <Route path="system-logs" element={<SuperAdminSystemLogsPage />} />
          <Route path="system-health" element={<SystemHealthPage />} />
          <Route path="activity" element={<UserActivity />} />
          <Route path="settings" element={<PlatformSettingsPage />} />
        </Route>
      </Routes>
    </Suspense>
  );
}

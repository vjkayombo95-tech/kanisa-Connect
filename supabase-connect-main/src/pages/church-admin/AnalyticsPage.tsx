import { lazy, Suspense, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { LockedFeatureNotice } from "@/components/billing/LockedFeatureNotice";
import { Button } from "@/components/ui/button";
import { BarChart3, Building2, HandCoins } from "lucide-react";
import { StatCard } from "@/components/church-admin/StatCard";
import { formatTZS } from "@/lib/currency";
import { useBillingAccess } from "@/hooks/use-billing-access";
import { useAuth } from "@/contexts/AuthContext";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/page-state";
import type { AnalyticsChartProps } from "./AnalyticsCharts";
import { readOfflineCache, withOfflineCache } from "@/lib/offline-cache";
import { logSupabaseError } from "@/lib/error-logger";
import {
  generateAnalyticsSnapshot,
  getLatestAnalyticsSnapshot,
  type AnalyticsSnapshotRow,
} from "@/lib/analytics-snapshots";

const AnalyticsCharts = lazy(() => import("./AnalyticsCharts"));

type AnalyticsSnapshotPayload = AnalyticsChartProps & {
  thisTotal: number;
  lastTotal: number;
  totalContributions?: number;
  transactionCount: number;
  categoryCount: number;
  overallChange: number;
  activeMembers?: number;
  newMembers?: number;
  pledgeTotals?: {
    pledged: number;
    paid: number;
    balance: number;
  };
  topCategories?: Array<{ name: string; total: number }>;
  monthlyContributions?: Array<{ month: string; amount: number }>;
  recentTrends?: Array<{ date: string; amount: number }>;
  generatedAt: string;
};

export default function AnalyticsPage() {
  const billing = useBillingAccess();
  const { churchId } = useAuth();
  const queryClient = useQueryClient();
  const [showCharts, setShowCharts] = useState(false);
  const snapshotCacheKey = churchId ? `offline-cache:analytics-snapshot:${churchId}` : null;

  const { data: snapshot, isLoading, isError, refetch } = useQuery({
    queryKey: ["analytics-snapshot", churchId],
    queryFn: async () => {
      if (!churchId) return null;
      return withOfflineCache(
        snapshotCacheKey,
        () => getLatestAnalyticsSnapshot<AnalyticsSnapshotPayload>(churchId),
        readOfflineCache(snapshotCacheKey, null as AnalyticsSnapshotRow<AnalyticsSnapshotPayload> | null),
      );
    },
    enabled: !!churchId && billing.hasFeature("analytics"),
  });

  const generateSnapshot = useMutation({
    mutationFn: async () => {
      if (!churchId) throw new Error("No church context");
      return generateAnalyticsSnapshot<AnalyticsSnapshotPayload>(churchId);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["analytics-snapshot", churchId] });
      setShowCharts(true);
    },
    onError: (error) => {
      logSupabaseError(error, {
        page: "Analytics",
        component: "AnalyticsPage",
        function: "generateSnapshot",
        church_id: churchId,
        operation: "rpc",
        rpc: "generate_church_analytics_snapshot",
      });
    },
  });

  const payload = snapshot?.payload;
  const isGrowth = (payload?.overallChange ?? 0) >= 0;
  const hasSnapshot = !!payload;

  const chartPayload = useMemo<AnalyticsChartProps | null>(() => {
    if (!payload) return null;
    return {
      trendData: payload.trendData ?? [],
      jumuiyaData: payload.jumuiyaData ?? [],
      categoryComparison: payload.categoryComparison ?? [],
    };
  }, [payload]);

  if (!billing.isLoading && !billing.hasFeature("analytics")) {
    return (
      <div className="space-y-6 animate-fade-in">
        <div>
          <h1 className="text-2xl font-bold font-serif">Analytics</h1>
          <p className="text-sm text-muted-foreground mt-1">Advanced analytics are locked on your current plan.</p>
        </div>
        <LockedFeatureNotice
          title="Analytics is LOCKED"
          description="Upgrade to Pro or Enterprise to unlock advanced analytics, trends, and comparative reporting."
        />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold font-serif">Analytics</h1>
        <p className="text-sm text-muted-foreground mt-1">Real-time comparative insights</p>
        {snapshot?.generated_at ? (
          <p className="text-xs text-muted-foreground mt-1">
            Snapshot generated {new Date(snapshot.generated_at).toLocaleString()}
          </p>
        ) : null}
        <div className="mt-4 flex flex-wrap gap-2">
          <Button asChild variant="outline">
            <Link to="/church-admin/finance-intelligence">Open Finance Intelligence</Link>
          </Button>
          <Button onClick={() => generateSnapshot.mutate()} disabled={!churchId || generateSnapshot.isPending}>
            {hasSnapshot ? "Refresh analytics" : "Generate analytics"}
          </Button>
          {hasSnapshot && !showCharts ? (
            <Button variant="outline" onClick={() => setShowCharts(true)}>
              View charts
            </Button>
          ) : null}
        </div>
      </div>

      {isLoading ? (
        <LoadingState variant="dashboard" title="Loading analytics summary" />
      ) : isError ? (
        <ErrorState kind="network" onRetry={() => void refetch()} />
      ) : !hasSnapshot ? (
        <EmptyState
          icon={<BarChart3 className="h-6 w-6" aria-hidden="true" />}
          title="No analytics snapshot yet."
          description="Generate analytics to calculate the latest finance summary for this church."
          action={
            <Button onClick={() => generateSnapshot.mutate()} disabled={!churchId || generateSnapshot.isPending}>
              Generate analytics
            </Button>
          }
        />
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <StatCard title="This Month" value={formatTZS(payload.thisTotal)} icon={HandCoins} trend={{ value: Math.round(Math.abs(payload.overallChange)), positive: isGrowth }} />
            <StatCard title="Last Month" value={formatTZS(payload.lastTotal)} icon={HandCoins} />
            <StatCard title="Transactions" value={payload.transactionCount} icon={BarChart3} />
            <StatCard title="Categories" value={payload.categoryCount} icon={Building2} />
          </div>

          {showCharts && chartPayload ? (
            <Suspense fallback={<Skeleton className="h-80 rounded-lg" />}>
              <AnalyticsCharts {...chartPayload} />
            </Suspense>
          ) : null}
        </>
      )}
    </div>
  );
}

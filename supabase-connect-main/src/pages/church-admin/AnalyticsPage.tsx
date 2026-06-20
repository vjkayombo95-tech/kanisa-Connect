import { lazy, Suspense, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { LockedFeatureNotice } from "@/components/billing/LockedFeatureNotice";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BarChart3, Building2, HandCoins } from "lucide-react";
import { StatCard } from "@/components/church-admin/StatCard";
import { formatTZS } from "@/lib/currency";
import { useBillingAccess } from "@/hooks/use-billing-access";
import { useAuth } from "@/contexts/AuthContext";
import { Skeleton } from "@/components/ui/skeleton";
import type { AnalyticsChartProps } from "./AnalyticsCharts";
import { readOfflineCache, withOfflineCache } from "@/lib/offline-cache";
import { assertClientRateLimit } from "@/lib/client-rate-limit";
import { logSupabaseError } from "@/lib/error-logger";

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

type AnalyticsSnapshotRow = {
  id: string;
  snapshot_type: string;
  period_start: string;
  period_end: string;
  payload: AnalyticsSnapshotPayload;
  generated_at: string;
};

export default function AnalyticsPage() {
  const billing = useBillingAccess();
  const { churchId } = useAuth();
  const queryClient = useQueryClient();
  const [showCharts, setShowCharts] = useState(false);
  const snapshotCacheKey = churchId ? `offline-cache:analytics-snapshot:${churchId}` : null;

  const { data: snapshot, isLoading } = useQuery({
    queryKey: ["analytics-snapshot", churchId],
    queryFn: async () => {
      if (!churchId) return null;
      return withOfflineCache(
        snapshotCacheKey,
        async () => {
          const { data, error } = await supabase
            .from("analytics_snapshots" as never)
            .select("id, snapshot_type, period_start, period_end, payload, generated_at")
            .eq("church_id", churchId)
            .eq("snapshot_type", "monthly_overview")
            .order("generated_at", { ascending: false })
            .limit(1)
            .maybeSingle();

          if (error) {
            if (error.message?.includes("analytics_snapshots")) return null;
            throw error;
          }

          return data as unknown as AnalyticsSnapshotRow | null;
        },
        readOfflineCache(snapshotCacheKey, null as AnalyticsSnapshotRow | null),
      );
    },
    enabled: !!churchId && billing.hasFeature("analytics"),
  });

  const generateSnapshot = useMutation({
    mutationFn: async () => {
      if (!churchId) throw new Error("No church context");
      assertClientRateLimit(`analytics-snapshot:${churchId}`, 3, 60 * 60 * 1000, "analytics generations");
      const { data, error } = await supabase.rpc("generate_church_analytics_snapshot" as never, {
        p_church_id: churchId,
      } as never);
      if (error) {
        logSupabaseError(error, {
          page: "Analytics",
          component: "AnalyticsPage",
          function: "generateSnapshot",
          church_id: churchId,
          operation: "rpc",
          rpc: "generate_church_analytics_snapshot",
        });
        throw error;
      }
      return data as unknown as AnalyticsSnapshotRow;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["analytics-snapshot", churchId] });
      setShowCharts(true);
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
            <Link to="/church-admin/analytics-assistant">Open AI Analytics Assistant</Link>
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
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[0, 1, 2, 3].map((item) => <Skeleton key={item} className="h-28 rounded-lg" />)}
        </div>
      ) : !hasSnapshot ? (
        <Card className="glass-card">
          <CardContent className="py-12 text-center text-muted-foreground">
            No analytics snapshot is available yet. Generate analytics to calculate and store the latest summary.
          </CardContent>
        </Card>
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

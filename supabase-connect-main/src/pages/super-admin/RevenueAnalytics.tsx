import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Bar, BarChart, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { CreditCard, DollarSign, HandCoins, TrendingUp, Wallet } from "lucide-react";

import { StatCard } from "@/components/church-admin/StatCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatTZS } from "@/lib/currency";
import { BILLING_PLANS, getPlanDefinition } from "@/lib/billing";
import { supabase } from "@/integrations/supabase/client";

type PlatformFeeRow = {
  id: string;
  created_at: string;
  fee_amount: number;
  gross_amount: number;
  net_amount: number;
  source_type: string;
};

type SubscriptionRow = {
  id: string;
  church_id: string;
  plan: "free" | "basic" | "intermediate" | "pro" | "enterprise";
  status: "active" | "trial" | "expired";
  started_at: string;
};

const REVENUE_SOURCE_LABELS: Record<string, string> = {
  contribution: "Contributions",
  give: "Give",
  prayer_request: "Prayer Requests",
  mass_intention: "Mass Intentions",
  community_help: "Community Help",
  pledge_payment: "Pledges",
  subscription: "Subscriptions",
};

function getMonthKey(dateValue: string) {
  return new Date(dateValue).toLocaleDateString("en-US", { month: "short" });
}

function getMonthRange(months: number) {
  const now = new Date();
  return Array.from({ length: months }, (_, index) => {
    const current = new Date(now.getFullYear(), now.getMonth() - (months - index - 1), 1);
    return current.toLocaleDateString("en-US", { month: "short" });
  });
}

export default function RevenueAnalytics() {
  const { data: platformFees = [], isLoading: feesLoading } = useQuery({
    queryKey: ["sa-platform-fees"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("platform_fees")
        .select("id, created_at, fee_amount, gross_amount, net_amount, source_type")
        .order("created_at", { ascending: false });

      if (error) {
        throw error;
      }

      return (data ?? []) as PlatformFeeRow[];
    },
  });

  const { data: subscriptions = [], isLoading: subscriptionsLoading } = useQuery({
    queryKey: ["sa-subscription-revenue"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("subscriptions")
        .select("id, church_id, plan, status, started_at")
        .order("started_at", { ascending: false });

      if (error) {
        throw error;
      }

      return (data ?? []) as SubscriptionRow[];
    },
  });

  const analytics = useMemo(() => {
    const monthRange = getMonthRange(6);
    const currentMonth = getMonthKey(new Date().toISOString());

    const feeRows = monthRange.map((month) => ({
      month,
      subscriptions: 0,
      fees: 0,
    }));

    const monthIndex = new Map(monthRange.map((month, index) => [month, index]));

    let totalPlatformFees = 0;
    let thisMonthPlatformFees = 0;
    let totalGrossThroughFees = 0;
    const feeBreakdownMap = new Map<string, { source: string; fee: number; gross: number; count: number }>();

    platformFees.forEach((fee) => {
      totalPlatformFees += fee.fee_amount || 0;
      totalGrossThroughFees += fee.gross_amount || 0;

      const feeMonth = getMonthKey(fee.created_at);
      const targetMonthIndex = monthIndex.get(feeMonth);
      if (typeof targetMonthIndex === "number") {
        feeRows[targetMonthIndex].fees += fee.fee_amount || 0;
      }

      if (feeMonth === currentMonth) {
        thisMonthPlatformFees += fee.fee_amount || 0;
      }

      const source = REVENUE_SOURCE_LABELS[fee.source_type] ?? fee.source_type;
      const currentSource = feeBreakdownMap.get(source) ?? { source, fee: 0, gross: 0, count: 0 };
      currentSource.fee += fee.fee_amount || 0;
      currentSource.gross += fee.gross_amount || 0;
      currentSource.count += 1;
      feeBreakdownMap.set(source, currentSource);
    });

    let totalSubscriptionRevenue = 0;
    let thisMonthSubscriptionRevenue = 0;
    const planSummaryMap = new Map<string, { plan: string; churches: number; revenue: number }>();

    subscriptions.forEach((subscription) => {
      const plan = getPlanDefinition(subscription.plan);
      const revenue = plan.price || 0;
      const month = getMonthKey(subscription.started_at);

      totalSubscriptionRevenue += revenue;
      if (month === currentMonth) {
        thisMonthSubscriptionRevenue += revenue;
      }

      const targetMonthIndex = monthIndex.get(month);
      if (typeof targetMonthIndex === "number") {
        feeRows[targetMonthIndex].subscriptions += revenue;
      }

      const currentPlan = planSummaryMap.get(plan.name) ?? { plan: plan.name, churches: 0, revenue: 0 };
      currentPlan.churches += 1;
      currentPlan.revenue += revenue;
      planSummaryMap.set(plan.name, currentPlan);
    });

    return {
      monthlyData: feeRows,
      totalPlatformFees,
      thisMonthPlatformFees,
      totalSubscriptionRevenue,
      thisMonthSubscriptionRevenue,
      totalRevenue: totalPlatformFees + totalSubscriptionRevenue,
      totalGrossThroughFees,
      feeBreakdown: Array.from(feeBreakdownMap.values()).sort((a, b) => b.fee - a.fee),
      planSummary: BILLING_PLANS.map((plan) => planSummaryMap.get(plan.name) ?? { plan: plan.name, churches: 0, revenue: 0 }),
    };
  }, [platformFees, subscriptions]);

  const isLoading = feesLoading || subscriptionsLoading;

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold font-serif">Revenue Analytics</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Money coming into the platform from subscriptions and recorded platform fees.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="This Month Platform Fees"
          value={formatTZS(analytics.thisMonthPlatformFees)}
          icon={HandCoins}
        />
        <StatCard
          title="Total Platform Fees"
          value={formatTZS(analytics.totalPlatformFees)}
          icon={DollarSign}
        />
        <StatCard
          title="Subscription Revenue"
          value={formatTZS(analytics.totalSubscriptionRevenue)}
          icon={CreditCard}
        />
        <StatCard
          title="Total Platform Revenue"
          value={formatTZS(analytics.totalRevenue)}
          icon={TrendingUp}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="text-base font-sans">Revenue Trend</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={analytics.monthlyData}>
                <XAxis dataKey="month" stroke="hsl(220, 10%, 50%)" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis
                  stroke="hsl(220, 10%, 50%)"
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(value) => `${(value / 1000000).toFixed(1)}M`}
                />
                <Tooltip
                  contentStyle={{
                    background: "hsl(224, 18%, 10%)",
                    border: "1px solid hsl(224, 15%, 14%)",
                    borderRadius: "8px",
                    color: "hsl(45, 10%, 93%)",
                  }}
                  formatter={(value: number) => [formatTZS(value)]}
                />
                <Line type="monotone" dataKey="subscriptions" stroke="hsl(40, 92%, 56%)" strokeWidth={2} dot={false} name="Subscriptions" />
                <Line type="monotone" dataKey="fees" stroke="hsl(200, 70%, 50%)" strokeWidth={2} dot={false} name="Platform Fees" />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="text-base font-sans">Revenue per Plan</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={analytics.planSummary}>
                <XAxis dataKey="plan" stroke="hsl(220, 10%, 50%)" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis
                  stroke="hsl(220, 10%, 50%)"
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(value) => `${(value / 1000000).toFixed(1)}M`}
                />
                <Tooltip
                  contentStyle={{
                    background: "hsl(224, 18%, 10%)",
                    border: "1px solid hsl(224, 15%, 14%)",
                    borderRadius: "8px",
                    color: "hsl(45, 10%, 93%)",
                  }}
                  formatter={(value: number) => [formatTZS(value)]}
                />
                <Bar dataKey="revenue" fill="hsl(40, 92%, 56%)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="text-base font-sans">Platform Fee Sources</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {analytics.feeBreakdown.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No platform fee rows have been recorded yet.
              </p>
            ) : (
              analytics.feeBreakdown.map((row) => (
                <div key={row.source} className="rounded-lg border border-border/60 bg-secondary/30 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="font-medium">{row.source}</p>
                      <p className="text-xs text-muted-foreground">{row.count} transaction{row.count === 1 ? "" : "s"}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-primary">{formatTZS(row.fee)}</p>
                      <p className="text-xs text-muted-foreground">from {formatTZS(row.gross)} gross</p>
                    </div>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="text-base font-sans">Platform Income Summary</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-lg border border-border/60 bg-secondary/30 p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <Wallet className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Gross processed through fee-bearing flows</p>
                  <p className="text-xl font-semibold">{formatTZS(analytics.totalGrossThroughFees)}</p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="rounded-lg border border-border/60 bg-background/40 p-4">
                <p className="text-sm text-muted-foreground">This month subscriptions</p>
                <p className="mt-1 text-lg font-semibold">{formatTZS(analytics.thisMonthSubscriptionRevenue)}</p>
              </div>
              <div className="rounded-lg border border-border/60 bg-background/40 p-4">
                <p className="text-sm text-muted-foreground">This month fees</p>
                <p className="mt-1 text-lg font-semibold">{formatTZS(analytics.thisMonthPlatformFees)}</p>
              </div>
            </div>

            <p className="text-xs text-muted-foreground">
              Subscription revenue is calculated from recorded subscription plan entries. Platform fees come from transactions that insert rows into <code>platform_fees</code>, such as prayer requests, mass intentions, community help, and pledge payments when configured.
            </p>
          </CardContent>
        </Card>
      </div>

      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="text-base font-sans">Active Subscribers by Plan</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {analytics.planSummary.map((plan) => (
              <div key={plan.plan} className="text-center p-4 rounded-lg bg-secondary/50">
                <p className="text-2xl font-bold text-primary">{plan.churches}</p>
                <p className="text-sm text-muted-foreground">{plan.plan}</p>
                <p className="text-xs text-muted-foreground/60">{formatTZS(plan.revenue)}</p>
              </div>
            ))}
          </div>
          {isLoading && (
            <p className="mt-4 text-sm text-muted-foreground">Loading revenue data...</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { LockedFeatureNotice } from "@/components/billing/LockedFeatureNotice";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { TrendingUp, TrendingDown, BarChart3, Users, HandCoins, Building2 } from "lucide-react";
import { StatCard } from "@/components/church-admin/StatCard";
import { formatTZS } from "@/lib/currency";
import { useBillingAccess } from "@/hooks/use-billing-access";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, AreaChart, Area } from "recharts";

function startOfMonthIso(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1).toISOString();
}

function nextMonthStartIso(date: Date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 1).toISOString();
}

export default function AnalyticsPage() {
  const billing = useBillingAccess();
  const now = new Date();
  const thisMonthStart = startOfMonthIso(now);
  const nextMonthStart = nextMonthStartIso(now);
  const lastMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lastMonthStart = startOfMonthIso(lastMonthDate);
  const thisMonthBoundary = startOfMonthIso(now);

  const { data: thisMonthContribs = [] } = useQuery({
    queryKey: ["analytics-this-month", thisMonthStart, nextMonthStart],
    queryFn: async () => {
      console.log("START:", thisMonthStart);
      console.log("END:", nextMonthStart);

      const { data, error } = await supabase
        .from("contributions")
        .select("amount, category_id, created_at, contribution_categories!contributions_category_id_fkey(name)")
        .gte("created_at", thisMonthStart)
        .lt("created_at", nextMonthStart);

      console.log("DATA:", data);
      console.log("ANALYTICS THIS MONTH ERROR:", error);

      if (error) return [];
      return data ?? [];
    },
  });

  const { data: lastMonthContribs = [] } = useQuery({
    queryKey: ["analytics-last-month", lastMonthStart, thisMonthBoundary],
    queryFn: async () => {
      console.log("START:", lastMonthStart);
      console.log("END:", thisMonthBoundary);

      const { data, error } = await supabase
        .from("contributions")
        .select("amount, category_id, created_at, contribution_categories!contributions_category_id_fkey(name)")
        .gte("created_at", lastMonthStart)
        .lt("created_at", thisMonthBoundary);

      console.log("DATA:", data);
      console.log("ANALYTICS LAST MONTH ERROR:", error);

      if (error) return [];
      return data ?? [];
    },
  });

  const { data: communities = [] } = useQuery({
    queryKey: ["analytics-communities"],
    queryFn: async () => {
      const { data, error } = await supabase.from("communities").select("id, name");
      if (error) return [];
      return data ?? [];
    },
  });

  const { data: communityMemberCounts = [] } = useQuery({
    queryKey: ["analytics-community-members"],
    queryFn: async () => {
      const { data, error } = await supabase.from("member_communities").select("community_id");
      if (error) return [];
      return data ?? [];
    },
  });

  const { data: trendData = [] } = useQuery({
    queryKey: ["analytics-trend"],
    queryFn: async () => {
      const sixMonthsAgo = new Date();
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

      const { data, error } = await supabase
        .from("contributions")
        .select("amount, created_at")
        .gte("created_at", sixMonthsAgo.toISOString())
        .order("created_at", { ascending: true });

      if (error || !data) {
        console.log("DATA:", data);
        console.log("ANALYTICS TREND ERROR:", error);
        return [];
      }

      const months: Record<string, number> = {};
      data.forEach((contribution: any) => {
        const key = new Date(contribution.created_at).toLocaleDateString("en-US", { month: "short", year: "2-digit" });
        months[key] = (months[key] || 0) + Number(contribution.amount || 0);
      });

      return Object.entries(months).map(([month, amount]) => ({ month, amount }));
    },
  });

  const thisTotal = thisMonthContribs.reduce((sum: number, contribution: any) => sum + Number(contribution.amount || 0), 0);
  const lastTotal = lastMonthContribs.reduce((sum: number, contribution: any) => sum + Number(contribution.amount || 0), 0);
  const overallChange = lastTotal > 0 ? ((thisTotal - lastTotal) / lastTotal) * 100 : 0;
  const isGrowth = overallChange >= 0;

  const thisMonthCategoryIds = [...new Set(thisMonthContribs.map((item: any) => item.category_id).filter(Boolean))];

  const categoryComparison = useMemo(() => {
    const currentTotals: Record<string, number> = {};
    const previousTotals: Record<string, number> = {};

    thisMonthContribs.forEach((contribution: any) => {
      const name = contribution.contribution_categories?.name || "Other";
      currentTotals[name] = (currentTotals[name] || 0) + Number(contribution.amount || 0);
    });

    lastMonthContribs.forEach((contribution: any) => {
      const name = contribution.contribution_categories?.name || "Other";
      previousTotals[name] = (previousTotals[name] || 0) + Number(contribution.amount || 0);
    });

    const names = [...new Set([...Object.keys(currentTotals), ...Object.keys(previousTotals)])];

    return names.map((name) => ({
      name,
      thisMonth: currentTotals[name] || 0,
      lastMonth: previousTotals[name] || 0,
      change: (previousTotals[name] || 0) > 0
        ? (((currentTotals[name] || 0) - (previousTotals[name] || 0)) / (previousTotals[name] || 1)) * 100
        : 0,
    }));
  }, [lastMonthContribs, thisMonthContribs]);

  const jumuiyaData = communities.map((community: any) => ({
    name: community.name,
    members: communityMemberCounts.filter((item: any) => item.community_id === community.id).length,
  }));

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
        <div className="mt-4">
          <Button asChild variant="outline">
            <Link to="/church-admin/analytics-assistant">Open AI Analytics Assistant</Link>
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatCard title="This Month" value={formatTZS(thisTotal)} icon={HandCoins} trend={{ value: Math.round(Math.abs(overallChange)), positive: isGrowth }} />
        <StatCard title="Last Month" value={formatTZS(lastTotal)} icon={HandCoins} />
        <StatCard title="Transactions" value={thisMonthContribs.length} icon={BarChart3} />
        <StatCard title="Categories" value={thisMonthCategoryIds.length} icon={Building2} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="glass-card">
          <CardHeader><CardTitle className="text-base font-sans flex items-center gap-2"><TrendingUp className="h-4 w-4 text-primary" /> Monthly Contribution Trend</CardTitle></CardHeader>
          <CardContent>
            {trendData.length === 0 ? <p className="text-sm text-muted-foreground text-center py-8">No data</p> : (
              <ResponsiveContainer width="100%" height={250}>
                <AreaChart data={trendData}>
                  <defs><linearGradient id="aGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="hsl(40, 92%, 56%)" stopOpacity={0.3} /><stop offset="95%" stopColor="hsl(40, 92%, 56%)" stopOpacity={0} /></linearGradient></defs>
                  <XAxis dataKey="month" stroke="hsl(220, 10%, 50%)" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis stroke="hsl(220, 10%, 50%)" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `${(value / 1000).toFixed(0)}k`} />
                  <Tooltip contentStyle={{ background: "hsl(224, 18%, 10%)", border: "1px solid hsl(224, 15%, 14%)", borderRadius: "8px", color: "hsl(45, 10%, 93%)" }} formatter={(value: number) => [formatTZS(value), "Amount"]} />
                  <Area type="monotone" dataKey="amount" stroke="hsl(40, 92%, 56%)" fill="url(#aGrad)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card className="glass-card">
          <CardHeader><CardTitle className="text-base font-sans flex items-center gap-2"><Users className="h-4 w-4 text-primary" /> Jumuiya Membership</CardTitle></CardHeader>
          <CardContent>
            {jumuiyaData.length === 0 ? <p className="text-sm text-muted-foreground text-center py-8">No data</p> : (
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={jumuiyaData}>
                  <XAxis dataKey="name" stroke="hsl(220, 10%, 50%)" fontSize={11} tickLine={false} axisLine={false} />
                  <YAxis stroke="hsl(220, 10%, 50%)" fontSize={12} tickLine={false} axisLine={false} />
                  <Tooltip contentStyle={{ background: "hsl(224, 18%, 10%)", border: "1px solid hsl(224, 15%, 14%)", borderRadius: "8px", color: "hsl(45, 10%, 93%)" }} />
                  <Bar dataKey="members" fill="hsl(40, 92%, 56%)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="glass-card">
        <CardHeader><CardTitle className="text-base font-sans flex items-center gap-2"><BarChart3 className="h-4 w-4 text-primary" /> Category Comparison (This Month vs Last Month)</CardTitle></CardHeader>
        <CardContent>
          {categoryComparison.length === 0 ? <p className="text-sm text-muted-foreground text-center py-8">No data</p> : (
            <div className="space-y-3">
              {categoryComparison.map((category) => (
                <div key={category.name} className="flex items-center justify-between p-3 rounded-lg bg-secondary/50">
                  <div>
                    <p className="text-sm font-medium">{category.name}</p>
                    <p className="text-xs text-muted-foreground">Last: {formatTZS(category.lastMonth)} to This: {formatTZS(category.thisMonth)}</p>
                  </div>
                  <Badge variant="outline" className={category.change >= 0 ? "text-success border-success/30" : "text-destructive border-destructive/30"}>
                    {category.change >= 0 ? <TrendingUp className="mr-1 h-3 w-3" /> : <TrendingDown className="mr-1 h-3 w-3" />}
                    {Math.abs(Math.round(category.change))}%
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

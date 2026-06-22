import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { StatCard } from "@/components/church-admin/StatCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Building2, Users, HandCoins, CreditCard, TrendingUp, Activity, Clock } from "lucide-react";
import { formatTZS } from "@/lib/currency";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";

type PlatformDashboardMetrics = {
  church_count: number;
  member_count: number;
  contribution_total: number;
  subscription_count: number;
  monthly_revenue: Array<{ month: string; revenue: number }>;
  recent_churches: Array<{ id: string; name: string; code: string | null; email: string | null; created_at: string }>;
  recent_activity: Array<{ id: string; action: string; detail: string | null; entity_type: string | null; created_at: string }>;
};

export default function PlatformDashboard() {
  const { data: metrics } = useQuery({
    queryKey: ["sa-dashboard-metrics"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_platform_dashboard_metrics" as never);
      if (error) throw error;
      return data as unknown as PlatformDashboardMetrics;
    },
    staleTime: 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const churchCount = metrics?.church_count ?? 0;
  const memberCount = metrics?.member_count ?? 0;
  const contributionsTotal = Number(metrics?.contribution_total ?? 0);
  const subCount = metrics?.subscription_count ?? 0;
  const revenueData = metrics?.monthly_revenue ?? [];
  const recentChurches = metrics?.recent_churches ?? [];
  const recentLogs = metrics?.recent_activity ?? [];

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold font-serif">Platform Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-1">Overview of the Kanisa Connect platform</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Total Churches" value={churchCount} icon={Building2} />
        <StatCard title="Total Members" value={memberCount} icon={Users} />
        <StatCard title="Total Contributions" value={formatTZS(contributionsTotal)} icon={HandCoins} />
        <StatCard title="Subscriptions" value={subCount} icon={CreditCard} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="glass-card lg:col-span-2">
          <CardHeader><CardTitle className="text-base font-sans flex items-center gap-2"><TrendingUp className="h-4 w-4 text-primary" /> Monthly Revenue</CardTitle></CardHeader>
          <CardContent>
            {revenueData.length === 0 ? (
              <div className="flex items-center justify-center h-[260px] text-sm text-muted-foreground">No revenue data yet.</div>
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <AreaChart data={revenueData}>
                  <defs>
                    <linearGradient id="goldGradSA" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(40, 92%, 56%)" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="hsl(40, 92%, 56%)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="month" stroke="hsl(220, 10%, 50%)" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis stroke="hsl(220, 10%, 50%)" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(v) => `${(v / 1000000).toFixed(1)}M`} />
                  <Tooltip contentStyle={{ background: "hsl(224, 18%, 10%)", border: "1px solid hsl(224, 15%, 14%)", borderRadius: "8px", color: "hsl(45, 10%, 93%)" }} formatter={(v: number) => [formatTZS(v), "Revenue"]} />
                  <Area type="monotone" dataKey="revenue" stroke="hsl(40, 92%, 56%)" fill="url(#goldGradSA)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card className="glass-card">
          <CardHeader><CardTitle className="text-base font-sans flex items-center gap-2"><Activity className="h-4 w-4 text-primary" /> Recent Activity</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {recentLogs.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">No recent activity.</p>
            ) : recentLogs.map((l: any) => (
              <div key={l.id} className="flex gap-3 items-start">
                <div className="h-2 w-2 rounded-full bg-primary mt-2 shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{l.action}</p>
                  <p className="text-xs text-muted-foreground">{l.detail || l.entity_type}</p>
                  <p className="text-xs text-muted-foreground/60">{new Date(l.created_at).toLocaleString()}</p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card className="glass-card">
        <CardHeader><CardTitle className="text-base font-sans flex items-center gap-2"><Clock className="h-4 w-4 text-primary" /> Recent Church Registrations</CardTitle></CardHeader>
        <CardContent>
          {recentChurches.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">No churches registered yet.</p>
          ) : (
            <div className="space-y-3">
              {recentChurches.map((c: any) => (
                <div key={c.id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                  <div>
                    <p className="text-sm font-medium">{c.name}</p>
                    <p className="text-xs text-muted-foreground">{c.code} • {c.email}</p>
                  </div>
                  <p className="text-xs text-muted-foreground">{new Date(c.created_at).toLocaleDateString()}</p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
